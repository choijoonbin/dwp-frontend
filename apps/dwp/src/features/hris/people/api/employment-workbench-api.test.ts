import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  EMPLOYMENT_ASSIGNMENTS_PATH,
  EMPLOYMENT_DOCUMENTS_PATH,
  getEmploymentAssignmentsWorkbench,
  getEmploymentDocumentsWorkbench,
} from './employment-workbench-api';

describe('employment workbench reads', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the unwrapped self-service and operations projections with an effective instant', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ asOf: '2026-10-01T00:00:00Z', documents: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ asOf: '2026-10-01T00:00:00Z', assignments: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      getEmploymentDocumentsWorkbench('scope:tenant/hrm', '2026-10-01T00:00:00Z')
    ).resolves.toEqual({ asOf: '2026-10-01T00:00:00Z', documents: [] });
    await expect(
      getEmploymentAssignmentsWorkbench('scope:tenant/hrm', '2026-10-01T00:00:00Z')
    ).resolves.toEqual({ asOf: '2026-10-01T00:00:00Z', assignments: [] });

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls).toEqual([
      `${EMPLOYMENT_DOCUMENTS_PATH}?asOf=2026-10-01T00%3A00%3A00Z&contextScopeKey=scope%3Atenant%2Fhrm`,
      `${EMPLOYMENT_ASSIGNMENTS_PATH}?asOf=2026-10-01T00%3A00%3A00Z&contextScopeKey=scope%3Atenant%2Fhrm`,
    ]);
  });
});
