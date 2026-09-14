// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApprovalDocumentDownloadDialog } from './approval-document-download-dialog';
import type { ApprovalGeneratedDocument } from '@dwp-frontend/shared-utils/api/approval-document-contract';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const id = '00000000-0000-4000-8000-000000000001';
async function artifact(): Promise<ApprovalGeneratedDocument> {
  const content = '{"title":"검토 문서"}';
  const bytes = new TextEncoder().encode(content);
  const digest = await webcrypto.subtle.digest('SHA-256', bytes);
  return {
    exportId: id,
    format: 'JSON',
    mediaType: 'application/json',
    fileName: `approval-${id}.json`,
    content,
    sha256: Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join(
      ''
    ),
    sizeBytes: bytes.byteLength,
    policyVersion: 0,
    generatedAt: new Date(Date.now() - 1000).toISOString(),
    expiresAt: new Date(Date.now() + 30000).toISOString(),
    retainUntil: new Date(Date.now() + 86400000).toISOString(),
  };
}
let root: Root | null;
let container: HTMLDivElement;
let onClose = vi.fn<() => void>();
let clicked: ReturnType<typeof vi.spyOn>;
async function mount(
  data: ApprovalGeneratedDocument,
  verify: () => Promise<void>,
  current = () => true
) {
  await act(async () => {
    root!.render(
      <StrictMode>
        <ApprovalDocumentDownloadDialog
          document={data}
          onVerify={verify}
          isCurrent={current}
          onClose={onClose}
        />
      </StrictMode>
    );
    await new Promise((resolve) => setTimeout(resolve, 250));
  });
  return getByRole(getByRole(document.body, 'dialog'), 'button', {
    name: 'requests.documents.download',
  });
}
describe('actual controlled download dialog', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:owned'),
      revokeObjectURL: vi.fn(),
    });
    clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    onClose = vi.fn<() => void>();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    if (root) await act(async () => root!.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
  });
  it('never auto-downloads on StrictMode mount and serializes same-tick submit clicks', async () => {
    const verify = vi.fn().mockResolvedValue(undefined);
    const button = await mount(await artifact(), verify);
    expect(clicked).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(verify).toHaveBeenCalledTimes(1);
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:owned');
  });
  it.each(['UNMOUNT', 'CONTEXT', 'AUTHORITY'] as const)(
    'does not create a URL after %s changes during verification',
    async (change) => {
      let resolve!: () => void;
      let reject!: (error: Error) => void;
      let current = true;
      const verify = vi.fn(
        () =>
          new Promise<void>((yes, no) => {
            resolve = yes;
            reject = no;
          })
      );
      const button = await mount(await artifact(), verify, () => current);
      await act(async () => fireEvent.click(button));
      await vi.waitFor(() => expect(verify).toHaveBeenCalledTimes(1));
      if (change === 'UNMOUNT') {
        await act(async () => root!.unmount());
        root = null;
      } else if (change === 'CONTEXT') current = false;
      await act(async () => {
        if (change === 'AUTHORITY') reject(new Error('403'));
        else resolve();
      });
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(URL.createObjectURL).not.toHaveBeenCalled();
      expect(clicked).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    }
  );
  it.each(['HASH', 'SIZE', 'EXPIRED'] as const)(
    'rejects %s without current-authority verification or file delivery',
    async (defect) => {
      const data = await artifact();
      const bad = {
        ...data,
        ...(defect === 'HASH' ? { sha256: 'f'.repeat(64) } : {}),
        ...(defect === 'SIZE' ? { sizeBytes: data.sizeBytes + 1 } : {}),
        ...(defect === 'EXPIRED' ? { expiresAt: new Date(Date.now() - 1).toISOString() } : {}),
      };
      const verify = vi.fn();
      const button = await mount(bad, verify);
      await act(async () => fireEvent.click(button));
      await vi.waitFor(() => expect(getByRole(document.body, 'alert')).toBeTruthy());
      expect(verify).not.toHaveBeenCalled();
      expect(URL.createObjectURL).not.toHaveBeenCalled();
      expect(clicked).not.toHaveBeenCalled();
    }
  );
});
