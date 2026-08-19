import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CalendarPlus, FileCheck2, MailPlus, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ActionButton, ConfirmDialog } from '@dwp-frontend/design-system';
import { getWorkplaceActions, previewWorkplaceAction, useToast } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  AskDwpResponse,
  WorkplaceAction,
  WorkplaceActionPreview,
} from '@dwp-frontend/shared-utils';

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

export function DwaionActionShelf({ response }: { response: AskDwpResponse | null }) {
  const { t } = useTranslation('work');
  const navigate = useNavigate();
  const toast = useToast();
  const [selected, setSelected] = useState<WorkplaceAction | null>(null);
  const [preview, setPreview] = useState<WorkplaceActionPreview | null>(null);
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
  const previewMutation = useMutation({
    mutationFn: (action: WorkplaceAction) =>
      previewWorkplaceAction(action.actionKey, {
        requestId: globalThis.crypto.randomUUID(),
        sourceReferences: response?.citations.map((citation) => citation.sourceId) ?? [],
      }),
    onSuccess: setPreview,
    onError: () => {
      toast.error(t('askPage.actionsShelf.previewError'));
      setSelected(null);
    },
  });

  if (!catalog.data?.length) return null;

  const beginPreview = (action: WorkplaceAction) => {
    setSelected(action);
    setPreview(null);
    previewMutation.mutate(action);
  };
  const close = () => {
    if (previewMutation.isPending) return;
    setSelected(null);
    setPreview(null);
  };
  const handoff = () => {
    if (!preview) return;
    navigate(preview.action.targetRoute, {
      state: {
        dwaionHandoff: {
          actionKey: preview.action.actionKey,
          planHash: preview.plan.planHash,
          sourceReferences: preview.plan.sourceReferences,
        },
      },
    });
    toast.success(t('askPage.actionsShelf.handoffComplete'));
  };

  return (
    <Box component="section" aria-labelledby="dwaion-actions-heading" sx={{ mt: 4 }}>
      <Typography id="dwaion-actions-heading" component="h2" variant="subtitle1" fontWeight={800}>
        {t('askPage.actionsShelf.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
        {t('askPage.actionsShelf.description')}
      </Typography>
      <Box
        sx={{
          mt: 1.5,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        {catalog.data.map((action) => {
          const Icon = icons[action.actionKey as keyof typeof icons] ?? Wrench;
          return (
            <ActionButton
              key={action.actionKey}
              intent="quiet"
              startIcon={<Icon size={17} aria-hidden="true" />}
              onClick={() => beginPreview(action)}
              sx={{
                minHeight: 58,
                justifyContent: 'flex-start',
                borderBottom: 1,
                borderColor: 'divider',
                borderRadius: 0,
              }}
            >
              <Stack alignItems="flex-start" sx={{ textAlign: 'left' }}>
                <Typography variant="body2" fontWeight={750}>
                  {actionTitle(action)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t(`askPage.actionsShelf.risk.${action.riskTier}`)}
                </Typography>
              </Stack>
            </ActionButton>
          );
        })}
      </Box>

      <ConfirmDialog
        open={Boolean(selected)}
        title={
          preview
            ? t('askPage.actionsShelf.confirmTitle', {
                action: actionTitle(preview.action),
              })
            : t('askPage.actionsShelf.previewing')
        }
        description={
          preview
            ? t('askPage.actionsShelf.confirmDescription', {
                steps: preview.plan.steps.length,
              })
            : t('askPage.actionsShelf.previewDescription')
        }
        cancelLabel={t('askPage.actionsShelf.cancel')}
        confirmLabel={t('askPage.actionsShelf.continue')}
        confirmingLabel={t('askPage.actionsShelf.opening')}
        busy={previewMutation.isPending}
        onClose={close}
        onConfirm={handoff}
      />
    </Box>
  );
}
