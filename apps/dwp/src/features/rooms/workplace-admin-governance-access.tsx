import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, ShieldCheck, ShieldX } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getWorkplaceAdminSites,
  getWorkplaceGovernanceAccessRules,
  previewWorkplaceGovernanceSiteAccess,
  saveWorkplaceGovernanceAccessRule,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  DateTimePickerField,
  DwpDateTimeProvider,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  isWorkplaceGovernancePeriodValid,
  isWorkplaceGovernanceUuid,
  parseWorkplaceGovernanceUserId,
} from './workplace-admin-governance-model';
import {
  GovernanceEmpty,
  GovernanceLoading,
  GovernancePanel,
  GovernanceQueryError,
} from './workplace-admin-governance-ui';

import type {
  WorkplaceGovernanceAccessPermission,
  WorkplaceGovernanceSiteAccessRule,
  WorkplaceGovernanceSiteAccessRuleInput,
} from '@dwp-frontend/shared-utils';

export function WorkplaceAdminGovernanceAccess({ canManage }: { canManage: boolean }) {
  const { t, i18n } = useTranslation('rooms');
  const [siteId, setSiteId] = useState('');
  const [permission, setPermission] = useState<WorkplaceGovernanceAccessPermission>('VIEW');
  const [editor, setEditor] = useState<WorkplaceGovernanceSiteAccessRule | 'new' | null>(null);
  const sitesQuery = useQuery({
    queryKey: ['workplace', 'admin', 'sites'],
    queryFn: getWorkplaceAdminSites,
    staleTime: 30_000,
    retry: 1,
  });
  const sites = useMemo(() => sitesQuery.data ?? [], [sitesQuery.data]);
  const selectedSite = sites.find((site) => site.siteId === siteId) ?? sites[0] ?? null;
  useEffect(() => {
    if (selectedSite && selectedSite.siteId !== siteId) setSiteId(selectedSite.siteId);
  }, [selectedSite, siteId]);
  const rulesQuery = useQuery({
    queryKey: ['workplace', 'governance', 'access-rules', selectedSite?.siteId],
    queryFn: () => getWorkplaceGovernanceAccessRules(selectedSite!.siteId),
    enabled: Boolean(selectedSite),
    staleTime: 15_000,
    retry: 1,
  });
  const previewQuery = useQuery({
    queryKey: ['workplace', 'governance', 'access-preview', selectedSite?.siteId, permission],
    queryFn: () => previewWorkplaceGovernanceSiteAccess(selectedSite!.siteId, permission),
    enabled: Boolean(selectedSite),
    staleTime: 5_000,
    retry: 1,
  });

  if (sitesQuery.isLoading) return <GovernanceLoading rows={6} />;
  if (sitesQuery.isError) return <GovernanceQueryError retry={() => void sitesQuery.refetch()} />;
  if (!selectedSite) {
    return (
      <GovernanceEmpty
        title={t('workplace.admin.governance.access.emptySites')}
        description={t('workplace.admin.governance.access.emptySitesDescription')}
      />
    );
  }

  return (
    <Stack spacing={2}>
      <Alert severity="info">{t('workplace.admin.governance.access.denyPrecedence')}</Alert>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.6fr) minmax(300px, 0.8fr)' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <GovernancePanel
          title={t('workplace.admin.governance.access.rules')}
          description={t('workplace.admin.governance.access.rulesDescription')}
          actions={
            canManage ? (
              <ActionButton
                intent="primary"
                startIcon={<Plus size={16} />}
                onClick={() => setEditor('new')}
              >
                {t('workplace.admin.governance.access.addRule')}
              </ActionButton>
            ) : null
          }
        >
          <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <SelectField
              label={t('workplace.admin.governance.fields.site')}
              value={selectedSite.siteId}
              options={sites.map((site) => ({ value: site.siteId, label: site.name }))}
              onValueChange={setSiteId}
            />
          </Box>
          {rulesQuery.isLoading ? (
            <GovernanceLoading rows={4} />
          ) : rulesQuery.isError ? (
            <GovernanceQueryError retry={() => void rulesQuery.refetch()} />
          ) : rulesQuery.data?.length ? (
            <Stack divider={<Divider flexItem />}>
              {rulesQuery.data.map((rule) => (
                <Stack
                  key={rule.accessRuleId}
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                  justifyContent="space-between"
                  gap={1.25}
                  sx={{ px: 1.5, py: 1.25 }}
                >
                  <Stack direction="row" gap={1.25} alignItems="flex-start" sx={{ minWidth: 0 }}>
                    <Box
                      sx={{
                        width: 34,
                        height: 34,
                        flex: '0 0 auto',
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: rule.effect === 'DENY' ? 'error.lighter' : 'success.lighter',
                        color: rule.effect === 'DENY' ? 'error.main' : 'success.main',
                      }}
                    >
                      {rule.effect === 'DENY' ? <ShieldX size={17} /> : <ShieldCheck size={17} />}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" gap={0.6} flexWrap="wrap" alignItems="center">
                        <Typography fontWeight={750}>
                          {rule.subjectType === 'USER'
                            ? t('workplace.admin.governance.access.userSubject', {
                                id: rule.subjectUserId,
                              })
                            : t('workplace.admin.governance.access.groupSubject', {
                                id: rule.subjectGroupRef,
                              })}
                        </Typography>
                        <Chip
                          size="small"
                          color={rule.effect === 'DENY' ? 'error' : 'success'}
                          variant="outlined"
                          label={rule.effect}
                        />
                        <Chip size="small" variant="outlined" label={rule.permission} />
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {rule.validFrom || rule.validUntil
                          ? t('workplace.admin.governance.access.validity', {
                              from:
                                rule.validFrom ?? t('workplace.admin.governance.common.unbounded'),
                              until:
                                rule.validUntil ?? t('workplace.admin.governance.common.unbounded'),
                            })
                          : t('workplace.admin.governance.access.always')}
                      </Typography>
                    </Box>
                  </Stack>
                  {canManage ? (
                    <ActionIconButton
                      size="small"
                      label={t('actions.edit')}
                      onClick={() => setEditor(rule)}
                    >
                      <Pencil size={15} />
                    </ActionIconButton>
                  ) : null}
                </Stack>
              ))}
            </Stack>
          ) : (
            <GovernanceEmpty
              title={t('workplace.admin.governance.access.emptyRules')}
              description={t('workplace.admin.governance.access.emptyRulesDescription')}
            />
          )}
        </GovernancePanel>

        <GovernancePanel
          title={t('workplace.admin.governance.access.preview')}
          description={t('workplace.admin.governance.access.previewDescription')}
        >
          <Stack spacing={1.5} sx={{ p: 1.5 }}>
            <SelectField
              label={t('workplace.admin.governance.fields.permission')}
              value={permission}
              options={(['VIEW', 'BOOK', 'MANAGE'] as const).map((value) => ({
                value,
                label: t(`workplace.admin.governance.permissions.${value}`),
              }))}
              onValueChange={(value) => setPermission(value as WorkplaceGovernanceAccessPermission)}
            />
            {previewQuery.isLoading ? <GovernanceLoading rows={2} /> : null}
            {previewQuery.isError ? (
              <GovernanceQueryError retry={() => void previewQuery.refetch()} />
            ) : null}
            {previewQuery.data ? (
              <Alert
                severity={previewQuery.data.allowed ? 'success' : 'warning'}
                icon={previewQuery.data.allowed ? <ShieldCheck /> : <ShieldX />}
              >
                <Typography fontWeight={750}>
                  {t(
                    previewQuery.data.allowed
                      ? 'workplace.admin.governance.access.allowed'
                      : 'workplace.admin.governance.access.denied'
                  )}
                </Typography>
                <Typography variant="caption" component="div">
                  {previewQuery.data.decision} ·{' '}
                  {t('workplace.admin.governance.access.matchedRules', {
                    count: previewQuery.data.matchedRuleIds.length,
                  })}
                </Typography>
              </Alert>
            ) : null}
            <Typography variant="caption" color="text.secondary">
              {t('workplace.admin.governance.access.previewIdentityNotice')}
            </Typography>
          </Stack>
        </GovernancePanel>
      </Box>

      <AccessRuleDialog
        siteId={selectedSite.siteId}
        timeZone={selectedSite.timeZone}
        target={editor}
        canManage={canManage}
        locale={i18n.resolvedLanguage}
        onClose={() => setEditor(null)}
      />
    </Stack>
  );
}

function AccessRuleDialog({
  siteId,
  timeZone,
  target,
  canManage,
  locale,
  onClose,
}: {
  siteId: string;
  timeZone: string;
  target: WorkplaceGovernanceSiteAccessRule | 'new' | null;
  canManage: boolean;
  locale?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation('rooms');
  const toast = useToast();
  const queryClient = useQueryClient();
  const existing = target && target !== 'new' ? target : null;
  const [form, setForm] = useState<WorkplaceGovernanceSiteAccessRuleInput>({
    subjectType: 'USER',
    subjectUserId: null,
    subjectGroupRef: null,
    permission: 'VIEW',
    effect: 'ALLOW',
    validFrom: null,
    validUntil: null,
    state: 'ACTIVE',
    version: null,
  });
  const [subject, setSubject] = useState('');
  useEffect(() => {
    if (!target) return;
    setForm(
      existing
        ? {
            subjectType: existing.subjectType,
            subjectUserId: existing.subjectUserId,
            subjectGroupRef: existing.subjectGroupRef,
            permission: existing.permission,
            effect: existing.effect,
            validFrom: existing.validFrom,
            validUntil: existing.validUntil,
            state: existing.state,
            version: existing.version,
          }
        : {
            subjectType: 'USER',
            subjectUserId: null,
            subjectGroupRef: null,
            permission: 'VIEW',
            effect: 'ALLOW',
            validFrom: null,
            validUntil: null,
            state: 'ACTIVE',
            version: null,
          }
    );
    setSubject(String(existing?.subjectUserId ?? existing?.subjectGroupRef ?? ''));
  }, [existing, target]);
  const subjectValid =
    form.subjectType === 'USER'
      ? parseWorkplaceGovernanceUserId(subject) !== null
      : isWorkplaceGovernanceUuid(subject);
  const periodValid = isWorkplaceGovernancePeriodValid(form.validFrom, form.validUntil);
  const mutation = useMutation({
    mutationFn: () => {
      if (!canManage || !subjectValid || !periodValid) throw new Error('Invalid access rule');
      const input: WorkplaceGovernanceSiteAccessRuleInput = {
        ...form,
        subjectUserId: form.subjectType === 'USER' ? parseWorkplaceGovernanceUserId(subject) : null,
        subjectGroupRef: form.subjectType === 'GROUP_REF' ? subject.trim() : null,
      };
      return saveWorkplaceGovernanceAccessRule(siteId, existing?.accessRuleId ?? null, input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workplace', 'governance'] });
      toast.success(t('workplace.admin.governance.common.saved'));
      onClose();
    },
    onError: () => toast.error(t('workplace.admin.governance.common.saveError')),
  });
  return (
    <FormDialog
      open={Boolean(target)}
      title={t(
        existing
          ? 'workplace.admin.governance.access.editRule'
          : 'workplace.admin.governance.access.addRule'
      )}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.save')}
      submittingLabel={t('actions.saving')}
      busy={mutation.isPending}
      submitDisabled={!canManage || !subjectValid || !periodValid}
      onClose={onClose}
      onSubmit={() => mutation.mutate()}
      maxWidth="md"
    >
      <Stack spacing={2}>
        <Box
          sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1.5fr' }, gap: 1.5 }}
        >
          <SelectField
            label={t('workplace.admin.governance.fields.subjectType')}
            value={form.subjectType}
            options={(['USER', 'GROUP_REF'] as const).map((value) => ({
              value,
              label: t(`workplace.admin.governance.subjectTypes.${value}`),
            }))}
            onValueChange={(value) => {
              setForm({
                ...form,
                subjectType: value as WorkplaceGovernanceSiteAccessRuleInput['subjectType'],
              });
              setSubject('');
            }}
          />
          <FormField
            required
            label={t(
              form.subjectType === 'USER'
                ? 'workplace.admin.governance.fields.userId'
                : 'workplace.admin.governance.fields.groupRef'
            )}
            value={subject}
            errorMessage={
              subject && !subjectValid
                ? t('workplace.admin.governance.fields.invalidSubject')
                : undefined
            }
            onChange={(event) => setSubject(event.target.value)}
          />
        </Box>
        <Box
          sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 1.5 }}
        >
          <SelectField
            label={t('workplace.admin.governance.fields.permission')}
            value={form.permission}
            options={(['VIEW', 'BOOK', 'MANAGE'] as const).map((value) => ({
              value,
              label: t(`workplace.admin.governance.permissions.${value}`),
            }))}
            onValueChange={(value) =>
              setForm({ ...form, permission: value as WorkplaceGovernanceAccessPermission })
            }
          />
          <SelectField
            label={t('workplace.admin.governance.fields.effect')}
            value={form.effect}
            options={(['ALLOW', 'DENY'] as const).map((value) => ({
              value,
              label: t(`workplace.admin.governance.effects.${value}`),
            }))}
            onValueChange={(value) =>
              setForm({
                ...form,
                effect: value as WorkplaceGovernanceSiteAccessRuleInput['effect'],
              })
            }
          />
          <SelectField
            label={t('workplace.admin.governance.fields.state')}
            value={form.state}
            options={(['ACTIVE', 'INACTIVE'] as const).map((value) => ({
              value,
              label: t(`workplace.admin.governance.states.${value}`),
            }))}
            onValueChange={(value) =>
              setForm({
                ...form,
                state: value as WorkplaceGovernanceSiteAccessRuleInput['state'],
              })
            }
          />
        </Box>
        <DwpDateTimeProvider locale={locale} timeZone={timeZone}>
          <Box
            sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}
          >
            <DateTimePickerField
              label={t('workplace.admin.governance.fields.validFrom')}
              value={form.validFrom}
              onValueChange={(value) => setForm({ ...form, validFrom: value })}
              supportingText={timeZone}
            />
            <DateTimePickerField
              label={t('workplace.admin.governance.fields.validUntil')}
              value={form.validUntil}
              onValueChange={(value) => setForm({ ...form, validUntil: value })}
              errorMessage={
                !periodValid ? t('workplace.admin.governance.fields.invalidPeriod') : undefined
              }
            />
          </Box>
        </DwpDateTimeProvider>
      </Stack>
    </FormDialog>
  );
}
