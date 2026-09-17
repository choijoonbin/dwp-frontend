import { describe, expect, it } from 'vitest';

import {
  workplaceServiceOptionRows,
  workplaceServiceOptionSchema,
} from './workplace-service-option-schema-editor';

describe('Workplace service typed option schema', () => {
  it('round-trips localized typed rows without raw JSON editing', () => {
    const rows = workplaceServiceOptionRows([
      {
        key: 'duration',
        labelKo: '지원 시간',
        labelEn: 'Support duration',
        type: 'NUMBER',
        required: true,
        minimum: 15,
        maximum: 240,
        defaultValue: 30,
      },
    ]);
    expect(workplaceServiceOptionSchema(rows)).toEqual([
      {
        key: 'duration',
        labelKo: '지원 시간',
        labelEn: 'Support duration',
        type: 'NUMBER',
        required: true,
        minimum: 15,
        maximum: 240,
        defaultValue: 30,
      },
    ]);
  });

  it('rejects duplicate keys, invalid ranges, labels and select defaults', () => {
    const [row] = workplaceServiceOptionRows([
      {
        key: 'layout',
        labelKo: '배치',
        labelEn: 'Layout',
        type: 'SINGLE_SELECT',
        values: ['BOARDROOM', 'CLASSROOM'],
      },
    ]);
    expect(workplaceServiceOptionSchema([{ ...row!, defaultValueText: 'THEATER' }])).toBeNull();
    expect(workplaceServiceOptionSchema([row!, { ...row!, rowId: 'duplicate' }])).toBeNull();
    expect(workplaceServiceOptionSchema([{ ...row!, labelKo: '' }])).toBeNull();
    expect(
      workplaceServiceOptionSchema([
        {
          ...row!,
          type: 'NUMBER',
          valuesText: '',
          minimumText: '10',
          maximumText: '1',
        },
      ])
    ).toBeNull();
  });
});
