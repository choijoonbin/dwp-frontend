import { useWorkplaceExperienceAuthority } from './workplace-experience-authority';
import { LoadingState } from '@dwp-frontend/design-system';
import { foundationTokens } from '@dwp-frontend/design-system';
import { InlineFeedback } from '@dwp-frontend/design-system';
import { formatWorkplaceExperienceInstant } from './workplace-experience-format';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton, EmptyState, FormField, SelectField } from '@dwp-frontend/design-system';
import {
  changeWorkplaceFacilityRequestStatus,
  getWorkplaceFacilityRequests,
  HttpError,
} from '@dwp-frontend/shared-utils';
import type { WorkplaceFacilityRequestStatus } from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useRoomsCapabilities, useWorkplaceGovernanceCapabilities } from './rooms-capabilities';
import { WorkplaceAdminSection } from './workplace-admin-experience-ui';
import {
  workplaceAuthorizedFloorMetadata,
  workplaceAuthorizedFloorContains,
  workplaceAuthorizedFloorSetsMatch,
  workplaceCanonicalScopeUuid,
} from './workplace-authorized-floor-metadata';
import type { AuthorizedFloorMetadata } from './workplace-authorized-floor-metadata';
import { WorkplaceExperiencePanel, WorkplaceExperienceQueryError } from './workplace-experience-ui';

const STATES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'] as const;
type StatusCommand = {
  scope: string;
  generation: number;
  siteId: string;
  requestId: string;
  version: number;
  status: WorkplaceFacilityRequestStatus;
  reason: string;
};
export function WorkplaceFacilityRequests({
  admin = false,
  siteId,
  floorId,
  timeZone = 'Asia/Seoul',
  authorizedScope,
}: {
  admin?: boolean;
  siteId?: string;
  floorId?: string;
  timeZone?: string;
  authorizedScope?: AuthorizedFloorMetadata | null;
}) {
  const { t } = useTranslation('rooms');
  const authorityKey = useWorkplaceExperienceAuthority();
  const capabilities = useRoomsCapabilities();
  const governance = useWorkplaceGovernanceCapabilities();
  const queryClient = useQueryClient();
  const scope = `${authorityKey}:${admin}:${siteId}:${floorId}:${JSON.stringify(authorizedScope)}`;
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<WorkplaceFacilityRequestStatus>('IN_PROGRESS');
  const [filter, setFilter] = useState<'' | WorkplaceFacilityRequestStatus>('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [outcome, setOutcome] = useState<'conflict' | 'unknown' | 'denied' | null>(null);
  const context = `${scope}:${filter}:${page}:${selectedId}`;
  const commandContext = useRef({ context, generation: 0 });
  if (commandContext.current.context !== context)
    commandContext.current = { context, generation: commandContext.current.generation + 1 };
  const inFlight = useRef<StatusCommand | null>(null);
  const allowed =
    capabilities.isLoaded &&
    (admin ? capabilities.canViewWorkplaceAdmin && Boolean(siteId) : capabilities.canViewWorkplace);
  const query = useQuery({
    queryKey: ['workplace', 'facility-requests', scope, filter, page],
    queryFn: () =>
      getWorkplaceFacilityRequests(
        { ...(admin ? { siteId, floorId, status: filter || undefined } : {}), page, size: 20 },
        admin
      ),
    enabled: allowed,
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  });
  const pageScope = workplaceAuthorizedFloorMetadata(
    query.data,
    governance.isLoaded && governance.globalAdministrator
  );
  const scopeMismatch =
    admin &&
    query.isSuccess &&
    (!workplaceAuthorizedFloorSetsMatch(authorizedScope ?? pageScope, pageScope) ||
      !Array.isArray(query.data.content) ||
      query.data.content.some(
        (row) =>
          !row ||
          !workplaceCanonicalScopeUuid(row.requestId) ||
          !workplaceCanonicalScopeUuid(row.resourceId) ||
          !Number.isSafeInteger(row.version) ||
          row.version < 0 ||
          row.siteId !== siteId ||
          (floorId && row.floorId !== floorId) ||
          !workplaceAuthorizedFloorContains(pageScope, row.floorId)
      ));
  const data = allowed && !query.isError && !scopeMismatch ? query.data : undefined;
  const selected = data?.content.find((item) => item.requestId === selectedId);
  useEffect(() => {
    setPage(0);
    setSelectedId(null);
    setReason('');
    setConfirmed(false);
    setOutcome(null);
  }, [scope, filter]);
  useEffect(() => {
    setReason('');
    setConfirmed(false);
  }, [selectedId]);
  useEffect(() => setConfirmed(false), [selected?.version, status, reason]);
  const canManage =
    admin &&
    capabilities.canUpdateWorkplaceAdmin &&
    governance.isLoaded &&
    governance.hierarchy.canManage &&
    Boolean(
      selected && governance.allowsTarget('CATALOG_MANAGE', selected.siteId, selected.floorId)
    );
  const ready =
    allowed &&
    canManage &&
    selected &&
    !query.isFetching &&
    !query.isStale &&
    !query.isError &&
    !outcome &&
    confirmed &&
    reason.trim().length > 0 &&
    status !== selected.status;
  const matchesCommand = (command: StatusCommand) =>
    command.scope === activeScope.current &&
    command.generation === commandContext.current.generation;
  const mutation = useMutation({
    mutationFn: async (command: StatusCommand) => {
      if (!canManage || !matchesCommand(command))
        throw new Error('Facility request authority changed');
      return changeWorkplaceFacilityRequestStatus(command.siteId, command.requestId, {
        version: command.version,
        status: command.status,
        reason: command.reason,
        confirmed: true,
      });
    },
    onSuccess: async (_saved, command) => {
      if (!matchesCommand(command)) return;
      setConfirmed(false);
      setReason('');
      setOutcome(null);
      await queryClient.invalidateQueries({ queryKey: ['workplace', 'facility-requests'] });
    },
    onError: (error, command) => {
      if (!matchesCommand(command)) return;
      setConfirmed(false);
      setOutcome(
        error instanceof HttpError && [401, 403, 404].includes(error.status)
          ? 'denied'
          : error instanceof HttpError && [400, 409].includes(error.status)
            ? 'conflict'
            : 'unknown'
      );
    },
    onSettled: (_data, _error, command) => {
      if (inFlight.current === command) inFlight.current = null;
    },
  });
  const resetMutation = mutation.reset;
  useEffect(() => resetMutation(), [scope, resetMutation]);
  const dispatch = () => {
    if (inFlight.current || !ready || !selected || !siteId) return;
    const command = {
      scope,
      generation: commandContext.current.generation,
      siteId,
      requestId: selected.requestId,
      version: selected.version,
      status,
      reason: reason.trim(),
    };
    inFlight.current = command;
    mutation.mutate(command);
  };
  const Panel = admin ? WorkplaceAdminSection : WorkplaceExperiencePanel;
  return (
    <Panel title={t('workplace.experience.facilityRequests')}>
      {admin && data && pageScope?.kind === 'FLOORS' ? (
        <Typography variant="body2" color="primary.main" sx={{ mb: 1 }}>
          {t('workplace.experience.floorScope.authorizedScope', {
            count: pageScope.floorIds?.length,
          })}
        </Typography>
      ) : null}
      {admin && data ? (
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          gap={1}
          flexWrap="wrap"
          sx={{ mb: 1.5, bgcolor: 'var(--dwp-product-soft)', p: 1.25 }}
        >
          <Typography variant="h5" color="primary.main" fontWeight="fontWeightBold">
            {data.totalElements}
            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              {filter
                ? t(`workplace.experience.requestStates.${filter}`)
                : t('workplace.experience.facilityRequests')}
            </Typography>
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('workplace.experience.polish.countShown', {
              count: data.content.length,
              total: data.totalElements,
            })}
          </Typography>
        </Stack>
      ) : null}
      <Stack gap={2}>
        {query.isLoading ? (
          <LoadingState
            embedded
            variant="skeleton"
            skeletonRows={1}
            skeletonHeight={40}
            label={t('workplace.experience.facilityRequests')}
          />
        ) : null}
        {admin ? (
          <SelectField
            size="small"
            label={t('workplace.experience.status')}
            value={filter}
            disabled={mutation.isPending || Boolean(outcome)}
            onValueChange={(value) => setFilter(value as typeof filter)}
            options={[
              { value: '', label: t('workplace.admin.operations.filters.allStatuses') },
              ...STATES.map((value) => ({
                value,
                label: t(`workplace.experience.requestStates.${value}`),
              })),
            ]}
          />
        ) : null}
        {scopeMismatch ? (
          <InlineFeedback severity="warning">
            {t('workplace.experience.floorScope.scopeUnverified')}
          </InlineFeedback>
        ) : null}
        {query.isError ? (
          <WorkplaceExperienceQueryError retry={() => void query.refetch()} />
        ) : null}
        {data?.content.length === 0 ? (
          <EmptyState title={t('workplace.experience.requestEmpty')} />
        ) : null}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              lg: selected ? 'minmax(0, 1fr) minmax(0, 1fr)' : '1fr',
            },
            gap: 2,
            alignItems: 'start',
          }}
        >
          <Stack gap={1}>
            {data?.content.map((request) => (
              <ActionButton
                key={request.requestId}
                intent={request.requestId === selectedId ? 'secondary' : 'quiet'}
                disabled={mutation.isPending || Boolean(outcome)}
                onClick={() => setSelectedId(request.requestId)}
                sx={{
                  textAlign: 'left',
                  justifyContent: 'space-between',
                  gap: 1,
                  py: 1.25,
                  borderBottom: admin ? 1 : 0,
                  borderColor: 'divider',
                }}
              >
                <Stack gap={0.5} sx={{ minWidth: 0 }}>
                  <Typography fontWeight={(theme) => theme.typography.fontWeightBold}>
                    {request.resourceName}
                  </Typography>
                  <Typography variant="caption">
                    {t(`workplace.experience.requestCategories.${request.category}`)} ·{' '}
                    {formatWorkplaceExperienceInstant(request.createdAt, timeZone)}
                  </Typography>
                </Stack>
                <Chip
                  size="small"
                  variant="outlined"
                  label={t(`workplace.experience.requestStates.${request.status}`)}
                />
              </ActionButton>
            ))}
          </Stack>
          {selected ? (
            <Stack
              gap={1.5}
              sx={{
                p: 1.5,
                borderRadius: foundationTokens.radius.control + 'px',
                bgcolor: 'var(--dwp-product-soft)',
                minWidth: 0,
              }}
            >
              <Typography fontWeight={(theme) => theme.typography.fontWeightBold}>
                {selected.resourceName}
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {selected.description}
              </Typography>
              {selected.statusReason ? (
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                  {selected.statusReason}
                </Typography>
              ) : null}
              <Typography variant="caption">
                {formatWorkplaceExperienceInstant(selected.updatedAt, timeZone)}
              </Typography>
              {canManage ? (
                <>
                  <SelectField
                    label={t('workplace.experience.changeStatus')}
                    value={status}
                    disabled={mutation.isPending || Boolean(outcome)}
                    onValueChange={(value) => setStatus(value as WorkplaceFacilityRequestStatus)}
                    options={STATES.map((value) => ({
                      value,
                      label: t(`workplace.experience.requestStates.${value}`),
                    }))}
                  />
                  <FormField
                    required
                    multiline
                    minRows={2}
                    label={t('workplace.experience.reason')}
                    value={reason}
                    inputProps={{ maxLength: 500 }}
                    disabled={mutation.isPending || Boolean(outcome)}
                    onChange={(event) => setReason(event.target.value)}
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={confirmed}
                        disabled={query.isFetching || mutation.isPending || Boolean(outcome)}
                        onChange={(event) => setConfirmed(event.target.checked)}
                      />
                    }
                    label={t('workplace.experience.confirmImpact')}
                  />
                  <ActionButton
                    intent="primary"
                    disabled={!ready || mutation.isPending}
                    onClick={dispatch}
                  >
                    {t('workplace.experience.changeStatus')}
                  </ActionButton>
                </>
              ) : null}
              <ActionButton
                intent="quiet"
                disabled={mutation.isPending || Boolean(outcome)}
                onClick={() => setSelectedId(null)}
              >
                {t('actions.close')}
              </ActionButton>
            </Stack>
          ) : null}
        </Box>
        {outcome ? (
          <InlineFeedback
            severity="error"
            action={
              outcome === 'denied' ? undefined : (
                <ActionButton
                  intent="secondary"
                  onClick={async () => {
                    const generation = commandContext.current.generation;
                    const result = await query.refetch();
                    if (
                      activeScope.current === scope &&
                      generation === commandContext.current.generation &&
                      result.isSuccess
                    ) {
                      setOutcome(null);
                      setConfirmed(false);
                      mutation.reset();
                    }
                  }}
                >
                  {t('workplace.experience.recheck')}
                </ActionButton>
              )
            }
          >
            {t(
              outcome === 'unknown'
                ? 'workplace.experience.changeUnknown'
                : outcome === 'denied'
                  ? 'workplace.experience.permissionChanged'
                  : 'workplace.experience.conflict'
            )}
          </InlineFeedback>
        ) : null}
        {data && data.totalPages > 1 ? (
          <Stack direction="row" justifyContent="space-between">
            <ActionButton
              intent="quiet"
              disabled={!page || mutation.isPending || Boolean(outcome)}
              onClick={() => {
                setPage(page - 1);
                setSelectedId(null);
              }}
            >
              {t('workplace.experience.previous')}
            </ActionButton>
            <ActionButton
              intent="quiet"
              disabled={page + 1 >= data.totalPages || mutation.isPending || Boolean(outcome)}
              onClick={() => {
                setPage(page + 1);
                setSelectedId(null);
              }}
            >
              {t('workplace.experience.next')}
            </ActionButton>
          </Stack>
        ) : null}
      </Stack>
    </Panel>
  );
}
