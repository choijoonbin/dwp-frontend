import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  EMPLOYMENT_ASSIGNMENTS_PATH,
  EMPLOYMENT_DOCUMENTS_PATH,
  getEmploymentAssignmentsWorkbench,
  getEmploymentDocumentsWorkbench,
  selectEmploymentAssignmentsWorkbench,
  selectEmploymentDocumentsWorkbench,
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

  it('fails closed on malformed, foreign-shaped, oversized or duplicate self documents', () => {
    const document = {
      workerPublicId: '10000000-0000-4000-8000-000000000001',
      relationshipPublicId: '10000000-0000-4000-8000-000000000002',
      assignmentPublicId: '10000000-0000-4000-8000-000000000003',
      relationshipType: 'EMPLOYEE',
      validFrom: '2026-01-01',
      validToExclusive: null,
      status: 'ACTIVE',
      revision: 4,
    } as const;
    const projection = {
      asOf: '2026-10-01T00:00:00Z',
      documents: [document],
    } as const;

    expect(selectEmploymentDocumentsWorkbench(projection)).toEqual(projection);
    expect(() =>
      selectEmploymentDocumentsWorkbench({ ...projection, tenantId: 'foreign-tenant' })
    ).toThrow('workbench is invalid');
    expect(() =>
      selectEmploymentDocumentsWorkbench({
        ...projection,
        documents: [{ ...document, workerPublicId: 'not-a-worker-id' }],
      })
    ).toThrow('projection is invalid');
    expect(() =>
      selectEmploymentDocumentsWorkbench({ ...projection, documents: [document, document] })
    ).toThrow('duplicate identities');
    expect(() =>
      selectEmploymentDocumentsWorkbench({
        ...projection,
        documents: Array.from({ length: 501 }, (_, revision) => ({ ...document, revision })),
      })
    ).toThrow('workbench is invalid');
  });

  it('accepts the backend assignment DTO with Instant owner validity evidence', () => {
    const owner = {
      owner: 'HRM',
      schemaId: 'HRM.Organization.v1',
      publicId: '30000000-0000-4000-8000-000000000001',
      revision: 4,
      contentHash: 'a'.repeat(64),
      validFrom: '2025-01-01T00:00:00Z',
      validToExclusive: '2027-01-01T00:00:00Z',
    } as const;
    const assignment = {
      personPublicId: '10000000-0000-4000-8000-000000000001',
      workerPublicId: '10000000-0000-4000-8000-000000000002',
      workerStatus: 'ACTIVE',
      workerVersion: 7,
      relationshipPublicId: '10000000-0000-4000-8000-000000000003',
      relationshipType: 'EMPLOYEE',
      relationshipStart: '2025-01-01',
      relationshipEnd: null,
      relationshipVersion: 6,
      assignmentPublicId: '10000000-0000-4000-8000-000000000004',
      assignmentStatus: 'ACTIVE',
      validFrom: '2025-01-01',
      validToExclusive: null,
      primary: true,
      fte: '1.0',
      assignmentVersion: 5,
      legalEmployerRef: { ...owner, schemaId: 'HRM.LegalEmployer.v1' },
      organizationRef: owner,
      positionRef: { ...owner, schemaId: 'HRM.Position.v1' },
      jobRef: { ...owner, schemaId: 'HRM.Job.v1' },
      workLocationRef: { ...owner, schemaId: 'HRM.WorkLocation.v1' },
    } as const;
    const projection = {
      asOf: '2026-10-01T00:00:00Z',
      assignments: [assignment],
    } as const;

    expect(selectEmploymentAssignmentsWorkbench(projection)).toEqual(projection);
    expect(
      selectEmploymentAssignmentsWorkbench({
        ...projection,
        assignments: [
          {
            ...assignment,
            fte: null,
            organizationRef: null,
            positionRef: null,
            jobRef: null,
            workLocationRef: null,
          },
        ],
      })
    ).toEqual({
      ...projection,
      assignments: [
        {
          ...assignment,
          fte: null,
          organizationRef: null,
          positionRef: null,
          jobRef: null,
          workLocationRef: null,
        },
      ],
    });
    expect(() =>
      selectEmploymentAssignmentsWorkbench({
        ...projection,
        assignments: [
          {
            ...assignment,
            organizationRef: { ...owner, validFrom: '2025-01-01' },
          },
        ],
      })
    ).toThrow('owner evidence is invalid');
  });
});
