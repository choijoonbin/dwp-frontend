import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  createApprovalFormDraft,
  getApprovalForm,
  updateApprovalFormDraft,
  claimApprovalTask,
  decideApprovalTask,
  updateApprovalDraft,
} from './approval-api';
import {
  assertSupportedApprovalFormSchema,
  isApprovalTypedFormSchema,
} from './approval-management-contract';

import type {
  ApprovalFormDraftInput,
  ApprovalFormSchema,
  ApprovalTypedFormSchema,
} from './approval-api';

const execution = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '100' } as const;
const metadata = {
  categoryId: 'category-1',
  nameKo: '비용 요청',
  nameEn: 'Expense request',
  descriptionKo: '',
  descriptionEn: '',
  ownerGroupRef: 'group-1',
  defaultWorkflowId: 'workflow-1',
};
const typedSchema: ApprovalTypedFormSchema = {
  schemaContract: 'DWP_APPROVAL_FORM_TYPED_V2',
  schemaVersion: 2,
  fields: [
    { key: 'summary', labelKo: '요청 내용', labelEn: 'Summary', type: 'TEXTAREA', required: true },
    {
      key: 'amount',
      labelKo: '금액',
      labelEn: 'Amount',
      type: 'NUMBER',
      min: '0',
      max: '99999999999999999999.99999999',
    },
  ],
};
function json(data: unknown): Response {
  return { ok: true, status: 200, text: async () => JSON.stringify({ data }) } as Response;
}

describe('approval form versioned API boundary', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('keeps unmarked legacy schema version 2 separate from the exact typed marker', () => {
    const legacy = { schemaVersion: 2, fields: [] };
    expect(isApprovalTypedFormSchema(legacy)).toBe(false);
    expect(() => assertSupportedApprovalFormSchema(legacy)).not.toThrow();
    expect(isApprovalTypedFormSchema(typedSchema)).toBe(true);
    for (const schema of [
      { ...typedSchema, schemaContract: 'UNKNOWN' },
      { ...typedSchema, schemaVersion: 1 },
      { schemaVersion: 3, fields: [] },
    ])
      expect(() => assertSupportedApprovalFormSchema(schema as ApprovalFormSchema)).toThrow();
  });

  it('sends the exact typed definition without a legacy fields payload or decimal conversion', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          json(
            url.includes('/csrf')
              ? { token: 'csrf', headerName: 'X-XSRF-TOKEN' }
              : { schema: typedSchema }
          )
        )
      );
    vi.stubGlobal('fetch', fetchMock);
    await createApprovalFormDraft({ ...metadata, formKey: 'EXPENSE_V2', typedSchema }, execution);
    await updateApprovalFormDraft(
      'form-1',
      { ...metadata, typedSchema, expectedVersion: 4 },
      execution
    );
    const commands = fetchMock.mock.calls.filter(([, init]) =>
      ['POST', 'PUT'].includes(init.method)
    );
    expect(commands).toHaveLength(2);
    for (const [, init] of commands) {
      const body = JSON.parse(init.body);
      expect(body.typedSchema).toEqual(typedSchema);
      expect(body).not.toHaveProperty('fields');
      expect(body.typedSchema.fields[1].max).toBe('99999999999999999999.99999999');
    }
    expect(JSON.parse(commands[1][1].body).expectedVersion).toBe(4);
  });

  it('rejects ambiguous definitions and invalid versions before CSRF or command transport', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const ambiguous = { ...metadata, typedSchema, fields: [] } as unknown as ApprovalFormDraftInput;
    await expect(
      createApprovalFormDraft({ ...ambiguous, formKey: 'FORM' }, execution)
    ).rejects.toThrow('Ambiguous');
    await expect(
      updateApprovalFormDraft(
        'form-1',
        { ...metadata, typedSchema, expectedVersion: 1.5 },
        execution
      )
    ).rejects.toThrow('version');
    await expect(
      createApprovalFormDraft({ ...metadata, formKey: 'FORM', fields: [] }, execution)
    ).rejects.toThrow('count');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not expose an unsupported schema as an editable legacy form', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ schema: { ...typedSchema, schemaContract: 'UNKNOWN' } }))
    );
    await expect(getApprovalForm('form-1', 'opaque-scope')).rejects.toThrow('Unsupported');
  });

  it.each(['claim', 'decision', 'draft'] as const)(
    'rejects an unknown form schema in a successful %s response without repeating the command',
    async (command) => {
      const fetchMock = vi
        .fn()
        .mockImplementation((url: string) =>
          Promise.resolve(
            json(
              url.includes('/csrf')
                ? { token: 'csrf', headerName: 'X-XSRF-TOKEN' }
                : { formSchema: { ...typedSchema, schemaContract: 'UNKNOWN' } }
            )
          )
        );
      vi.stubGlobal('fetch', fetchMock);
      const result =
        command === 'claim'
          ? claimApprovalTask('task-1', 1, execution)
          : command === 'decision'
            ? decideApprovalTask('task-1', { decision: 'APPROVE', expectedVersion: 1 }, execution)
            : updateApprovalDraft(
                'request-1',
                {
                  workflowId: 'workflow-1',
                  formId: 'form-1',
                  title: 'Expense request',
                  summary: 'Requested expense',
                  priority: 'NORMAL',
                  payload: {},
                  expectedVersion: 1,
                },
                execution
              );
      await expect(result).rejects.toThrow('Unsupported');
      expect(
        fetchMock.mock.calls.filter(([, init]) => ['POST', 'PUT'].includes(init.method))
      ).toHaveLength(1);
    }
  );
});
