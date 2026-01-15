// ----------------------------------------------------------------------

/**
 * Extracts the tenant ID from the current hostname.
 * Example: 'client-a.dwp.com' -> 'client-a'
 */
export const getTenantId = (): string => {
  const hostname = window.location.hostname;
  
  // Local development or IP address
  if (hostname === 'localhost' || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    return 'default';
  }

  const parts = hostname.split('.');
  if (parts.length >= 3) {
    return parts[0];
  }

  return 'default';
};
