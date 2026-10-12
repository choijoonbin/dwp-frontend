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
import { hasWorkCalendarDocumentHandoff } from '@dwp-frontend/shared-utils/api/work-calendar-document-handoff';

import { useWorkHubOperationOwner } from '../../components/use-work-hub-operation-owner';
import {
  authorizedWorkCalendarEventHandoff,
  clearCalendarWorkHandoffRecovery,
  consumeAuthorizedWorkCalendarDocumentHandoff,
  hasWorkCalendarEventHandoff,
  isCurrentWorkCalendarHandoffOwner,
  readCalendarWorkHandoffRecovery,
  type CalendarWorkHandoffRecovery,
  type CalendarWorkHandoffReturnTarget,
} from './calendar-work-handoff';

type DocumentWorkHandoffState =
  | Readonly<{ status: 'ABSENT' | 'PENDING' | 'REJECTED'; handoff: null }>
  | Readonly<{ status: 'AUTHORIZED'; handoff: WorkCalendarEventHandoff }>;

type CalendarCreateState = Readonly<{
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
    fingerprint: string | null;
    settled: boolean;
  } | null>(null);
  const [documentWorkHandoff, setDocumentWorkHandoff] = useState<DocumentWorkHandoffState>(() =>
    hasWorkCalendarDocumentHandoff()
      ? { status: 'PENDING', handoff: null }
      : { status: 'ABSENT', handoff: null }
  );
  const documentWorkHandoffResolvedRef = useRef(false);
  const documentWorkHandoffHandledRef = useRef(false);
  useEffect(() => {
    let active = true;
    if (!workOperationOwner) {
      setWorkOwnerBinding(null);
      return;
    }
    const submittedOwner = workOperationOwner;
    setWorkOwnerBinding((current) =>
      current?.owner === submittedOwner
        ? current
        : { owner: submittedOwner, fingerprint: null, settled: false }
    );
    void workCalendarOwnerFingerprint(submittedOwner)
      .then((fingerprint) => {
        if (active) setWorkOwnerBinding({ owner: submittedOwner, fingerprint, settled: true });
      })
      .catch(() => {
        if (active)
          setWorkOwnerBinding({ owner: submittedOwner, fingerprint: null, settled: true });
      });
    return () => {
      active = false;
    };
  }, [workOperationOwner]);
  const workOwnerFingerprint =
    workOwnerBinding?.owner === workOperationOwner ? workOwnerBinding.fingerprint : null;
  const workOwnerFingerprintPending = Boolean(
    workOperationOwner &&
    (workOwnerBinding?.owner !== workOperationOwner || !workOwnerBinding.settled)
  );
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
  const routeWorkHandoffRequested = hasWorkCalendarEventHandoff(location.state);
  const documentWorkHandoffRequested =
    documentWorkHandoff.status !== 'ABSENT' && !documentWorkHandoffHandledRef.current;
  const workHandoffRequested = routeWorkHandoffRequested || documentWorkHandoffRequested;
  useEffect(() => {
    if (
      documentWorkHandoff.status !== 'PENDING' ||
      documentWorkHandoffResolvedRef.current ||
      !permissionsLoaded
    ) {
      return;
    }
    // A present owner without a fingerprint is still being hashed. Once auth and permissions are
    // settled, a missing owner is definitive and consumes the envelope as an authorization denial.
    if (workOwnerFingerprintPending) return;
    documentWorkHandoffResolvedRef.current = true;
    const handoff = consumeAuthorizedWorkCalendarDocumentHandoff(
      permissions,
      workOwnerFingerprint,
      Date.now()
    );
    setDocumentWorkHandoff(
      handoff ? { status: 'AUTHORIZED', handoff } : { status: 'REJECTED', handoff: null }
    );
  }, [
    documentWorkHandoff.status,
    permissions,
    permissionsLoaded,
    workOperationOwner,
    workOwnerFingerprint,
    workOwnerFingerprintPending,
  ]);
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
    const handoff =
      activeWorkHandoff ??
      routeWorkHandoff ??
      documentWorkHandoff.handoff ??
      retainedAuthorizedHandoff;
    if (!handoff || Date.parse(handoff.expiresAt) <= Date.now()) return null;
    return {
      path: handoff.returnTo,
      handoffId: handoff.handoffId,
      ownerFingerprint: handoff.ownerFingerprint,
      expiresAt: handoff.expiresAt,
    };
  }, [activeWorkHandoff, documentWorkHandoff.handoff, retainedAuthorizedHandoff, routeWorkHandoff]);
  useEffect(() => {
    if (!permissionsLoaded) return;
    // A present owner without a fingerprint is still being hashed. A missing owner after auth
    // settled is definitive and must flow through the reader so it destroys the old receipt.
    if (workOwnerFingerprintPending) return;
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
  }, [permissions, permissionsLoaded, workOwnerFingerprint, workOwnerFingerprintPending]);
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
    if (workHandoffRequested && workOwnerFingerprintPending) return;
    if (documentWorkHandoff.status === 'PENDING') return;
    const requestedWorkHandoffState = routeWorkHandoffRequested
      ? location.state
      : documentWorkHandoff.handoff
        ? { workCalendarEventHandoff: documentWorkHandoff.handoff }
        : null;
    const currentWorkHandoff = requestedWorkHandoffState
      ? authorizedWorkCalendarEventHandoff(
          requestedWorkHandoffState,
          permissions,
          workOwnerFingerprint,
          Date.now()
        )
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
    if (documentWorkHandoffRequested) documentWorkHandoffHandledRef.current = true;
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
    documentWorkHandoff.handoff,
    documentWorkHandoff.status,
    documentWorkHandoffRequested,
    location.pathname,
    location.search,
    location.state,
    navigate,
    permissions,
    routeWorkHandoffRequested,
    scheduleWritable,
    workHandoffRequested,
    workOperationOwner,
    workOwnerFingerprint,
    workOwnerFingerprintPending,
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
