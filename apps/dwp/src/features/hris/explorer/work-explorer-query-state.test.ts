import { describe, expect, it } from 'vitest';

import {
  mergeWorkExplorerQueryState,
  parseWorkExplorerQueryState,
} from './work-explorer-query-state';

describe('Work Explorer URL state', () => {
  it('round-trips useful search, filter, and selection state without dropping the guard scope', () => {
    const current = new URLSearchParams(
      'scope=opaque%3Ascope-7&q=pay&module=PAY&workbench=PAYROLL&selected=hris.explorer.pay-results'
    );
    expect(parseWorkExplorerQueryState(current)).toEqual({
      query: 'pay',
      module: 'PAY',
      workbench: 'PAYROLL',
      selected: 'hris.explorer.pay-results',
    });
    const next = mergeWorkExplorerQueryState(current, { query: 'tax', module: 'ALL' });
    expect(next.get('scope')).toBe('opaque:scope-7');
    expect(next.get('q')).toBe('tax');
    expect(next.has('module')).toBe(false);
    expect(next.get('workbench')).toBe('PAYROLL');
    expect(next.get('selected')).toBe('hris.explorer.pay-results');
  });

  it('fails closed to known filters and discards malformed selection state', () => {
    expect(
      parseWorkExplorerQueryState(
        new URLSearchParams('module=OWNER_DB&workbench=EIGHTH&selected=%2Fadmin&q=%20%20')
      )
    ).toEqual({ query: '', module: 'ALL', workbench: 'ALL', selected: null });
  });

  it('preserves trailing search text while a user types a multi-word label', () => {
    const afterSpace = mergeWorkExplorerQueryState(new URLSearchParams('scope=opaque'), {
      query: 'pay ',
    });
    expect(afterSpace.get('q')).toBe('pay ');
    expect(parseWorkExplorerQueryState(afterSpace).query).toBe('pay ');

    const afterNextCharacter = mergeWorkExplorerQueryState(afterSpace, { query: 'pay r' });
    expect(parseWorkExplorerQueryState(afterNextCharacter).query).toBe('pay r');
    expect(afterNextCharacter.get('scope')).toBe('opaque');
  });
});
