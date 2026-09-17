import { useTranslation } from 'react-i18next';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { AuditPolicyRevision } from '@dwp-frontend/shared-utils';

export type AuditPolicyDiffRow = Readonly<{
  field: string;
  before: unknown;
  after: unknown;
}>;

export function policyRevisionEvidenceRows(
  revision: Pick<AuditPolicyRevision, 'diff'>
): AuditPolicyDiffRow[] {
  return Object.entries(revision.diff).map(([field, value]) => ({
    field,
    before: value.before,
    after: value.after,
  }));
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '—';
  }
}

export function AuditPolicyRevisionEvidence({ revision }: { revision: AuditPolicyRevision }) {
  const { t } = useTranslation('admin');
  const rows = policyRevisionEvidenceRows(revision);

  if (!rows.length && !revision.approval) return null;

  return (
    <Stack gap={1.25} sx={{ mt: 1.5 }}>
      {rows.length > 0 && (
        <Box
          role="table"
          aria-label={t('auditControl.governance.revisions.diffTitle')}
          sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}
        >
          <Box
            role="row"
            sx={{
              display: { xs: 'none', sm: 'grid' },
              gridTemplateColumns: 'minmax(140px, 0.8fr) minmax(0, 1fr) minmax(0, 1fr)',
              gap: 1,
              px: 1.5,
              py: 1,
              bgcolor: 'background.default',
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Typography role="columnheader" variant="caption" fontWeight={750}>
              {t('auditControl.governance.revisions.diffField')}
            </Typography>
            <Typography role="columnheader" variant="caption" fontWeight={750}>
              {t('auditControl.governance.revisions.diffBefore')}
            </Typography>
            <Typography role="columnheader" variant="caption" fontWeight={750}>
              {t('auditControl.governance.revisions.diffAfter')}
            </Typography>
          </Box>
          {rows.map((row) => (
            <Box
              role="row"
              key={row.field}
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'minmax(140px, 0.8fr) minmax(0, 1fr) minmax(0, 1fr)',
                },
                gap: { xs: 0.5, sm: 1 },
                px: 1.5,
                py: 1.15,
                borderBottom: 1,
                borderColor: 'divider',
                '&:last-child': { borderBottom: 0 },
              }}
            >
              <Typography role="cell" variant="caption" fontWeight={750}>
                {t(`auditControl.governance.revisions.fields.${row.field}`, {
                  defaultValue: row.field,
                })}
              </Typography>
              <Stack role="cell" direction="row" gap={0.75} alignItems="baseline" minWidth={0}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: { xs: 'inline', sm: 'none' } }}
                >
                  {t('auditControl.governance.revisions.diffBefore')}
                </Typography>
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                  {displayValue(row.before)}
                </Typography>
              </Stack>
              <Stack role="cell" direction="row" gap={0.75} alignItems="baseline" minWidth={0}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: { xs: 'inline', sm: 'none' } }}
                >
                  {t('auditControl.governance.revisions.diffAfter')}
                </Typography>
                <Typography
                  variant="body2"
                  color="primary.main"
                  fontWeight={750}
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {displayValue(row.after)}
                </Typography>
              </Stack>
            </Box>
          ))}
        </Box>
      )}

      <Alert severity="info">
        {t('auditControl.governance.revisions.impactUnavailable', { count: rows.length })}
      </Alert>

      {revision.approval && (
        <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
          <Chip
            size="small"
            variant="outlined"
            label={t('auditControl.governance.revisions.approvalRequested', {
              actor: revision.approval.requestedBy,
              date: formatDate(revision.approval.requestedAt, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
            })}
          />
          <Chip
            size="small"
            variant="outlined"
            color={revision.approval.decidedBy ? 'success' : 'warning'}
            label={
              revision.approval.decidedBy
                ? t('auditControl.governance.revisions.approvalDecided', {
                    actor: revision.approval.decidedBy,
                    date: revision.approval.decidedAt
                      ? formatDate(revision.approval.decidedAt, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      : '—',
                  })
                : t('auditControl.governance.revisions.approvalPending')
            }
          />
        </Stack>
      )}
    </Stack>
  );
}
