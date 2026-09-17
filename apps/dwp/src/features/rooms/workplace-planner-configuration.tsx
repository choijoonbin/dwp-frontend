import { useTranslation } from 'react-i18next';
import { CalendarDays, ShieldCheck, UsersRound } from 'lucide-react';
import {
  ActionButton,
  DatePickerField,
  EmptyState,
  FormField,
  InlineFeedback,
  LoadingState,
  SelectField,
  TimePickerField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';
import {
  WORKPLACE_PLANNER_RESOURCE_TYPES,
  WORKPLACE_PLANNER_TARGETS,
  type WorkplacePlannerResourceType,
  type WorkplacePlannerTarget,
  type WorkplacePlannerUrlState,
} from './workplace-planner-url-state';

import type {
  WorkplaceAuthorizedBookingBeneficiary,
  WorkplaceExploreResponse,
} from '@dwp-frontend/shared-utils';

function beneficiaryRef(value: WorkplaceAuthorizedBookingBeneficiary) {
  return value.beneficiaryPersonPublicId ?? String(value.beneficiaryUserId);
}

export function WorkplacePlannerConfiguration({
  state,
  beneficiaries,
  catalog,
  sourceState,
  canCreate,
  purpose,
  accessibleOnly,
  buildError,
  actorDisplayName,
  onState,
  onPurpose,
  onAccessibleOnly,
  onPreview,
  previewPending,
  onRetry,
}: {
  state: WorkplacePlannerUrlState;
  beneficiaries: readonly WorkplaceAuthorizedBookingBeneficiary[];
  catalog: WorkplaceExploreResponse | null;
  sourceState: 'LOADING' | 'READY' | 'STALE' | 'DENIED' | 'UNAVAILABLE';
  canCreate: boolean;
  purpose: string;
  accessibleOnly: boolean;
  buildError: 'NO_BENEFICIARY' | 'INVALID_RANGE' | 'TOO_MANY_ITEMS' | null;
  actorDisplayName: string;
  onState: (patch: {
    target?: WorkplacePlannerTarget;
    beneficiaries?: readonly string[];
    week?: string;
    dates?: readonly string[];
    start?: string;
    duration?: number;
    site?: string;
    floor?: string;
    types?: readonly WorkplacePlannerResourceType[];
    adjacent?: boolean;
    neighborhood?: boolean;
    minDistance?: number | null;
    maxDistance?: number | null;
  }) => void;
  onPurpose: (value: string) => void;
  onAccessibleOnly: (value: boolean) => void;
  onPreview: () => void;
  previewPending: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation('rooms');
  const visibleBeneficiaries = beneficiaries.filter((beneficiary) => {
    if (state.target === 'SELF') return beneficiary.self;
    if (state.target === 'DELEGATE') return !beneficiary.self;
    return true;
  });
  const selectedBeneficiaries = new Set(state.beneficiaryRefs);
  const sites = catalog?.sites ?? [];
  const floors = (catalog?.floors ?? []).filter(
    (floor) => !state.siteId || floor.siteId === state.siteId
  );
  const siteOptions = sites.map((site) => ({ value: site.siteId, label: site.name }));
  const floorOptions = floors.map((floor) => ({ value: floor.floorId, label: floor.name }));
  if (state.siteId && !siteOptions.some((option) => option.value === state.siteId)) {
    siteOptions.push({
      value: state.siteId,
      label: t('workplace.planner.configuration.locationUnavailable'),
    });
  }
  if (state.floorId && !floorOptions.some((option) => option.value === state.floorId)) {
    floorOptions.push({
      value: state.floorId,
      label: t('workplace.planner.configuration.locationUnavailable'),
    });
  }
  const distanceInvalid =
    state.minimumDistanceMeters !== null &&
    state.maximumDistanceMeters !== null &&
    state.minimumDistanceMeters > state.maximumDistanceMeters;
  const previewDisabled =
    !canCreate || sourceState !== 'READY' || Boolean(buildError) || distanceInvalid;
  const updateBeneficiary = (reference: string, checked: boolean) => {
    let next = checked
      ? [...selectedBeneficiaries, reference]
      : [...selectedBeneficiaries].filter((value) => value !== reference);
    if (state.target !== 'TEAM') next = checked ? [reference] : [];
    onState({ beneficiaries: next.slice(0, 5) });
  };
  const updateType = (type: WorkplacePlannerResourceType, checked: boolean) => {
    const selected = new Set(state.resourceTypes);
    if (checked) selected.add(type);
    else selected.delete(type);
    onState({
      types: WORKPLACE_PLANNER_RESOURCE_TYPES.filter((candidate) => selected.has(candidate)),
    });
  };

  if (sourceState === 'LOADING') {
    return (
      <Box data-testid="workplace-planner-configuration" sx={workplaceMemberCard} p={2}>
        <LoadingState
          label={t('workplace.planner.states.loading')}
          variant="skeleton"
          skeletonRows={4}
          skeletonHeight={58}
          embedded
        />
      </Box>
    );
  }
  if (sourceState === 'DENIED') {
    return (
      <Box data-testid="workplace-planner-configuration" sx={workplaceMemberCard}>
        <EmptyState
          icon={<ShieldCheck size={28} />}
          title={t('workplace.planner.states.deniedTitle')}
          description={t('workplace.planner.states.deniedDescription')}
        />
      </Box>
    );
  }

  return (
    <Box data-testid="workplace-planner-configuration" sx={workplaceMemberCard}>
      <Box p={{ xs: 1.5, md: 2.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Box>
            <Typography component="h2" variant="h6">
              {t('workplace.planner.configuration.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('workplace.planner.configuration.description')}
            </Typography>
          </Box>
          <Chip size="small" label={t('workplace.planner.configuration.package')} />
        </Stack>

        {(sourceState === 'STALE' || sourceState === 'UNAVAILABLE') && (
          <InlineFeedback
            severity="warning"
            action={
              <ActionButton intent="quiet" size="small" onClick={onRetry}>
                {t('actions.retry')}
              </ActionButton>
            }
          >
            {t(`workplace.planner.states.${sourceState.toLowerCase()}`)}
          </InlineFeedback>
        )}

        <Box sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.5, mt: 2 })}>
          <Stack direction="row" gap={1} alignItems="center">
            <UsersRound size={18} aria-hidden="true" />
            <Typography component="p" variant="subtitle2">
              {t('workplace.planner.configuration.targetTitle')}
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ mt: 1 }}>
            {t('workplace.planner.configuration.actor', { value: actorDisplayName })}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.25} mt={1.5}>
            <SelectField
              data-testid="workplace-planner-target"
              label={t('workplace.planner.configuration.target')}
              value={state.target}
              options={WORKPLACE_PLANNER_TARGETS.map((value) => ({
                value,
                label: t(`workplace.planner.targets.${value}`),
              }))}
              onValueChange={(value) => {
                if (!value) return;
                const target = value as WorkplacePlannerTarget;
                const defaultBeneficiary = beneficiaries.find((beneficiary) =>
                  target === 'SELF' ? beneficiary.self : !beneficiary.self
                );
                onState({
                  target,
                  beneficiaries: defaultBeneficiary ? [beneficiaryRef(defaultBeneficiary)] : [],
                });
              }}
              sx={{
                width: { xs: '100%', sm: 240 },
                minWidth: { xs: 0, sm: 240 },
                maxWidth: { sm: 240 },
                flexBasis: { sm: 240 },
                flexShrink: { sm: 0 },
              }}
            />
            <Box flex={1} minWidth={0}>
              <Typography variant="caption" color="text.secondary">
                {t('workplace.planner.configuration.beneficiaries')}
              </Typography>
              <Stack direction="row" gap={0.75} flexWrap="wrap" mt={0.5}>
                {visibleBeneficiaries.map((beneficiary) => {
                  const reference = beneficiaryRef(beneficiary);
                  const checked = selectedBeneficiaries.has(reference);
                  return (
                    <Chip
                      key={reference}
                      data-testid={`workplace-planner-beneficiary-${reference}`}
                      label={beneficiary.displayName}
                      color={checked ? 'primary' : 'default'}
                      variant="outlined"
                      aria-pressed={checked}
                      onClick={() => updateBeneficiary(reference, !checked)}
                    />
                  );
                })}
                {visibleBeneficiaries.length === 0 && (
                  <Typography variant="body2" color="warning.main">
                    {t('workplace.planner.configuration.noBeneficiary')}
                  </Typography>
                )}
              </Stack>
            </Box>
          </Stack>
        </Box>

        <Box sx={{ mt: 2 }}>
          <Stack direction="row" gap={1} alignItems="center" mb={1}>
            <CalendarDays size={18} aria-hidden="true" />
            <Typography component="p" variant="subtitle2">
              {t('workplace.planner.configuration.scheduleTitle')}
            </Typography>
          </Stack>
          <Stack
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
              gap: 1.25,
            }}
          >
            <DatePickerField
              size="small"
              label={t('workplace.planner.configuration.week')}
              value={state.week}
              onValueChange={(value) => value && onState({ week: value, dates: [] })}
            />
            <TimePickerField
              size="small"
              label={t('workplace.planner.configuration.start')}
              value={state.start}
              onValueChange={(value) => value && onState({ start: value.slice(0, 5) })}
            />
            <SelectField
              label={t('workplace.planner.configuration.duration')}
              value={String(state.duration)}
              options={[480, 540, 600].map((value) => ({
                value: String(value),
                label: t('workplace.planner.configuration.durationMinutes', {
                  count: value / 60,
                }),
              }))}
              onValueChange={(value) => value && onState({ duration: Number(value) })}
            />
          </Stack>
          <FormGroup row sx={{ mt: 1 }}>
            {state.dates.map((date) => (
              <FormControlLabel
                key={date}
                control={<Checkbox checked readOnly size="small" />}
                label={date}
              />
            ))}
          </FormGroup>
        </Box>

        <Stack
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 1.25,
            mt: 2,
          }}
        >
          <SelectField
            label={t('workplace.planner.configuration.site')}
            value={state.siteId}
            options={siteOptions}
            onValueChange={(value) => onState({ site: value ?? '', floor: '' })}
          />
          <SelectField
            label={t('workplace.planner.configuration.floor')}
            value={state.floorId}
            options={floorOptions}
            onValueChange={(value) => onState({ floor: value ?? '' })}
          />
        </Stack>

        <Box sx={{ mt: 2 }}>
          <Typography component="p" variant="subtitle2">
            {t('workplace.planner.configuration.resources')}
          </Typography>
          <FormGroup row>
            {WORKPLACE_PLANNER_RESOURCE_TYPES.map((type) => (
              <FormControlLabel
                key={type}
                control={
                  <Checkbox
                    checked={state.resourceTypes.includes(type)}
                    onChange={(event) => updateType(type, event.target.checked)}
                  />
                }
                label={t(`workplace.resourceTypes.${type}`)}
              />
            ))}
          </FormGroup>
        </Box>

        {state.target === 'TEAM' && (
          <Box sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.5, mt: 2 })}>
            <Typography component="p" variant="subtitle2">
              {t('workplace.planner.configuration.teamConstraints')}
            </Typography>
            <FormGroup row>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={state.adjacentSeats}
                    onChange={(event) => onState({ adjacent: event.target.checked })}
                  />
                }
                label={t('workplace.planner.configuration.adjacentSeats')}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={state.sameNeighborhood}
                    onChange={(event) => onState({ neighborhood: event.target.checked })}
                  />
                }
                label={t('workplace.planner.configuration.sameNeighborhood')}
              />
            </FormGroup>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.25} mt={1}>
              <FormField
                size="small"
                type="number"
                label={t('workplace.planner.configuration.minimumDistance')}
                value={state.minimumDistanceMeters ?? ''}
                inputProps={{ min: 0, max: 100000, step: 0.1 }}
                onChange={(event) =>
                  onState({
                    minDistance: event.target.value === '' ? null : Number(event.target.value),
                  })
                }
              />
              <FormField
                size="small"
                type="number"
                label={t('workplace.planner.configuration.maximumDistance')}
                value={state.maximumDistanceMeters ?? ''}
                inputProps={{ min: 0, max: 100000, step: 0.1 }}
                onChange={(event) =>
                  onState({
                    maxDistance: event.target.value === '' ? null : Number(event.target.value),
                  })
                }
              />
            </Stack>
            {distanceInvalid && (
              <Typography variant="caption" color="error.main">
                {t('workplace.planner.validation.DISTANCE_ORDER')}
              </Typography>
            )}
          </Box>
        )}

        <Box sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.5, mt: 2 })}>
          <Typography component="p" variant="subtitle2">
            {t('workplace.planner.configuration.waitlistConditions')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('workplace.planner.configuration.waitlistConditionSummary', {
              distance:
                state.maximumDistanceMeters === null
                  ? t('workplace.planner.configuration.distanceNotSpecified')
                  : t('workplace.planner.configuration.maximumDistanceValue', {
                      value: state.maximumDistanceMeters,
                    }),
            })}
          </Typography>
          <Chip
            size="small"
            variant="outlined"
            label={t('workplace.planner.configuration.priceNotApplicable')}
            sx={{ mt: 1 }}
          />
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.25} mt={2}>
          <FormField
            fullWidth
            size="small"
            label={t('workplace.planner.configuration.purpose')}
            value={purpose}
            inputProps={{ maxLength: 500 }}
            onChange={(event) => onPurpose(event.target.value)}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={accessibleOnly}
                onChange={(event) => onAccessibleOnly(event.target.checked)}
              />
            }
            label={t('workplace.planner.configuration.accessibleOnly')}
          />
        </Stack>

        {buildError && (
          <InlineFeedback severity="error">
            {t(`workplace.planner.validation.${buildError}`)}
          </InlineFeedback>
        )}
        {!canCreate && (
          <InlineFeedback severity="info">{t('workplace.planner.states.readOnly')}</InlineFeedback>
        )}
        <ActionButton
          data-testid="workplace-planner-preview"
          fullWidth
          intent="primary"
          loading={previewPending}
          disabled={previewDisabled}
          onClick={onPreview}
          sx={{ mt: 2, minHeight: 44, display: { xs: 'none', sm: 'inline-flex' } }}
        >
          {t('workplace.planner.actions.preview')}
        </ActionButton>
        <Box
          aria-hidden="true"
          sx={{
            display: { xs: 'block', sm: 'none' },
            height: 'calc(68px + env(safe-area-inset-bottom))',
          }}
        />
      </Box>
      <Box
        sx={(theme) => ({
          display: { xs: 'block', sm: 'none' },
          position: 'fixed',
          zIndex: theme.zIndex.appBar,
          insetInline: 0,
          bottom: 0,
          p: 1.5,
          pb: 'max(12px, env(safe-area-inset-bottom))',
          backgroundColor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
        })}
      >
        <ActionButton
          data-testid="workplace-planner-preview-mobile"
          fullWidth
          intent="primary"
          loading={previewPending}
          disabled={previewDisabled}
          onClick={onPreview}
          sx={{ minHeight: 44 }}
        >
          {t('workplace.planner.actions.preview')}
        </ActionButton>
      </Box>
    </Box>
  );
}
