import { describe, expect, it } from 'vitest';

import {
  securityHeaders,
  trustedHttpOrigin,
  trustedWebSocketOrigin,
} from '../../../scripts/frontend-security-headers.mjs';

const scriptDirective = (development: boolean) => {
  const headers = securityHeaders(development);
  return headers['Content-Security-Policy']
    .split(';')
    .map((directive) => directive.trim())
    .find((directive) => directive.startsWith('script-src'));
};

describe('frontend security headers', () => {
  it('permits only same-origin scripts and WebAssembly compilation in preview', () => {
    expect(scriptDirective(false)).toBe("script-src 'self' 'wasm-unsafe-eval'");
    expect(scriptDirective(false)).not.toContain("'unsafe-eval'");
  });

  it('keeps the existing development-only inline allowance without external script origins', () => {
    expect(scriptDirective(true)).toBe("script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'");
  });

  it('permits only an explicitly configured secure realtime origin outside development', () => {
    const policy = securityHeaders(
      false,
      'https://api.dwp.example',
      trustedWebSocketOrigin('wss://meet.dwp.example:7443/rtc?token=discarded')
    )['Content-Security-Policy'];

    expect(policy).toContain(
      "connect-src 'self' https://api.dwp.example wss://meet.dwp.example:7443;"
    );
    expect(policy).not.toContain(' ws:');
    expect(policy).not.toContain('token=discarded');
    expect(trustedWebSocketOrigin('ws://meet.dwp.example')).toBe('');
  });

  it('canonicalizes API paths while rejecting credential-bearing or non-HTTP origins', () => {
    expect(trustedHttpOrigin('https://api.dwp.example:8443/v1?source=runtime')).toBe(
      'https://api.dwp.example:8443'
    );
    expect(trustedHttpOrigin('https://operator:secret@api.dwp.example/v1')).toBe('');
    expect(trustedHttpOrigin('javascript:alert(1)')).toBe('');
  });
});
