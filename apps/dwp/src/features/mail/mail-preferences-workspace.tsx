import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  CheckCircle2,
  CirclePause,
  FileSignature,
  Keyboard,
  LoaderCircle,
  MailCheck,
  RefreshCw,
  Save,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import {
  getMailHome,
  getMailComposeContext,
  getMailPreferences,
  getMailWritingAssets,
  updateMailPreferences,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  GuidedEmptyState,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import { MailPageHeading } from './mail-components';
import {
  mailAccountCapabilityPresentation,
  mailAccountFeatureReadinessPresentation,
  mailAccountReadinessIsReady,
} from './mail-account-capability-presentation';
import { MAIL_PREFERENCES_QUERY_KEY } from './mail-runtime-preferences';
import { useMailUserPermissions } from './use-mail-user-permissions';

import type {
  MailAccount,
  MailAccountConnectionState,
  MailAccountReadinessEvidence,
  MailAccountSynchronizationState,
  MailComposeCapabilities,
  MailPreferences,
  MailPreferenceKey,
} from '@dwp-frontend/shared-utils';

type PreferenceTab = 'accounts' | 'reading' | 'notifications' | 'shortcuts';
type LockedPreference = MailPreferenceKey;

export function MailPreferencesWorkspace() {
  const { t } = useTranslation('mail');
  const { isLoaded, canUpdate } = useMailUserPermissions();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<PreferenceTab>('accounts');
  const [draft, setDraft] = useState<MailPreferences | null>(null);
  const home = useQuery({
    queryKey: ['mail', 'home'],
    queryFn: () => getMailHome(),
    staleTime: 30_000,
    retry: 1,
  });
  const preferences = useQuery({
    queryKey: MAIL_PREFERENCES_QUERY_KEY,
    queryFn: getMailPreferences,
    staleTime: 30_000,
    retry: 1,
  });
  const composeContext = useQuery({
    queryKey: ['mail', 'compose-context'],
    queryFn: getMailComposeContext,
    staleTime: 30_000,
    retry: 1,
  });
  const assets = useQuery({
    queryKey: ['mail', 'writing-assets'],
    queryFn: () => getMailWritingAssets(),
    staleTime: 30_000,
    retry: 1,
  });

  useEffect(() => {
    if (preferences.data) setDraft(preferences.data);
  }, [preferences.data]);

  const save = useMutation({
    mutationFn: () => {
      if (!canUpdate) throw new Error('APP.MAIL:UPDATE is required');
      if (!draft) throw new Error('Mail preferences are unavailable.');
      const { orgLocks: _orgLocks, ...input } = draft;
      return updateMailPreferences(input);
    },
    onSuccess: async (saved) => {
      setDraft(saved);
      queryClient.setQueryData(MAIL_PREFERENCES_QUERY_KEY, saved);
      await queryClient.invalidateQueries({ queryKey: ['mail', 'compose-context'] });
      toast.success(t('secondary.accounts.preferencesSaved'));
    },
    onError: () => toast.error(t('secondary.accounts.preferencesSaveError')),
  });
  const refresh = () =>
    void Promise.all([
      home.refetch(),
      preferences.refetch(),
      assets.refetch(),
      composeContext.refetch(),
    ]);

  return (
    <PageCanvas topInset="compact">
      <MailPageHeading
        eyebrow={t('accounts.eyebrow')}
        title={t('secondary.accounts.title')}
        description={t('secondary.accounts.description')}
        actions={
          <ActionIconButton label={t('actions.refresh')} onClick={refresh}>
            <RefreshCw size={17} />
          </ActionIconButton>
        }
      />
      {isLoaded && !canUpdate && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {t('permissions.readOnly', {
            defaultValue: 'You have read-only access. Preference changes are unavailable.',
          })}
        </Alert>
      )}
      <Tabs
        value={tab}
        onChange={(_event, value: PreferenceTab) => setTab(value)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label={t('secondary.accounts.tabsLabel')}
        sx={{ mt: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="accounts" label={t('secondary.accounts.accountTab')} />
        <Tab value="reading" label={t('secondary.accounts.readingTab')} />
        <Tab value="notifications" label={t('secondary.accounts.notificationTab')} />
        <Tab value="shortcuts" label={t('secondary.accounts.shortcutTab')} />
      </Tabs>

      {home.isLoading || preferences.isLoading ? (
        <Skeleton variant="rounded" height={320} sx={{ mt: 2 }} />
      ) : home.isError || preferences.isError || !draft ? (
        <Alert severity="error" sx={{ mt: 2 }}>
          {t('secondary.accounts.preferencesLoadError')}
        </Alert>
      ) : (
        <Box component="fieldset" disabled={!canUpdate} sx={{ mt: 2, p: 0, m: 0, border: 0 }}>
          {tab === 'accounts' && (
            <AccountSettings
              accounts={home.data?.accounts ?? []}
              accountCapabilities={composeContext.data?.accountCapabilities ?? {}}
              accountReadiness={composeContext.data?.accountReadiness ?? {}}
              capabilityLoading={composeContext.isLoading}
              capabilityError={composeContext.isError}
              onRefreshReadiness={() => void composeContext.refetch()}
              draft={draft}
              onChange={setDraft}
            />
          )}
          {tab === 'reading' && (
            <ReadingSettings
              draft={draft}
              signatures={assets.data?.signatures ?? []}
              onChange={setDraft}
            />
          )}
          {tab === 'notifications' && <NotificationSettings draft={draft} onChange={setDraft} />}
          {tab === 'shortcuts' && <ShortcutSettings draft={draft} onChange={setDraft} />}
          <Stack
            direction={{ xs: 'column-reverse', sm: 'row' }}
            justifyContent="flex-end"
            sx={{ mt: 3 }}
          >
            <ActionButton
              intent="primary"
              startIcon={<Save size={16} />}
              loading={save.isPending}
              disabled={!canUpdate}
              loadingLabel={t('actions.saving')}
              onClick={() => save.mutate()}
            >
              {t('actions.save')}
            </ActionButton>
          </Stack>
        </Box>
      )}
    </PageCanvas>
  );
}

function AccountSettings({
  accounts,
  accountCapabilities,
  accountReadiness,
  capabilityLoading,
  capabilityError,
  onRefreshReadiness,
  draft,
  onChange,
}: {
  accounts: MailAccount[];
  accountCapabilities: Record<string, MailComposeCapabilities>;
  accountReadiness: Record<string, MailAccountReadinessEvidence>;
  capabilityLoading: boolean;
  capabilityError: boolean;
  onRefreshReadiness: () => void;
  draft: MailPreferences;
  onChange: (next: MailPreferences) => void;
}) {
  const { t } = useTranslation('mail');
  if (!accounts.length) {
    return (
      <GuidedEmptyState
        kind="first-use"
        title={t('accounts.emptyTitle')}
        description={t('accounts.emptyDescription')}
      />
    );
  }
  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {t('secondary.accounts.capabilityBoundary')}
      </Typography>
      {capabilityError && (
        <Alert severity="warning">{t('secondary.accounts.capabilityLoadError')}</Alert>
      )}
      <SelectField
        label={t('secondary.accounts.defaultSender')}
        value={draft.defaultAccountId ?? ''}
        options={accounts.map((account) => ({
          value: account.accountId,
          label: `${account.displayName} · ${account.emailAddress}`,
          disabled:
            account.connectionState !== 'ACTIVE' ||
            !mailAccountReadinessIsReady(
              accountReadiness[account.accountId] ?? account.readiness ?? undefined
            ),
        }))}
        disabled={isLocked(draft, 'defaultAccountId')}
        supportingText={lockReason(draft, 'defaultAccountId')}
        onValueChange={(value) => onChange({ ...draft, defaultAccountId: value || null })}
      />
      <Box
        component="section"
        aria-label={t('secondary.accounts.listLabel')}
        sx={{ borderBlock: 1, borderColor: 'divider' }}
      >
        {accounts.map((account, index) => (
          <Box key={account.accountId}>
            {index > 0 && <Divider />}
            <AccountRow
              account={account}
              capabilities={
                mailAccountReadinessIsReady(
                  accountReadiness[account.accountId] ?? account.readiness ?? undefined
                )
                  ? accountCapabilities[account.accountId]
                  : undefined
              }
              readiness={accountReadiness[account.accountId] ?? account.readiness ?? undefined}
              capabilityLoading={capabilityLoading}
              onRetry={onRefreshReadiness}
            />
          </Box>
        ))}
      </Box>
      <ActionButton
        component={RouterLink}
        to="/mail/templates"
        intent="secondary"
        startIcon={<FileSignature size={16} />}
      >
        {t('secondary.accounts.manageWritingAssets')}
      </ActionButton>
    </Stack>
  );
}

function AccountRow({
  account,
  capabilities,
  readiness,
  capabilityLoading,
  onRetry,
}: {
  account: MailAccount;
  capabilities?: MailComposeCapabilities;
  readiness?: MailAccountReadinessEvidence;
  capabilityLoading: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation('mail');
  const status = accountStatusPresentation(account);
  const StatusIcon = status.icon;
  const readinessReady = mailAccountReadinessIsReady(readiness);
  const readinessState = readinessReady ? 'READY' : (readiness?.state ?? 'UNAVAILABLE');
  const featureReadiness = mailAccountFeatureReadinessPresentation(readiness);
  const readinessSourceLabel = (source: string) => {
    const knownSources = new Set([
      'CONNECTOR_RUNTIME',
      'PERSISTED_CONNECTION',
      'RUNTIME_REGISTRY',
      'ACCESS_POLICY',
      'NO_RUNTIME_ATTESTATION',
      'ACCOUNT_CONFIGURATION',
    ]);
    return knownSources.has(source)
      ? t(`secondary.accounts.readiness.source.${source}`)
      : t('secondary.accounts.readiness.source.unknown');
  };
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1.5}
      alignItems={{ sm: 'center' }}
      sx={{ py: 2 }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'var(--dwp-product-soft)',
          borderRadius: 1,
        }}
      >
        <MailCheck size={19} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
          <Typography fontWeight={800}>{account.displayName}</Typography>
          {account.defaultAccount && (
            <Chip size="small" variant="outlined" label={t('accounts.default')} />
          )}
          {account.accountKind === 'SHARED' && (
            <Chip size="small" variant="outlined" label={t('accounts.shared')} />
          )}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {account.emailAddress}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t(`provider.${account.providerType}`)} ·{' '}
          {t(`accounts.sync.${account.synchronizationState}`)}
        </Typography>
        <Stack spacing={0.4} sx={{ mt: 1, p: 1.25, bgcolor: 'action.hover' }}>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              color={
                readinessReady ? 'success' : readinessState === 'DEGRADED' ? 'warning' : 'error'
              }
              label={t(`secondary.accounts.readiness.state.${readinessState}`)}
            />
            <Typography variant="caption" color="text.secondary">
              {readiness
                ? t('secondary.accounts.readiness.observed', {
                    source: readinessSourceLabel(readiness.source),
                    time: readiness.observedAt,
                  })
                : t('secondary.accounts.readiness.missingEvidence')}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {t('secondary.accounts.readiness.credential', {
              state: t(
                readiness?.credentialConfigured
                  ? 'secondary.accounts.readiness.configured'
                  : 'secondary.accounts.readiness.notConfigured'
              ),
            })}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {readiness?.lastSuccessfulSyncAt
              ? t('secondary.accounts.readiness.lastSync', {
                  time: readiness.lastSuccessfulSyncAt,
                  scope:
                    readiness.lastSuccessfulSyncScope ??
                    t('secondary.accounts.readiness.scopeUnavailable'),
                })
              : t('secondary.accounts.readiness.noSuccessfulSync')}
          </Typography>
          {readiness?.errorCode ? (
            <Typography variant="caption" color="error.main">
              {t('secondary.accounts.readiness.error', { code: readiness.errorCode })}
            </Typography>
          ) : null}
          {readiness?.action === 'RETRY' ? (
            <ActionButton
              intent="secondary"
              size="small"
              startIcon={<RefreshCw size={14} />}
              onClick={onRetry}
              sx={{ alignSelf: 'flex-start' }}
            >
              {t('secondary.accounts.readiness.action.RETRY')}
            </ActionButton>
          ) : readiness && readiness.action !== 'NONE' ? (
            <Typography variant="caption" color="warning.main" fontWeight={700}>
              {t(`secondary.accounts.readiness.action.${readiness.action}`)}
            </Typography>
          ) : !readiness ? (
            <Typography variant="caption" color="warning.main" fontWeight={700}>
              {t('secondary.accounts.readiness.action.ACTIVATE_EXTERNALLY')}
            </Typography>
          ) : null}
        </Stack>
        <Typography variant="caption" fontWeight={800} sx={{ mt: 1 }}>
          {t('secondary.accounts.authorization.title')}
        </Typography>
        <Stack
          component="dl"
          spacing={0.75}
          aria-label={t('secondary.accounts.authorization.title')}
          sx={{ m: 0, mt: 0.75 }}
        >
          {(
            [
              ['consent', readiness?.consentEvidence],
              ['token', readiness?.tokenEvidence],
            ] as const
          ).map(([kind, evidence]) => (
            <Box
              key={kind}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'minmax(9rem, auto) 1fr' },
                gap: { xs: 0.25, sm: 1 },
                p: 1,
                border: 1,
                borderColor: 'divider',
              }}
            >
              <Typography component="dt" variant="caption" fontWeight={800}>
                {t(`secondary.accounts.authorization.${kind}`)}
              </Typography>
              <Box component="dd" sx={{ m: 0, minWidth: 0 }}>
                <Stack
                  direction="row"
                  spacing={0.75}
                  alignItems="center"
                  flexWrap="wrap"
                  useFlexGap
                >
                  <Chip
                    size="small"
                    color={
                      evidence?.state === 'VERIFIED' || evidence?.state === 'NOT_REQUIRED'
                        ? 'success'
                        : 'error'
                    }
                    label={t(
                      `secondary.accounts.authorization.state.${evidence?.state ?? 'UNKNOWN'}`
                    )}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {evidence
                      ? t('secondary.accounts.authorization.observed', {
                          source: readinessSourceLabel(evidence.source),
                          time: evidence.observedAt,
                        })
                      : t('secondary.accounts.authorization.missing')}
                  </Typography>
                </Stack>
                {evidence?.expiresAt ? (
                  <Typography variant="caption" color="text.secondary" display="block">
                    {t('secondary.accounts.authorization.expires', { time: evidence.expiresAt })}
                  </Typography>
                ) : null}
                {evidence?.errorCode ? (
                  <Typography variant="caption" color="error.main" display="block">
                    {t('secondary.accounts.readiness.error', { code: evidence.errorCode })}
                  </Typography>
                ) : null}
                {evidence && evidence.action !== 'NONE' ? (
                  <Typography
                    variant="caption"
                    color="warning.main"
                    display="block"
                    fontWeight={700}
                  >
                    {t(`secondary.accounts.readiness.action.${evidence.action}`)}
                  </Typography>
                ) : null}
              </Box>
            </Box>
          ))}
        </Stack>
        <Stack spacing={0.75} sx={{ mt: 1 }}>
          <Typography variant="caption" fontWeight={800}>
            {t('secondary.accounts.featureReadiness.title')}
          </Typography>
          {capabilityLoading ? (
            <Chip
              size="small"
              variant="outlined"
              label={t('secondary.accounts.capabilityLoading')}
            />
          ) : (
            <Stack component="ul" spacing={0.75} sx={{ m: 0, p: 0, listStyle: 'none' }}>
              {featureReadiness.map((feature) => (
                <Box
                  component="li"
                  key={feature.featureKey}
                  sx={{ p: 1, border: 1, borderColor: 'divider', minWidth: 0 }}
                >
                  <Stack
                    direction="row"
                    spacing={0.75}
                    alignItems="center"
                    flexWrap="wrap"
                    useFlexGap
                  >
                    <Typography variant="caption" fontWeight={800}>
                      {t(`secondary.accounts.capabilities.${feature.presentationKey}`)}
                    </Typography>
                    <Chip
                      size="small"
                      variant={feature.ready ? 'filled' : 'outlined'}
                      color={feature.ready ? 'success' : 'default'}
                      label={t(
                        feature.ready
                          ? 'secondary.accounts.capabilityReady'
                          : 'secondary.accounts.capabilityUnavailable'
                      )}
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {feature.evidence
                      ? t('secondary.accounts.featureReadiness.observed', {
                          source: readinessSourceLabel(feature.evidence.source),
                          time: feature.evidence.observedAt,
                        })
                      : t('secondary.accounts.featureReadiness.missing')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {feature.evidence?.lastSuccessfulAt
                      ? t('secondary.accounts.featureReadiness.lastSuccess', {
                          time: feature.evidence.lastSuccessfulAt,
                          scope:
                            feature.evidence.lastSuccessfulScope ??
                            t('secondary.accounts.readiness.scopeUnavailable'),
                        })
                      : t('secondary.accounts.featureReadiness.noSuccess')}
                  </Typography>
                  {feature.evidence?.errorCode ? (
                    <Typography variant="caption" color="error.main" display="block">
                      {t('secondary.accounts.readiness.error', {
                        code: feature.evidence.errorCode,
                      })}
                    </Typography>
                  ) : null}
                  {feature.evidence && feature.evidence.action !== 'NONE' ? (
                    <Typography
                      variant="caption"
                      color="warning.main"
                      display="block"
                      fontWeight={700}
                    >
                      {t(`secondary.accounts.readiness.action.${feature.evidence.action}`)}
                    </Typography>
                  ) : null}
                </Box>
              ))}
            </Stack>
          )}
          <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
            {mailAccountCapabilityPresentation(account, capabilities)
              .filter((capability) => capability.key.startsWith('sharedIdentity'))
              .map((capability) => (
                <Chip
                  key={capability.key}
                  size="small"
                  variant={capability.ready ? 'filled' : 'outlined'}
                  color={capability.ready ? 'success' : 'default'}
                  label={t('secondary.accounts.capabilityStatus', {
                    feature: t(`secondary.accounts.capabilities.${capability.key}`),
                    status: t(
                      capability.ready
                        ? 'secondary.accounts.capabilityReady'
                        : 'secondary.accounts.capabilityUnavailable'
                    ),
                  })}
                />
              ))}
          </Stack>
        </Stack>
      </Box>
      <Stack direction="row" spacing={0.75} alignItems="center" color={`${status.color}.main`}>
        <StatusIcon size={16} aria-hidden />
        <Typography variant="body2" fontWeight={700}>
          {t(status.labelKey)}
        </Typography>
      </Stack>
    </Stack>
  );
}

function ReadingSettings({
  draft,
  signatures,
  onChange,
}: {
  draft: MailPreferences;
  signatures: Array<{ signatureId: string; name: string }>;
  onChange: (next: MailPreferences) => void;
}) {
  const { t } = useTranslation('mail');
  return (
    <Stack spacing={2.5}>
      <SettingsSection
        title={t('secondary.accounts.densityTitle')}
        description={t('secondary.accounts.densityDescription')}
      >
        <SelectField
          label={t('secondary.accounts.density')}
          value={draft.density}
          options={[
            { value: 'COMFORTABLE', label: t('secondary.accounts.densityComfortable') },
            { value: 'COMPACT', label: t('secondary.accounts.densityCompact') },
          ]}
          disabled={isLocked(draft, 'density')}
          supportingText={lockReason(draft, 'density')}
          onValueChange={(value) => value && onChange({ ...draft, density: value })}
        />
      </SettingsSection>
      <SettingsSection
        title={t('secondary.accounts.remoteImagesTitle')}
        description={t('secondary.accounts.remoteImagesDescription')}
      >
        <SelectField
          label={t('secondary.accounts.remoteImages')}
          value={draft.remoteImages}
          options={[
            { value: 'BLOCK', label: t('secondary.accounts.remoteImagesBlock') },
            { value: 'ASK', label: t('secondary.accounts.remoteImagesAsk') },
            { value: 'ALLOW', label: t('secondary.accounts.remoteImagesAllow') },
          ]}
          disabled={isLocked(draft, 'remoteImages')}
          supportingText={lockReason(draft, 'remoteImages')}
          onValueChange={(value) => value && onChange({ ...draft, remoteImages: value })}
        />
      </SettingsSection>
      <SettingsSection
        title={t('secondary.accounts.sendDelayTitle')}
        description={t('secondary.accounts.sendDelayDescription')}
      >
        <SelectField
          label={t('secondary.accounts.sendDelay')}
          value={draft.sendDelaySeconds}
          options={[0, 5, 10, 20, 30].map((value) => ({
            value,
            label:
              value === 0
                ? t('secondary.accounts.sendImmediately')
                : t('secondary.accounts.seconds', { count: value }),
          }))}
          disabled={isLocked(draft, 'sendDelaySeconds')}
          supportingText={lockReason(draft, 'sendDelaySeconds')}
          onValueChange={(value) =>
            value !== '' && onChange({ ...draft, sendDelaySeconds: Number(value) })
          }
        />
      </SettingsSection>
      <SettingsSection
        title={t('secondary.accounts.defaultSignatureTitle')}
        description={t('secondary.accounts.defaultSignatureDescription')}
      >
        <SelectField
          label={t('secondary.accounts.defaultSignature')}
          value={draft.defaultSignatureId ?? ''}
          options={[
            { value: '', label: t('secondary.accounts.noDefaultSignature') },
            ...signatures.map((signature) => ({
              value: signature.signatureId,
              label: signature.name,
            })),
          ]}
          disabled={isLocked(draft, 'defaultSignatureId')}
          supportingText={lockReason(draft, 'defaultSignatureId')}
          onValueChange={(value) => onChange({ ...draft, defaultSignatureId: value || null })}
        />
      </SettingsSection>
    </Stack>
  );
}

function NotificationSettings({
  draft,
  onChange,
}: {
  draft: MailPreferences;
  onChange: (next: MailPreferences) => void;
}) {
  const { t } = useTranslation('mail');
  return (
    <Stack divider={<Divider flexItem />}>
      <PreferenceSwitch
        label={t('secondary.accounts.notifyNewMail')}
        description={t('secondary.accounts.notifyNewMailDescription')}
        checked={draft.notifyNewMail}
        locked={lockReason(draft, 'notifyNewMail')}
        onChange={(checked) => onChange({ ...draft, notifyNewMail: checked })}
      />
      <PreferenceSwitch
        label={t('secondary.accounts.notifySharedAssignment')}
        description={t('secondary.accounts.notifySharedAssignmentDescription')}
        checked={draft.notifySharedAssignment}
        locked={lockReason(draft, 'notifySharedAssignment')}
        onChange={(checked) => onChange({ ...draft, notifySharedAssignment: checked })}
      />
      <PreferenceSwitch
        label={t('secondary.accounts.notifyFollowUpDue')}
        description={t('secondary.accounts.notifyFollowUpDueDescription')}
        checked={draft.notifyFollowUpDue}
        locked={lockReason(draft, 'notifyFollowUpDue')}
        onChange={(checked) => onChange({ ...draft, notifyFollowUpDue: checked })}
      />
      <Alert severity="info">{t('secondary.accounts.notificationBoundary')}</Alert>
    </Stack>
  );
}

function ShortcutSettings({
  draft,
  onChange,
}: {
  draft: MailPreferences;
  onChange: (next: MailPreferences) => void;
}) {
  const { t } = useTranslation('mail');
  return (
    <Stack spacing={2}>
      <PreferenceSwitch
        label={t('secondary.accounts.keyboardShortcuts')}
        description={t('secondary.accounts.keyboardShortcutsDescription')}
        checked={draft.keyboardShortcuts}
        locked={lockReason(draft, 'keyboardShortcuts')}
        onChange={(checked) => onChange({ ...draft, keyboardShortcuts: checked })}
      />
      <Box
        component="section"
        aria-label={t('secondary.accounts.shortcutList')}
        sx={{ borderBlock: 1, borderColor: 'divider' }}
      >
        {[
          ['C', t('command.items.compose')],
          ['/', t('command.items.focus-search')],
          ['G I', t('navigation.items.mail.inbox.label')],
          ['?', t('command.open')],
        ].map(([keys, label], index) => (
          <Box key={keys}>
            {index > 0 && <Divider />}
            <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ py: 1.5 }}>
              <Typography variant="body2">{label}</Typography>
              <Chip size="small" icon={<Keyboard size={14} />} label={keys} variant="outlined" />
            </Stack>
          </Box>
        ))}
      </Box>
    </Stack>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Box component="section">
      <Typography component="h2" variant="subtitle1" fontWeight={800}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {description}
      </Typography>
      {children}
    </Box>
  );
}

function PreferenceSwitch({
  label,
  description,
  checked,
  locked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  locked?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Stack
      direction="row"
      spacing={2}
      alignItems="flex-start"
      justifyContent="space-between"
      sx={{ py: 1.75 }}
    >
      <Box>
        <Typography fontWeight={750}>{label}</Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
        {locked && (
          <Typography variant="caption" color="warning.main">
            {locked}
          </Typography>
        )}
      </Box>
      <FormControlLabel
        sx={{ m: 0 }}
        control={
          <Switch
            checked={checked}
            disabled={Boolean(locked)}
            onChange={(_event, value) => onChange(value)}
          />
        }
        label=""
        slotProps={{ typography: { 'aria-hidden': true } }}
      />
    </Stack>
  );
}

function isLocked(preferences: MailPreferences, key: LockedPreference) {
  return Boolean(preferences.orgLocks?.[key]);
}

function lockReason(preferences: MailPreferences, key: LockedPreference) {
  return preferences.orgLocks?.[key];
}

type AccountStatusPresentation = {
  color: 'success' | 'info' | 'warning' | 'error';
  icon: typeof CheckCircle2;
  labelKey: string;
};

function accountStatusPresentation(account: MailAccount): AccountStatusPresentation {
  const connection: Record<MailAccountConnectionState, AccountStatusPresentation> = {
    ACTIVE: { color: 'success', icon: CheckCircle2, labelKey: 'accounts.status.ready' },
    REAUTHENTICATION_REQUIRED: {
      color: 'warning',
      icon: AlertTriangle,
      labelKey: 'accounts.status.reauthenticationRequired',
    },
    SUSPENDED: { color: 'error', icon: CirclePause, labelKey: 'accounts.status.suspended' },
    DISCONNECTED: { color: 'error', icon: AlertTriangle, labelKey: 'accounts.status.disconnected' },
  };
  if (account.connectionState !== 'ACTIVE') return connection[account.connectionState];
  const synchronization: Record<MailAccountSynchronizationState, AccountStatusPresentation> = {
    READY: connection.ACTIVE,
    SYNCING: { color: 'info', icon: LoaderCircle, labelKey: 'accounts.status.syncing' },
    DEGRADED: { color: 'warning', icon: AlertTriangle, labelKey: 'accounts.status.degraded' },
    PAUSED: { color: 'warning', icon: CirclePause, labelKey: 'accounts.status.paused' },
  };
  return synchronization[account.synchronizationState];
}
