import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpenCheck, ExternalLink, Gauge, LockKeyhole, ShieldCheck } from 'lucide-react';
import { ActionButton, ActionIconButton, ContentDialog } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { Theme } from '@mui/material/styles';
import type { AskCitation, AskDwpResponse } from '@dwp-frontend/shared-utils';
import {
  confidenceValue,
  isGroundedFallbackResponse,
  responseTone,
} from './dwaion-workspace-model';

export function DwaionWorkspaceContext({
  response,
  onOpenCitation,
}: {
  response: AskDwpResponse;
  onOpenCitation: (citation: AskCitation) => void;
}) {
  const { t } = useTranslation('work');
  const compact = useMediaQuery((theme: Theme) => theme.breakpoints.down('md'));
  const [open, setOpen] = useState(false);
  const triggerId = useId();

  const close = () => {
    setOpen(false);
    globalThis.requestAnimationFrame(() => document.getElementById(triggerId)?.focus());
  };

  if (compact) {
    return (
      <>
        <ActionButton
          id={triggerId}
          intent="secondary"
          startIcon={<BookOpenCheck size={18} aria-hidden="true" />}
          onClick={() => setOpen(true)}
          sx={{ minHeight: 44, width: '100%', justifyContent: 'space-between' }}
        >
          {t('askPage.contextRail.evidenceTitle')}
          <Typography component="span" variant="caption" color="text.secondary">
            {t('askPage.contextRail.sourceCount', { count: response.sourceCount })}
          </Typography>
        </ActionButton>
        <ContentDialog
          open={open}
          fullScreen
          title={t('askPage.contextRail.evidenceTitle')}
          description={t('askPage.contextRail.evidenceDescription')}
          closeLabel={t('askPage.citationPreview.close')}
          onClose={close}
          titleStart={<BookOpenCheck size={20} aria-hidden="true" />}
          closeButtonSx={{ width: 44, height: 44 }}
          contentDividers
          contentSx={{ p: 0, pb: 'env(safe-area-inset-bottom, 0px)' }}
          slotProps={{
            paper: {
              sx: {
                pt: 'env(safe-area-inset-top, 0px)',
                pl: 'env(safe-area-inset-left, 0px)',
                pr: 'env(safe-area-inset-right, 0px)',
              },
            },
          }}
        >
          <ResponseContext
            response={response}
            onOpenCitation={(citation) => {
              setOpen(false);
              onOpenCitation(citation);
            }}
          />
        </ContentDialog>
      </>
    );
  }

  return (
    <Box
      component="aside"
      aria-label={t('askPage.contextRail.label')}
      sx={{
        alignSelf: 'start',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ p: 2 }}>
        <Typography
          component="h2"
          variant="subtitle2"
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <BookOpenCheck size={17} />
          {t('askPage.contextRail.evidenceTitle')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('askPage.contextRail.evidenceDescription')}
        </Typography>
      </Box>
      <Divider />
      <ResponseContext response={response} onOpenCitation={onOpenCitation} />
    </Box>
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
  const groundedFallback = isGroundedFallbackResponse(response);

  return (
    <>
      <Box sx={{ px: 2, py: 1.5 }}>
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          <Chip
            size="small"
            color={tone}
            variant="outlined"
            label={
              groundedFallback ? t('askPage.fallback.state') : t(`askPage.states.${response.state}`)
            }
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
                  <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>
                    {citation.title}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    sx={{ overflowWrap: 'anywhere' }}
                  >
                    {t(`askPage.sourceTypes.${citation.sourceType}`)} · {citation.sourceSystem}
                  </Typography>
                </Box>
                {citation.route && (
                  <ActionIconButton
                    label={t('askPage.openSource', { title: citation.title })}
                    tooltip={t('askPage.openSource', { title: citation.title })}
                    size="small"
                    onClick={() => onOpenCitation(citation)}
                    sx={{ width: 44, height: 44 }}
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
          {groundedFallback && (
            <EvidenceRow
              icon={BookOpenCheck}
              label={t('askPage.fallback.responseMode')}
              value={t('askPage.fallback.responseModeValue')}
            />
          )}
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
          sx={{ fontFamily: mono ? 'monospace' : undefined, overflowWrap: 'anywhere' }}
        >
          {value}
        </Typography>
      </Box>
    </Box>
  );
}
