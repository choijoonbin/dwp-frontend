import { describe, expect, it } from 'vitest';

import {
  addFormStudioV3Field,
  cloneFormStudioV3Field,
  createFormStudioV3FieldDraft,
  moveFormStudioV3Field,
  readFormStudioV3EditorFields,
  removeFormStudioV3Field,
  updateFormStudioV3Field,
} from './form-studio-v3-editor-model';

function field(key: string) {
  return {
    key,
    type: 'TEXT',
    control: 'TEXT_INPUT',
    label: { ko: key, en: key },
    help: { ko: '', en: '' },
    span: { desktop: 6, tablet: 12, mobile: 12 },
    required: false,
    validation: {},
    options: [],
    viewRoles: ['*'],
    editRoles: ['*'],
    retention: {
      classification: 'INTERNAL',
      retentionClass: 'STANDARD',
      legalHoldEligible: true,
    },
    export: { included: true, label: { ko: key, en: key }, format: 'TEXT', mask: 'NONE' },
  };
}

function schema() {
  return {
    schemaContract: 'DWP_APPROVAL_FORM_TYPED_V3',
    schemaVersion: 3,
    pages: [
      {
        key: 'request',
        title: { ko: '요청', en: 'Request' },
        sections: [
          {
            key: 'details',
            title: { ko: '상세', en: 'Details' },
            fields: [field('summary'), field('amount')],
          },
        ],
      },
    ],
    rules: [],
  };
}

describe('Form Studio V3 editor model', () => {
  it('adds, edits, clones, reorders and removes fields without dropping schema properties', () => {
    const original = schema();
    const draft = createFormStudioV3FieldDraft(original);
    const added = addFormStudioV3Field(original, { ...draft, labelKo: '비고', labelEn: 'Notes' });
    expect(readFormStudioV3EditorFields(added).map((item) => item.key)).toEqual([
      'summary',
      'amount',
      'new_field',
    ]);
    expect(original.pages[0]?.sections[0]?.fields).toHaveLength(2);

    const updated = updateFormStudioV3Field(added, 'new_field', {
      ...draft,
      labelKo: '변경 비고',
      labelEn: 'Updated notes',
      required: true,
    });
    const cloned = cloneFormStudioV3Field(updated, 'new_field');
    const moved = moveFormStudioV3Field(cloned.schema, cloned.fieldId, -1);
    const removed = removeFormStudioV3Field(moved, 'amount');

    expect(readFormStudioV3EditorFields(removed).map((item) => item.key)).toEqual([
      'summary',
      'new_field_copy',
      'new_field',
    ]);
    expect(
      readFormStudioV3EditorFields(removed).find((item) => item.key === 'new_field')
    ).toMatchObject({
      labelEn: 'Updated notes',
      required: true,
    });
    expect(removed.schemaContract).toBe('DWP_APPROVAL_FORM_TYPED_V3');
    expect(removed.rules).toEqual([]);
  });

  it('fails closed for duplicate keys and stale field identifiers', () => {
    const source = schema();
    const draft = createFormStudioV3FieldDraft(source);
    expect(() => addFormStudioV3Field(source, { ...draft, key: 'summary' })).toThrow(
      'Duplicate Form Studio V3 field key.'
    );
    expect(() => removeFormStudioV3Field(source, 'missing')).toThrow(
      'Form Studio V3 field is stale.'
    );
  });
});
