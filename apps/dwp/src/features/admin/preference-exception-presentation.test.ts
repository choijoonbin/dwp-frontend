import { describe, expect, it } from 'vitest';

import {
  preferenceExceptionOwnerLabelKey,
  preferenceExceptionPathLabelKey,
  preferenceExceptionStatePresentation,
  preferenceExceptionValuePresentation,
} from './preference-exception-presentation';

describe('preference exception presentation', () => {
  it('formats only typed values for known preference paths', () => {
    expect(preferenceExceptionValuePresentation('navigation.pattern', 'rail')).toEqual({
      kind: 'translation',
      key: 'preferenceExceptions.values.navigation.rail',
    });
    expect(preferenceExceptionValuePresentation('accessibility.reduceMotion', true)).toEqual({
      kind: 'translation',
      key: 'preferenceExceptions.values.enabled',
    });
    expect(preferenceExceptionValuePresentation('appearance.accentColor', '#1a2b3c')).toEqual({
      kind: 'literal',
      value: '#1A2B3C',
    });
  });

  it('fails closed for objects, unknown paths, and internal owner references', () => {
    const value = preferenceExceptionValuePresentation('future.internal.schema', {
      secret: 'never-render-me',
    });
    expect(value).toEqual({
      kind: 'translation',
      key: 'preferenceExceptions.values.unavailable',
    });
    expect(JSON.stringify(value)).not.toContain('never-render-me');
    expect(preferenceExceptionPathLabelKey('future.internal.schema')).toBe(
      'preferenceExceptions.paths.unknown'
    );
    expect(preferenceExceptionOwnerLabelKey('internal-owner-uuid')).toBe(
      'preferenceExceptions.owners.managed'
    );
    expect(preferenceExceptionStatePresentation('FUTURE')).toEqual({
      labelKey: 'preferenceExceptions.states.UNKNOWN',
      color: 'warning',
      known: false,
    });
  });
});
