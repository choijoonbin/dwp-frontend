import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createVideoMeetingPersonalRoom,
  createVideoMeetingPersonalRoomSession,
  getVideoMeetingPersonalRoom,
  getVideoMeetingPersonalRoomSessions,
  rotateVideoMeetingPersonalRoomInvitation,
  updateVideoMeetingPersonalRoom,
  type VideoMeetingPersonalRoom,
} from '@dwp-frontend/shared-utils/api/video-meeting-personal-room-api';
import {
  createMeetingIntelligenceAuthorizationFence,
  MeetingIntelligenceAuthorizationSupersededError,
} from './meeting-intelligence-authorization-fence';
import {
  personalRoomCommandFailure,
  personalRoomInvitationUrl,
} from './meeting-personal-room-model';

type Notice =
  'created' | 'updated' | 'rotated' | 'copied' | 'copyFailed' | 'conflict' | 'failed' | null;
type Command = 'create' | 'update' | 'rotate' | 'start';

export function useMeetingPersonalRoomState(
  scope: string,
  enabled: boolean,
  onEnterMeeting: (meetingId: string) => void
) {
  const client = useQueryClient();
  const authority = useMemo(() => createMeetingIntelligenceAuthorizationFence(scope), [scope]);
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const [revoked, setRevoked] = useState(false);
  const [busy, setBusy] = useState<Command | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [page, setPage] = useState(0);
  const key = ['meetings', 'personal-room', scope] as const;
  const revoke = () => {
    authority.revoke();
    client.setQueriesData({ queryKey: key }, null);
    setRevoked(true);
    setNotice(null);
  };
  const room = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const validation = authority.beginValidation();
      try {
        const value = await getVideoMeetingPersonalRoom(signal);
        if (!authority.authorize(validation))
          throw new MeetingIntelligenceAuthorizationSupersededError();
        return value;
      } catch (error) {
        if (
          !signal.aborted &&
          authority.deny(validation) !== null &&
          personalRoomCommandFailure(error) === 'forbidden'
        ) {
          client.setQueriesData({ queryKey: key }, null);
          setRevoked(true);
        }
        throw error;
      }
    },
    enabled: enabled && !revoked,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    meta: { accessSensitive: true },
  });
  const history = useQuery({
    queryKey: [...key, 'sessions', room.data?.roomId, page],
    queryFn: async ({ signal }) => {
      const generation = authority.capture();
      try {
        const value = await getVideoMeetingPersonalRoomSessions(page, 5, signal);
        if (!authority.canCommit(generation))
          throw new MeetingIntelligenceAuthorizationSupersededError();
        return value;
      } catch (error) {
        if (
          !signal.aborted &&
          authority.canCommit(generation) &&
          personalRoomCommandFailure(error) === 'forbidden'
        )
          revoke();
        throw error;
      }
    },
    enabled: enabled && !revoked && !room.isError && Boolean(room.data),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    meta: { accessSensitive: true },
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      authority.revoke();
    };
  }, [authority]);
  const run = async <T,>(
    kind: Command,
    body: unknown,
    execute: (idempotencyKey: string) => Promise<T>,
    commit: (result: T) => void
  ) => {
    const generation = authority.capture();
    if (inFlight.current || !mounted.current || !authority.canCommit(generation) || !enabled)
      return false;
    inFlight.current = true;
    setBusy(kind);
    setNotice(null);
    try {
      const fingerprint = JSON.stringify({ kind, body });
      if (attempt.current?.fingerprint !== fingerprint)
        attempt.current = { fingerprint, key: crypto.randomUUID() };
      const result = await execute(attempt.current.key);
      if (!mounted.current || !authority.canCommit(generation)) return false;
      commit(result);
      attempt.current = null;
      return true;
    } catch (error) {
      if (!mounted.current || !authority.canCommit(generation)) return false;
      const failure = personalRoomCommandFailure(error);
      if (failure === 'forbidden') revoke();
      else setNotice(failure);
      return false;
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(null);
    }
  };
  const writeRoom = (value: VideoMeetingPersonalRoom, message: Notice) => {
    client.setQueryData(key, value);
    setNotice(message);
  };
  const create = (name: string) =>
    run(
      'create',
      { name: name.trim() },
      (id) => createVideoMeetingPersonalRoom(name, id),
      (value) => writeRoom(value, 'created')
    );
  const rename = (name: string, current: VideoMeetingPersonalRoom) =>
    run(
      'update',
      { name: name.trim(), expectedVersion: current.version },
      (id) => updateVideoMeetingPersonalRoom(name, current.version, id),
      (value) => writeRoom(value, 'updated')
    );
  const rotate = (current: VideoMeetingPersonalRoom) =>
    run(
      'rotate',
      { expectedVersion: current.version },
      (id) => rotateVideoMeetingPersonalRoomInvitation(current.version, id),
      (value) => writeRoom(value, 'rotated')
    );
  const start = (current: VideoMeetingPersonalRoom) =>
    run(
      'start',
      { expectedVersion: current.version, invitationRevision: current.invitationRevision },
      (id) =>
        createVideoMeetingPersonalRoomSession(current.version, current.invitationRevision, id),
      (value) => {
        void client.invalidateQueries({ queryKey: key });
        onEnterMeeting(value.meetingId);
      }
    );
  const copy = async (
    current: VideoMeetingPersonalRoom,
    invitationText?: (url: string) => string
  ) => {
    const generation = authority.capture();
    if (!mounted.current || !authority.canCommit(generation) || inFlight.current) return;
    try {
      const url = personalRoomInvitationUrl(window.location.origin, current);
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable.');
      await navigator.clipboard.writeText(invitationText ? invitationText(url) : url);
      if (mounted.current && authority.canCommit(generation)) setNotice('copied');
    } catch {
      if (mounted.current && authority.canCommit(generation)) setNotice('copyFailed');
    }
  };
  const retry = () => {
    setRevoked(false);
    void room.refetch();
  };
  return {
    room,
    history,
    revoked,
    busy,
    notice,
    page,
    setPage,
    retry,
    create,
    rename,
    rotate,
    start,
    copy,
  };
}
