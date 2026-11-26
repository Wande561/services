import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AppContext';
import { apiRequest } from '../utils/apiRequest';
import { verificationKey, verificationQueue, type VerificationSubmission } from '../utils/verification';

const individual = [ ['legalName', 'Full legal name matches the identity evidence'], ['identity', 'Identity independently verified'], ['phone', 'Phone ownership independently verified'], ['email', 'Email ownership independently verified'], ['photo', 'Profile photograph reviewed and matches the person'] ] as const;
const business = [ ['businessName', 'Registered business name verified'], ['businessDocument', 'Business registration document independently verified'], ['businessContact', 'Business contact information independently verified'] ] as const;
function ReviewCard({ submission, self }: { submission: VerificationSubmission; self: boolean }) {
  const [checks, setChecks] = useState<Record<string, boolean>>({}); const [note, setNote] = useState(''); const client = useQueryClient();
  const decide = useMutation({ mutationFn: (data: object) => apiRequest(`/verification/admin/submissions/${encodeURIComponent(submission.id)}/decision`, { method: 'POST', data }), onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: verificationKey }), client.invalidateQueries({ queryKey: ['services'] })]) });
  const checklist = submission.kind === 'Individual' ? individual.filter(([key]) => key !== 'photo' || submission.provider?.role === 'provider' || submission.documents.some(doc => doc.kind === 'Profile photograph')) : business;
  return <article className="rounded-xl border border-home-line bg-home-surface p-6"><h2 className="text-2xl">{submission.kind === 'Individual' ? submission.legalName : submission.businessName}</h2>
    <p className="mt-2 text-sm text-emerald-300">{submission.kind === 'Individual' ? `${submission.provider?.role === 'client' ? 'Client' : 'Provider'} identity verification` : 'Registered business verification'}</p>
    {submission.registrationNumber && <p className="mt-2 text-sm text-emerald-300">Registration number: {submission.registrationNumber}</p>}
    <p className="mt-2 text-sm text-emerald-300">Contact phone: {submission.contactPhone}</p><p className="text-sm text-emerald-300">Contact email: {submission.contactEmail}</p>
    <div className="mt-3 flex flex-wrap gap-4">{submission.documents.map(doc => <a key={doc.id} href={`/api/verification/admin/submissions/${encodeURIComponent(submission.id)}/documents/${encodeURIComponent(doc.id)}`} className="text-sm text-emerald-300 underline">Download {doc.kind.toLowerCase()}</a>)}</div>
    {self ? <p className="mt-4 text-sm text-red-300">You cannot review your own submission. Another verification administrator must review it.</p> : <div className="mt-4 space-y-3 border-t border-home-line pt-4"><p className="text-sm text-emerald-300">Check each item only after independently verifying it. Phone and email are not verified automatically by the app.</p>
      {checklist.map(([key, label]) => <label key={key} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={!!checks[key]} onChange={e => setChecks(previous => ({ ...previous, [key]: e.target.checked }))} />{label}</label>)}
      <button type="button" className="btn-primary disabled:opacity-50" disabled={decide.isPending || !checklist.every(([key]) => checks[key])} onClick={() => decide.mutate({ decision: 'approve', checks })}>Approve verification</button>
      <label className="block text-sm">Reason for rejection<input className="mt-1 block w-full rounded-lg border border-home-control bg-home-canvas p-3 text-white" value={note} onChange={e => setNote(e.target.value)} maxLength={1000} /></label>
      <button type="button" className="btn-secondary disabled:opacity-50" disabled={decide.isPending || !note.trim()} onClick={() => decide.mutate({ decision: 'reject', note })}>Reject submission</button>
      {decide.isError && <p role="alert" className="text-red-300">{decide.error.message}</p>}
    </div>}
  </article>;
}
export default function VerificationReview() {
  const { currentUser } = useAuth(); const queue = useQuery(verificationQueue(currentUser?.id ?? '', !!currentUser?.isVerificationAdmin));
  if (!currentUser?.isVerificationAdmin) return <main className="p-8"><p role="alert" className="text-red-300">Verification administrator access required.</p></main>;
  return <main className="min-h-screen px-5 py-12"><div className="mx-auto max-w-4xl"><h1 className="text-4xl">Identity and business verification</h1><p className="mt-2 text-sm text-emerald-300">Review client and provider submissions and independently check their evidence before awarding a badge.</p>
    {queue.isPending && <p className="mt-5">Loading submissions…</p>}{queue.isError && <p role="alert" className="mt-5 text-red-300">{queue.error.message}</p>}{queue.data?.length === 0 && <p className="mt-5 text-emerald-300">No submissions awaiting review.</p>}
    <div className="mt-6 space-y-5">{queue.data?.map(submission => <ReviewCard key={submission.id} submission={submission} self={submission.provider?.userId === currentUser.id} />)}</div>
  </div></main>;
}
