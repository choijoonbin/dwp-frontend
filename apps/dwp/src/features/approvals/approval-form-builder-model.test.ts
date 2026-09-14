import { describe, expect, it } from 'vitest';

import {
  SUPPORTED_APPROVAL_FORM_FIELD_TYPES,
  approvalFormFieldIssues,
  createApprovalFormField,
  moveApprovalFormField,
} from './approval-form-builder-model';

import type { ApprovalFormField } from '@dwp-frontend/shared-utils';

const field = (key: string, type: ApprovalFormField['type'] = 'TEXT'): ApprovalFormField => ({
  key,
  labelKo: key,
  labelEn: key,
  type,
  required: false,
  options: type === 'SELECT' ? ['ONE', 'TWO'] : [],
});

describe('approval form builder model', () => {
  it('exposes only the six field types supported by the server contract', () => {
    expect(SUPPORTED_APPROVAL_FORM_FIELD_TYPES).toEqual([
      'TEXT',
      'TEXTAREA',
      'NUMBER',
      'DATE',
      'SELECT',
      'USER',
    ]);
  });

  it('creates a deterministic contract-safe field draft', () => {
    expect(createApprovalFormField(2)).toEqual({
      key: 'field3',
      labelKo: '',
      labelEn: '',
      helpKo: '',
      helpEn: '',
      type: 'TEXT',
      required: false,
      options: [],
    });
  });

  it('moves fields without mutating the source snapshot', () => {
    const source = [field('first'), field('second'), field('third')];

    expect(moveApprovalFormField(source, 1, -1).map((item) => item.key)).toEqual([
      'second',
      'first',
      'third',
    ]);
    expect(source.map((item) => item.key)).toEqual(['first', 'second', 'third']);
    expect(moveApprovalFormField(source, 0, -1)).toEqual(source);
  });

  it('reports duplicate keys, missing labels, and invalid select options by field', () => {
    expect(
      approvalFormFieldIssues([
        field('duplicate'),
        { ...field('duplicate'), labelEn: '' },
        { ...field('choice', 'SELECT'), options: ['ONE', 'ONE'] },
      ])
    ).toEqual([
      { index: 0, key: 'duplicate', issue: 'DUPLICATE_KEY' },
      { index: 1, key: 'duplicate', issue: 'DUPLICATE_KEY' },
      { index: 1, key: 'duplicate', issue: 'LABEL' },
      { index: 2, key: 'choice', issue: 'OPTIONS' },
    ]);
  });
  it('keeps client field constraints aligned with the actual draft DTO', () => {
    expect(
      approvalFormFieldIssues([{ ...field('choice', 'SELECT'), options: ['ONE'] }])
    ).toContainEqual({ index: 0, key: 'choice', issue: 'OPTIONS' });
    expect(
      approvalFormFieldIssues([{ ...field('plain'), options: ['ONE', 'TWO'] }])
    ).toContainEqual({ index: 0, key: 'plain', issue: 'OPTIONS' });
    expect(
      approvalFormFieldIssues([
        field('UPPER'),
        field('x'),
        { ...field('long'), helpEn: 'x'.repeat(501) },
      ])
    ).toEqual(
      expect.arrayContaining([
        { index: 0, key: 'UPPER', issue: 'KEY' },
        { index: 1, key: 'x', issue: 'KEY' },
        { index: 2, key: 'long', issue: 'HELP' },
      ])
    );
  });
  it('does not reuse a field key after another field was deleted', () => {
    expect(createApprovalFormField(2, [field('field1'), field('field3')]).key).toBe('field4');
  });
});
