// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApprovalPayloadData } from './approval-payload-data';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      key === 'inbox.payload.booleanTrue'
        ? '예'
        : key === 'inbox.payload.booleanFalse'
          ? '아니요'
          : (options?.defaultValue ?? key),
    i18n: { resolvedLanguage: 'ko', language: 'ko' },
  }),
}));

let container: HTMLDivElement;
let root: Root;
describe('approval persisted payload presentation', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });
  it('shows repeating rows using the immutable schema labels without losing stored decimal digits', async () => {
    await act(async () =>
      root.render(
        <ApprovalPayloadData
          payload={{
            items: [{ amount: '12345678901234567890.12345678', memo: '<script>alert(1)</script>' }],
          }}
          formSchema={{
            schemaContract: 'DWP_APPROVAL_FORM_TYPED_V2',
            schemaVersion: 2,
            fields: [
              {
                key: 'items',
                type: 'REPEATING_GROUP',
                labelKo: '비용 항목',
                labelEn: 'Expense items',
                fields: [
                  { key: 'amount', type: 'NUMBER', labelKo: '금액', labelEn: 'Amount' },
                  { key: 'memo', type: 'TEXT', labelKo: '사유', labelEn: 'Reason' },
                ],
              },
            ],
          }}
        />
      )
    );
    expect(container.textContent).toContain('비용 항목');
    expect(container.textContent).toContain('금액');
    expect(container.textContent).toContain('12345678901234567890.12345678');
    expect(container.textContent).toContain('<script>alert(1)</script>');
    expect(container.textContent).not.toContain('[object Object]');
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('dl > div > ol')).toBeNull();
    expect(container.querySelector('dl > div > dd > ol')).not.toBeNull();
  });
  it('preserves legacy fields and hides only explicitly requested system metadata', async () => {
    await act(async () =>
      root.render(
        <ApprovalPayloadData
          payload={{ summary: '권한 검토', createdFrom: 'legacy' }}
          hideSystemFields
          formSchema={{
            schemaVersion: 2,
            fields: [{ key: 'summary', labelKo: '요청 내용', type: 'TEXTAREA', required: true }],
          }}
        />
      )
    );
    expect(container.textContent).toContain('요청 내용');
    expect(container.textContent).toContain('권한 검토');
    expect(container.textContent).not.toContain('createdFrom');
  });

  it('uses schema order, sorts unknown fields, and safely formats typed and structured values', async () => {
    await act(async () =>
      root.render(
        <ApprovalPayloadData
          payload={{
            zeta: { z: 'last', a: 'first' },
            tags: ['security', 'finance'],
            amount: '12345678901234567890.12345678',
            approved: true,
            neededBy: '2026-09-30',
            alpha: { amount: 4200000, currency: 'KRW' },
          }}
          formSchema={{
            schemaContract: 'DWP_APPROVAL_FORM_TYPED_V2',
            schemaVersion: 2,
            fields: [
              { key: 'neededBy', type: 'DATE', labelKo: '필요 일자', labelEn: 'Needed by' },
              { key: 'amount', type: 'NUMBER', labelKo: '금액', labelEn: 'Amount' },
              {
                key: 'approved',
                type: 'SELECT',
                labelKo: '승인 여부',
                labelEn: 'Approved',
                options: ['true', 'false'],
              },
            ],
          }}
        />
      )
    );

    const text = container.textContent ?? '';
    expect(text.indexOf('필요 일자')).toBeLessThan(text.indexOf('금액'));
    expect(text.indexOf('금액')).toBeLessThan(text.indexOf('승인 여부'));
    expect(text.indexOf('승인 여부')).toBeLessThan(text.indexOf('alpha'));
    expect(text.indexOf('alpha')).toBeLessThan(text.indexOf('tags'));
    expect(text.indexOf('tags')).toBeLessThan(text.indexOf('zeta'));
    expect(text).toContain('12345678901234567890.12345678');
    expect(text).toContain('2026. 9. 30.');
    expect(text).toContain('security');
    expect(text).toContain('finance');
    expect(text).toContain('KRW');
    expect(text).toContain('예');
    expect(text.indexOf('a')).toBeLessThan(text.lastIndexOf('z'));
    expect(text).not.toContain('[object Object]');
  });

  it('renders a calendar DATE on the same day in a negative UTC offset timezone', async () => {
    const originalTimezone = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    try {
      await act(async () =>
        root.render(
          <ApprovalPayloadData
            payload={{ neededBy: '2026-09-30' }}
            formSchema={{
              schemaContract: 'DWP_APPROVAL_FORM_TYPED_V2',
              schemaVersion: 2,
              fields: [
                { key: 'neededBy', type: 'DATE', labelKo: '필요 일자', labelEn: 'Needed by' },
              ],
            }}
          />
        )
      );
      expect(container.textContent).toContain('2026. 9. 30.');
    } finally {
      process.env.TZ = originalTimezone;
    }
  });
});
