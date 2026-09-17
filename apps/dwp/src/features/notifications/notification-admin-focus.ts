const ADMIN_FOCUS_VALUE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;

export type NotificationAdminFocusKey = 'policyId' | 'revisionId' | 'controlId';

export function notificationAdminFocus(
  searchParams: URLSearchParams,
  key: NotificationAdminFocusKey
): string | null {
  const value = searchParams.get(key);
  if (!value || value !== value.trim() || !ADMIN_FOCUS_VALUE.test(value)) return null;
  return value;
}
