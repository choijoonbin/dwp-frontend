import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { UseQueryResult } from '@tanstack/react-query';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import {
  ActionButton,
  DetailInspector,
  EmptyState,
  InlineFeedback,
  LoadingState,
  LocalErrorState,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import type { WorkspaceActivityEvent, WorkspaceActivityState } from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  activityEventDetailModel,
  availableActivitySourceRoute,
  selectedActivityEvent,
} from './activity-detail-model';

import type { ActivityDetailField } from './activity-detail-model';

type ActivityEventDetailProps = {
  eventId: string;
  query: UseQueryResult<WorkspaceActivityEvent, Error>;
  showSourceAction?: boolean;
  variant?: 'inline' | 'drawer';
  onClose?: () => void;
};

type LabeledField = ActivityDetailField & { label: string };

const accessibleFeedbackSx = {
  color: 'text.primary',
  bgcolor: 'background.paper',
  border: 1,
  borderColor: 'divider',
  '& .MuiAlert-icon': { color: 'text.primary' },
} as const;

function detailStateSeverity(
  state: WorkspaceActivityState
): 'info' | 'success' | 'warning' | 'error' {
  if (state === 'completed') return 'success';
  if (state === 'failed') return 'error';
  if (state === 'needs-input' || state === 'unknown') return 'warning';
  return 'info';
}

function DetailFields({ fields }: { fields: LabeledField[] }) {
  return (
    <Box
      component="dl"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
        gap: 1.5,
        m: 0,
      }}
    >
      {fields.map((field) => (
        <Box key={field.key} sx={{ minWidth: 0 }}>
          <Typography component="dt" variant="caption" color="text.secondary">
            {field.label}
          </Typography>
          <Typography
            component="dd"
            variant="body2"
            fontWeight="fontWeightMedium"
            sx={{ m: 0, mt: 0.25, overflowWrap: 'anywhere' }}
          >
            {field.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box component="section">
      <Typography component="h3" variant="subtitle2" sx={{ mb: 1.25 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

export function ActivityEventDetail({
  eventId,
  query,
  showSourceAction = true,
  variant = 'inline',
  onClose,
}: ActivityEventDetailProps) {
  const { t } = useTranslation('work');
  const navigate = useNavigate();
  const [sourceUnavailable, setSourceUnavailable] = useState<string | null>(null);
  const drawerContentRef = useRef<HTMLDivElement | null>(null);
  const selected = selectedActivityEvent(eventId, query.data);
  const model = selected ? activityEventDetailModel(selected) : null;
  const kindLabel = model
    ? t(`activityFoundation.detail.kind.${model.kind}.label`)
    : t('activityPage.detailTitle');

  useEffect(() => {
    if (variant !== 'drawer' || !eventId) return;
    const frame = globalThis.requestAnimationFrame(() =>
      drawerContentRef.current?.focus({ preventScroll: true })
    );
    return () => globalThis.cancelAnimationFrame(frame);
  }, [eventId, variant]);

  const openSource = async () => {
    setSourceUnavailable(null);
    // Revalidate source ACL at the moment of navigation, including after a stale snapshot.
    const latest = await query.refetch();
    const event = !latest.isError ? selectedActivityEvent(eventId, latest.data) : undefined;
    const route = event ? availableActivitySourceRoute(event) : null;
    if (route) navigate(route);
    else setSourceUnavailable(eventId);
  };

  const formatTimestamp = (value: string) =>
    formatDate(value, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const localizeFieldValue = (field: ActivityDetailField): string => {
    if (field.key === 'actorType') {
      return t(`labels.actor.${field.value}`, { defaultValue: field.value });
    }
    if (field.key === 'sourceAccess') {
      return t(`activityFoundation.detail.sourceAccess.${field.value}`, {
        defaultValue: field.value,
      });
    }
    if (field.key === 'dataProvenance') {
      return t(`activityFoundation.detail.provenance.${field.value}`, {
        defaultValue: field.value,
      });
    }
    return field.value;
  };

  const labelFields = (fields: ActivityDetailField[]): LabeledField[] =>
    fields.map((field) => ({
      ...field,
      label: t(`activityFoundation.detail.fields.${field.key}`, { defaultValue: field.key }),
      value: localizeFieldValue(field),
    }));

  const content = !eventId ? (
    <EmptyState title={t('activityFoundation.selectEvent')} size="compact" />
  ) : query.isLoading ? (
    <LoadingState label={t('activityPage.loading')} size="compact" />
  ) : query.isError || !selected || !model ? (
    <LocalErrorState
      title={t('activityFoundation.unavailableTitle')}
      description={t('activityFoundation.unavailableDescription')}
      retryLabel={t('activityPage.retry')}
      onRetry={() => void query.refetch()}
      retrying={query.isFetching}
      size="compact"
    />
  ) : (
    <Stack gap={2.5} divider={<Divider flexItem />}>
      <Box>
        <Typography component="h3" variant="h6">
          {selected.title}
        </Typography>
        {selected.summary && (
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            {selected.summary}
          </Typography>
        )}
      </Box>

      <DetailSection title={t('activityFoundation.detail.sections.meaning')}>
        <InlineFeedback
          severity={detailStateSeverity(selected.state)}
          title={t(`activityPage.states.${selected.state}`)}
          sx={accessibleFeedbackSx}
        >
          <Stack gap={0.5}>
            <Typography component="span" variant="body2">
              {t(`activityFoundation.detail.kind.${model.kind}.description`)}
            </Typography>
            <Typography component="span" variant="body2">
              {t(`activityFoundation.detail.stateDescription.${selected.state}`)}
            </Typography>
          </Stack>
        </InlineFeedback>
        {model.kind === 'CHANGE' && (
          <Box sx={{ mt: 1.5 }}>
            <DetailFields
              fields={[
                {
                  key: 'recordState',
                  label: t('activityFoundation.detail.fields.recordState'),
                  value: t(`activityPage.states.${selected.state}`),
                },
                ...(model.workStatusAtChange
                  ? [
                      {
                        key: 'workStatusAtChange',
                        label: t('activityFoundation.detail.fields.workStatusAtChange'),
                        value: t(`activityFoundation.workStatus.${model.workStatusAtChange}`, {
                          defaultValue: model.workStatusAtChange,
                        }),
                      },
                    ]
                  : []),
              ]}
            />
          </Box>
        )}
      </DetailSection>

      <DetailSection title={t('activityFoundation.detail.sections.time')}>
        <DetailFields
          fields={[
            {
              key: 'occurredAt',
              label: t(
                model.kind === 'CHANGE'
                  ? 'activityFoundation.detail.fields.changeOccurredAt'
                  : 'activityFoundation.detail.fields.occurredAt'
              ),
              value: formatTimestamp(model.occurredAt),
            },
            ...(model.sourceObservedAt
              ? [
                  {
                    key: 'sourceObservedAt',
                    label: t('activityFoundation.detail.fields.sourceObservedAt'),
                    value: formatTimestamp(model.sourceObservedAt),
                  },
                ]
              : []),
            ...(model.updatedAt
              ? [
                  {
                    key: 'updatedAt',
                    label: t('activityFoundation.detail.fields.updatedAt'),
                    value: formatTimestamp(model.updatedAt),
                  },
                ]
              : []),
          ]}
        />
      </DetailSection>

      <DetailSection title={t('activityFoundation.detail.sections.actor')}>
        <DetailFields fields={labelFields(model.actorFields)} />
      </DetailSection>

      <DetailSection title={t('activityFoundation.detail.sections.object')}>
        <DetailFields fields={labelFields(model.objectFields)} />
      </DetailSection>

      <DetailSection title={t('activityFoundation.detail.sections.source')}>
        <DetailFields fields={labelFields(model.sourceFields)} />
      </DetailSection>

      {model.executionFields.length > 0 && (
        <DetailSection title={t('activityFoundation.detail.sections.execution')}>
          <DetailFields fields={labelFields(model.executionFields)} />
          {model.kind === 'EXECUTION_SNAPSHOT' && (
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
              {t('activityFoundation.detail.executionReferenceNotice')}
            </Typography>
          )}
        </DetailSection>
      )}

      <DetailSection title={t('activityFoundation.detail.sections.audit')}>
        <InlineFeedback
          severity={model.audit.recordId ? 'info' : 'warning'}
          title={t(`activityFoundation.detail.audit.${model.audit.presentation}.title`)}
          sx={accessibleFeedbackSx}
        >
          {t(`activityFoundation.detail.audit.${model.audit.presentation}.description`)}
        </InlineFeedback>
        {model.audit.recordId && (
          <Box sx={{ mt: 1.5 }}>
            <DetailFields
              fields={[
                {
                  key: 'auditRecordId',
                  label: t('activityFoundation.detail.fields.auditRecordId'),
                  value: model.audit.recordId,
                },
              ]}
            />
          </Box>
        )}
        {model.legacy && (
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.25 }}>
            {t('activityFoundation.legacyNotice')}
          </Typography>
        )}
      </DetailSection>

      <Box
        component="details"
        sx={{
          '&[open] > summary': { mb: 1.5 },
          '& > summary': {
            cursor: 'pointer',
            fontWeight: 'fontWeightMedium',
            '&:focus-visible': {
              outline: '3px solid var(--dwp-focus-ring, currentColor)',
              outlineOffset: 2,
            },
          },
        }}
      >
        <Typography component="summary" variant="subtitle2">
          {t('activityFoundation.detail.sections.technical')}
        </Typography>
        <DetailFields fields={labelFields(model.traceFields)} />
      </Box>

      {(model.canRefreshUnknownState || showSourceAction) && (
        <Box>
          <Stack direction="row" gap={1} flexWrap="wrap">
            {model.canRefreshUnknownState && (
              <ActionButton
                intent="secondary"
                startIcon={<RefreshCw size={16} aria-hidden="true" />}
                disabled={query.isFetching}
                onClick={() => void query.refetch()}
              >
                {t('activityFoundation.detail.refreshInformation')}
              </ActionButton>
            )}
            {showSourceAction && availableActivitySourceRoute(selected) && (
              <ActionButton
                intent="secondary"
                endIcon={<ArrowUpRight size={16} aria-hidden="true" />}
                disabled={query.isFetching}
                onClick={() => void openSource()}
              >
                {t('activityPage.openSource')}
              </ActionButton>
            )}
          </Stack>
          {showSourceAction &&
            (!availableActivitySourceRoute(selected) || sourceUnavailable === eventId) && (
              <Typography role="status" variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t('activityFoundation.sourceUnavailable')}
              </Typography>
            )}
          {showSourceAction && (
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
              {t('activityFoundation.sourceActionNotice')}
            </Typography>
          )}
        </Box>
      )}
    </Stack>
  );

  if (!onClose) {
    // Existing embedded callers keep their surrounding close/navigation contract until migrated.
    return (
      <Box
        component="aside"
        aria-label={t('activityPage.detailTitle')}
        sx={{ minWidth: 0, p: { xs: 2, md: 3 }, bgcolor: 'background.paper' }}
      >
        <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
          {t('activityPage.detailTitle')}
        </Typography>
        {content}
      </Box>
    );
  }

  return (
    <DetailInspector
      open={Boolean(eventId)}
      variant={variant}
      width={480}
      title={t('activityPage.detailTitle')}
      subtitle={kindLabel}
      closeLabel={t('activityFoundation.detail.close')}
      onClose={onClose}
      status={
        selected ? (
          <Chip
            size="small"
            variant="outlined"
            label={t(`activityPage.states.${selected.state}`)}
          />
        ) : undefined
      }
    >
      {variant === 'drawer' ? (
        <Box
          ref={drawerContentRef}
          tabIndex={-1}
          aria-label={selected?.title ?? t('activityPage.detailTitle')}
          sx={{ outline: 0 }}
        >
          {content}
        </Box>
      ) : (
        content
      )}
    </DetailInspector>
  );
}
