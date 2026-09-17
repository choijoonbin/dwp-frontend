import { describe, expect, it } from 'vitest';

import {
  mailKeyboardShortcutsEnabled,
  mailRemoteImageState,
  mailUsesCompactDensity,
} from './mail-runtime-preferences';

describe('mail runtime preferences', () => {
  it('fails closed while keyboard shortcut preferences are unavailable', () => {
    expect(mailKeyboardShortcutsEnabled(undefined)).toBe(false);
    expect(mailKeyboardShortcutsEnabled({ keyboardShortcuts: false })).toBe(false);
    expect(mailKeyboardShortcutsEnabled({ keyboardShortcuts: true })).toBe(true);
  });

  it('applies each remote image policy without allowing a BLOCK override', () => {
    expect(mailRemoteImageState('ALLOW', false)).toEqual({
      allowed: true,
      canLoad: false,
      policy: 'ALLOW',
    });
    expect(mailRemoteImageState('ASK', false)).toEqual({
      allowed: false,
      canLoad: true,
      policy: 'ASK',
    });
    expect(mailRemoteImageState('ASK', true).allowed).toBe(true);
    expect(mailRemoteImageState('BLOCK', true)).toEqual({
      allowed: false,
      canLoad: false,
      policy: 'BLOCK',
    });
  });

  it('uses compact rows only for the saved compact density', () => {
    expect(mailUsesCompactDensity({ density: 'COMPACT' })).toBe(true);
    expect(mailUsesCompactDensity({ density: 'COMFORTABLE' })).toBe(false);
    expect(mailUsesCompactDensity(undefined)).toBe(false);
  });
});
