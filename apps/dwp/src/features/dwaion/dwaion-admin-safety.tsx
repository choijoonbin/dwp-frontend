import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LockKeyhole, ShieldAlert } from 'lucide-react';
import { ActionButton, FormField, PageCanvas, SelectField } from '@dwp-frontend/design-system';
import {
  getDwaionSafetyPolicy,
  updateDwaionSafetyPolicy,
  type DwaionPolicyOutcome,
  type DwaionSafetyPolicy,
  usePermissions,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DwaionAdminPageHeader } from './dwaion-admin-ui';

const OUTCOME_OPTIONS = (['HANDOFF', 'DENY'] as const).map((value) => ({ value, label: value }));

export function DwaionAdminSafety() {
  const { t } = useTranslation('work');
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canUpdate =
    hasPermission('ADMIN.DWAION_SAFETY', 'UPDATE') ||
    hasPermission('ADMIN.DWAION_SAFETY', 'MANAGE');
  const query = useQuery({
    queryKey: ['dwaion', 'admin', 'safety'],
    queryFn: getDwaionSafetyPolicy,
    staleTime: 20_000,
  });
  const [draft, setDraft] = useState<DwaionSafetyPolicy | null>(null);
  const [reason, setReason] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (query.data) setDraft(query.data);
  }, [query.data]);
  const dirty = useMemo(
    () =>
      Boolean(
        draft &&
        query.data &&
        (draft.privilegedDataOutcome !== query.data.privilegedDataOutcome ||
          draft.mutationOutcome !== query.data.mutationOutcome ||
          draft.maxSourceScopes !== query.data.maxSourceScopes ||
          draft.maxToolCalls !== query.data.maxToolCalls)
      ),
    [draft, query.data]
  );
  const mutation = useMutation({
    mutationFn: () =>
      updateDwaionSafetyPolicy({
        privilegedDataOutcome: draft!.privilegedDataOutcome,
        mutationOutcome: draft!.mutationOutcome,
        requireCitations: true,
        maxSourceScopes: draft!.maxSourceScopes,
        maxToolCalls: draft!.maxToolCalls,
        expectedVersion: query.data!.policyVersion,
        changeReason: reason.trim(),
      }),
    onSuccess: async (policy) => {
      queryClient.setQueryData(['dwaion', 'admin', 'safety'], policy);
      setDraft(policy);
      setReason('');
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ['dwaion', 'admin', 'overview'] });
    },
  });

  return (
    <PageCanvas>
      <DwaionAdminPageHeader
        eyebrow={t('dwaionAdmin.shared.governance')}
        title={t('dwaionAdmin.safety.title')}
        description={t('dwaionAdmin.safety.description')}
      />
      {saved && (
        <Alert severity="success" sx={{ mt: 2 }} onClose={() => setSaved(false)}>
          {t('dwaionAdmin.safety.saved')}
        </Alert>
      )}
      {(query.isError || mutation.isError) && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {t('dwaionAdmin.safety.error')}
        </Alert>
      )}
      {query.isLoading || !draft ? (
        <Skeleton variant="rounded" height={480} sx={{ mt: 3 }} />
      ) : (
        <Box component="section" sx={{ mt: 3, maxWidth: 880 }}>
          <Alert severity="info" icon={<LockKeyhole size={19} />}>
            {t('dwaionAdmin.safety.lockedBoundary')}
          </Alert>
          <Box sx={{ mt: 2, borderBlock: 1, borderColor: 'divider' }}>
            <SafetyRow
              title={t('dwaionAdmin.safety.prompt.title')}
              description={t('dwaionAdmin.safety.prompt.description')}
              value={
                <Typography variant="body2" fontWeight={800}>
                  {t('dwaionAdmin.shared.blocked')}
                </Typography>
              }
            />
            <Divider />
            <SafetyRow
              title={t('dwaionAdmin.safety.privileged.title')}
              description={t('dwaionAdmin.safety.privileged.description')}
              value={
                <SelectField<DwaionPolicyOutcome>
                  size="small"
                  value={draft.privilegedDataOutcome}
                  options={OUTCOME_OPTIONS}
                  disabled={!canUpdate}
                  onValueChange={(value) =>
                    value && setDraft({ ...draft, privilegedDataOutcome: value })
                  }
                  sx={{ width: 190 }}
                />
              }
            />
            <Divider />
            <SafetyRow
              title={t('dwaionAdmin.safety.mutation.title')}
              description={t('dwaionAdmin.safety.mutation.description')}
              value={
                <SelectField<DwaionPolicyOutcome>
                  size="small"
                  value={draft.mutationOutcome}
                  options={OUTCOME_OPTIONS}
                  disabled={!canUpdate}
                  onValueChange={(value) => value && setDraft({ ...draft, mutationOutcome: value })}
                  sx={{ width: 190 }}
                />
              }
            />
            <Divider />
            <SafetyRow
              title={t('dwaionAdmin.safety.citations.title')}
              description={t('dwaionAdmin.safety.citations.description')}
              value={
                <Typography variant="body2" fontWeight={800}>
                  {t('dwaionAdmin.shared.required')}
                </Typography>
              }
            />
            <Divider />
            <SafetyRow
              title={t('dwaionAdmin.safety.web.title')}
              description={t('dwaionAdmin.safety.web.description')}
              value={
                <Typography variant="body2" fontWeight={800}>
                  {t('dwaionAdmin.shared.blocked')}
                </Typography>
              }
            />
          </Box>
          <Box
            sx={{
              mt: 3,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 3,
            }}
          >
            <PolicySlider
              label={t('dwaionAdmin.safety.maxSources')}
              value={draft.maxSourceScopes}
              min={1}
              max={7}
              disabled={!canUpdate}
              onChange={(value) => setDraft({ ...draft, maxSourceScopes: value })}
            />
            <PolicySlider
              label={t('dwaionAdmin.safety.maxTools')}
              value={draft.maxToolCalls}
              min={0}
              max={10}
              disabled={!canUpdate}
              onChange={(value) => setDraft({ ...draft, maxToolCalls: value })}
            />
          </Box>
          <FormField
            label={t('dwaionAdmin.shared.reason')}
            value={reason}
            disabled={!canUpdate || !dirty}
            multiline
            minRows={3}
            onChange={(event) => setReason(event.target.value)}
            errorMessage={
              dirty && reason && reason.trim().length < 10
                ? t('dwaionAdmin.shared.reasonError')
                : undefined
            }
            sx={{ mt: 3 }}
          />
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              {t('dwaionAdmin.shared.version', { version: draft.policyVersion })}
            </Typography>
            <ActionButton
              intent="primary"
              startIcon={<ShieldAlert size={16} />}
              disabled={!canUpdate || !dirty || reason.trim().length < 10}
              loading={mutation.isPending}
              loadingLabel={t('dwaionAdmin.shared.saving')}
              onClick={() => mutation.mutate()}
            >
              {t('dwaionAdmin.shared.save')}
            </ActionButton>
          </Stack>
        </Box>
      )}
    </PageCanvas>
  );
}

function SafetyRow({
  title,
  description,
  value,
}: {
  title: string;
  description: string;
  value: React.ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'stretch', sm: 'center' }}
      gap={2}
      sx={{ py: 1.6 }}
    >
      <Box>
        <Typography variant="body2" fontWeight={800}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {description}
        </Typography>
      </Box>
      <Box sx={{ flexShrink: 0 }}>{value}</Box>
    </Stack>
  );
}

function PolicySlider({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="body2" fontWeight={800}>
          {label}
        </Typography>
        <Typography variant="body2">{value}</Typography>
      </Stack>
      <Slider
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={1}
        marks
        disabled={disabled}
        onChange={(_, next) => onChange(next as number)}
        sx={{ mt: 1 }}
      />
    </Box>
  );
}
