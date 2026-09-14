// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApprovalPayloadData } from './approval-payload-data';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
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
});
