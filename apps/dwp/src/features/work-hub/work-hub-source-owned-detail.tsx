import { FileText, Link2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { InlineFeedback } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { WorkHubItem, WorkHubSourceContext } from './work-hub-contracts';
import { workHubStatusLabelKey } from './work-hub-presentation';
import { WorkSourceDetailSection } from './work-hub-source-detail-section';
import { WorkHubSourceOwnedEvidence } from './work-hub-source-owned-evidence';
import { workHubSourceDetailInvalid } from './work-hub-source-owned-detail-model';
import { useWorkHubSourceOwnedDetail } from './use-work-hub-source-owned-detail';

function ContextGrid({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
        columnGap: 3,
        rowGap: 1.5,
      }}
    >
      {rows.map(({ label, value }) => (
        <Box key={label} sx={{ minWidth: 0 }}>
          <Typography component="dt" variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Typography
            component="dd"
            variant="body2"
            sx={{ m: 0, mt: 0.35, fontWeight: 'fontWeightBold', overflowWrap: 'anywhere' }}
          >
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function contextDate(value: string | null, fallback: string) {
  return value ? formatDate(value, { dateStyle: 'medium', timeStyle: 'short' }) : fallback;
}

function localizedName(
  context: Extract<WorkHubSourceContext, { kind: 'APPROVAL_TASK' | 'APPROVAL_REQUEST' }>,
  korean: boolean
) {
  return korean ? context.workflowNameKo : context.workflowNameEn;
}

export function WorkHubSourceOwnedDetail({
  item,
  onSourceInvalid,
}: {
  item: WorkHubItem;
  onSourceInvalid?: () => void;
}) {
  const { t, i18n } = useTranslation('work');
  const queryClient = useQueryClient();
  const missing = t('workHub.sourceDetail.notProvided');
  const korean = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language) === 'ko';
  const kind = item.reference.sourceSystem.startsWith('APPROVAL')
    ? 'approval'
    : item.reference.sourceSystem === 'SERVICE_REQUEST'
      ? 'service'
      : 'workspace';
  const context = item.sourceContext;
  const detail = useWorkHubSourceOwnedDetail(item);
  const detailReady =
    detail.isSuccess && !detail.isFetching && !detail.isError && !detail.isRefetchError;
  const sourceInvalid = workHubSourceDetailInvalid(detail.error);
  const reconciledInvalid = useRef<string | null>(null);
  const invalidationToken = sourceInvalid ? `${item.key}:${item.version}` : null;
  useEffect(() => {
    if (!invalidationToken) {
      reconciledInvalid.current = null;
      return;
    }
    if (reconciledInvalid.current === invalidationToken) return;
    reconciledInvalid.current = invalidationToken;
    void queryClient.invalidateQueries({ queryKey: ['workspace', 'work-hub', 'queue'] });
    onSourceInvalid?.();
  }, [invalidationToken, onSourceInvalid, queryClient]);
  const approvalRows =
    context?.kind === 'APPROVAL_TASK' || context?.kind === 'APPROVAL_REQUEST'
      ? [
          {
            label: t('workHub.sourceDetail.documentNumber'),
            value: item.displayId || missing,
          },
          ...(context.kind === 'APPROVAL_TASK'
            ? [
                {
                  label: t('workHub.sourceDetail.requester'),
                  value: context.requesterName || missing,
                },
                {
                  label: t('workHub.sourceDetail.organization'),
                  value: context.requesterOrgName || missing,
                },
              ]
            : []),
          {
            label: t('workHub.sourceDetail.submittedAt'),
            value: contextDate(context.submittedAt, missing),
          },
          {
            label: t('workHub.sourceDetail.workflow'),
            value: localizedName(context, korean) || missing,
          },
          {
            label: t('workHub.sourceDetail.approval.currentStep'),
            value:
              context.currentStep.sequence === null
                ? context.currentStep.name || missing
                : `${t('workHub.sourceDetail.approval.step', {
                    count: context.currentStep.sequence,
                  })} · ${context.currentStep.name || missing}`,
          },
          ...(context.kind === 'APPROVAL_TASK'
            ? [
                {
                  label: t('workHub.sourceDetail.approval.riskScore'),
                  value: t('workHub.sourceDetail.approval.riskScoreValue', {
                    score: context.riskScore,
                  }),
                },
              ]
            : []),
        ]
      : null;
  const serviceRows =
    context?.kind === 'SERVICE_REQUEST'
      ? [
          {
            label: t('workHub.sourceDetail.service.number'),
            value: item.displayId || missing,
          },
          {
            label: t('workHub.sourceDetail.service.name'),
            value: (korean ? context.serviceNameKo : context.serviceNameEn) || missing,
          },
          {
            label: t('workHub.sourceDetail.service.assignedGroup'),
            value: context.assignedGroup || missing,
          },
          {
            label: t('workHub.sourceDetail.service.assignedTo'),
            value: context.assignedTo || missing,
          },
          {
            label: t('workHub.sourceDetail.submittedAt'),
            value: contextDate(context.submittedAt, missing),
          },
        ]
      : null;
  return (
    <Stack gap={2}>
      <Box>
        <Typography component="h3" variant="subtitle1">
          {t(`workHub.sourceDetail.${kind}.title`)}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
          {t(`workHub.sourceDetail.${kind}.description`)}
        </Typography>
      </Box>
      <Box
        component="dl"
        sx={{
          m: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(120px, 0.4fr) minmax(0, 1fr)',
          rowGap: 1.25,
        }}
      >
        <Typography component="dt" variant="caption" color="text.secondary">
          {t('workHub.sourceDetail.myRole')}
        </Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0 }}>
          {t(`workHub.responsibility.${item.waitingFor}`)}
        </Typography>
        <Typography component="dt" variant="caption" color="text.secondary">
          {t('workHub.sourceDetail.sourceState')}
        </Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0 }}>
          {t(workHubStatusLabelKey(item))}
        </Typography>
        <Typography component="dt" variant="caption" color="text.secondary">
          {t('workHub.detail.priority')}
        </Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0 }}>
          {t(`workHub.priority.${item.priority}`)}
        </Typography>
        <Typography component="dt" variant="caption" color="text.secondary">
          {t('workHub.detail.due')}
        </Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
          {item.dueAt
            ? formatDate(item.dueAt, { dateStyle: 'medium', timeStyle: 'short' })
            : t('workHub.urgency.NO_DUE_DATE')}
        </Typography>
      </Box>
      {!sourceInvalid && approvalRows && (
        <WorkSourceDetailSection
          title={t('workHub.sourceDetail.approval.document')}
          description={t('workHub.sourceDetail.approval.contextDescription')}
          icon={FileText}
          tone="primary"
        >
          <ContextGrid rows={approvalRows} />
        </WorkSourceDetailSection>
      )}
      {!sourceInvalid && serviceRows && (
        <WorkSourceDetailSection
          title={t('workHub.sourceDetail.service.request')}
          description={t('workHub.sourceDetail.service.contextDescription')}
          icon={Link2}
          tone="primary"
        >
          <ContextGrid rows={serviceRows} />
        </WorkSourceDetailSection>
      )}
      {detail.isLoading && (
        <InlineFeedback severity="info">{t('workHub.sourceDetail.loading')}</InlineFeedback>
      )}
      {(detail.isError || detail.isRefetchError) && (
        <InlineFeedback severity="warning">
          {sourceInvalid
            ? t('workHub.sourceDetail.accessRequired')
            : `${t('workHub.sourceDetail.loadFailed')}. ${t('workHub.sourceDetail.readAgain')}`}
        </InlineFeedback>
      )}
      {detailReady && <WorkHubSourceOwnedEvidence projection={detail.data} />}
      {!sourceInvalid && (item.reason || item.summary) && (
        <Box
          sx={{
            p: 2,
            bgcolor: 'action.hover',
            borderInlineStart: 3,
            borderColor: 'primary.main',
            borderRadius: (theme) => `${theme.shape.borderRadius}px`,
          }}
        >
          {[
            ['workHub.detail.whyAssigned', item.reason],
            ['workHub.detail.summary', item.summary === item.reason ? null : item.summary],
          ]
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <Box key={label} sx={{ '& + &': { mt: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">
                  {t(label!)}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ mt: 0.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                >
                  {value}
                </Typography>
              </Box>
            ))}
        </Box>
      )}
      <InlineFeedback severity="info">
        {t(`workHub.sourceDetail.${kind}.handoffNotice`)}
      </InlineFeedback>
    </Stack>
  );
}
