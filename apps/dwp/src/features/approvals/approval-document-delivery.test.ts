// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  downloadApprovalDocumentArtifact,
  verifyApprovalPrintHtml,
} from './approval-document-delivery';
import type { ApprovalGeneratedDocument } from '@dwp-frontend/shared-utils/api/approval-document-contract';

const id = '00000000-0000-0000-0000-000000000001';
const html = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"></head><body><h1>검토 문서</h1></body></html>`;
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
describe('controlled document browser delivery', () => {
  beforeEach(() => vi.stubGlobal('crypto', webcrypto));
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  it('downloads only after current authority, bytes and expiry are checked and disposes the URL', async () => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:owned'),
      revokeObjectURL: vi.fn(),
    });
    const clicked = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const verify = vi.fn().mockResolvedValue(undefined);
    await downloadApprovalDocumentArtifact(await artifact(), verify, () => true);
    expect(verify).toHaveBeenCalledOnce();
    expect(clicked).toHaveBeenCalledOnce();
    expect(document.querySelector('a')).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:owned');
  });
  it.each(['AUTHORITY', 'CONTEXT', 'EXPIRY'] as const)(
    'never creates a file after %s changes during verification',
    async (change) => {
      vi.stubGlobal('URL', { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() });
      const data = await artifact();
      const verify = async () => {
        if (change === 'AUTHORITY') throw new Error('403');
        if (change === 'EXPIRY') vi.spyOn(Date, 'now').mockReturnValue(Date.parse(data.expiresAt));
      };
      await expect(
        downloadApprovalDocumentArtifact(data, verify, () => change !== 'CONTEXT')
      ).rejects.toThrow();
      expect(URL.createObjectURL).not.toHaveBeenCalled();
    }
  );
  it('permits only a controlled print document and rejects active content even if server bytes were hashed', () => {
    expect(verifyApprovalPrintHtml(html)).toBe(html);
    for (const unsafe of [
      '<script>alert(1)</script>',
      '<iframe src="https://evil.invalid"></iframe>',
      '<form></form>',
      '<p onclick="alert(1)">x</p>',
      '<object></object>',
    ])
      expect(() => verifyApprovalPrintHtml(html.replace('</body>', `${unsafe}</body>`))).toThrow();
    expect(() =>
      verifyApprovalPrintHtml(html.replace("default-src 'none'", 'default-src *'))
    ).toThrow();
  });
});
