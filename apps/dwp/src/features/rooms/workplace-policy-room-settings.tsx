import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getRoomsAdminOverview, saveRoomResource } from '@dwp-frontend/shared-utils';
import type { CalendarResource, CalendarResourceInput } from '@dwp-frontend/shared-utils';
import { ActionButton, FormDialog, InlineFeedback } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useRoomsCapabilities } from './rooms-capabilities';
import { useWorkplaceExperienceAuthority } from './workplace-experience-authority';
import { governanceChangeOutcome } from './workplace-governance-change-model';
import { WorkplaceGovernanceValueComparison } from './workplace-governance-value-comparison';
import {
  WorkplaceExperienceFreshness,
  WorkplaceExperiencePanel,
  WorkplaceExperienceQueryError,
} from './workplace-experience-ui';
import {
  roomResourceInputIsValid,
  WorkplacePolicyRoomResourceForm,
} from './workplace-policy-room-resource-form';

function roomInput(room: CalendarResource): CalendarResourceInput {
  return {
    code: room.code,
    nameKo: room.nameKo,
    nameEn: room.nameEn,
    type: 'ROOM',
    site: room.site,
    floor: room.floor,
    capacity: room.capacity,
    features: room.features,
    timeZone: room.timeZone,
    state: room.state,
    approvalRequired: room.approvalRequired,
    version: room.version,
  };
}
const newRoomInput: CalendarResourceInput = {
  code: '',
  nameKo: '',
  nameEn: '',
  type: 'ROOM',
  site: '',
  floor: null,
  capacity: 1,
  features: [],
  timeZone: 'UTC',
  state: 'AVAILABLE',
  approvalRequired: false,
  version: null,
};

export function WorkplacePolicyRoomSettings() {
  const { t } = useTranslation('rooms');
  const navigate = useNavigate();
  const capabilities = useRoomsCapabilities();
  const authority = useWorkplaceExperienceAuthority();
  const authorityRef = useRef(authority);
  if (authorityRef.current !== authority) authorityRef.current = authority;
  const generation = useRef(0);
  const inFlight = useRef(false);
  const blockedTargets = useRef(
    new Map<
      string,
      { outcome: ReturnType<typeof governanceChangeOutcome>; input: CalendarResourceInput }
    >()
  );
  const [target, setTarget] = useState<CalendarResource | 'new' | null>(null);
  const [form, setForm] = useState<CalendarResourceInput | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<ReturnType<typeof governanceChangeOutcome> | null>(null);
  const targetId = target === 'new' ? 'new' : target?.resourceId;
  const fingerprint = JSON.stringify(form);
  const blockKey = `${authority}:${targetId}`;
  const query = useQuery({
    queryKey: ['rooms', 'policy-approval-rules', authority],
    queryFn: getRoomsAdminOverview,
    enabled: capabilities.isLoaded && capabilities.canViewRoomsAdmin,
    retry: false,
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
  const data =
    capabilities.isLoaded && capabilities.canViewRoomsAdmin && !query.isError
      ? query.data
      : undefined;
  const rooms = data?.resources.filter((room) => room.type === 'ROOM') ?? [];
  const original = rooms.find((room) => room.resourceId === targetId);
  const current = useRef({ targetId, fingerprint, sourceVersion: original?.version });
  current.current = { targetId, fingerprint, sourceVersion: original?.version };
  const ready = Boolean(
    data &&
    target &&
    (target === 'new' || original?.version === target.version) &&
    !query.isFetching &&
    !query.isStale &&
    !query.isError
  );
  const canManage =
    capabilities.canManageRoomsAdmin && (target !== 'new' || capabilities.canCreateRoomsAdmin);
  const sourceRef = useRef({ ready, canManage });
  sourceRef.current = { ready, canManage };
  useEffect(() => {
    generation.current += 1;
    setTarget(null);
    setForm(null);
    setConfirmed(false);
    setOutcome(null);
    setBusy(false);
  }, [authority]);
  useEffect(() => {
    setConfirmed(false);
  }, [fingerprint, targetId, original?.version, query.isFetching, query.isError]);
  const choose = (room: CalendarResource | 'new') => {
    if (inFlight.current) return;
    generation.current += 1;
    const blocked = blockedTargets.current.get(
      `${authority}:${room === 'new' ? 'new' : room.resourceId}`
    );
    setTarget(room);
    setForm(blocked?.input ?? (room === 'new' ? { ...newRoomInput } : roomInput(room)));
    setConfirmed(false);
    setOutcome(blocked?.outcome ?? null);
  };
  const save = async () => {
    if (
      !target ||
      !form ||
      !ready ||
      !confirmed ||
      !canManage ||
      !roomResourceInputIsValid(form) ||
      outcome ||
      inFlight.current
    )
      return;
    const issued = {
      authority,
      generation: generation.current,
      targetId,
      fingerprint,
      sourceVersion: original?.version,
    };
    const stillCurrent = () =>
      issued.authority === authorityRef.current &&
      issued.generation === generation.current &&
      current.current.targetId === issued.targetId &&
      current.current.fingerprint === issued.fingerprint &&
      current.current.sourceVersion === issued.sourceVersion &&
      sourceRef.current.canManage;
    const input: CalendarResourceInput = {
      ...form,
      features: [...form.features],
      version: target === 'new' ? null : target.version,
    };
    inFlight.current = true;
    setBusy(true);
    try {
      await saveRoomResource(target === 'new' ? null : target.resourceId, input);
      if (!stillCurrent()) return;
      setTarget(null);
      setConfirmed(false);
      await query.refetch();
    } catch (error) {
      const result = governanceChangeOutcome(error, true);
      blockedTargets.current.set(blockKey, { outcome: result, input });
      if (!stillCurrent()) return;
      setOutcome(result);
      setConfirmed(false);
    } finally {
      inFlight.current = false;
      if (issued.authority === authorityRef.current && issued.generation === generation.current)
        setBusy(false);
    }
  };
  const recheck = async () => {
    if (!target || inFlight.current) return;
    const issued = { authority, generation: generation.current, id: targetId };
    const result = await query.refetch();
    if (
      issued.authority !== authorityRef.current ||
      issued.generation !== generation.current ||
      current.current.targetId !== issued.id
    )
      return;
    if (issued.id === 'new') {
      if (result.isSuccess && outcome === 'conflict') {
        blockedTargets.current.delete(blockKey);
        setOutcome(null);
      }
      return;
    }
    const found = result.data?.resources.find(
      (room) => room.resourceId === issued.id && room.type === 'ROOM'
    );
    if (result.isSuccess && found && sourceRef.current.canManage) {
      blockedTargets.current.delete(blockKey);
      setTarget(found);
      setForm((value) => (value ? { ...value, version: found.version } : value));
      setOutcome(null);
      setConfirmed(false);
    }
  };
  const display = (value: unknown) =>
    typeof value === 'boolean'
      ? t(`workplace.admin.policy.${value ? 'enabled' : 'disabled'}`)
      : Array.isArray(value)
        ? value.join(', ')
        : String(value ?? '—');
  const fields = [
    'code',
    'nameKo',
    'nameEn',
    'site',
    'floor',
    'capacity',
    'timeZone',
    'approvalRequired',
    'state',
    'features',
  ] as const;
  const rows = form
    ? fields
        .filter(
          (key) =>
            ['nameEn', 'approvalRequired', 'capacity'].includes(key) ||
            target === 'new' ||
            form[key] !== (target ? roomInput(target)[key] : undefined)
        )
        .map((key) => ({
          label: t(`admin.resources.${key}`),
          current: target && target !== 'new' ? display(roomInput(target)[key]) : '—',
          proposed: display(form[key]),
        }))
    : [];
  const dirty =
    target === 'new' ||
    Boolean(target && form && JSON.stringify(form) !== JSON.stringify(roomInput(target)));
  return (
    <WorkplaceExperiencePanel
      title={t('workplace.experience.roomApprovalSettings')}
      description={t('workplace.experience.roomApprovalBoundary')}
    >
      <Stack gap={1.5}>
        <ActionButton
          intent="secondary"
          onClick={() => navigate('/workplace/admin/meeting-policy')}
        >
          {t('workplace.experience.roomPolicyConfiguration')}
        </ActionButton>
        {capabilities.canCreateRoomsAdmin && capabilities.canManageRoomsAdmin ? (
          <ActionButton
            intent="primary"
            disabled={busy || !data || query.isFetching || query.isStale}
            onClick={() => choose('new')}
          >
            {t('admin.resources.add')}
          </ActionButton>
        ) : null}
        {query.isError ? (
          <WorkplaceExperienceQueryError retry={() => void query.refetch()} />
        ) : null}
        {data ? (
          <WorkplaceExperienceFreshness at={data.generatedAt} refreshing={query.isFetching} />
        ) : null}
        {!rooms.length && data ? (
          <InlineFeedback severity="info">
            {t('workplace.admin.governance.common.notAvailable')}
          </InlineFeedback>
        ) : null}
        {rooms.map((room) => (
          <Stack
            key={room.resourceId}
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            gap={1}
            sx={{ py: 1.5, borderTop: 1, borderColor: 'divider', minWidth: 0 }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography fontWeight="fontWeightBold">{room.name}</Typography>
              <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
                {room.site} · {room.floor} · {t('admin.resources.capacity')}: {room.capacity} ·{' '}
                {room.timeZone}
              </Typography>
              <Typography variant="body2">
                {t('admin.resources.approvalRequired')}:{' '}
                {t(`workplace.admin.policy.${room.approvalRequired ? 'enabled' : 'disabled'}`)}
              </Typography>
            </Box>
            {capabilities.canManageRoomsAdmin ? (
              <ActionButton
                intent="secondary"
                disabled={busy || query.isFetching || query.isStale}
                onClick={() => choose(room)}
              >
                {t('actions.edit')}
              </ActionButton>
            ) : null}
          </Stack>
        ))}
      </Stack>
      <FormDialog
        open={Boolean(target && capabilities.canViewRoomsAdmin)}
        title={t(target === 'new' ? 'admin.resources.createTitle' : 'admin.resources.editTitle')}
        mobileFullScreen
        maxWidth="lg"
        cancelLabel={t('actions.cancel')}
        submitLabel={t('actions.save')}
        submittingLabel={t('actions.saving')}
        busy={busy}
        submitDisabled={
          !ready ||
          !confirmed ||
          !canManage ||
          !dirty ||
          !roomResourceInputIsValid(form) ||
          Boolean(outcome)
        }
        onClose={() => {
          if (!inFlight.current) {
            generation.current += 1;
            setTarget(null);
            setConfirmed(false);
            setOutcome(null);
          }
        }}
        onSubmit={() => void save()}
      >
        {target && form ? (
          <Stack gap={2}>
            {target !== 'new' ? (
              <Typography variant="caption">
                {t('workplace.experience.version')}: {target.version}
              </Typography>
            ) : null}
            <WorkplaceGovernanceValueComparison rows={rows} />
            <WorkplacePolicyRoomResourceForm
              input={form}
              disabled={busy || Boolean(outcome) || !canManage}
              onChange={(value) => {
                setForm(value);
                setConfirmed(false);
              }}
            />
            <InlineFeedback severity="info">
              {t('workplace.experience.roomApprovalSaveNotice')}
            </InlineFeedback>
            {!ready ? (
              <InlineFeedback severity="warning">
                {t('workplace.experience.sourceNotCurrent')}
              </InlineFeedback>
            ) : null}
            {outcome ? (
              <InlineFeedback
                severity="error"
                action={
                  <ActionButton intent="secondary" onClick={() => void recheck()}>
                    {t('workplace.experience.recheck')}
                  </ActionButton>
                }
              >
                {t(
                  `workplace.experience.${outcome === 'conflict' ? 'conflict' : outcome === 'denied' ? 'permissionChanged' : 'changeUnknown'}`
                )}
              </InlineFeedback>
            ) : null}
            {outcome === 'conflict' && capabilities.canViewWorkplaceAdmin ? (
              <ActionButton
                intent="secondary"
                onClick={() => navigate('/workplace/admin/locations')}
              >
                {t('workplace.admin.locations.title')}
              </ActionButton>
            ) : null}
            <FormControlLabel
              sx={{ m: 0, alignItems: 'flex-start' }}
              control={
                <Checkbox
                  checked={confirmed}
                  disabled={!ready || busy || Boolean(outcome)}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
              }
              label={t('workplace.experience.confirmImpact')}
            />
          </Stack>
        ) : null}
      </FormDialog>
    </WorkplaceExperiencePanel>
  );
}
