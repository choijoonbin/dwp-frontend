import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Eye, History } from 'lucide-react';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { buildMailOperationalExceptions, sourceEvidenceState } from './mail-admin-operations-model';
import {
  EvidenceChip,
  FormattedTime,
  Section,
  SourceEvidence,
  StateChip,
} from './mail-admin-operations-ui-shared';

import type { MailAdminOperationsContentProps } from './mail-admin-operations-ui-shared';

export function OperationsSurface({
  overview,
  operations,
  now,
  onOpenException,
}: Pick<MailAdminOperationsContentProps, 'overview' | 'operations' | 'onOpenException'> & {
  now: number;
}) {
  const { t } = useTranslation('mail');
  const fallback = useMemo(() => buildMailOperationalExceptions(overview, now), [overview, now]);
  return (
    <Stack spacing={2.5}>
      <SourceEvidence overview={overview} operations={operations} now={now} />
      <Section
        title={t('admin.operationsWorkspace.a01.sources', {
          defaultValue: 'Operational evidence sources',
        })}
        description={t('admin.operationsWorkspace.a01.sourcesDescription', {
          defaultValue: 'Freshness and collection failures are shown per source.',
        })}
      >
        {operations ? (
          operations.sources.map((source, index) => (
            <Box key={source.sourceId}>
              {index > 0 ? <Divider /> : null}
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.25}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                sx={{ px: { xs: 1.75, sm: 2.25 }, py: 1.5 }}
              >
                <Typography variant="body2" fontWeight="fontWeightBold" sx={{ flex: 1 }}>
                  {source.sourceId}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  <FormattedTime value={source.observedAt} />
                </Typography>
                {source.errorCode ? (
                  <Typography variant="caption" color="error.main">
                    {source.errorCode}
                  </Typography>
                ) : null}
                <EvidenceChip state={sourceEvidenceState(source)} />
              </Stack>
            </Box>
          ))
        ) : (
          <Box sx={{ p: 2 }}>
            <InlineFeedback severity="warning">
              {t('admin.operationsWorkspace.a01.sourceUnavailable', {
                defaultValue:
                  'Source-by-source evidence is unavailable. Overview totals are not treated as verified health.',
              })}
            </InlineFeedback>
          </Box>
        )}
      </Section>
      <Section
        title={t('admin.operationsWorkspace.a01.exceptionsTitle', {
          defaultValue: 'Exceptions requiring review',
        })}
        description={t('admin.operationsWorkspace.a01.exceptionsDescription', {
          defaultValue: 'Open an evidence-backed drilldown before taking recovery action.',
        })}
      >
        {operations?.exceptions.length ? (
          operations.exceptions.map((exception, index) => (
            <Box key={exception.exceptionId}>
              {index > 0 ? <Divider /> : null}
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.25}
                alignItems={{ xs: 'stretch', md: 'center' }}
                sx={{ px: { xs: 1.75, sm: 2.25 }, py: 1.6 }}
              >
                <Activity size={18} aria-hidden="true" />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                    <Typography variant="body2" fontWeight="fontWeightBold">
                      {exception.safeResourceRef}
                    </Typography>
                    <StateChip label={exception.severity} />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {exception.kind} · {exception.correlationId ?? 'No correlation ID'} ·{' '}
                    <FormattedTime value={exception.lastObservedAt} />
                  </Typography>
                </Box>
                {exception.impactCount != null ? (
                  <Typography variant="body2">
                    {t('admin.operationsWorkspace.a01.affected', {
                      defaultValue: '{{count}} affected',
                      count: exception.impactCount,
                    })}
                  </Typography>
                ) : null}
                <ActionButton
                  intent="secondary"
                  size="small"
                  disabled={!onOpenException}
                  startIcon={<Eye size={15} />}
                  onClick={() => onOpenException?.(exception)}
                >
                  {t('admin.operationsWorkspace.a01.openEvidence', {
                    defaultValue: 'Open evidence',
                  })}
                </ActionButton>
              </Stack>
            </Box>
          ))
        ) : fallback.length ? (
          fallback.map((exception, index) => (
            <Box key={exception.id}>
              {index > 0 ? <Divider /> : null}
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ p: 2 }}>
                <Activity size={18} />
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {exception.title}
                </Typography>
                <Typography>{exception.count}</Typography>
                <EvidenceChip state={exception.evidenceState} />
              </Stack>
            </Box>
          ))
        ) : (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2">
              {t('admin.operationsWorkspace.a01.noReportedExceptions', {
                defaultValue: 'No exceptions were reported by available sources.',
              })}
            </Typography>
          </Box>
        )}
      </Section>
      <Section
        title={t('admin.operationsWorkspace.a01.commands', {
          defaultValue: 'Recent administrative commands',
        })}
        description={t('admin.operationsWorkspace.a01.commandsDescription', {
          defaultValue:
            'Results come from command and audit evidence; mail content is not exposed.',
        })}
      >
        {operations?.commands.length ? (
          operations.commands.map((command, index) => (
            <Box key={command.auditId}>
              {index > 0 ? <Divider /> : null}
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.25}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                sx={{ p: 2 }}
              >
                <History size={17} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight="fontWeightBold">
                    {command.commandType}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {command.safeResourceRef} · {command.actorName}
                  </Typography>
                </Box>
                <Typography variant="caption">{command.correlationId}</Typography>
                <StateChip label={command.result} />
              </Stack>
            </Box>
          ))
        ) : (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {t('admin.operationsWorkspace.a01.noCommands', {
                defaultValue: 'No command-audit records were returned.',
              })}
            </Typography>
          </Box>
        )}
      </Section>
    </Stack>
  );
}
