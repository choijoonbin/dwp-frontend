import { useTranslation } from 'react-i18next';
import { useDisplayDictionary } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  auditEvidenceRows,
  type AuditEvidenceValuePresentation,
} from './audit-evidence-presentation';

function EvidenceValue({ value }: { value: AuditEvidenceValuePresentation }) {
  const { t } = useTranslation('admin');
  const display = useDisplayDictionary();
  if (value.kind === 'literal') return <>{value.value}</>;
  if (value.kind === 'display') return <>{display(value.domain, value.code)}</>;
  return <>{t(value.key)}</>;
}

export function AuditEvidenceSummary({
  before,
  after,
  changedFields,
  metadataCount = 0,
}: {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  changedFields?: string[];
  metadataCount?: number;
}) {
  const { t } = useTranslation('admin');
  const rows = auditEvidenceRows(before, after, changedFields);
  return (
    <Stack gap={1}>
      {rows.length ? (
        rows.map((row) => (
          <Box key={row.id} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.25 }}>
            <Typography variant="caption" color="text.secondary">
              {t(row.labelKey)}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={0.75} sx={{ mt: 0.5 }}>
              <Typography variant="body2">
                <Box component="span" fontWeight={700}>
                  {t('auditControl.evidence.beforeLabel')}{' '}
                </Box>
                <EvidenceValue value={row.before} />
              </Typography>
              <Typography variant="body2" color="text.secondary" aria-hidden="true">
                →
              </Typography>
              <Typography variant="body2">
                <Box component="span" fontWeight={700}>
                  {t('auditControl.evidence.afterLabel')}{' '}
                </Box>
                <EvidenceValue value={row.after} />
              </Typography>
            </Stack>
          </Box>
        ))
      ) : (
        <Typography variant="body2" color="text.secondary">
          {t('auditControl.evidence.noItemizedChange')}
        </Typography>
      )}
      {metadataCount > 0 && (
        <Typography variant="caption" color="text.secondary">
          {t('auditControl.evidence.protectedMetadata', { count: metadataCount })}
        </Typography>
      )}
    </Stack>
  );
}
