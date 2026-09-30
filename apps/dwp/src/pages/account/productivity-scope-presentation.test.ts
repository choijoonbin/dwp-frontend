import { describe, expect, it } from 'vitest';

import {
  hasUnknownProductivityScope,
  productivityScopeLabels,
} from './productivity-scope-presentation';

const translate = (key: string) => `translated:${key}`;

describe('productivity connection scope presentation', () => {
  it('maps technical OAuth scopes to user-facing permission labels', () => {
    expect(productivityScopeLabels(translate, ['Mail.ReadBasic', 'Calendars.Read'])).toEqual([
      'translated:profile.connections.permissions.mailBasicRead',
      'translated:profile.connections.permissions.calendarRead',
    ]);
    expect(hasUnknownProductivityScope(['Mail.ReadBasic', 'Calendars.Read'])).toBe(false);
  });

  it('fails closed and deduplicates unknown scopes', () => {
    expect(
      productivityScopeLabels(translate, ['Internal.Scope.One', 'Internal.Scope.Two'])
    ).toEqual(['translated:profile.connections.permissions.unknown']);
    expect(hasUnknownProductivityScope(['Internal.Scope.One'])).toBe(true);
  });
});
