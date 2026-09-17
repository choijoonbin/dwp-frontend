import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  dwaionHandoffStrings,
  dwaionHandoffText,
  parseDwaionHandoff,
  parseDwaionProposalHandoffBinding,
  type CalendarEvent,
  type CalendarEventImportance,
  type CalendarEventType,
  type PermissionDTO,
  type DwaionProposalHandoffBinding,
} from '@dwp-frontend/shared-utils';
import {
  workCalendarEventHandoffDescription,
  workCalendarOwnerFingerprint,
  type WorkCalendarEventHandoff,
} from '@dwp-frontend/shared-utils/api/work-hub-calendar-api';

import { useWorkHubOperationOwner } from '../../components/use-work-hub-operation-owner';
import {
  authorizedWorkCalendarEventHandoff,
  clearCalendarWorkHandoffRecovery,
  hasWorkCalendarEventHandoff,
  isCurrentWorkCalendarHandoffOwner,
  readCalendarWorkHandoffRecovery,
  type CalendarWorkHandoffRecovery,
  type CalendarWorkHandoffReturnTarget,
} from './calendar-work-handoff';

export type CalendarCreateState = Readonly<{
  start: string;
  end?: string;
  type: CalendarEventType;
  title?: string;
  description?: string;
  timeZone?: string;
  calendarId?: string;
  visibility?: CalendarEvent['visibility'];
  importance?: CalendarEventImportance;
  attendeeEmails?: string[];
  fromDwaion?: boolean;
  dwaionProposalBinding?: DwaionProposalHandoffBinding;
  workHandoff?: WorkCalendarEventHandoff;
}>;

export function useCalendarCreateHandoff({
  canCreate,
  canCreateGranted,
  scheduleWritable,
  permissions,
  permissionsLoaded,
}: {
  canCreate: boolean;
  canCreateGranted: boolean;
  scheduleWritable: boolean;
  permissions: readonly PermissionDTO[];
  permissionsLoaded: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const workOperationOwner = useWorkHubOperationOwner();
  const [createState, setCreateState] = useState<CalendarCreateState | null>(null);
  const [retainedWorkHandoff, setRetainedWorkHandoff] = useState<WorkCalendarEventHandoff | null>(
    null
  );
  const [workRecovery, setWorkRecovery] = useState<CalendarWorkHandoffRecovery | null>(null);
  const [workOwnerBinding, setWorkOwnerBinding] = useState<{
    owner: string;
    fingerprint: string;
  } | null>(null);
  useEffect(() => {
    let active = true;
    if (!workOperationOwner) {
      setWorkOwnerBinding(null);
      return;
    }
    const submittedOwner = workOperationOwner;
    setWorkOwnerBinding((current) => (current?.owner === submittedOwner ? current : null));
    void workCalendarOwnerFingerprint(submittedOwner)
      .then((fingerprint) => {
        if (active) setWorkOwnerBinding({ owner: submittedOwner, fingerprint });
      })
      .catch(() => {
        if (active) setWorkOwnerBinding(null);
      });
    return () => {
      active = false;
    };
  }, [workOperationOwner]);
  const workOwnerFingerprint =
    workOwnerBinding?.owner === workOperationOwner ? workOwnerBinding.fingerprint : null;
  const workOwnerFingerprintRef = useRef(workOwnerFingerprint);
  workOwnerFingerprintRef.current = workOwnerFingerprint;
  const activeWorkHandoff = isCurrentWorkCalendarHandoffOwner(
    createState?.workHandoff,
    workOwnerFingerprint
  )
    ? createState.workHandoff
    : null;
  const dwaionHandoff = useMemo(
    () => parseDwaionHandoff(location.state, 'CALENDAR.EVENT.CREATE'),
    [location.state]
  );
  const dwaionProposalBinding = useMemo(
    () => parseDwaionProposalHandoffBinding(location.state),
    [location.state]
  );
  const routeWorkHandoff = useMemo(
    () => authorizedWorkCalendarEventHandoff(location.state, permissions, workOwnerFingerprint),
    [location.state, permissions, workOwnerFingerprint]
  );
  const workHandoffRequested = hasWorkCalendarEventHandoff(location.state);
  const retainedAuthorizedHandoff = useMemo(
    () =>
      retainedWorkHandoff
        ? authorizedWorkCalendarEventHandoff(
            { workCalendarEventHandoff: retainedWorkHandoff },
            permissions,
            workOwnerFingerprint,
            Date.now()
          )
        : null,
    [permissions, retainedWorkHandoff, workOwnerFingerprint]
  );
  const handoffReturnTarget = useMemo((): CalendarWorkHandoffReturnTarget | null => {
    const handoff = activeWorkHandoff ?? routeWorkHandoff ?? retainedAuthorizedHandoff;
    if (!handoff || Date.parse(handoff.expiresAt) <= Date.now()) return null;
    return {
      path: handoff.returnTo,
      handoffId: handoff.handoffId,
      ownerFingerprint: handoff.ownerFingerprint,
      expiresAt: handoff.expiresAt,
    };
  }, [activeWorkHandoff, retainedAuthorizedHandoff, routeWorkHandoff]);
  useEffect(() => {
    if (!permissionsLoaded) return;
    // A present owner without a fingerprint is still being hashed. A missing owner after auth
    // settled is definitive and must flow through the reader so it destroys the old receipt.
    if (workOperationOwner && !workOwnerFingerprint) return;
    const recovered = readCalendarWorkHandoffRecovery(
      permissions,
      workOwnerFingerprint,
      permissionsLoaded,
      Date.now()
    );
    if (!recovered) {
      setWorkRecovery(null);
      return;
    }
    setWorkRecovery(recovered);
    setRetainedWorkHandoff(recovered.handoff);
    setCreateState((current) =>
      current?.workHandoff?.handoffId === recovered.handoff.handoffId
        ? current
        : {
            start: recovered.input.startsAt,
            end: recovered.input.endsAt,
            type: 'FOCUS',
            title: recovered.input.title,
            description: recovered.input.description ?? undefined,
            timeZone: recovered.input.timeZone,
            calendarId: recovered.input.calendarId ?? recovered.event.calendarId,
            visibility: recovered.input.visibility,
            importance: recovered.input.importance ?? 'NORMAL',
            attendeeEmails: [],
            workHandoff: recovered.handoff,
          }
    );
  }, [permissions, permissionsLoaded, workOperationOwner, workOwnerFingerprint]);
  useEffect(() => {
    if (createState?.workHandoff && !activeWorkHandoff) {
      clearCalendarWorkHandoffRecovery(createState.workHandoff.handoffId);
      setWorkRecovery((current) =>
        current?.handoff.handoffId === createState.workHandoff?.handoffId ? null : current
      );
      setCreateState(null);
    }
  }, [activeWorkHandoff, createState?.workHandoff]);
  useEffect(() => {
    if (retainedWorkHandoff && !retainedAuthorizedHandoff) {
      clearCalendarWorkHandoffRecovery(retainedWorkHandoff.handoffId);
      setWorkRecovery((current) =>
        current?.handoff.handoffId === retainedWorkHandoff.handoffId ? null : current
      );
      setRetainedWorkHandoff(null);
    }
  }, [retainedAuthorizedHandoff, retainedWorkHandoff]);
  useEffect(() => {
    if (!retainedAuthorizedHandoff) return;
    const handoffId = retainedAuthorizedHandoff.handoffId;
    const remaining = Date.parse(retainedAuthorizedHandoff.expiresAt) - Date.now();
    const expire = () => {
      clearCalendarWorkHandoffRecovery(handoffId);
      setWorkRecovery((current) => (current?.handoff.handoffId === handoffId ? null : current));
      setRetainedWorkHandoff((current) => (current?.handoffId === handoffId ? null : current));
      setCreateState((current) => (current?.workHandoff?.handoffId === handoffId ? null : current));
    };
    if (remaining <= 0) {
      expire();
      return;
    }
    const timer = window.setTimeout(expire, remaining + 1);
    return () => window.clearTimeout(timer);
  }, [retainedAuthorizedHandoff]);
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const requestedType = query.get('create');
    if (!requestedType && !dwaionHandoff && !workHandoffRequested) return;
    if (canCreateGranted && !scheduleWritable) return;
    if (workHandoffRequested && workOperationOwner && !workOwnerFingerprint) return;
    const currentWorkHandoff = workHandoffRequested
      ? authorizedWorkCalendarEventHandoff(location.state, permissions, workOwnerFingerprint)
      : null;
    if (canCreate && (!workHandoffRequested || currentWorkHandoff)) {
      if (currentWorkHandoff) setRetainedWorkHandoff(currentWorkHandoff);
      setCreateState({
        start:
          currentWorkHandoff?.startsAt ??
          dwaionHandoffText(dwaionHandoff, 'startsAt') ??
          new Date().toISOString(),
        end: currentWorkHandoff?.endsAt ?? dwaionHandoffText(dwaionHandoff, 'endsAt') ?? undefined,
        type: currentWorkHandoff || requestedType === 'focus' ? 'FOCUS' : 'MEETING',
        title: currentWorkHandoff?.title ?? dwaionHandoffText(dwaionHandoff, 'title') ?? undefined,
        description: currentWorkHandoff
          ? workCalendarEventHandoffDescription(currentWorkHandoff)
          : undefined,
        timeZone: currentWorkHandoff?.timeZone,
        visibility: currentWorkHandoff ? 'PRIVATE' : undefined,
        attendeeEmails: currentWorkHandoff ? [] : dwaionHandoffStrings(dwaionHandoff, 'attendees'),
        fromDwaion: Boolean(dwaionHandoff),
        dwaionProposalBinding:
          dwaionProposalBinding?.actionKey === 'CALENDAR.EVENT.CREATE'
            ? dwaionProposalBinding
            : undefined,
        workHandoff: currentWorkHandoff ?? undefined,
      });
    }
    query.delete('create');
    const search = query.toString();
    navigate(
      { pathname: location.pathname, search: search ? `?${search}` : '' },
      { replace: true, state: null }
    );
  }, [
    canCreate,
    canCreateGranted,
    dwaionHandoff,
    dwaionProposalBinding,
    location.pathname,
    location.search,
    location.state,
    navigate,
    permissions,
    scheduleWritable,
    workHandoffRequested,
    workOperationOwner,
    workOwnerFingerprint,
  ]);
  const isAuthorized = useCallback(
    (handoff: WorkCalendarEventHandoff) => {
      const authorized = authorizedWorkCalendarEventHandoff(
        { workCalendarEventHandoff: handoff },
        permissions,
        workOwnerFingerprintRef.current,
        Date.now()
      );
      if (authorized?.handoffId === handoff.handoffId) return true;
      setRetainedWorkHandoff(null);
      setCreateState((current) =>
        current?.workHandoff?.handoffId === handoff.handoffId ? null : current
      );
      return false;
    },
    [permissions]
  );
  const closeCreateState = useCallback(() => {
    clearCalendarWorkHandoffRecovery(createState?.workHandoff?.handoffId);
    setWorkRecovery(null);
    setCreateState(null);
    setRetainedWorkHandoff(null);
  }, [createState?.workHandoff?.handoffId]);
  const closeUnavailableCreateState = useCallback(() => {
    setCreateState((current) => (current?.workHandoff ? current : null));
  }, []);
  return {
    activeWorkHandoff,
    closeCreateState,
    closeUnavailableCreateState,
    createState,
    handoffReturnTarget,
    isAuthorized,
    setCreateState,
    workRecovery:
      workRecovery?.handoff.handoffId === activeWorkHandoff?.handoffId ? workRecovery : null,
  };
}
