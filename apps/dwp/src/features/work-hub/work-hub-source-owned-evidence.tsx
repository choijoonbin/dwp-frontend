import { FileText, MessageSquareText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatNumber, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { WorkSourceDetailSection } from './work-hub-source-detail-section';
import { WorkHubSourceOwnedHistory } from './work-hub-source-owned-history';
import type {
  WorkHubSourceDetailField,
  WorkHubSourceDetailProjection,
} from './work-hub-source-owned-detail-model';

function localizedFieldLabel(field: WorkHubSourceDetailField, korean: boolean) {
  return (korean ? field.labelKo : field.labelEn) ?? (korean ? field.labelEn : field.labelKo);
}

export function WorkHubSourceOwnedEvidence({
  projection,
}: {
  projection: WorkHubSourceDetailProjection;
}) {
  const { t, i18n } = useTranslation('work');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const korean = locale === 'ko';
  const missing = t('workHub.sourceDetail.notProvided');
  const rows = projection.fields.flatMap((field) => {
    const label = localizedFieldLabel(field, korean);
    if (!label) return [];
    const value =
      field.value === null
        ? missing
        : typeof field.value === 'boolean'
          ? t(`workHub.sourceDetail.${field.value ? 'yes' : 'no'}`)
          : typeof field.value === 'number'
            ? formatNumber(field.value, undefined, locale)
            : field.value;
    return [{ key: field.key, label, value }];
  });
  return (
    <Stack gap={2}>
      {projection.kind === 'APPROVAL_REQUEST' && (
        <WorkSourceDetailSection
          title={t('workHub.sourceOwned.request.requestedInformation')}
          description={t('workHub.sourceOwned.request.description')}
          icon={MessageSquareText}
          tone="warning"
        >
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {projection.requestedInformation || t('workHub.sourceOwned.request.noInformation')}
          </Typography>
        </WorkSourceDetailSection>
      )}
      {projection.kind === 'SERVICE_REQUEST' && projection.requestedInformation && (
        <WorkSourceDetailSection
          title={t('workHub.sourceDetail.service.requestedInformation')}
          icon={MessageSquareText}
          tone="warning"
        >
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {projection.requestedInformation}
          </Typography>
        </WorkSourceDetailSection>
      )}
      {(rows.length > 0 || projection.kind === 'APPROVAL_REQUEST') && (
        <WorkSourceDetailSection
          title={t(
            projection.kind === 'APPROVAL_REQUEST'
              ? 'workHub.sourceOwned.request.fields'
              : projection.kind === 'APPROVAL_TASK'
                ? 'workHub.sourceDetail.approval.evidence'
                : 'workHub.sourceDetail.service.originalRequest'
          )}
          icon={FileText}
        >
          {rows.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              {t('workHub.sourceOwned.request.emptyFields')}
            </Typography>
          )}
          <Stack component="dl" gap={1.5} sx={{ m: 0 }}>
            {rows.map(({ key, label, value }) => (
              <Stack key={key} component="div" gap={0.35} sx={{ minWidth: 0 }}>
                <Typography component="dt" variant="caption" color="text.secondary">
                  {label}
                </Typography>
                <Typography
                  component="dd"
                  variant="body2"
                  sx={{ m: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                >
                  {value}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </WorkSourceDetailSection>
      )}
      <WorkHubSourceOwnedHistory events={projection.history} />
    </Stack>
  );
}
