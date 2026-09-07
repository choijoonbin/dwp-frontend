import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import {
  getVideoMeetingPreparation,
  issueVideoMeetingMaterialAccessTicket,
  registerVideoMeetingMaterial,
  removeVideoMeetingMaterial,
  replaceVideoMeetingAgenda,
  replaceMyVideoMeetingPreparation,
  respondVideoMeetingInvitation,
  serializeVideoMeetingPreparationSource,
  type VideoMeetingAgendaInput,
} from './video-meeting-preparation-api';
import { scheduleVideoMeeting, type ScheduleVideoMeetingInput } from './video-meeting-api';

const id = '88000000-0000-4000-8000-000000000001';
const key = '88000000-0000-4000-8000-000000000002';
const participantId = '88000000-0000-4000-8000-000000000003';
const secondAgendaId = '88000000-0000-4000-8000-000000000004';
const item: VideoMeetingAgendaInput = {
  title: ' Decision ',
  objective: ' Evidence ',
  ownerUserId: 7,
  plannedMinutes: 15,
};
function preparation(overrides: Record<string, unknown> = {}) {
  return {
    meetingId: id,
    meetingVersion: 3,
    agendaVersion: 2,
    materialsVersion: 1,
    invitationRevision: 4,
    agendaItems: [
      {
        itemId: key,
        position: 0,
        title: 'Decision',
        objective: 'Evidence',
        ownerUserId: 7,
        ownerDisplayName: 'Joon',
        plannedMinutes: 15,
      },
    ],
    materials: [],
    myResponse: null,
    invitationResponses: [],
    invitationCounts: { accepted: 0, tentative: 0, declined: 0, pending: 0 },
    myPreparation: {
      agendaVersion: 2,
      version: 0,
      preparedAgendaItemIds: [],
      updatedAt: null,
    },
    canEditAgenda: true,
    canManageMaterials: true,
    canRespond: false,
    canPrepare: true,
    observedAt: '2099-09-04T00:00:02Z',
    ...overrides,
  };
}
function transport(data: unknown, status = 200) {
  const fetch = vi.fn().mockImplementation(
    async (url: string) =>
      ({
        ok: status < 400,
        status,
        text: async () =>
          JSON.stringify({
            data: url.includes('/csrf') ? { token: 'csrf', headerName: 'X-XSRF-TOKEN' } : data,
          }),
      }) as Response
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
function last(fetch: ReturnType<typeof transport>) {
  return [...fetch.mock.calls].reverse().find(([url]) => !String(url).includes('/csrf')) as [
    string,
    RequestInit,
  ];
}
describe('V29 preparation and scheduling public contract', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });
  it('keeps the legacy create body unchanged when optional preparation is omitted', () => {
    expect(serializeVideoMeetingPreparationSource({})).toEqual({});
  });
  it('allowlists preparation fields and strips client-only roles, keys, consent and credentials', () => {
    expect(
      serializeVideoMeetingPreparationSource({
        sourceTemplateId: id,
        sourceTemplateVersion: 2,
        agendaItems: [
          { ...item, key: 'ui-only', roleHint: 'host', consent: true } as VideoMeetingAgendaInput,
        ],
      })
    ).toEqual({
      sourceTemplateId: id,
      sourceTemplateVersion: 2,
      agendaItems: [
        { title: 'Decision', objective: 'Evidence', ownerUserId: 7, plannedMinutes: 15 },
      ],
    });
  });
  it.each([
    { sourceTemplateId: id },
    { sourceTemplateVersion: 1 },
    { sourceTemplateId: '../admin', sourceTemplateVersion: 1 },
    { sourceTemplateId: id, sourceTemplateVersion: -1 },
    { sourceTemplateId: id, sourceTemplateVersion: 0.5 },
    { agendaItems: [{ ...item, itemId: key }] },
    { agendaItems: [{ ...item, title: ' ' }] },
    { agendaItems: [{ ...item, ownerUserId: -1 }] },
    { agendaItems: [{ ...item, plannedMinutes: 0 }] },
    { agendaItems: [{ ...item, plannedMinutes: 1.5 }] },
  ])('rejects an invalid or transplanted source before transport: %s', (patch) => {
    expect(() => serializeVideoMeetingPreparationSource(patch)).toThrow();
  });
  it('GET uses the exact public meeting route and forwards cancellation', async () => {
    const fetch = transport(preparation());
    await getVideoMeetingPreparation(id, new AbortController().signal);
    expect(last(fetch)[0]).toBe('/api/meetings/v1/meetings/' + id + '/preparation');
    expect(last(fetch)[1].signal).toBeDefined();
  });
  it('projects only the strict preparation allowlist and drops server-side identity hints', async () => {
    transport(
      preparation({
        tenantId: 99,
        ownerUserId: 7,
        deviceId: 'never',
        consent: true,
        token: 'never',
        agendaItems: [
          {
            itemId: key,
            position: 0,
            title: 'Decision',
            objective: 'Evidence',
            ownerUserId: 7,
            ownerDisplayName: 'Joon',
            plannedMinutes: 15,
            tenantId: 99,
            token: 'never',
          },
        ],
        myPreparation: {
          agendaVersion: 2,
          version: 0,
          preparedAgendaItemIds: [],
          updatedAt: null,
          participantId,
          userId: 7,
        },
      })
    );
    const result = await getVideoMeetingPreparation(id);
    expect(result).not.toHaveProperty('tenantId');
    expect(result).not.toHaveProperty('ownerUserId');
    expect(result).not.toHaveProperty('deviceId');
    expect(result).not.toHaveProperty('consent');
    expect(result).not.toHaveProperty('token');
    expect(result.agendaItems[0]).not.toHaveProperty('tenantId');
    expect(result.agendaItems[0]).not.toHaveProperty('token');
    expect(result.myPreparation).not.toHaveProperty('participantId');
    expect(result.myPreparation).not.toHaveProperty('userId');
  });
  it('replaces only my checklist with canonical agenda IDs and optimistic versions', async () => {
    const agendaItems = [
      preparation().agendaItems[0],
      {
        itemId: secondAgendaId,
        position: 1,
        title: 'Release',
        objective: null,
        ownerUserId: null,
        ownerDisplayName: null,
        plannedMinutes: 10,
      },
    ];
    const fetch = transport(
      preparation({
        agendaItems,
        myPreparation: {
          agendaVersion: 2,
          version: 1,
          preparedAgendaItemIds: [key, secondAgendaId],
          updatedAt: '2099-09-04T00:00:01Z',
          participantId,
          completionCount: 2,
        },
      })
    );
    const result = await replaceMyVideoMeetingPreparation(id, [secondAgendaId, key], 2, 0, key);
    const [url, init] = last(fetch);
    expect(url).toBe('/api/meetings/v1/meetings/' + id + '/my-preparation');
    expect(JSON.parse(String(init.body))).toEqual({
      expectedAgendaVersion: 2,
      expectedVersion: 0,
      preparedAgendaItemIds: [key, secondAgendaId],
    });
    expect(init.headers).toEqual(expect.objectContaining({ 'Idempotency-Key': key }));
    expect(result.myPreparation).toEqual({
      agendaVersion: 2,
      version: 1,
      preparedAgendaItemIds: [key, secondAgendaId],
      updatedAt: '2099-09-04T00:00:01Z',
    });
    expect(result.myPreparation).not.toHaveProperty('participantId');
    expect(result.myPreparation).not.toHaveProperty('completionCount');
  });
  it.each([
    { myPreparation: { agendaVersion: 3, version: 0, preparedAgendaItemIds: [], updatedAt: null } },
    {
      myPreparation: {
        agendaVersion: 2,
        version: 1,
        preparedAgendaItemIds: [participantId],
        updatedAt: '2099-09-04T00:00:01Z',
      },
    },
    {
      myPreparation: {
        agendaVersion: 2,
        version: 1,
        preparedAgendaItemIds: [key, key],
        updatedAt: '2099-09-04T00:00:01Z',
      },
    },
    { invitationCounts: { accepted: 0, tentative: 0, declined: 0, pending: 1 } },
    {
      agendaItems: [
        {
          itemId: key,
          position: 1,
          title: 'Decision',
          objective: null,
          ownerUserId: null,
          ownerDisplayName: null,
          plannedMinutes: 15,
        },
      ],
    },
  ])('rejects an unbound personal-preparation projection: %s', async (patch) => {
    transport(preparation(patch));
    await expect(getVideoMeetingPreparation(id)).rejects.toThrow();
  });
  it('PUT agenda uses immutable item identities, optimistic version and caller stable key', async () => {
    const fetch = transport(preparation());
    await replaceVideoMeetingAgenda(id, [{ ...item, itemId: key }], 3, key);
    const [url, init] = last(fetch);
    expect(url).toBe('/api/meetings/v1/meetings/' + id + '/agenda');
    expect(JSON.parse(String(init.body))).toEqual({
      expectedAgendaVersion: 3,
      items: [
        {
          itemId: key,
          title: 'Decision',
          objective: 'Evidence',
          ownerUserId: 7,
          plannedMinutes: 15,
        },
      ],
    });
    expect(init.headers).toEqual(expect.objectContaining({ 'Idempotency-Key': key }));
  });
  it('RSVP carries invitation and response revisions without admission or actor fields', async () => {
    const fetch = transport(preparation());
    await respondVideoMeetingInvitation(id, 'ACCEPTED', 2, 0, key);
    const [url, init] = last(fetch);
    expect(url).toBe('/api/meetings/v1/meetings/' + id + '/invitation-response');
    expect(JSON.parse(String(init.body))).toEqual({
      response: 'ACCEPTED',
      expectedInvitationRevision: 2,
      expectedVersion: 0,
    });
  });
  it('registers only allowlisted governed material metadata with a stable command key', async () => {
    const fetch = transport(preparation());
    await registerVideoMeetingMaterial(
      id,
      {
        displayName: ' Release evidence ',
        contentType: 'Application/PDF',
        referenceProvider: 'DWP_FILES',
        opaqueReference: 'files/release-evidence',
        sourceVersion: 'v7',
        classification: 'CONFIDENTIAL',
        sizeBytes: 2048,
        contentSha256: 'a'.repeat(64),
        token: 'never',
        contents: 'never',
      } as Parameters<typeof registerVideoMeetingMaterial>[1],
      4,
      key
    );
    const [url, init] = last(fetch);
    expect(url).toBe('/api/meetings/v1/meetings/' + id + '/materials');
    expect(JSON.parse(String(init.body))).toEqual({
      displayName: 'Release evidence',
      contentType: 'application/pdf',
      referenceProvider: 'DWP_FILES',
      opaqueReference: 'files/release-evidence',
      sourceVersion: 'v7',
      classification: 'CONFIDENTIAL',
      sizeBytes: 2048,
      contentSha256: 'a'.repeat(64),
      expectedMaterialsVersion: 4,
    });
    expect(init.headers).toEqual(expect.objectContaining({ 'Idempotency-Key': key }));
  });
  it('soft-removes a bound material using both collection and row versions', async () => {
    const fetch = transport(preparation());
    await removeVideoMeetingMaterial(id, key, 5, 2, key);
    const [url, init] = last(fetch);
    expect(url).toBe('/api/meetings/v1/meetings/' + id + `/materials/${key}/remove`);
    expect(JSON.parse(String(init.body))).toEqual({
      expectedMaterialsVersion: 5,
      expectedVersion: 2,
    });
  });
  it('requests a short-lived material ticket without putting the source reference in the URL', async () => {
    const fetch = transport({
      meetingId: id,
      materialId: key,
      materialVersion: 2,
      accessUrl: 'https://files.example.test/meeting-materials/open?ticket=short-lived-ticket-001',
      expiresAt: '2099-09-04T00:01:00Z',
      contentType: 'application/pdf',
      displayName: 'Release evidence',
    });
    const result = await issueVideoMeetingMaterialAccessTicket(id, key, 2);
    const [url, init] = last(fetch);
    expect(url).toBe('/api/meetings/v1/meetings/' + id + `/materials/${key}/access-ticket`);
    expect(JSON.parse(String(init.body))).toEqual({ expectedVersion: 2 });
    expect(result.accessUrl).not.toContain('files/release-evidence');
  });
  it.each([
    { meetingId: key },
    { materialId: id },
    { materialVersion: 3 },
    { accessUrl: 'http://files.example.test/meeting-materials/open' },
    { accessUrl: 'https://user@files.example.test/meeting-materials/open' },
    { expiresAt: '2000-01-01T00:00:00Z' },
  ])('rejects an unbound or unsafe material ticket: %s', async (patch) => {
    transport({
      meetingId: id,
      materialId: key,
      materialVersion: 2,
      accessUrl: 'https://files.example.test/meeting-materials/open?ticket=short-lived-ticket-001',
      expiresAt: '2099-09-04T00:01:00Z',
      contentType: 'application/pdf',
      displayName: 'Release evidence',
      ...patch,
    });
    await expect(issueVideoMeetingMaterialAccessTicket(id, key, 2)).rejects.toThrow(
      'Invalid material access ticket'
    );
  });
  it.each([
    { opaqueReference: 'https://files.example.test/a' },
    { opaqueReference: 'file?id=secret' },
    { sourceVersion: 'bad version' },
    { contentSha256: 'A'.repeat(64) },
    { sizeBytes: 10_737_418_241 },
  ])('rejects unsafe material metadata before transport: %s', async (patch) => {
    const fetch = transport(preparation());
    await expect(
      registerVideoMeetingMaterial(
        id,
        {
          displayName: 'Evidence',
          contentType: 'application/pdf',
          referenceProvider: 'DWP_FILES',
          opaqueReference: 'files/evidence',
          sourceVersion: null,
          classification: 'INTERNAL',
          sizeBytes: null,
          contentSha256: null,
          ...patch,
        },
        0,
        key
      )
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    () => getVideoMeetingPreparation(id),
    () => replaceVideoMeetingAgenda(id, [item], 0, key),
    () => respondVideoMeetingInvitation(id, 'TENTATIVE', 1, 0, key),
    () =>
      registerVideoMeetingMaterial(
        id,
        {
          displayName: 'Evidence',
          contentType: 'application/pdf',
          referenceProvider: 'DWP_FILES',
          opaqueReference: 'files/evidence',
          classification: 'INTERNAL',
        },
        0,
        key
      ),
    () => removeVideoMeetingMaterial(id, key, 1, 0, key),
  ])('rejects another meeting in the read or mutation response', async (execute) => {
    transport(preparation({ meetingId: key }));
    await expect(execute()).rejects.toThrow('binding');
  });
  it('rejects invalid UUIDs, duplicate item identities, versions and keys before transport', async () => {
    const fetch = transport(preparation());
    await expect(getVideoMeetingPreparation('../admin')).rejects.toThrow();
    await expect(
      replaceVideoMeetingAgenda(
        id,
        [
          { ...item, itemId: key },
          { ...item, itemId: key },
        ],
        0,
        key
      )
    ).rejects.toThrow();
    await expect(respondVideoMeetingInvitation(id, 'ACCEPTED', 0, 0, key)).rejects.toThrow();
    await expect(respondVideoMeetingInvitation(id, 'ACCEPTED', 1, 0, '')).rejects.toThrow();
    await expect(replaceMyVideoMeetingPreparation(id, [key, key], 2, 0, key)).rejects.toThrow();
    await expect(replaceMyVideoMeetingPreparation(id, [key], -1, 0, key)).rejects.toThrow();
    await expect(replaceMyVideoMeetingPreparation(id, [key], 2, 0, '')).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('schedule serializes real agenda/source fields while retaining media-off and existing contracts', async () => {
    const fetch = transport({
      meeting: {
        meetingId: id,
        title: 'Decision',
        participants: [],
        artifacts: [],
        startsAt: '2027-01-01T00:00:00Z',
        endsAt: '2027-01-01T00:45:00Z',
        durationMinutes: 45,
        accessScope: 'INVITED',
        lifecycleState: 'SCHEDULED',
      },
      meetingCode: 'ABCD-EFGH-JKMN',
    });
    const input: ScheduleVideoMeetingInput = {
      title: 'Decision',
      startsAt: '2027-01-01T00:00:00Z',
      durationMinutes: 45,
      timeZone: 'Asia/Seoul',
      participantUserIds: [7],
      accessScope: 'INVITED',
      waitingRoomEnabled: true,
      allowJoinBeforeHost: false,
      defaultMicrophoneEnabled: false,
      defaultCameraEnabled: false,
      idempotencyKey: key,
      agendaItems: [item],
      sourceTemplateId: id,
      sourceTemplateVersion: 2,
    };
    await scheduleVideoMeeting(input);
    const [url, init] = last(fetch);
    expect(url).toBe('/api/meetings/v1/meetings');
    expect(JSON.parse(String(init.body))).toEqual(
      expect.objectContaining({
        sourceTemplateId: id,
        sourceTemplateVersion: 2,
        agendaItems: [
          { title: 'Decision', objective: 'Evidence', ownerUserId: 7, plannedMinutes: 15 },
        ],
        defaultMicrophoneEnabled: false,
        defaultCameraEnabled: false,
      })
    );
  });
  it.each([401, 403, 409, 503])('propagates %s without a success fallback', async (status) => {
    transport(null, status);
    await expect(getVideoMeetingPreparation(id)).rejects.toThrow();
  });
});
