/** The AskRequest server contract counts Unicode code points after the UI trims the request. */
export function questionCharacterCount(value: string): number {
  return Array.from(value.trim()).length;
}
export function questionValidation(value: string): 'empty' | 'short' | 'long' | 'valid' {
  const length = questionCharacterCount(value);
  if (length === 0) return 'empty';
  if (length < 2) return 'short';
  return length > 4_000 ? 'long' : 'valid';
}
