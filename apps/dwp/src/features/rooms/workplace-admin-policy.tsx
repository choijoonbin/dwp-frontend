import { useWorkplaceExperienceAuthority } from './workplace-experience-authority';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Armchair,
  CalendarRange,
  Clock3,
  History,
  Save,
  ShieldCheck,
  UserRoundCheck,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useBlocker, useNavigate } from 'react-router-dom';
import { getWorkplacePolicy } from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ConfirmDialog,
  FormField,
  PageCanvas,
  TimePickerField,
  SectionHeader,
  foundationTokens,
  SelectField,
  InlineFeedback,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { RoomsAdminOperations } from './rooms-admin-operations';
import { WorkplacePolicyRoomSettings } from './workplace-policy-room-settings';
import { WorkplaceExperienceFreshness, WorkplaceExperiencePanel } from './workplace-experience-ui';

import { useRoomsCapabilities } from './rooms-capabilities';
import { RoomsPageHeading, RoomsPermissionNotice } from './rooms-ui';
import {
  WorkplaceBookingPolicyReview,
  WORKPLACE_BOOKING_POLICY_FIELDS,
} from './workplace-booking-policy-review';
import { WorkplacePolicyImpactPreview } from './workplace-policy-impact-preview';
import { WorkplaceGovernanceValueComparison } from './workplace-governance-value-comparison';

import type { WorkplacePolicy } from '@dwp-frontend/shared-utils';
import type { LucideIcon } from 'lucide-react';

function PolicySection({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        p: { xs: 1.5, md: 2.25 },
        borderRadius: foundationTokens.radius.control + 'px',
        minWidth: 0,
      }}
    >
      <Box sx={{ mb: 2 }}>
        <SectionHeader icon={Icon} title={title} density="compact" />
      </Box>
      {children}
    </Box>
  );
}

function timeInMinutes(value: string) {
  const [hour = 0, minute = 0] = value.split(':').map(Number);
  return hour * 60 + minute;
}

export function WorkplaceAdminPolicy() {
  const { t } = useTranslation('rooms');
  const navigate = useNavigate();
  const identity = useWorkplaceExperienceAuthority();
  const activeIdentity = useRef(identity);
  activeIdentity.current = identity;
  const capabilities = useRoomsCapabilities();
  const query = useQuery({
    queryKey: ['workplace', 'admin', identity, 'policy'],
    queryFn: getWorkplacePolicy,
    enabled: capabilities.isLoaded && capabilities.canViewWorkplaceAdmin,
    staleTime: 30_000,
    retry: 1,
  });
  const [form, setForm] = useState<WorkplacePolicy | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  useEffect(() => {
    setForm(null);
    setBaseline(null);
    setReviewOpen(false);
  }, [identity]);
  const [baseline, setBaseline] = useState<WorkplacePolicy | null>(null);
  const [section, setSection] = useState('approval');
  useEffect(() => {
    if (capabilities.isLoaded && section === 'approval' && !capabilities.canViewRoomsAdmin)
      setSection('hours');
  }, [section, capabilities.isLoaded, capabilities.canViewRoomsAdmin]);
  const sections = [
    { value: 'hours', label: t('workplace.admin.policy.hoursTitle'), icon: Clock3 },
    {
      value: 'booking',
      label: t('workplace.admin.policy.bookingWindowTitle'),
      icon: CalendarRange,
    },
    { value: 'arrival', label: t('workplace.admin.policy.arrivalTitle'), icon: UserRoundCheck },
    ...(capabilities.canViewRoomsAdmin
      ? [
          {
            value: 'approval',
            label: t('workplace.experience.roomApprovalWorkflow'),
            icon: ShieldCheck,
          },
        ]
      : []),
    { value: 'fixed', label: t('workplace.admin.policy.fixedSeatTitle'), icon: Armchair },
    { value: 'privacy', label: t('workplace.admin.policy.privacyTitle'), icon: ShieldCheck },
  ];
  const changes =
    form && query.data
      ? Object.keys(form).filter(
          (key) =>
            key !== 'version' &&
            form[key as keyof WorkplacePolicy] !== query.data?.[key as keyof WorkplacePolicy]
        )
      : [];
  const display = (value: unknown) =>
    typeof value === 'boolean'
      ? t(value ? 'workplace.admin.policy.enabled' : 'workplace.admin.policy.disabled')
      : String(value);
  const comparisonRows =
    form && query.data
      ? WORKPLACE_BOOKING_POLICY_FIELDS.filter(([key]) =>
          changes.length
            ? changes.includes(key)
            : ['bookingWindowDays', 'minimumBookingMinutes', 'requireCheckIn'].includes(key)
        ).map(([key, label]) => ({
          label: t(`workplace.admin.policy.${label}`),
          current: display(query.data![key]),
          proposed: display(form[key]),
        }))
      : [];
  const dirty = Boolean(form && baseline && JSON.stringify(form) !== JSON.stringify(baseline));
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    if (query.data && !dirtyRef.current) {
      setForm(query.data);
      setBaseline(query.data);
    }
  }, [dirty, query.data]);
  const patch = <K extends keyof WorkplacePolicy>(key: K, value: WorkplacePolicy[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));
  const patchBookingWindow = (days: number) =>
    setForm((current) =>
      current
        ? {
            ...current,
            bookingWindowDays: days,
            maximumConsecutiveDays: Math.min(current.maximumConsecutiveDays, days),
          }
        : current
    );
  const valid = Boolean(
    form &&
    form.bookingWindowDays >= 1 &&
    form.bookingWindowDays <= 365 &&
    form.maximumActiveBookings >= 1 &&
    form.maximumActiveBookings <= 100 &&
    form.maximumConsecutiveDays >= 1 &&
    form.maximumConsecutiveDays <= 31 &&
    form.maximumConsecutiveDays <= form.bookingWindowDays &&
    form.minimumBookingMinutes >= 15 &&
    form.minimumBookingMinutes <= 1440 &&
    form.maximumBookingMinutes >= form.minimumBookingMinutes &&
    form.maximumBookingMinutes <= 10080 &&
    timeInMinutes(form.workingDayStart) < timeInMinutes(form.workingDayEnd) &&
    form.checkInLeadMinutes >= 0 &&
    form.checkInLeadMinutes <= 240 &&
    form.autoReleaseMinutes >= 0 &&
    form.autoReleaseMinutes <= 240 &&
    form.bookingRetentionDays >= 30 &&
    form.bookingRetentionDays <= 3650
  );
  const navigationBlocker = useBlocker(dirty);
  useEffect(() => {
    if (!dirty) return undefined;
    const preventUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', preventUnload);
    return () => window.removeEventListener('beforeunload', preventUnload);
  }, [dirty]);

  return (
    <PageCanvas>
      <RoomsPageHeading
        eyebrow={t('workplace.admin.policy.eyebrow')}
        title={t('workplace.admin.policy.title')}
        description={t('workplace.admin.policy.description')}
        actions={
          <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
            {query.dataUpdatedAt ? (
              <WorkplaceExperienceFreshness
                at={new Date(query.dataUpdatedAt).toISOString()}
                refreshing={query.isFetching}
              />
            ) : null}
            <ActionButton
              component={Link}
              to="/workplace/admin/operations?view=audit&action=workplace.policy.updated&aggregateType=POLICY"
              intent="secondary"
              startIcon={<History size={17} />}
              disabled={!capabilities.isLoaded || !capabilities.canViewWorkplaceAdmin}
            >
              {t('workplace.admin.policy.viewHistory')}
            </ActionButton>
            <ActionButton
              intent="primary"
              startIcon={<Save size={17} />}
              disabled={
                section === 'approval' || !dirty || !valid || !capabilities.canManageWorkplaceAdmin
              }
              onClick={() => setReviewOpen(true)}
            >
              {t('actions.save')}
            </ActionButton>
          </Stack>
        }
      />
      {capabilities.isLoaded && !capabilities.canManageWorkplaceAdmin && (
        <RoomsPermissionNotice>{t('permissions.adminPolicyReadOnly')}</RoomsPermissionNotice>
      )}
      {query.isLoading && <Skeleton variant="rectangular" height={560} />}
      {query.isError && (
        <InlineFeedback
          severity="error"
          action={
            <ActionButton intent="quiet" onClick={() => query.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('workplace.admin.policy.loadError')}
        </InlineFeedback>
      )}
      {form &&
        query.data &&
        !query.isError &&
        capabilities.isLoaded &&
        capabilities.canViewWorkplaceAdmin && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: '220px minmax(0, 1fr)' },
              gap: 2,
              alignItems: 'start',
            }}
          >
            <Box
              sx={{
                display: { xs: 'none', lg: 'block' },
                minWidth: 0,
                position: 'sticky',
                top: 88,
              }}
            >
              <WorkplaceExperiencePanel title={t('workplace.experience.policyCategories')}>
                <Stack gap={1}>
                  {sections.map((item) => (
                    <ActionButton
                      key={item.value}
                      intent={section === item.value ? 'primary' : 'quiet'}
                      startIcon={<item.icon size={17} />}
                      aria-pressed={section === item.value}
                      onClick={() => setSection(item.value)}
                      sx={{ justifyContent: 'flex-start', whiteSpace: 'normal', minHeight: 56 }}
                    >
                      {item.label}
                    </ActionButton>
                  ))}
                </Stack>
              </WorkplaceExperiencePanel>
            </Box>
            <Stack
              gap={2}
              sx={{
                minWidth: 0,
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr)',
                  lg:
                    section === 'approval'
                      ? 'minmax(0, 1fr)'
                      : 'minmax(0, 1.55fr) minmax(280px, .85fr)',
                },
                alignItems: 'start',
                '& > [data-testid="policy-room-approval-queue"], & > .MuiAlert-root': {
                  gridColumn: '1 / -1',
                },
              }}
            >
              {capabilities.canViewRoomsAdmin ? (
                <RoomsAdminOperations embedded />
              ) : (
                <InlineFeedback severity="info">
                  {t('workplace.experience.roomApprovalAccessNotice')}
                </InlineFeedback>
              )}
              <Stack spacing={1.5} sx={{ minWidth: 0 }} data-testid="policy-editor">
                {section !== 'approval' ? (
                  <Box
                    sx={{
                      p: 1.5,
                      bgcolor: 'var(--dwp-product-soft)',
                      borderRadius: foundationTokens.radius.control + 'px',
                      borderLeft: 3,
                      borderColor: 'var(--dwp-product-accent)',
                    }}
                  >
                    <Typography variant="overline" color="var(--dwp-product-accent)">
                      {t('workplace.experience.globalPolicyScope')}
                    </Typography>
                    <Typography component="h2" variant="h6" fontWeight="fontWeightBold">
                      {t('workplace.experience.editPolicyDraft')}
                    </Typography>
                    <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1 }}>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`${t('workplace.experience.version')} ${query.data?.version}`}
                      />
                      <Chip
                        size="small"
                        color={dirty ? 'primary' : 'default'}
                        label={t('workplace.experience.policyChangeCount', {
                          count: changes.length,
                        })}
                      />
                    </Stack>
                  </Box>
                ) : null}
                <Box sx={{ display: { xs: 'block', lg: 'none' } }}>
                  <SelectField
                    label={t('workplace.experience.policyCategories')}
                    value={section}
                    options={sections.map(({ value, label }) => ({ value, label }))}
                    onValueChange={setSection}
                  />
                </Box>
                {section !== 'approval' ? (
                  <Stack
                    component="aside"
                    aria-label={t('workplace.experience.changeReviewRail')}
                    sx={{ minWidth: 0 }}
                  >
                    <WorkplaceGovernanceValueComparison rows={comparisonRows} />
                  </Stack>
                ) : null}
                {!valid && (
                  <InlineFeedback severity="warning">
                    {t('workplace.admin.policy.validationError')}
                  </InlineFeedback>
                )}
                <Box
                  component="section"
                  aria-label={sections.find((item) => item.value === section)?.label}
                  sx={{ minWidth: 0 }}
                >
                  {section === 'approval' && capabilities.canViewRoomsAdmin ? (
                    <WorkplacePolicyRoomSettings />
                  ) : null}
                  {section === 'booking' ? (
                    <PolicySection
                      icon={CalendarRange}
                      title={t('workplace.admin.policy.bookingWindowTitle')}
                    >
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {t('workplace.admin.policy.bookingWindowHint')}
                      </Typography>
                      <ToggleButtonGroup
                        exclusive
                        value={form.bookingWindowDays}
                        disabled={!capabilities.canManageWorkplaceAdmin}
                        onChange={(_, value: number | null) => value && patchBookingWindow(value)}
                        size="small"
                        sx={{ flexWrap: 'wrap' }}
                      >
                        {[7, 14, 30, 60, 90].map((days) => (
                          <ToggleButton key={days} value={days}>
                            {t('workplace.admin.policy.days', { count: days })}
                          </ToggleButton>
                        ))}
                      </ToggleButtonGroup>
                      <Box
                        sx={{
                          mt: 2,
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                          gap: 1.5,
                        }}
                      >
                        <FormField
                          type="number"
                          label={t('workplace.admin.policy.bookingWindow')}
                          value={form.bookingWindowDays}
                          disabled={!capabilities.canManageWorkplaceAdmin}
                          onChange={(event) => patchBookingWindow(Number(event.target.value))}
                          inputProps={{ min: 1, max: 365 }}
                        />
                        <FormField
                          type="number"
                          label={t('workplace.admin.policy.activeLimit')}
                          value={form.maximumActiveBookings}
                          disabled={!capabilities.canManageWorkplaceAdmin}
                          onChange={(event) =>
                            patch('maximumActiveBookings', Number(event.target.value))
                          }
                          inputProps={{ min: 1, max: 100 }}
                        />
                        <FormField
                          type="number"
                          label={t('workplace.admin.policy.consecutiveDays')}
                          value={form.maximumConsecutiveDays}
                          disabled={!capabilities.canManageWorkplaceAdmin}
                          onChange={(event) =>
                            patch('maximumConsecutiveDays', Number(event.target.value))
                          }
                          inputProps={{ min: 1, max: Math.min(31, form.bookingWindowDays) }}
                        />
                      </Box>
                      <FormControlLabel
                        sx={{ mt: 1 }}
                        control={
                          <Switch
                            checked={form.allowRecurring}
                            disabled={!capabilities.canManageWorkplaceAdmin}
                            onChange={(_, value) => patch('allowRecurring', value)}
                          />
                        }
                        label={t('workplace.admin.policy.allowRecurring')}
                      />
                    </PolicySection>
                  ) : null}

                  {section === 'fixed' ? (
                    <PolicySection
                      icon={Armchair}
                      title={t('workplace.admin.policy.fixedSeatTitle')}
                    >
                      <FormControlLabel
                        control={
                          <Switch
                            checked={form.allowAssignedDeskLending}
                            disabled={!capabilities.canManageWorkplaceAdmin}
                            onChange={(_, value) => patch('allowAssignedDeskLending', value)}
                          />
                        }
                        label={t('workplace.admin.policy.allowAssignedDeskLending')}
                      />
                      <Typography variant="body2" color="text.secondary">
                        {t('workplace.admin.policy.allowAssignedDeskLendingHint')}
                      </Typography>
                    </PolicySection>
                  ) : null}

                  {section === 'hours' ? (
                    <PolicySection icon={Clock3} title={t('workplace.admin.policy.hoursTitle')}>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                          gap: 1.5,
                        }}
                      >
                        <TimePickerField
                          label={t('workplace.admin.policy.workingStart')}
                          value={form.workingDayStart}
                          disabled={!capabilities.canManageWorkplaceAdmin}
                          onValueChange={(value) => value && patch('workingDayStart', value)}
                        />
                        <TimePickerField
                          label={t('workplace.admin.policy.workingEnd')}
                          value={form.workingDayEnd}
                          disabled={!capabilities.canManageWorkplaceAdmin}
                          onValueChange={(value) => value && patch('workingDayEnd', value)}
                        />
                        <FormField
                          type="number"
                          label={t('workplace.admin.policy.minimumMinutes')}
                          value={form.minimumBookingMinutes}
                          disabled={!capabilities.canManageWorkplaceAdmin}
                          onChange={(event) =>
                            patch('minimumBookingMinutes', Number(event.target.value))
                          }
                          inputProps={{ min: 15, max: 1440, step: 15 }}
                        />
                        <FormField
                          type="number"
                          label={t('workplace.admin.policy.maximumMinutes')}
                          value={form.maximumBookingMinutes}
                          disabled={!capabilities.canManageWorkplaceAdmin}
                          onChange={(event) =>
                            patch('maximumBookingMinutes', Number(event.target.value))
                          }
                          inputProps={{ min: 15, max: 10080, step: 15 }}
                        />
                      </Box>
                    </PolicySection>
                  ) : null}

                  {section === 'arrival' ? (
                    <PolicySection
                      icon={UserRoundCheck}
                      title={t('workplace.admin.policy.arrivalTitle')}
                    >
                      <Stack gap={1.25}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={form.requireCheckIn}
                              disabled={!capabilities.canManageWorkplaceAdmin}
                              onChange={(_, value) => patch('requireCheckIn', value)}
                            />
                          }
                          label={t('workplace.admin.policy.requireCheckIn')}
                        />
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                            gap: 1.5,
                          }}
                        >
                          <FormField
                            type="number"
                            disabled={!form.requireCheckIn || !capabilities.canManageWorkplaceAdmin}
                            label={t('workplace.admin.policy.checkInLead')}
                            value={form.checkInLeadMinutes}
                            onChange={(event) =>
                              patch('checkInLeadMinutes', Number(event.target.value))
                            }
                            inputProps={{ min: 0, max: 240 }}
                          />
                          <FormField
                            type="number"
                            disabled={!form.requireCheckIn || !capabilities.canManageWorkplaceAdmin}
                            label={t('workplace.admin.policy.autoRelease')}
                            value={form.autoReleaseMinutes}
                            onChange={(event) =>
                              patch('autoReleaseMinutes', Number(event.target.value))
                            }
                            inputProps={{ min: 0, max: 240 }}
                          />
                        </Box>
                      </Stack>
                    </PolicySection>
                  ) : null}

                  {section === 'privacy' ? (
                    <PolicySection
                      icon={ShieldCheck}
                      title={t('workplace.admin.policy.privacyTitle')}
                    >
                      <Stack gap={1.5}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={form.showColleagueNames}
                              disabled={!capabilities.canManageWorkplaceAdmin}
                              onChange={(_, value) => patch('showColleagueNames', value)}
                            />
                          }
                          label={t('workplace.admin.policy.showNames')}
                        />
                        <Box sx={{ maxWidth: 420 }}>
                          <FormField
                            type="number"
                            label={t('workplace.admin.policy.bookingRetentionDays')}
                            value={form.bookingRetentionDays}
                            disabled={!capabilities.canManageWorkplaceAdmin}
                            onChange={(event) =>
                              patch('bookingRetentionDays', Number(event.target.value))
                            }
                            supportingText={t('workplace.admin.policy.bookingRetentionDaysHint')}
                            inputProps={{ min: 30, max: 3650 }}
                          />
                        </Box>
                      </Stack>
                    </PolicySection>
                  ) : null}
                </Box>
                {section !== 'approval' ? (
                  <ActionButton
                    intent="primary"
                    disabled={!dirty || !valid || !capabilities.canManageWorkplaceAdmin}
                    onClick={() => setReviewOpen(true)}
                  >
                    {t('workplace.experience.reviewChange')}
                  </ActionButton>
                ) : null}
              </Stack>
              <Stack
                spacing={2}
                sx={{
                  minWidth: 0,
                  position: { lg: section === 'approval' ? 'static' : 'sticky' },
                  top: { lg: 88 },
                }}
              >
                {section !== 'approval' ? (
                  <WorkplacePolicyImpactPreview proposed={form} valid={valid} />
                ) : null}
                <ActionButton
                  intent="secondary"
                  onClick={() => navigate('/workplace/admin/governance?area=policy')}
                >
                  {t('workplace.admin.governance.tabs.policy')}
                </ActionButton>
              </Stack>
            </Stack>
          </Box>
        )}
      <ConfirmDialog
        open={navigationBlocker.state === 'blocked'}
        title={t('workplace.admin.policy.unsavedTitle')}
        description={t('workplace.admin.policy.unsavedDescription')}
        cancelLabel={t('actions.keep')}
        confirmLabel={t('workplace.admin.policy.discardChanges')}
        intent="danger"
        onClose={() => navigationBlocker.reset?.()}
        onConfirm={() => navigationBlocker.proceed?.()}
      />
      {reviewOpen && form && query.data ? (
        <WorkplaceBookingPolicyReview
          proposed={form}
          current={query.data}
          valid={valid}
          sourceReady={!query.isFetching && !query.isError}
          recheck={async () => {
            const result = await query.refetch();
            if (activeIdentity.current !== identity) return false;
            if (result.isSuccess && result.data) {
              setForm((value) => (value ? { ...value, version: result.data!.version } : value));
              setBaseline(result.data);
            }
            return result.isSuccess;
          }}
          onSaved={(saved) => {
            setForm(saved);
            setBaseline(saved);
          }}
          onClose={() => setReviewOpen(false)}
        />
      ) : null}
    </PageCanvas>
  );
}
