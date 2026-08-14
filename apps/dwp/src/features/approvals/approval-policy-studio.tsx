import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  EmptyState,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';
import { getApprovalPolicies, updateApprovalPolicy, useToast } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { ApprovalSurface, StatusChip, approvalTone } from './approval-ui';
import { useApprovalExperience } from './use-approval-experience';

type RuleEntry = { key: string; value: string };

const ENFORCEMENT_OPTIONS = ['BLOCK', 'WARN', 'MONITOR'].map((value) => ({
  value,
  label: value,
}));
const SEVERITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((value) => ({
  value,
  label: value,
}));
const LIFECYCLE_OPTIONS = ['ACTIVE', 'DISABLED', 'RETIRED'].map((value) => ({
  value,
  label: value,
}));

export function ApprovalPolicyStudio() {
  const { t, i18n } = useTranslation('approvals');
  const experience = useApprovalExperience();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [mode, setMode] = useState('BLOCK');
  const [severity, setSeverity] = useState('HIGH');
  const [state, setState] = useState('ACTIVE');
  const [rules, setRules] = useState<RuleEntry[]>([]);
  const policies = useQuery({
    queryKey: ['approvals', 'admin', 'policies'],
    queryFn: getApprovalPolicies,
    staleTime: 30_000,
  });
  const selected = useMemo(
    () => policies.data?.find((policy) => policy.policyId === selectedId) ?? null,
    [policies.data, selectedId]
  );
  useEffect(() => {
    if (!selectedId && policies.data?.length) setSelectedId(policies.data[0].policyId);
  }, [policies.data, selectedId]);

  const save = useMutation({
    mutationFn: () =>
      updateApprovalPolicy(selected!.policyId, {
        enforcementMode: mode,
        severity,
        lifecycleState: state,
        rule: Object.fromEntries(rules.map((entry) => [entry.key, parseRuleValue(entry.value)])),
        expectedVersion: selected!.version,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(['approvals', 'admin', 'policies'], result);
      setEditorOpen(false);
      toast.success(t('admin.studio.policySaved'));
    },
    onError: () => toast.error(t('admin.studio.saveConflict')),
  });
  const openEditor = () => {
    if (!selected) return;
    setMode(selected.enforcementMode);
    setSeverity(selected.severity);
    setState(selected.lifecycleState);
    setRules(Object.entries(selected.rule).map(([key, value]) => ({ key, value: String(value) })));
    setEditorOpen(true);
  };

  if (policies.isError) return <Alert severity="error">{t('admin.loadError')}</Alert>;

  return (
    <>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(270px, 0.8fr) minmax(0, 2.2fr)' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <ApprovalSurface
          title={t('admin.policies.title')}
          meta={t('admin.policies.meta')}
          action={<Chip size="small" label={policies.data?.length ?? 0} />}
        >
          <Stack component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {(policies.data ?? []).map((policy) => (
              <Box component="li" key={policy.policyId}>
                <ButtonBase
                  onClick={() => setSelectedId(policy.policyId)}
                  sx={{
                    width: 1,
                    minHeight: 76,
                    px: 2,
                    py: 1.25,
                    gap: 1.25,
                    display: 'flex',
                    textAlign: 'left',
                    borderBottom: 1,
                    borderColor: 'divider',
                    bgcolor:
                      policy.policyId === selectedId
                        ? alpha(approvalTone.primary, 0.08)
                        : 'transparent',
                    boxShadow:
                      policy.policyId === selectedId
                        ? `inset 3px 0 0 ${approvalTone.primary}`
                        : 'none',
                    '&:hover': { bgcolor: alpha(approvalTone.primary, 0.055) },
                  }}
                >
                  <ShieldCheck size={18} color={approvalTone.primary} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={750} noWrap>
                      {i18n.resolvedLanguage?.startsWith('ko') ? policy.nameKo : policy.nameEn}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {policy.policyType}
                    </Typography>
                  </Box>
                  <StatusChip status={policy.lifecycleState} />
                </ButtonBase>
              </Box>
            ))}
          </Stack>
        </ApprovalSurface>

        {!selected ? (
          <EmptyState
            title={t('admin.studio.noPolicy')}
            description={t('admin.studio.noPolicyDescription')}
            icon={<ShieldCheck size={24} />}
          />
        ) : (
          <Stack gap={2} minWidth={0}>
            <Box
              component="section"
              sx={{
                p: { xs: 2, md: 2.5 },
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
                <Box minWidth={0}>
                  <Typography variant="overline" color="primary.main">
                    {selected.policyType}
                  </Typography>
                  <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                    <Typography component="h2" variant="h5">
                      {i18n.resolvedLanguage?.startsWith('ko') ? selected.nameKo : selected.nameEn}
                    </Typography>
                    <StatusChip status={selected.lifecycleState} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                    {selected.policyKey}
                  </Typography>
                </Box>
                {experience.canManagePolicies && (
                  <ActionButton
                    intent="secondary"
                    startIcon={<SlidersHorizontal size={17} />}
                    onClick={openEditor}
                  >
                    {t('admin.studio.configurePolicy')}
                  </ActionButton>
                )}
              </Stack>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              {[
                [t('admin.studio.enforcement'), selected.enforcementMode],
                [t('admin.studio.severity'), selected.severity],
                [t('admin.studio.policyVersion'), `v${selected.version}`],
              ].map(([label, value]) => (
                <Box
                  key={String(label)}
                  sx={{ p: 2, borderRight: { md: 1 }, borderColor: 'divider' }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography variant="h6" sx={{ mt: 0.4 }}>
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>

            <ApprovalSurface title={t('admin.studio.ruleTitle')} meta={t('admin.studio.ruleMeta')}>
              <Box component="dl" sx={{ m: 0 }}>
                {Object.entries(selected.rule).map(([key, value]) => (
                  <Box
                    key={key}
                    sx={{
                      minHeight: 64,
                      px: 2,
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'minmax(180px,0.7fr) minmax(0,1.3fr)' },
                      alignItems: 'center',
                      gap: 2,
                      borderBottom: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <Typography component="dt" variant="body2" fontWeight={720}>
                      {key}
                    </Typography>
                    <Typography component="dd" variant="body2" color="text.secondary" sx={{ m: 0 }}>
                      {String(value)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </ApprovalSurface>
            <Alert
              severity={selected.enforcementMode === 'BLOCK' ? 'warning' : 'info'}
              icon={<KeyRound size={18} />}
            >
              {t('admin.studio.policyChangeNotice')}
            </Alert>
          </Stack>
        )}
      </Box>

      <FormDialog
        open={editorOpen}
        title={t('admin.studio.configurePolicy')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('actions.save')}
        submittingLabel={t('actions.save')}
        busy={save.isPending}
        onClose={() => setEditorOpen(false)}
        onSubmit={() => save.mutate()}
        maxWidth="sm"
      >
        <Stack gap={2}>
          <Alert severity="warning">{t('admin.studio.policyReviewNotice')}</Alert>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3,1fr)' },
              gap: 1.25,
            }}
          >
            <SelectField
              label={t('admin.studio.enforcement')}
              value={mode}
              options={ENFORCEMENT_OPTIONS}
              onValueChange={(value) => value && setMode(value)}
            />
            <SelectField
              label={t('admin.studio.severity')}
              value={severity}
              options={SEVERITY_OPTIONS}
              onValueChange={(value) => value && setSeverity(value)}
            />
            <SelectField
              label={t('admin.studio.lifecycle')}
              value={state}
              options={LIFECYCLE_OPTIONS}
              onValueChange={(value) => value && setState(value)}
            />
          </Box>
          <Typography variant="subtitle2">{t('admin.studio.ruleTitle')}</Typography>
          {rules.map((entry, index) => (
            <Box
              key={entry.key}
              sx={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
                gap: 1.25,
              }}
            >
              <FormField label={t('admin.studio.ruleKey')} value={entry.key} disabled />
              <FormField
                label={t('admin.studio.ruleValue')}
                value={entry.value}
                onChange={(event) =>
                  setRules((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, value: event.target.value } : item
                    )
                  )
                }
              />
            </Box>
          ))}
        </Stack>
      </FormDialog>
    </>
  );
}

function parseRuleValue(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed !== '' && Number.isFinite(Number(trimmed))) return Number(trimmed);
  return trimmed;
}
