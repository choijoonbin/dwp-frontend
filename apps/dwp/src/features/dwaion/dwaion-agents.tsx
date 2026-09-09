import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bot,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Database,
  Lock,
  MessageSquarePlus,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  ActionButton,
  ErrorState,
  GuidedEmptyState,
  PageCanvas,
} from '@dwp-frontend/design-system';
import {
  createQuestionLaunch,
  HttpError,
  isAppResourceEntitled,
  listRuntimeRegistryEntries,
  type AgentCatalogCategory,
  type AgentCatalogProfile,
  type AgentCatalogSource,
  type LocalizedCatalogText,
  type PermissionDTO,
  type RuntimeRegistryEntry,
  usePermissions,
} from '@dwp-frontend/shared-utils';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import {
  createDwaionQuestionLaunchState,
  DWAION_AGENT_KEY,
  DWAION_APPROVAL_EXPERT_AGENT_KEY,
  dwaionWorkspaceRoute,
  type DwaionAgentKey,
} from './dwaion-contract';
import { catalogCopy } from './dwaion-catalog-copy';
import { useDwaionGovernedMutation } from '../../components/use-dwaion-governed-mutation';

const USER_AGENT_KEYS = new Set([DWAION_AGENT_KEY, DWAION_APPROVAL_EXPERT_AGENT_KEY]);
type CatalogFilter = 'ALL' | AgentCatalogCategory;
type RuntimeAgent = RuntimeRegistryEntry & {
  entryKey: DwaionAgentKey;
  agentCatalogProfile: AgentCatalogProfile;
};

function isDwaionRuntimeAgent(agent: RuntimeRegistryEntry): agent is RuntimeAgent {
  return (
    agent.registryType === 'AGENT' &&
    USER_AGENT_KEYS.has(agent.entryKey as DwaionAgentKey) &&
    agent.agentCatalogProfile?.schemaVersion === 1
  );
}

function localize(value: LocalizedCatalogText, language: 'ko' | 'en'): string {
  return value[language];
}

function permissionParts(permission: string) {
  const separator = permission.lastIndexOf(':');
  return separator > 0
    ? {
        resourceKey: permission.slice(0, separator),
        permissionCode: permission.slice(separator + 1),
      }
    : null;
}

export function hasSourcePermission(
  source: AgentCatalogSource,
  permissions: readonly PermissionDTO[]
): boolean {
  return source.requiredPermissions.some((required) => {
    const expected = permissionParts(required);
    if (!expected) return false;
    const matches = permissions.filter(
      (permission) =>
        permission.resourceKey.trim().toUpperCase() === expected.resourceKey &&
        permission.permissionCode.trim().toUpperCase() === expected.permissionCode
    );
    return (
      !matches.some((permission) => permission.effect === 'DENY') &&
      matches.some((permission) => permission.effect === 'ALLOW')
    );
  });
}

function updatedLabel(value: string | null | undefined, language: 'ko' | 'en') {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return formatDate(
    parsed.toISOString(),
    { year: 'numeric', month: 'short', day: 'numeric' },
    language
  );
}

export function DwaionAgents() {
  const { t, i18n } = useTranslation('work');
  const language = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const copy = catalogCopy(language);
  const navigate = useNavigate();
  const governQuestionLaunch = useDwaionGovernedMutation(
    'route.dwaion.work.question-launch-create.action'
  );
  const [search, setSearch] = useSearchParams();
  const { permissions } = usePermissions();
  const [pending, setPending] = useState(false);
  const [launchError, setLaunchError] = useState(false);
  const launching = useRef(false);
  const launchGeneration = useRef(0);
  const query = useQuery({
    queryKey: ['dwaion', 'runtime-agents'],
    queryFn: () => listRuntimeRegistryEntries('AGENT'),
    staleTime: 60_000,
  });
  const canUseApprovalExpert = isAppResourceEntitled('APP.APPROVALS', permissions);
  const agents = useMemo(
    () =>
      (query.isError ? [] : (query.data ?? [])).filter(
        (agent): agent is RuntimeAgent =>
          isDwaionRuntimeAgent(agent) &&
          (agent.entryKey !== DWAION_APPROVAL_EXPERT_AGENT_KEY || canUseApprovalExpert)
      ),
    [canUseApprovalExpert, query.data, query.isError]
  );
  const rawFilter = search.get('category');
  const filter: CatalogFilter =
    rawFilter === 'GENERAL' || rawFilter === 'APPROVAL' ? rawFilter : 'ALL';
  const visibleAgents = agents.filter(
    (agent) => filter === 'ALL' || agent.agentCatalogProfile.category === filter
  );
  const selectedKey = search.get('agent');
  const selected = selectedKey
    ? visibleAgents.find((agent) => agent.entryKey === selectedKey)
    : visibleAgents[0];

  const resetLaunch = () => {
    launchGeneration.current += 1;
    launching.current = false;
    setPending(false);
    setLaunchError(false);
  };
  const select = (entryKey: DwaionAgentKey) => {
    resetLaunch();
    const next = new URLSearchParams(search);
    next.set('agent', entryKey);
    setSearch(next);
  };
  const changeFilter = (nextFilter: CatalogFilter) => {
    resetLaunch();
    const next = new URLSearchParams(search);
    if (nextFilter === 'ALL') next.delete('category');
    else next.set('category', nextFilter);
    const current = agents.find((agent) => agent.entryKey === next.get('agent'));
    if (current && nextFilter !== 'ALL' && current.agentCatalogProfile.category !== nextFilter) {
      next.delete('agent');
    }
    setSearch(next);
  };
  const start = async (agent: RuntimeAgent, question?: string) => {
    if (launching.current) return;
    if (!question) {
      navigate(dwaionWorkspaceRoute(undefined, undefined, agent.entryKey));
      return;
    }
    launching.current = true;
    const generation = ++launchGeneration.current;
    setPending(true);
    setLaunchError(false);
    try {
      const receipt = await governQuestionLaunch((authority) =>
        createQuestionLaunch(question, authority)
      );
      if (generation !== launchGeneration.current) return;
      const state = createDwaionQuestionLaunchState(receipt.launchId);
      if (!state) throw new Error('Question launch receipt is invalid.');
      navigate(dwaionWorkspaceRoute(undefined, undefined, agent.entryKey), { state });
    } catch {
      if (generation === launchGeneration.current) setLaunchError(true);
    } finally {
      if (generation === launchGeneration.current) {
        launching.current = false;
        setPending(false);
      }
    }
  };

  return (
    <PageCanvas topInset="compact">
      <Box data-testid="dwaion-agents" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        <Stack
          component="header"
          direction={{ xs: 'column', lg: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', lg: 'flex-end' }}
          gap={{ xs: 1, lg: 2 }}
        >
          <Box>
            <Typography variant="overline" color="primary.main" fontWeight="fontWeightBold">
              {copy.agentEyebrow}
            </Typography>
            <Stack direction="row" alignItems="center" gap={1.5} sx={{ mt: 0.25 }}>
              <Typography
                component="h1"
                variant="h4"
                fontWeight="fontWeightBold"
                sx={{
                  fontSize: { xs: 'h2.fontSize', sm: 'h1.fontSize' },
                  lineHeight: 'button.lineHeight',
                }}
              >
                {t('dwaionAgents.title')}
              </Typography>
              {!query.isLoading && !query.isError && (
                <Chip color="primary" size="small" label={agents.length} />
              )}
            </Stack>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 0.5,
                maxWidth: 760,
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: { xs: 1, sm: 2 },
                overflow: 'hidden',
              }}
            >
              {t('dwaionAgents.description')}
            </Typography>
          </Box>
          <Stack
            component="nav"
            aria-label={t('dwaionAgents.title')}
            direction="row"
            gap={{ xs: 0.75, sm: 1 }}
            useFlexGap
            flexWrap="wrap"
          >
            {(['ALL', 'GENERAL', 'APPROVAL'] as const).map((value) => (
              <ActionButton
                key={value}
                intent={filter === value ? 'primary' : 'secondary'}
                aria-pressed={filter === value}
                onClick={() => changeFilter(value)}
                sx={{ minHeight: 44, px: { xs: 1.75, sm: 2.25 } }}
              >
                {copy.filters[value]}
                {value === 'ALL'
                  ? ` (${agents.length})`
                  : ` (${agents.filter((agent) => agent.agentCatalogProfile.category === value).length})`}
              </ActionButton>
            ))}
          </Stack>
        </Stack>

        {query.isError && (
          <Alert
            severity="error"
            sx={{ mt: 2 }}
            action={
              <ActionButton intent="quiet" onClick={() => void query.refetch()}>
                {copy.retry}
              </ActionButton>
            }
          >
            {query.error instanceof HttpError && query.error.status === 403
              ? copy.permission
              : t('dwaionAgents.loadError')}
          </Alert>
        )}
        {!query.isLoading && !query.isError && selectedKey && !selected && (
          <Box sx={{ mt: 2 }}>
            <ErrorState size="compact" title={copy.unavailable} />
          </Box>
        )}

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          gap={1}
          sx={{
            display: { xs: 'none', lg: 'flex' },
            mt: { xs: 1.25, lg: 2.25 },
            mb: { xs: 1, lg: 1.5 },
          }}
        >
          <Stack direction="row" alignItems="center" gap={1}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} />
            <Typography variant="body2" fontWeight="fontWeightBold">
              {copy.catalogStatus}
            </Typography>
          </Stack>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: { xs: 'none', sm: 'block' } }}
          >
            {copy.promptBoundary}
          </Typography>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              lg: 'minmax(0, 1.48fr) minmax(340px, 0.9fr)',
            },
            gap: { xs: 1.5, lg: 2 },
            alignItems: 'start',
          }}
        >
          <Stack
            component="section"
            aria-label={t('dwaionAgents.title')}
            gap={{ xs: 1.5, lg: 1.75 }}
            sx={{ minWidth: 0 }}
          >
            {query.isLoading
              ? [0, 1].map((index) => <Skeleton key={index} variant="rounded" height={290} />)
              : visibleAgents.length
                ? visibleAgents.map((agent) => (
                    <AgentCard
                      key={agent.entryKey}
                      agent={agent}
                      language={language}
                      selected={selected?.entryKey === agent.entryKey}
                      permissions={permissions}
                      pending={pending}
                      launchError={launchError && selected?.entryKey === agent.entryKey}
                      onSelect={() => select(agent.entryKey)}
                      onStart={(question) => void start(agent, question)}
                    />
                  ))
                : !query.isError && (
                    <GuidedEmptyState
                      kind="permission"
                      title={t('dwaionAgents.emptyTitle')}
                      description={t('dwaionAgents.emptyDescription')}
                    />
                  )}
            {!query.isLoading && !query.isError && (
              <Stack
                direction="row"
                alignItems="flex-start"
                gap={1.5}
                sx={{
                  p: { xs: 1.5, lg: 1.75 },
                  borderRadius: (theme) => Number(theme.shape.borderRadius) * 1.5 + 'px',
                  bgcolor: 'action.hover',
                }}
              >
                <Lock size={20} aria-hidden="true" />
                <Typography variant="body2" color="text.secondary">
                  {copy.catalogNotice}
                </Typography>
              </Stack>
            )}
          </Stack>

          <Box sx={{ display: { xs: 'none', lg: 'block' }, minWidth: 0 }}>
            {selected && (
              <AgentInspector
                agent={selected}
                language={language}
                permissions={permissions}
                pending={pending}
                launchError={launchError}
                onStart={(question) => void start(selected, question)}
              />
            )}
          </Box>
        </Box>
      </Box>
    </PageCanvas>
  );
}

function AgentCard({
  agent,
  language,
  selected,
  permissions,
  pending,
  launchError,
  onSelect,
  onStart,
}: {
  agent: RuntimeAgent;
  language: 'ko' | 'en';
  selected: boolean;
  permissions: readonly PermissionDTO[];
  pending: boolean;
  launchError: boolean;
  onSelect: () => void;
  onStart: (question?: string) => void;
}) {
  const copy = catalogCopy(language);
  const profile = agent.agentCatalogProfile;
  const icon =
    profile.category === 'APPROVAL' ? (
      <ClipboardCheck size={24} aria-hidden="true" />
    ) : (
      <Bot size={24} aria-hidden="true" />
    );
  return (
    <Box
      component="article"
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderTop: { xs: selected ? 4 : 1, lg: 1 },
        borderLeft: { xs: 1, lg: selected ? 4 : 1 },
        borderColor: selected ? 'primary.main' : 'divider',
        borderTopColor: { xs: selected ? 'primary.main' : 'divider', lg: 'divider' },
        borderLeftColor: {
          xs: selected ? 'primary.main' : 'divider',
          lg: selected ? 'primary.main' : 'divider',
        },
        borderRadius: (theme) => Number(theme.shape.borderRadius) * 1.5 + 'px',
        p: { xs: 1.5, sm: 2.25, lg: 2.5 },
        boxShadow: (theme) =>
          selected ? `0 8px 24px ${alpha(theme.palette.primary.main, 0.08)}` : 'none',
      }}
    >
      <Stack direction="row" gap={{ xs: 1.1, lg: 1.5 }} alignItems="flex-start">
        <Box
          sx={{
            width: { xs: 40, lg: 48 },
            height: { xs: 40, lg: 48 },
            flex: '0 0 auto',
            display: 'grid',
            placeItems: 'center',
            borderRadius: (theme) => Number(theme.shape.borderRadius) * 1.5 + 'px',
            bgcolor: 'var(--dwp-product-soft)',
            color: 'primary.dark',
          }}
        >
          {icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={0.75} alignItems={{ sm: 'center' }}>
            <Typography component="h2" variant="h6" fontWeight="fontWeightBold">
              {localize(profile.displayName, language)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {copy.versionRevision(agent.artifactVersion, agent.revision)}
            </Typography>
          </Stack>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: { xs: 'none', lg: 'block' } }}
          >
            {agent.ownerRef}
          </Typography>
        </Box>
        <Chip
          size="small"
          color={selected ? 'primary' : 'success'}
          variant={selected ? 'filled' : 'outlined'}
          label={selected ? copy.selected : copy.published}
        />
      </Stack>

      <Typography
        variant="body2"
        sx={{
          mt: { xs: 1, lg: 1.75 },
          p: { xs: 0, lg: 1.25 },
          borderRadius: (theme) => Number(theme.shape.borderRadius) * 1 + 'px',
          bgcolor: { xs: 'transparent', lg: 'var(--dwp-product-soft)' },
          lineHeight: { xs: 'h5.lineHeight', lg: 'body2.lineHeight' },
        }}
      >
        {localize(profile.description, language)}
      </Typography>

      <Box
        sx={{
          mt: { xs: 1, lg: 1.75 },
          display: { xs: 'block', lg: 'grid' },
          gridTemplateColumns: 'minmax(0, 1fr) minmax(150px, 0.75fr)',
          gap: 2,
        }}
      >
        <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
          <SectionTitle icon={<CheckCircle2 size={16} />} title={copy.can} />
          <BulletList values={profile.capabilities} language={language} limit={3} />
        </Box>
        <Box>
          <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
            <SectionTitle icon={<Database size={16} />} title={copy.sources} />
          </Box>
          <Stack
            direction="row"
            gap={0.75}
            useFlexGap
            flexWrap="wrap"
            sx={{ mt: { xs: 0, lg: 0.75 } }}
          >
            {profile.sources.map((source) => {
              const available = hasSourcePermission(source, permissions);
              return (
                <Chip
                  key={source.sourceSystem}
                  size="small"
                  variant={selected ? 'filled' : 'outlined'}
                  color={available ? 'primary' : 'default'}
                  label={
                    <>
                      <Box component="span" sx={{ display: { xs: 'inline', lg: 'none' } }}>
                        {`#${localize(source.displayName, language).replaceAll(' ', '')}`}
                      </Box>
                      <Box component="span" sx={{ display: { xs: 'none', lg: 'inline' } }}>
                        {localize(source.displayName, language)}
                      </Box>
                    </>
                  }
                  aria-label={`${localize(source.displayName, language)}: ${available ? copy.permissionGranted : copy.permissionRequired}; ${source.requiredPermissions.join(', ')}`}
                  sx={{
                    bgcolor: { xs: 'var(--dwp-product-soft)', lg: undefined },
                    color: { xs: 'text.primary', lg: undefined },
                    '& .MuiChip-label': {
                      '&::after': { content: '""' },
                    },
                  }}
                />
              );
            })}
          </Stack>
        </Box>
      </Box>

      {selected && (
        <Box sx={{ display: { xs: 'block', lg: 'none' }, mt: 1 }}>
          <AgentMobileDetail
            agent={agent}
            language={language}
            pending={pending}
            launchError={launchError}
            onStart={onStart}
          />
        </Box>
      )}

      <Divider sx={{ my: { xs: 1.5, lg: 2 }, display: { xs: 'none', lg: 'block' } }} />
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={{ xs: 1, lg: 1.5 }}
        sx={{ mt: { xs: 1, lg: 0 } }}
      >
        <Stack
          direction="row"
          alignItems="center"
          gap={0.75}
          sx={{ display: { xs: 'none', lg: 'flex' } }}
        >
          <ShieldCheck size={16} aria-hidden="true" />
          <Typography variant="caption" color="text.secondary">
            {profile.humanConfirmationRequired ? copy.humanReview : copy.safety}
          </Typography>
        </Stack>
        <ActionButton
          intent={selected ? 'primary' : 'secondary'}
          onClick={selected ? () => onStart() : onSelect}
          endIcon={<ChevronRight size={17} />}
          fullWidth={false}
          sx={{
            minHeight: 44,
            whiteSpace: 'normal',
            width: { xs: '100%', sm: 'auto' },
            flexShrink: 0,
          }}
        >
          {selected ? copy.startWithAgent : copy.inspect}
        </ActionButton>
      </Stack>
    </Box>
  );
}

function AgentMobileDetail({
  agent,
  language,
  pending,
  launchError,
  onStart,
}: {
  agent: RuntimeAgent;
  language: 'ko' | 'en';
  pending: boolean;
  launchError: boolean;
  onStart: (question?: string) => void;
}) {
  const copy = catalogCopy(language);
  const profile = agent.agentCatalogProfile;
  return (
    <Stack gap={1}>
      <Box
        sx={(theme) => ({
          p: 1.15,
          borderRadius: (theme) => Number(theme.shape.borderRadius) * 1 + 'px',
          bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.13 : 0.07),
        })}
      >
        <SectionTitle icon={<CheckCircle2 size={18} />} title={copy.can} color="success.main" />
        <BulletList values={profile.capabilities} language={language} limit={1} />
        <Box sx={{ mt: 0.9 }}>
          <SectionTitle icon={<XCircle size={18} />} title={copy.cannot} color="error.main" />
          <BulletList values={profile.boundaries} language={language} limit={1} />
        </Box>
      </Box>
      <Box>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
          {copy.recommendedPrompts}
        </Typography>
        <Stack gap={0.5}>
          {profile.starterPrompts.slice(0, 2).map((question) => {
            const prompt = localize(question, language);
            return (
              <ActionButton
                key={prompt}
                intent="quiet"
                disabled={pending}
                onClick={() => onStart(prompt)}
                endIcon={<ChevronRight size={16} />}
                sx={{
                  justifyContent: 'space-between',
                  minHeight: 44,
                  overflow: 'hidden',
                  textAlign: 'start',
                  bgcolor: 'var(--dwp-product-soft)',
                  border: 0,
                }}
              >
                <Box
                  component="span"
                  sx={{
                    minWidth: 0,
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 1,
                    overflow: 'hidden',
                  }}
                >
                  {prompt}
                </Box>
              </ActionButton>
            );
          })}
        </Stack>
      </Box>
      {launchError && <ErrorState size="compact" title={copy.launchError} />}
    </Stack>
  );
}

function AgentInspector({
  agent,
  language,
  permissions,
  pending,
  launchError,
  onStart,
}: {
  agent: RuntimeAgent;
  language: 'ko' | 'en';
  permissions: readonly PermissionDTO[];
  pending: boolean;
  launchError: boolean;
  onStart: (question?: string) => void;
}) {
  const copy = catalogCopy(language);
  const profile = agent.agentCatalogProfile;
  const updated = updatedLabel(agent.updatedAt, language);
  return (
    <Box
      component="aside"
      aria-label={copy.detail}
      sx={{
        minWidth: 0,
        border: 1,
        borderColor: 'divider',
        borderRadius: (theme) => Number(theme.shape.borderRadius) * 1.5 + 'px',
        bgcolor: 'background.paper',
        overflow: 'hidden',
        position: 'sticky',
        top: 16,
      }}
    >
      <Stack direction="row" alignItems="center" gap={1} sx={{ p: 1.5, bgcolor: 'action.hover' }}>
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main' }} />
        <Typography variant="overline" color="primary.main" fontWeight="fontWeightBold">
          {copy.inspector}
        </Typography>
        <Typography component="h2" variant="h6" fontWeight="fontWeightBold" sx={{ flex: 1 }}>
          {localize(profile.displayName, language)}
        </Typography>
        <Chip size="small" variant="outlined" label={agent.artifactVersion} />
      </Stack>
      <Stack gap={1.6} sx={{ p: 1.75 }}>
        <CatalogSection
          title={`${copy.can} vs ${copy.cannot}`}
          icon={<ShieldCheck size={19} aria-hidden="true" />}
        >
          <Box
            sx={{
              p: 1.1,
              borderRadius: (theme) => Number(theme.shape.borderRadius) * 1 + 'px',
              bgcolor: (theme) => alpha(theme.palette.success.main, 0.12),
              color: 'text.primary',
            }}
          >
            <SectionTitle icon={<CheckCircle2 size={17} />} title={copy.can} color="success.main" />
            <BulletList values={profile.capabilities} language={language} />
          </Box>
          <Box
            sx={{
              mt: 0.8,
              p: 1.1,
              borderRadius: (theme) => Number(theme.shape.borderRadius) * 1 + 'px',
              bgcolor: (theme) => alpha(theme.palette.error.main, 0.1),
              color: 'text.primary',
            }}
          >
            <SectionTitle icon={<XCircle size={17} />} title={copy.cannot} color="error.main" />
            <BulletList values={profile.boundaries} language={language} />
          </Box>
        </CatalogSection>

        <CatalogSection
          title={copy.sourcePermission}
          icon={<Database size={19} aria-hidden="true" />}
        >
          <Stack component="ul" gap={0.65} sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {profile.sources.map((source) => {
              const available = hasSourcePermission(source, permissions);
              return (
                <Stack
                  component="li"
                  key={source.sourceSystem}
                  direction="row"
                  alignItems="flex-start"
                  gap={1}
                  sx={{
                    p: 0.9,
                    borderRadius: (theme) => Number(theme.shape.borderRadius) * 1 + 'px',
                    bgcolor: 'action.hover',
                  }}
                >
                  <Database size={17} aria-hidden="true" />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight="fontWeightBold">
                      {localize(source.displayName, language)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="p">
                      {source.requiredPermissions.length > 1 ? `${copy.anyPermission}: ` : ''}
                      {source.requiredPermissions.join(' · ')}
                    </Typography>
                  </Box>
                  <Stack alignItems="flex-end" gap={0.5}>
                    <Chip
                      size="small"
                      color={available ? 'success' : 'default'}
                      variant="outlined"
                      label={available ? copy.permissionGranted : copy.permissionRequired}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {copy.readOnly}
                    </Typography>
                  </Stack>
                </Stack>
              );
            })}
          </Stack>
        </CatalogSection>

        <CatalogSection
          title={copy.starters}
          icon={<MessageSquarePlus size={19} aria-hidden="true" />}
        >
          <Stack gap={0.65}>
            {profile.starterPrompts.map((question) => {
              const prompt = localize(question, language);
              return (
                <ActionButton
                  key={prompt}
                  intent="secondary"
                  disabled={pending}
                  onClick={() => onStart(prompt)}
                  endIcon={<ChevronRight size={16} />}
                  sx={{
                    justifyContent: 'space-between',
                    minHeight: 44,
                    whiteSpace: 'normal',
                    textAlign: 'start',
                  }}
                >
                  {prompt}
                </ActionButton>
              );
            })}
          </Stack>
          {launchError && (
            <Box sx={{ mt: 1 }}>
              <ErrorState size="compact" title={copy.launchError} />
            </Box>
          )}
        </CatalogSection>

        <CatalogSection title={copy.safety} icon={<ShieldCheck size={19} aria-hidden="true" />}>
          <Box
            sx={{
              p: 1.1,
              borderRadius: (theme) => Number(theme.shape.borderRadius) * 1 + 'px',
              bgcolor: 'action.hover',
            }}
          >
            <Typography variant="body2" sx={{ lineHeight: 'h5.lineHeight' }}>
              {localize(profile.safetySummary, language)}
            </Typography>
            <Stack component="dl" gap={0.45} sx={{ m: 0, mt: 1 }}>
              <CatalogTerm label={copy.version} value={agent.artifactVersion} />
              <CatalogTerm label={copy.revision} value={agent.revision} />
              <CatalogTerm label={copy.risk} value={agent.riskTier} />
              <CatalogTerm label={copy.schemaVersion} value={profile.schemaVersion} />
              {updated && (
                <CatalogTerm label={language === 'ko' ? '갱신일' : 'Updated'} value={updated} />
              )}
              {profile.humanConfirmationRequired && (
                <CatalogTerm label={copy.confirmation} value={copy.humanReview} />
              )}
            </Stack>
          </Box>
        </CatalogSection>

        <ActionButton
          intent="primary"
          disabled={pending}
          onClick={() => onStart()}
          startIcon={<MessageSquarePlus size={17} />}
          endIcon={<ChevronRight size={17} />}
          sx={{ minHeight: 48, whiteSpace: 'normal' }}
        >
          {pending ? copy.launching : copy.startWithAgent}
        </ActionButton>
      </Stack>
    </Box>
  );
}

function CatalogSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box component="section">
      <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 0.75 }}>
        {icon}
        <Typography component="h3" variant="subtitle1" fontWeight="fontWeightBold">
          {title}
        </Typography>
      </Stack>
      {children}
    </Box>
  );
}

function SectionTitle({ icon, title, color }: { icon: ReactNode; title: string; color?: string }) {
  return (
    <Stack direction="row" alignItems="center" gap={0.75} sx={{ color }}>
      {icon}
      <Typography variant="subtitle2" fontWeight="fontWeightBold">
        {title}
      </Typography>
    </Stack>
  );
}

function BulletList({
  values,
  language,
  limit,
}: {
  values: LocalizedCatalogText[];
  language: 'ko' | 'en';
  limit?: number;
}) {
  return (
    <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.25 }}>
      {values.slice(0, limit).map((value) => {
        const text = localize(value, language);
        return (
          <Typography
            component="li"
            variant="body2"
            key={text}
            sx={{ my: 0.1, lineHeight: 'h4.lineHeight' }}
          >
            {text}
          </Typography>
        );
      })}
    </Box>
  );
}

function CatalogTerm({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Stack direction="row" gap={1} justifyContent="space-between">
      <Typography component="dt" variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        component="dd"
        variant="caption"
        fontWeight="fontWeightBold"
        sx={{ m: 0, textAlign: 'end' }}
      >
        {value}
      </Typography>
    </Stack>
  );
}
