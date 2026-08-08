export type SessionDevice = {
  browser: string;
  platform: string;
  kind: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  label: string;
};

export function describeSessionDevice(userAgent?: string | null): SessionDevice {
  const value = userAgent?.trim() || '';
  const browser = detectBrowser(value);
  const platform = detectPlatform(value);
  const kind = detectKind(value);
  return {
    browser,
    platform,
    kind,
    label: browser === 'Unknown browser' ? platform : `${browser} on ${platform}`,
  };
}

function detectBrowser(value: string): string {
  if (/Edg\//.test(value)) return 'Microsoft Edge';
  if (/OPR\//.test(value)) return 'Opera';
  if (/Firefox\//.test(value)) return 'Firefox';
  if (/CriOS\//.test(value)) return 'Chrome';
  if (/Chrome\//.test(value)) return 'Chrome';
  if (/FxiOS\//.test(value)) return 'Firefox';
  if (/Safari\//.test(value) && /Version\//.test(value)) return 'Safari';
  return 'Unknown browser';
}

function detectPlatform(value: string): string {
  if (/iPad/.test(value)) return 'iPadOS';
  if (/iPhone|iPod/.test(value)) return 'iOS';
  if (/Android/.test(value)) return 'Android';
  if (/Windows/.test(value)) return 'Windows';
  if (/Macintosh|Mac OS X/.test(value)) return 'macOS';
  if (/Linux/.test(value)) return 'Linux';
  return 'Unknown device';
}

function detectKind(value: string): SessionDevice['kind'] {
  if (/iPad|Tablet/.test(value)) return 'tablet';
  if (/Mobile|iPhone|iPod|Android/.test(value)) return 'mobile';
  if (value) return 'desktop';
  return 'unknown';
}
