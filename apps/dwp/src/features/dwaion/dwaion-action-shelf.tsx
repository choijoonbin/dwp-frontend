import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CalendarPlus, FileCheck2, MailPlus, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { getWorkplaceActions, HttpError, previewWorkplaceAction } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { buildDwaionActionDraftInputs } from './dwaion-action-draft';
import { actionDestination } from './dwaion-catalog-copy';
import { createDwaionActionReviewRouteState } from './dwaion-action-review-state';

import type {
  AgentActionHandoffOrigin,
  AskDwpResponse,
  WorkplaceAction,
} from '@dwp-frontend/shared-utils';
import { useDwaionGovernedMutation } from '../../components/use-dwaion-governed-mutation';

const icons = {
  'CALENDAR.EVENT.CREATE': CalendarPlus,
  'MAIL.DRAFT.CREATE': MailPlus,
  'SERVICE.REQUEST.CREATE': Wrench,
  'APPROVAL.REQUEST.CREATE': FileCheck2,
} as const;

const translationKeys: Record<string, string> = {
  'CALENDAR.EVENT.CREATE': 'calendarEvent',
  'MAIL.DRAFT.CREATE': 'mailDraft',
  'SERVICE.REQUEST.CREATE': 'serviceRequest',
  'APPROVAL.REQUEST.CREATE': 'approvalRequest',
};

export function DwaionActionShelf({
  query,
  response,
}: {
  query: string | null;
  response: AskDwpResponse | null;
}) {
  const { t, i18n } = useTranslation('work');
  const language = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const location = useLocation();
  const navigate = useNavigate();
  const governPreview = useDwaionGovernedMutation('route.dwaion.work.action-preview.action');
  const [selected, setSelected] = useState<WorkplaceAction | null>(null);
  const [previewError, setPreviewError] = useState<'permission' | 'unavailable' | null>(null);
  const actionTitle = (action: WorkplaceAction) => {
    const translationKey = translationKeys[action.actionKey];
    return translationKey
      ? t(`askPage.actionsShelf.items.${translationKey}.title`)
      : t('askPage.actionsShelf.unknownAction');
  };
  const catalog = useQuery({
    queryKey: ['dwaion', 'actions'],
    queryFn: getWorkplaceActions,
    staleTime: 60_000,
  });
  const origin = (): AgentActionHandoffOrigin => ({
    appKey: 'APP.ASK',
    route: location.pathname,
    surface: 'action-shelf',
    sourceRunId: response!.runId,
    sourceRequestId: response!.requestId,
    sourceCorrelationId: response!.correlationId,
    conversationId: response!.conversationId,
  });
  const previewMutation = useMutation({
    mutationFn: (action: WorkplaceAction) =>
      governPreview((authority) =>
        previewWorkplaceAction(
          action.actionKey,
          {
            requestId: globalThis.crypto.randomUUID(),
            inputs: buildDwaionActionDraftInputs(action.actionKey, query, response),
            sourceReferences: response?.citations.map((citation) => citation.sourceId) ?? [],
            origin: origin(),
          },
          authority
        )
      ),
    onSuccess: (value, action) => {
      setPreviewError(null);
      const expectedOrigin = origin();
      navigate(`/dwaion/actions?action=${encodeURIComponent(action.actionKey)}`, {
        state: createDwaionActionReviewRouteState(value, expectedOrigin, location.pathname),
      });
    },
    onError: (error) => {
      setPreviewError(
        error instanceof HttpError && error.status === 403 ? 'permission' : 'unavailable'
      );
    },
  });

  if (!response || response.policy.outcome === 'DENY' || !catalog.data?.length) return null;

  const beginPreview = (action: WorkplaceAction) => {
    setSelected(action);
    setPreviewError(null);
    previewMutation.mutate(action);
  };

  return (
    <Box
      component="section"
      aria-labelledby="dwaion-actions-heading"
      sx={{ mt: { xs: 2.5, md: 4 } }}
    >
      <Stack direction="row" alignItems="flex-end" justifyContent="space-between" gap={1}>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            id="dwaion-actions-heading"
            component="h2"
            variant="subtitle1"
            fontWeight="fontWeightBold"
          >
            {t('askPage.actionsShelf.title')}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.25, display: { xs: 'none', sm: 'block' } }}
          >
            {t('askPage.actionsShelf.description')}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ flex: '0 0 auto' }}>
          {t('askPage.actionsShelf.count', { count: catalog.data.length })}
        </Typography>
      </Stack>
      {catalog.isError && (
        <InlineFeedback severity="warning" sx={{ mt: 1.5 }}>
          {t('dwaionActions.loadError')}
        </InlineFeedback>
      )}
      <Box
        sx={{
          mt: 1.5,
          display: { xs: 'flex', sm: 'grid' },
          gridTemplateColumns: { sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
          gap: 1,
          overflowX: { xs: 'auto', sm: 'visible' },
          overscrollBehaviorInline: 'contain',
          scrollSnapType: { xs: 'inline mandatory', sm: 'none' },
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {catalog.data.map((action) => {
          const Icon = icons[action.actionKey as keyof typeof icons] ?? Wrench;
          return (
            <ActionButton
              key={action.actionKey}
              intent="quiet"
              startIcon={<Icon size={18} aria-hidden="true" />}
              onClick={() => beginPreview(action)}
              sx={{
                minHeight: { xs: 118, sm: 132 },
                minWidth: { xs: 210, sm: 0 },
                flex: { xs: '0 0 62%', sm: 'initial' },
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
                border: 1,
                borderColor: 'divider',
                borderRadius: (theme) => Number(theme.shape.borderRadius) * 1.5 + 'px',
                px: 1.25,
                py: 1.25,
                scrollSnapAlign: { xs: 'start', sm: 'none' },
                bgcolor: 'background.paper',
              }}
            >
              <Stack alignItems="flex-start" gap={0.55} sx={{ textAlign: 'left', minWidth: 0 }}>
                <Stack direction="row" justifyContent="space-between" gap={1} width="100%">
                  <Typography variant="caption" color="primary.main" fontWeight="fontWeightBold">
                    {t(`askPage.actionsShelf.risk.${action.riskTier}`)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {actionDestination(action.actionKey, language).app}
                  </Typography>
                </Stack>
                <Typography variant="body1" fontWeight="fontWeightBold">
                  {actionTitle(action)}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ whiteSpace: 'normal', lineHeight: 'h5.lineHeight' }}
                >
                  {action.description}
                </Typography>
              </Stack>
            </ActionButton>
          );
        })}
      </Box>

      {selected && (previewMutation.isPending || previewError) && (
        <InlineFeedback
          severity={previewError ? 'error' : 'info'}
          sx={{ mt: 1.25 }}
          action={
            previewError ? (
              <ActionButton intent="quiet" onClick={() => previewMutation.mutate(selected)}>
                {t('dwaionActions.controls.retry')}
              </ActionButton>
            ) : undefined
          }
        >
          {previewError === 'permission'
            ? t('dwaionActions.controls.permissionOff')
            : previewError
              ? t('dwaionActions.loadError')
              : t('dwaionActions.reviewBoundary')}
        </InlineFeedback>
      )}
    </Box>
  );
}
