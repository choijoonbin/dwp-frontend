// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useApprovalFormSchemaValidation } from './approval-form-schema-validation';
import { typedEditorSeed } from './approval-form-builder-typed-model';
import type { ApprovalTypedFormSchema } from '@dwp-frontend/shared-utils/api/approval-form-typed-contract';
import type { CompiledApprovalTypedForm } from './approval-form-typed-model';

const compiler = vi.hoisted(() => ({ compile: vi.fn(), requireSummary: vi.fn() }));
vi.mock('./approval-form-typed-compiler', () => ({
  compileApprovalTypedForm: compiler.compile,
  requireApprovalTypedSummary: compiler.requireSummary,
}));
let container: HTMLDivElement;
let root: Root;
let latest: ReturnType<typeof useApprovalFormSchemaValidation>;
function Probe({ schema, enabled = true }: { schema: ApprovalTypedFormSchema; enabled?: boolean }) {
  latest = useApprovalFormSchemaValidation(schema, enabled);
  return null;
}
const compiled = (schema: ApprovalTypedFormSchema, hash: string) =>
  ({ definition: schema, schemaSha256: hash }) as CompiledApprovalTypedForm;

describe('typed definition latest-source compilation fence', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    compiler.compile.mockReset();
    compiler.requireSummary.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });
  it('rejects old async results and closes saving immediately on every schema edit', async () => {
    const first = typedEditorSeed('첫 번째', 'First');
    const second = typedEditorSeed('두 번째', 'Second');
    let resolveFirst!: (value: CompiledApprovalTypedForm) => void;
    let resolveSecond!: (value: CompiledApprovalTypedForm) => void;
    compiler.compile
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          })
      );
    await act(async () => root.render(<Probe schema={first} />));
    expect(latest.pending).toBe(true);
    await act(async () => root.render(<Probe schema={second} />));
    await act(async () => resolveFirst(compiled(first, 'old')));
    expect(latest.compiled).toBeNull();
    expect(latest.pending).toBe(true);
    await act(async () => resolveSecond(compiled(second, 'new')));
    expect(latest.compiled?.schemaSha256).toBe('new');
    expect(latest.pending).toBe(false);
    await act(async () => root.render(<Probe schema={second} enabled={false} />));
    expect(latest.compiled).toBeNull();
  });
  it('marks actual compiler/summary failures invalid without exposing raw engine messages', async () => {
    compiler.compile.mockRejectedValue(new Error('internal raw engine message'));
    await act(async () => root.render(<Probe schema={typedEditorSeed('내용', 'Summary')} />));
    expect(latest.invalid).toBe(true);
    expect(latest.compiled).toBeNull();
    expect(latest).not.toHaveProperty('message');
  });
});
