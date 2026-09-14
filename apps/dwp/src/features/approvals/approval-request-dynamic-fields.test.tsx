// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApprovalRequestDynamicFields } from './approval-request-dynamic-fields';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

let container: HTMLDivElement;
let root: Root;

describe('ApprovalRequestDynamicFields', () => {
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

  it('renders localized schema fields and reports the exact changed key', async () => {
    const onChange = vi.fn();

    await act(async () => {
      root.render(
        <ApprovalRequestDynamicFields
          fields={[
            {
              key: 'businessReason',
              labelKo: '업무 사유',
              labelEn: 'Business reason',
              helpKo: '승인이 필요한 이유를 입력하세요.',
              type: 'TEXTAREA',
              required: true,
            },
            {
              key: 'owner',
              labelKo: '담당자',
              labelEn: 'Owner',
              type: 'USER',
              required: false,
            },
          ]}
          values={{ businessReason: '기존 사유', owner: '' }}
          korean
          idPrefix="request"
          onChange={onChange}
        />
      );
    });

    const reason = container.querySelector<HTMLTextAreaElement>('#request-businessReason');
    expect(reason).not.toBeNull();
    expect(reason?.required).toBe(true);
    expect(container.textContent).toContain('승인이 필요한 이유를 입력하세요.');

    await act(async () => {
      fireEvent.change(reason!, { target: { value: '변경한 사유' } });
    });

    expect(onChange).toHaveBeenCalledWith('businessReason', '변경한 사유');
  });

  it('keeps fields inert while authority is unavailable', async () => {
    const onChange = vi.fn();

    await act(async () => {
      root.render(
        <ApprovalRequestDynamicFields
          fields={[
            {
              key: 'cost',
              labelEn: 'Cost',
              type: 'NUMBER',
              required: true,
            },
          ]}
          values={{ cost: '1200' }}
          korean={false}
          idPrefix="request"
          disabled
          onChange={onChange}
        />
      );
    });

    const cost = container.querySelector<HTMLInputElement>('#request-cost');
    expect(cost?.disabled).toBe(true);
    expect(cost?.value).toBe('1200');
    expect(onChange).not.toHaveBeenCalled();
  });
});
