import { useEffect, useRef, useState } from 'react';
import { HttpError } from '@dwp-frontend/shared-utils';
import {
  getMeetingRecordRetention,
  updateMeetingRecordRetention,
  type MeetingRecordRetention,
  type MeetingRecordRetentionCommand,
} from '@dwp-frontend/shared-utils/api/video-meeting-record-retention-api';

type Attempt = { meetingId: string; input: MeetingRecordRetentionCommand; commandId: string };
type Phase =
  'idle' | 'loading' | 'ready' | 'saving' | 'error' | 'uncertain' | 'denied' | 'conflict';
export function useMeetingRecordRetention(canManage: boolean) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [data, setData] = useState<MeetingRecordRetention | null>(null);
  const active = useRef(false);
  const request = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const attempt = useRef<Attempt | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current?.abort();
      attempt.current = null;
    };
  }, []);
  const reset = () => {
    request.current?.abort();
    request.current = null;
    pending.current = false;
    attempt.current = null;
    setData(null);
    setPhase('idle');
  };
  const perform = async (meetingId: string, command?: Attempt) => {
    if (pending.current || (command && !canManage)) return;
    pending.current = true;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const current = () =>
      active.current && request.current === controller && !controller.signal.aborted;
    setData(null);
    setPhase(command ? 'saving' : 'loading');
    try {
      const result = command
        ? await updateMeetingRecordRetention(
            meetingId,
            command.input,
            command.commandId,
            controller.signal
          )
        : await getMeetingRecordRetention(meetingId, controller.signal);
      if (!current()) return;
      attempt.current = null;
      setData(result);
      setPhase('ready');
    } catch (error) {
      if (!current()) return;
      if (error instanceof HttpError && [401, 403, 404, 410].includes(error.status)) {
        attempt.current = null;
        setPhase('denied');
      } else if (error instanceof HttpError && [400, 409, 422].includes(error.status)) {
        attempt.current = null;
        setPhase('conflict');
      } else setPhase(command ? 'uncertain' : 'error');
    } finally {
      if (current()) pending.current = false;
    }
  };
  return {
    phase,
    data,
    reset,
    busy: phase === 'loading' || phase === 'saving',
    load: (meetingId: string) => {
      // An uncertain mutation must first be resolved using the identical command.
      if (!attempt.current) void perform(meetingId);
    },
    update: (snapshot: MeetingRecordRetention, hold: boolean, purgeAuthorized: boolean) => {
      if (
        !canManage ||
        phase !== 'ready' ||
        data !== snapshot ||
        attempt.current ||
        snapshot.state === 'PURGED'
      )
        return;
      const command = {
        meetingId: snapshot.meetingId,
        commandId: crypto.randomUUID(),
        input: {
          expectedMeetingVersion: snapshot.meetingVersion,
          expectedPolicyVersion: snapshot.policyVersion,
          expectedControlVersion: snapshot.controlVersion,
          hold,
          purgeAuthorized,
        },
      };
      attempt.current = command;
      void perform(snapshot.meetingId, command);
    },
    retry: () => {
      const command = attempt.current;
      if (command) void perform(command.meetingId, command);
    },
  };
}
