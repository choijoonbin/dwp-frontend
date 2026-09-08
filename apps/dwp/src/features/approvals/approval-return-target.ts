const RETURN_TARGET_MAX_LENGTH = 2_048;
const INTERNAL_ORIGIN = 'https://approvals.internal';

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

export function approvalWorkReturnTarget(value: unknown): string | null {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > RETURN_TARGET_MAX_LENGTH ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    hasControlCharacter(value)
  ) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(value);
    if (decoded.includes('\\') || hasControlCharacter(decoded)) return null;
    const resolved = new URL(value, INTERNAL_ORIGIN);
    const canonical = `${resolved.pathname}${resolved.search}${resolved.hash}`;
    const workOwnedPath = resolved.pathname === '/work' || resolved.pathname.startsWith('/work/');

    return resolved.origin === INTERNAL_ORIGIN && canonical === value && workOwnedPath
      ? canonical
      : null;
  } catch {
    return null;
  }
}
