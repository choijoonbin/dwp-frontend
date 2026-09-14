// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByLabelText, getByRole, queryByLabelText } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApprovalTypedFormPreview } from './approval-form-builder-typed-preview';
import { compileApprovalTypedForm } from './approval-form-typed-compiler';
import { duplicateTypedEditorField, typedEditorSeed } from './approval-form-builder-typed-model';
import type { ApprovalTypedFormSchema } from '@dwp-frontend/shared-utils/api/approval-form-typed-contract';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
let container: HTMLDivElement;
let root: Root;
const schema = (): ApprovalTypedFormSchema => ({
  ...typedEditorSeed('요약', 'Summary'),
  fields: [
    ...typedEditorSeed('요약', 'Summary').fields,
    { key: 'amount', type: 'NUMBER', labelKo: '금액', labelEn: 'Amount' },
    {
      key: 'details',
      type: 'TEXT',
      labelKo: '내용',
      labelEn: 'Details',
      visibleWhen: { op: 'GT', field: 'amount', value: '100' },
      requiredWhen: { op: 'GTE', field: 'amount', value: '200' },
    },
    {
      key: 'items',
      type: 'REPEATING_GROUP',
      labelKo: '항목',
      labelEn: 'Items',
      maxRows: 2,
      fields: [
        { key: 'price', type: 'NUMBER', labelKo: '가격', labelEn: 'Price' },
        {
          key: 'line',
          type: 'CALCULATED_NUMBER',
          labelKo: '행 합계',
          labelEn: 'Line',
          calculation: { op: 'FIELD', field: 'price' },
        },
      ],
    },
    {
      key: 'total',
      type: 'CALCULATED_NUMBER',
      labelKo: '총액',
      labelEn: 'Total',
      calculation: { op: 'SUM', group: 'items', field: 'line' },
    },
  ],
});
const change = async (label: string | RegExp, value: string) => {
  await act(async () => fireEvent.change(getByLabelText(container, label), { target: { value } }));
};
const click = async (key: string) => {
  await act(async () => fireEvent.click(getByRole(container, 'button', { name: key })));
};

describe('actual typed form preview', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', webcrypto);
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });
  const render = async () => {
    const compiled = await compileApprovalTypedForm(schema());
    await act(async () =>
      root.render(
        <StrictMode>
          <ApprovalTypedFormPreview
            compiled={compiled}
            korean={false}
            title="Advanced definition"
          />
        </StrictMode>
      )
    );
  };
  it('evaluates condition visibility and requiredness without blocking authoring with native required inputs', async () => {
    await render();
    expect(queryByLabelText(container, 'Details')).toBeNull();
    await change(/^Summary/, 'Review');
    await change('Amount', '200');
    expect(getByLabelText(container, /^Details/).getAttribute('aria-required')).toBe('true');
    expect(
      container.querySelectorAll('input:invalid,textarea:invalid,select:invalid')
    ).toHaveLength(0);
    await click('admin.typedForm.previewValidate');
    expect(container.textContent).toContain('admin.typedForm.previewInvalid');
    await change(/^Details/, 'Required context');
    await click('admin.typedForm.previewValidate');
    expect(container.textContent).toContain('admin.typedForm.previewValid');
    await change('Amount', '100');
    expect(queryByLabelText(container, /^Details/)).toBeNull();
  });
  it('keeps 28-digit decimals as text and calculates group totals from actual row values', async () => {
    await render();
    await click('admin.typedForm.addRow');
    const price = getByLabelText(container, 'Price') as HTMLInputElement;
    expect(price.type).toBe('text');
    expect(price.inputMode).toBe('decimal');
    await change('Price', '12345678901234567890.12345678');
    expect((getByLabelText(container, 'Total') as HTMLInputElement).value).toBe(
      '12345678901234567890.12345678'
    );
    expect((getByLabelText(container, 'Line') as HTMLInputElement).readOnly).toBe(true);
    await change('Price', '1e3');
    expect((getByLabelText(container, 'Price') as HTMLInputElement).value).toBe('1e3');
    expect((getByLabelText(container, 'Total') as HTMLInputElement).value).toBe('');
    expect(container.textContent).toContain('admin.typedForm.previewInvalid');
  });
  it('limits actual sample rows and permits recovery by deleting a row', async () => {
    await render();
    await click('admin.typedForm.addRow');
    await click('admin.typedForm.addRow');
    expect(
      (getByRole(container, 'button', { name: 'admin.typedForm.addRow' }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    await act(async () =>
      fireEvent.click(
        container.querySelector<HTMLButtonElement>(
          'button[aria-label="admin.typedForm.removeRow"]'
        )!
      )
    );
    expect(
      (getByRole(container, 'button', { name: 'admin.typedForm.addRow' }) as HTMLButtonElement)
        .disabled
    ).toBe(false);
  });
  it('binds canvas focus to exact root/row fields and switches localized preview without changing the definition', async () => {
    const compiled = await compileApprovalTypedForm(schema());
    const onSelect = vi.fn();
    const onInspect = vi.fn();
    await act(async () =>
      root.render(
        <ApprovalTypedFormPreview
          compiled={compiled}
          korean={false}
          title="Preview"
          selected={['amount']}
          onSelect={onSelect}
          onInspect={onInspect}
        />
      )
    );
    await act(async () => fireEvent.focusIn(getByLabelText(container, 'Amount')));
    expect(onSelect).toHaveBeenLastCalledWith(['amount']);
    await click('admin.typedForm.addRow');
    await act(async () => fireEvent.focusIn(getByLabelText(container, 'Price')));
    expect(onSelect).toHaveBeenLastCalledWith(['items', 'price']);
    await click('admin.studio.previewKorean');
    expect(getByLabelText(container, '가격')).not.toBeNull();
    expect(queryByLabelText(container, 'Price')).toBeNull();
    expect(compiled.definition.fields[1].labelEn).toBe('Amount');
    const inspect = container.querySelector<HTMLButtonElement>(
      'button[aria-label="admin.typedForm.inspectField"]'
    )!;
    await act(async () => fireEvent.click(inspect));
    expect(onInspect).toHaveBeenCalledWith(['summary']);
    const group = getByRole(container, 'region', { name: '항목' });
    const inspectGroup = group.querySelector<HTMLButtonElement>(
      'button[aria-label="admin.typedForm.inspectField"]'
    )!;
    await act(async () => fireEvent.focusIn(inspectGroup));
    expect(onSelect).toHaveBeenLastCalledWith(['items']);
    await act(async () => fireEvent.click(inspectGroup));
    expect(onInspect).toHaveBeenLastCalledWith(['items']);
  });
  it('distinguishes copied group landmarks without changing stored labels', async () => {
    const source = duplicateTypedEditorField(schema(), ['items']).schema;
    const compiled = await compileApprovalTypedForm(source);
    await act(async () =>
      root.render(<ApprovalTypedFormPreview compiled={compiled} korean={false} title="Preview" />)
    );
    expect(getByRole(container, 'region', { name: 'Items (items)' })).not.toBeNull();
    expect(getByRole(container, 'region', { name: 'Items (items_copy_1)' })).not.toBeNull();
    expect(source.fields.find((field) => field.key === 'items_copy_1')?.labelEn).toBe('Items');
  });
  it('keeps draft USER fields read-only at root and in repeating rows without accepting UUID text', async () => {
    const base = schema();
    const source: ApprovalTypedFormSchema = {
      ...base,
      fields: [
        ...base.fields.map((field) =>
          field.type === 'REPEATING_GROUP'
            ? {
                ...field,
                fields: [
                  ...field.fields,
                  { key: 'owner', type: 'USER' as const, labelKo: '담당자', labelEn: 'Owner' },
                ],
              }
            : field
        ),
        { key: 'reviewer', type: 'USER', labelKo: '검토자', labelEn: 'Reviewer' },
      ],
    };
    const compiled = await compileApprovalTypedForm(source);
    await act(async () =>
      root.render(<ApprovalTypedFormPreview compiled={compiled} korean={false} title="Preview" />)
    );
    await click('admin.typedForm.addRow');
    for (const label of ['Reviewer', 'Owner']) {
      const input = getByLabelText(container, label) as HTMLInputElement;
      expect(input.disabled).toBe(true);
      expect(input.readOnly).toBe(true);
      expect(input.placeholder).toBe('admin.typedForm.userDraftPlaceholder');
      expect(input.value).toBe('');
    }
    expect(container.textContent).toContain('admin.typedForm.userDraftDescription');
    expect(container.querySelector('[role="combobox"]')).toBeNull();
  });
});
