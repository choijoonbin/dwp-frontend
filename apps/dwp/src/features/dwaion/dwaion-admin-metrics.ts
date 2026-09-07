export function verifiedPercentage(numerator?: number, denominator?: number) {
  if (
    numerator === undefined ||
    denominator === undefined ||
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    numerator < 0 ||
    denominator <= 0 ||
    numerator > denominator
  ) {
    return null;
  }

  return Math.round((numerator / denominator) * 100);
}

export function verifiedPercentageLabel(numerator?: number, denominator?: number) {
  const percentage = verifiedPercentage(numerator, denominator);
  return percentage === null ? '—' : `${percentage}%`;
}
