import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountRole, Prisma, VerificationKind } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { requiredText } from './request-validation';
import { ObjectStorageService } from './object-storage.service';

const summary = { id: true, kind: true, status: true, legalName: true, businessName: true, registrationNumber: true, contactPhone: true, contactEmail: true, createdAt: true, reviewedAt: true, reviewNote: true, documents: { select: { id: true, kind: true } } } satisfies Prisma.VerificationSubmissionSelect;
function document(value: unknown, kind: string, allowPdf = false) {
  if (typeof value !== 'string' || value.length > 1400000) throw new BadRequestException(`${kind} must be at most 1 MB`);
  const match = /^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || (!allowPdf && match[1] === 'application/pdf')) throw new BadRequestException(`Choose a valid ${kind} file`);
  const data = Buffer.from(match[2], 'base64');
  if (!data.length || data.length > 1048576 || data.toString('base64') !== match[2]) throw new BadRequestException(`Invalid ${kind} file`);
  const jpeg = data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  const png = data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const webp = data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP';
  const pdf = data.toString('ascii', 0, 5) === '%PDF-';
  if ((match[1] === 'image/jpeg' && !jpeg) || (match[1] === 'image/png' && !png) || (match[1] === 'image/webp' && !webp) || (match[1] === 'application/pdf' && !pdf)) throw new BadRequestException(`Invalid ${kind} file`);
  return { kind, mimeType: match[1], data };
}
@Injectable()
export class VerificationService {
  constructor(private readonly db: PrismaService, private readonly storage: ObjectStorageService) {}
  async mine(providerId: string) {
    const profile = await this.db.profile.findUniqueOrThrow({ where: { userId: providerId }, select: { verificationTier: true } });
    const submission = await this.db.verificationSubmission.findFirst({ where: { providerId }, select: summary, orderBy: { createdAt: 'desc' } });
    return { tier: profile.verificationTier, submission };
  }
  async submit(providerId: string, role: AccountRole, body: any) {
    if (body?.kind !== 'Individual' && body?.kind !== 'Business') throw new BadRequestException('Choose individual or business verification');
    const kind: VerificationKind = body.kind;
    if (role === 'client' && kind !== 'Individual') throw new ForbiddenException('Business verification is available to providers only');
    const legalName = kind === 'Individual' ? requiredText(body?.legalName, 'your full legal name', 100) : null;
    const businessName = kind === 'Business' ? requiredText(body?.businessName, 'your registered business name', 120) : null;
    const registrationNumber = kind === 'Business' && body?.registrationNumber ? requiredText(body.registrationNumber, 'a registration number', 100) : null;
    const documents = kind === 'Individual' ? [document(body?.identityDocument, 'Identity document', true), ...(body?.profilePhoto ? [document(body.profilePhoto, 'Profile photograph')] : role === 'provider' ? [document(body?.profilePhoto, 'Profile photograph')] : [])] : [document(body?.businessDocument, 'Business registration document', true)];
    const storedDocuments: Array<{ kind: string; mimeType: string; data: Buffer | null; storageKey: string | null }> = [];
    try {
      for (const file of documents) {
        const stored = await this.storage.store('verification', file.mimeType, file.data);
        storedDocuments.push({ kind: file.kind, mimeType: file.mimeType, data: stored.legacyData, storageKey: stored.storageKey });
      }
      return await this.db.$transaction(async tx => {
        await tx.$queryRaw`SELECT "userId" FROM "Profile" WHERE "userId" = ${providerId} FOR UPDATE`;
        const profile = await tx.profile.findUnique({ where: { userId: providerId }, select: { phone: true, businessName: true, verificationTier: true, user: { select: { name: true, email: true } } } });
        if (!profile) throw new NotFoundException('Profile not found');
        if (profile.verificationTier !== 'Basic') throw new ConflictException('Your account is already verified');
        if (kind === 'Individual' && profile.user.name?.trim().toLowerCase() !== legalName?.toLowerCase()) throw new BadRequestException('Your legal name must match your account name. Update your profile first.');
        if (kind === 'Business' && profile.businessName?.trim().toLowerCase() !== businessName?.toLowerCase()) throw new BadRequestException('Your registered business name must match your profile business name. Update your profile first.');
        if (await tx.verificationSubmission.findFirst({ where: { providerId, status: 'Pending' }, select: { id: true } })) throw new ConflictException('You already have a submission awaiting review');
        return tx.verificationSubmission.create({ data: { providerId, kind, legalName, businessName, registrationNumber, contactPhone: profile.phone, contactEmail: profile.user.email, documents: { create: storedDocuments } }, select: summary });
      });
    } catch (error) {
      await this.storage.deleteMany(storedDocuments.map(file => file.storageKey)).catch(() => undefined);
      throw error;
    }
  }
  async queue() {
    return this.db.verificationSubmission.findMany({ where: { status: 'Pending' }, select: { ...summary, provider: { select: { userId: true, role: true, businessName: true, user: { select: { name: true } } } } }, orderBy: { createdAt: 'asc' } });
  }
  async readDocument(id: string, documentId: string) {
    const file = await this.db.verificationDocument.findFirst({ where: { id: documentId, submissionId: id }, select: { data: true, storageKey: true, mimeType: true } });
    if (!file) throw new NotFoundException('Document not found');
    return { mimeType: file.mimeType, data: await this.storage.read(file.storageKey, file.data, 'Document') };
  }
  async decide(reviewerId: string, id: string, body: any) {
    if (body?.decision !== 'approve' && body?.decision !== 'reject') throw new BadRequestException('Choose approve or reject');
    const note = body.decision === 'reject' ? requiredText(body?.note, 'a reason for rejection', 1000) : null;
    const required = body.decision === 'approve' ? body?.checks : null;
    return this.db.$transaction(async tx => {
      const initial = await tx.verificationSubmission.findUnique({ where: { id }, select: { providerId: true } });
      if (!initial) throw new NotFoundException('Submission not found');
      if (initial.providerId === reviewerId) throw new ForbiddenException('You cannot review your own verification');
      await tx.$queryRaw`SELECT "userId" FROM "Profile" WHERE "userId" = ${initial.providerId} FOR UPDATE`;
      const submission = await tx.verificationSubmission.findUnique({ where: { id }, include: { provider: { select: { role: true, phone: true, businessName: true, user: { select: { name: true, email: true } } } }, documents: { select: { kind: true } } } });
      if (!submission || submission.status !== 'Pending') throw new ConflictException('This submission has already been reviewed');
      if (body.decision === 'approve') {
        const checklist = submission.kind === 'Individual' ? ['legalName', 'identity', 'phone', 'email', ...(submission.provider.role === 'provider' || submission.documents.some(doc => doc.kind === 'Profile photograph') ? ['photo'] : [])] : ['businessName', 'businessDocument', 'businessContact'];
        if (!required || typeof required !== 'object' || !checklist.every(key => required[key] === true)) throw new BadRequestException('Confirm every verification check before approving');
        const docKinds = submission.documents.map(doc => doc.kind);
        if (submission.kind === 'Individual' && (!docKinds.includes('Identity document') || (submission.provider.role === 'provider' && !docKinds.includes('Profile photograph')))) throw new ConflictException('Required documents are missing');
        if (submission.kind === 'Business' && !docKinds.includes('Business registration document')) throw new ConflictException('Required document is missing');
        if (submission.contactPhone !== submission.provider.phone || submission.contactEmail !== submission.provider.user.email || (submission.kind === 'Individual' && submission.legalName?.toLowerCase() !== submission.provider.user.name?.trim().toLowerCase()) || (submission.kind === 'Business' && submission.businessName?.toLowerCase() !== submission.provider.businessName?.trim().toLowerCase())) throw new ConflictException('The profile changed after submission. Reject it and ask the provider to submit again.');
        await tx.profile.update({ where: { userId: submission.providerId }, data: { verificationTier: submission.kind === 'Individual' ? 'IdentityVerified' : 'BusinessVerified' } });
      }
      return tx.verificationSubmission.update({ where: { id }, data: { status: body.decision === 'approve' ? 'Approved' : 'Rejected', reviewedAt: new Date(), reviewedById: reviewerId, reviewNote: note, ...(required ? { checks: Object.fromEntries((submission.kind === 'Individual' ? ['legalName','identity','phone','email', ...(submission.provider.role === 'provider' || submission.documents.some(doc => doc.kind === 'Profile photograph') ? ['photo'] : [])] : ['businessName','businessDocument','businessContact']).map(key => [key, true])) } : {}) }, select: summary });
    });
  }
}
