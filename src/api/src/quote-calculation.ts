import { BadRequestException } from '@nestjs/common';

const maximum = 2_147_483_647;

/** All amounts are integer rand cents. */
export function calculateQuotation(input: {
  labourCents: unknown;
  materialsCents: unknown;
  travelCents: unknown;
  depositRequired: unknown;
}) {
  const amount = (value: unknown, label: string): number => {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > maximum) {
      throw new BadRequestException(`Enter a valid ${label} amount`);
    }
    return value;
  };
  const labourCents = amount(input.labourCents, 'labour');
  const materialsCents = amount(input.materialsCents, 'materials');
  const travelCents = amount(input.travelCents, 'travel');
  if (typeof input.depositRequired !== 'boolean') throw new BadRequestException('Choose whether a deposit is required');
  const totalCents = labourCents + materialsCents + travelCents;
  if (totalCents > maximum) throw new BadRequestException('The quotation total is too large');
  const depositCents = input.depositRequired ? Math.floor((totalCents + 2) / 4) : 0;
  if (input.depositRequired && depositCents === 0) throw new BadRequestException('A deposit requires a positive quotation total');
  return { labourCents, materialsCents, travelCents, totalCents, depositCents, balanceCents: totalCents - depositCents };
}
