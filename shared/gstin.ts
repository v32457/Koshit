const GSTIN_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function normalizeGstin(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase();
}

function checksumMatches(value: string): boolean {
  let total = 0;

  for (let index = 0; index < 14; index += 1) {
    const characterValue = GSTIN_ALPHABET.indexOf(value[index]);

    if (characterValue < 0) return false;

    const product = characterValue * (index % 2 === 1 ? 2 : 1);
    total += Math.floor(product / 36) + (product % 36);
  }

  const expected = GSTIN_ALPHABET[(36 - (total % 36)) % 36];
  return value[14] === expected;
}

export function isValidGstin(value: string | null | undefined): boolean {
  const gstin = normalizeGstin(value);

  if (!GSTIN_PATTERN.test(gstin)) return false;

  const stateCode = Number(gstin.slice(0, 2));
  const validStateCode =
    (stateCode >= 1 && stateCode <= 38) || stateCode === 97 || stateCode === 99;

  return validStateCode && checksumMatches(gstin);
}
