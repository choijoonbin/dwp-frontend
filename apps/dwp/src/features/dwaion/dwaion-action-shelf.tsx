import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CalendarPlus, FileCheck2, MailPlus, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { ActionButton, ConfirmDialog } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  createDwaionHandoff,
  getWorkplaceActions,
  previewWorkplaceAction,
  useToast,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { buildDwaionActionDraftInputs } from './dwaion-action-draft';

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

export function DwaionActionShelf({
  query,
  response,
}: {
  query: string | null;
  response: AskDwpResponse | null;
}) {
  const { t, i18n } = useTranslation('work');
  const location = useLocation();
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
        inputs: buildDwaionActionDraftInputs(action.actionKey, query, response),
        sourceReferences: response?.citations.map((citation) => citation.sourceId) ?? [],
        origin: {
          appKey: 'APP.ASK',
          route: location.pathname,
          surface: 'action-shelf',
          sourceRunId: response!.runId,
          sourceRequestId: response!.requestId,
          sourceCorrelationId: response!.correlationId,
          conversationId: response!.conversationId,
        },
      }),
    onSuccess: setPreview,
    onError: () => {
      toast.error(t('askPage.actionsShelf.previewError'));
      setSelected(null);
    },
  });

  if (!response || response.policy.outcome === 'DENY' || !catalog.data?.length) return null;

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
          ...createDwaionHandoff({
            actionKey: preview.action.actionKey,
            planHash: preview.plan.planHash,
            reviewedInputs: preview.reviewedInputs,
            sourceReferences: preview.plan.sourceReferences,
            origin: preview.plan.handoffOrigin,
          }),
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
        details={
          preview ? (
            <DraftReview
              preview={preview}
              locale={i18n.resolvedLanguage ?? i18n.language}
              labels={{
                heading: t('askPage.actionsShelf.review.heading'),
                empty: t('askPage.actionsShelf.review.empty'),
                title: t('askPage.actionsShelf.review.title'),
                schedule: t('askPage.actionsShelf.review.schedule'),
                recipients: t('askPage.actionsShelf.review.recipients'),
                content: t('askPage.actionsShelf.review.content'),
                summary: t('askPage.actionsShelf.review.summary'),
                justification: t('askPage.actionsShelf.review.justification'),
                count: (count) => t('askPage.actionsShelf.review.count', { count }),
                characters: (count) => t('askPage.actionsShelf.review.characters', { count }),
              }}
            />
          ) : undefined
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

type DraftReviewLabels = {
  heading: string;
  empty: string;
  title: string;
  schedule: string;
  recipients: string;
  content: string;
  summary: string;
  justification: string;
  count: (count: number) => string;
  characters: (count: number) => string;
};

function DraftReview({
  preview,
  locale,
  labels,
}: {
  preview: WorkplaceActionPreview;
  locale: string;
  labels: DraftReviewLabels;
}) {
  const rows = draftReviewRows(preview, locale, labels);
  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'action.hover',
        p: 1.5,
      }}
    >
      <Typography variant="caption" fontWeight={800} color="text.secondary">
        {labels.heading}
      </Typography>
      {rows.length ? (
        <Stack component="dl" gap={1} sx={{ m: 0, mt: 1 }}>
          {rows.map((row) => (
            <Box
              key={row.label}
              sx={{ display: 'grid', gridTemplateColumns: '88px minmax(0, 1fr)', gap: 1.5 }}
            >
              <Typography component="dt" variant="caption" color="text.secondary">
                {row.label}
              </Typography>
              <Typography
                component="dd"
                variant="body2"
                fontWeight={650}
                sx={{ m: 0, overflowWrap: 'anywhere' }}
              >
                {row.value}
              </Typography>
            </Box>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          {labels.empty}
        </Typography>
      )}
    </Box>
  );
}

function draftReviewRows(
  preview: WorkplaceActionPreview,
  locale: string,
  labels: DraftReviewLabels
): Array<{ label: string; value: string }> {
  const value = (field: string) => {
    const candidate = preview.reviewedInputs[field];
    return typeof candidate === 'string' ? candidate : '';
  };
  const count = (field: string) => {
    const candidate = preview.reviewedInputs[field];
    return Array.isArray(candidate) ? candidate.length : 0;
  };
  const text = (field: string, limit = 140) => compact(value(field), limit);
  const dateTime = (field: string) => {
    const candidate = value(field);
    if (!candidate) return '';
    const date = new Date(candidate);
    return Number.isNaN(date.getTime())
      ? ''
      : formatDate(
          date,
          { dateStyle: 'medium', timeStyle: 'short' },
          resolveSupportedLocale(locale)
        );
  };

  if (preview.action.actionKey === 'CALENDAR.EVENT.CREATE') {
    const startsAt = dateTime('startsAt');
    const endsAt = dateTime('endsAt');
    return compactRows([
      [labels.title, text('title')],
      [labels.schedule, startsAt && endsAt ? `${startsAt} - ${endsAt}` : ''],
      [labels.recipients, count('attendees') ? labels.count(count('attendees')) : ''],
    ]);
  }
  if (preview.action.actionKey === 'MAIL.DRAFT.CREATE') {
    return compactRows([
      [labels.title, text('subject')],
      [labels.recipients, count('to') ? labels.count(count('to')) : ''],
      [labels.content, value('body') ? labels.characters(value('body').length) : ''],
    ]);
  }
  if (preview.action.actionKey === 'SERVICE.REQUEST.CREATE') {
    return compactRows([[labels.summary, text('requestSummary')]]);
  }
  return compactRows([
    [labels.title, text('title')],
    [
      labels.justification,
      value('businessJustification')
        ? labels.characters(value('businessJustification').length)
        : '',
    ],
  ]);
}

function compactRows(
  rows: Array<[label: string, value: string]>
): Array<{ label: string; value: string }> {
  return rows.filter(([, value]) => Boolean(value)).map(([label, value]) => ({ label, value }));
}

function compact(value: string | null | undefined, limit: number): string {
  return value?.replace(/\s+/gu, ' ').trim().slice(0, limit) ?? '';
}
