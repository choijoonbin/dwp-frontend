import { useTranslation } from 'react-i18next';
import {
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  FileText,
  Gauge,
  ListChecks,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { ActionIconButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  AskCitation,
  AskCitationSourceType,
  AskDwpResponse,
  WorkspaceWorkSummary,
} from '@dwp-frontend/shared-utils';
import type { LucideIcon } from 'lucide-react';

import { confidenceValue, responseTone } from './dwaion-workspace-model';

type DwaionWorkspaceContextProps = {
  response: AskDwpResponse | null;
  workSummary?: WorkspaceWorkSummary;
  sourceScopes: AskCitationSourceType[];
  showWorkSignals?: boolean;
  onOpenCitation: (citation: AskCitation) => void;
};

const SOURCE_ICONS: Record<AskCitationSourceType, LucideIcon> = {
  WORK_ITEM: BriefcaseBusiness,
  MAIL: Mail,
  CALENDAR: CalendarDays,
  APPROVAL_TASK: ListChecks,
  APPROVAL_REQUEST: FileCheck2,
  APPROVAL_FORM: FileText,
  APPROVAL_OPERATION: Gauge,
};

export function DwaionWorkspaceContext({
  response,
  workSummary,
  sourceScopes,
  showWorkSignals = true,
  onOpenCitation,
}: DwaionWorkspaceContextProps) {
  const { t } = useTranslation('work');

  return (
    <Box
      component="aside"
      aria-label={t('askPage.contextRail.label')}
      sx={{
        position: { lg: 'sticky' },
        top: { lg: 82 },
        alignSelf: 'start',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ px: 2, py: 1.75 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box
            sx={{
              width: 30,
              height: 30,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 1,
              bgcolor: 'primary.lighter',
              color: 'primary.main',
            }}
          >
            {response ? (
              <BookOpenCheck size={17} aria-hidden="true" />
            ) : (
              <ShieldCheck size={17} aria-hidden="true" />
            )}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h2" variant="subtitle2" fontWeight={800}>
              {t(response ? 'askPage.contextRail.evidenceTitle' : 'askPage.contextRail.scopeTitle')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t(
                response
                  ? 'askPage.contextRail.evidenceDescription'
                  : 'askPage.contextRail.scopeDescription'
              )}
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Divider />

      {response ? (
        <ResponseContext response={response} onOpenCitation={onOpenCitation} />
      ) : (
        <IdleContext
          workSummary={workSummary}
          sourceScopes={sourceScopes}
          showWorkSignals={showWorkSignals}
        />
      )}
    </Box>
  );
}

function IdleContext({
  workSummary,
  sourceScopes,
  showWorkSignals,
}: {
  workSummary?: WorkspaceWorkSummary;
  sourceScopes: AskCitationSourceType[];
  showWorkSignals: boolean;
}) {
  const { t } = useTranslation('work');
  return (
    <>
      <Box sx={{ px: 2, py: 1.5 }}>
        <Stack spacing={0.5}>
          {sourceScopes.map((key) => {
            const Icon = SOURCE_ICONS[key];
            return (
              <Box
                key={key}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '28px minmax(0, 1fr) auto',
                  alignItems: 'center',
                  gap: 1,
                  py: 0.75,
                }}
              >
                <Icon size={17} color="currentColor" aria-hidden="true" />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={700}>
                    {t(`askPage.sourceTypes.${key}`)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t(`askPage.contextRail.sources.${key}`)}
                  </Typography>
                </Box>
                <CheckCircle2
                  size={15}
                  color="#188464"
                  aria-label={t('askPage.contextRail.enabled')}
                />
              </Box>
            );
          })}
        </Stack>
      </Box>

      {showWorkSignals && <Divider />}

      {showWorkSignals && (
        <Box sx={{ px: 2, py: 1.75 }}>
          <Typography component="h3" variant="caption" color="text.secondary" fontWeight={800}>
            {t('askPage.contextRail.signalsTitle')}
          </Typography>
          <Box
            sx={{
              mt: 1.25,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 1,
            }}
          >
            {[
              ['total', workSummary?.total ?? 0],
              ['dueSoon', workSummary?.dueSoon ?? 0],
              ['waiting', workSummary?.waiting ?? 0],
            ].map(([key, value]) => (
              <Box key={String(key)} sx={{ minWidth: 0 }}>
                <Typography component="p" variant="h6">
                  {value}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap display="block">
                  {t(`askPage.contextRail.signals.${key}`)}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      <Box sx={{ px: 2, py: 1.5, bgcolor: 'action.hover', display: 'flex', gap: 1 }}>
        <LockKeyhole size={16} color="currentColor" aria-hidden="true" />
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
          {t('askPage.contextRail.permissionNote')}
        </Typography>
      </Box>
    </>
  );
}

function ResponseContext({
  response,
  onOpenCitation,
}: {
  response: AskDwpResponse;
  onOpenCitation: (citation: AskCitation) => void;
}) {
  const { t } = useTranslation('work');
  const tone = responseTone(response);

  return (
    <>
      <Box sx={{ px: 2, py: 1.5 }}>
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          <Chip
            size="small"
            color={tone}
            variant="outlined"
            label={t(`askPage.states.${response.state}`)}
          />
          <Chip
            size="small"
            variant="outlined"
            label={t(`askPage.contextRail.confidence.${confidenceValue(response)}`)}
          />
          <Chip
            size="small"
            variant="outlined"
            label={t('askPage.contextRail.sourceCount', { count: response.sourceCount })}
          />
        </Stack>
      </Box>

      <Divider />

      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography component="h3" variant="caption" color="text.secondary" fontWeight={800}>
          {t('askPage.sourcesHeading', { count: response.citations.length })}
        </Typography>
        {response.citations.length ? (
          <Stack component="ol" spacing={0} sx={{ p: 0, m: 0, mt: 0.75, listStyle: 'none' }}>
            {response.citations.map((citation, index) => (
              <Box
                component="li"
                key={citation.sourceId}
                sx={{
                  py: 1,
                  display: 'grid',
                  gridTemplateColumns: '22px minmax(0, 1fr) auto',
                  gap: 0.75,
                  alignItems: 'center',
                  borderTop: index === 0 ? 0 : 1,
                  borderColor: 'divider',
                }}
              >
                <Typography variant="caption" color="primary.main" fontWeight={800}>
                  {index + 1}
                </Typography>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={700} noWrap>
                    {citation.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    {t(`askPage.sourceTypes.${citation.sourceType}`)} · {citation.sourceSystem}
                  </Typography>
                </Box>
                {citation.route && (
                  <ActionIconButton
                    label={t('askPage.openSource', { title: citation.title })}
                    tooltip={t('askPage.openSource', { title: citation.title })}
                    size="small"
                    onClick={() => onOpenCitation(citation)}
                  >
                    <ExternalLink size={15} aria-hidden="true" />
                  </ActionIconButton>
                )}
              </Box>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t('askPage.contextRail.noSources')}
          </Typography>
        )}
      </Box>

      <Divider />

      <Box sx={{ px: 2, py: 1.5 }}>
        <Stack spacing={1.1}>
          <EvidenceRow
            icon={ShieldCheck}
            label={t('askPage.contextRail.policy')}
            value={t(`askPage.policyOutcomes.${response.policy.outcome}`)}
          />
          <EvidenceRow
            icon={Gauge}
            label={t('askPage.evidence.usage')}
            value={
              response.modelRoute.totalTokens
                ? t('askPage.evidence.tokens', { count: response.modelRoute.totalTokens })
                : t('askPage.evidence.notApplicable')
            }
          />
          <EvidenceRow
            icon={LockKeyhole}
            label={t('askPage.evidence.audit')}
            value={response.auditId.slice(0, 12)}
            mono
          />
        </Stack>
      </Box>

      <Box sx={{ px: 2, py: 1.5, bgcolor: 'action.hover' }}>
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
          {t('askPage.evidence.privacy')}
        </Typography>
      </Box>
    </>
  );
}

function EvidenceRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '22px minmax(0, 1fr)', gap: 0.75 }}>
      <Icon size={15} color="currentColor" aria-hidden="true" />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" display="block">
          {label}
        </Typography>
        <Typography
          variant="body2"
          fontWeight={700}
          noWrap
          sx={{ fontFamily: mono ? 'monospace' : undefined }}
        >
          {value}
        </Typography>
      </Box>
    </Box>
  );
}
