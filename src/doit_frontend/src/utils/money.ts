const rand = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' });

export function formatRand(cents: number) {
  return rand.format(cents / 100);
}

export function parseRandCents(value: string) {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) return NaN;
  const [amount, cents = ''] = value.split(/[.,]/);
  return Number(amount) * 100 + Number(cents.padEnd(2, '0'));
}
