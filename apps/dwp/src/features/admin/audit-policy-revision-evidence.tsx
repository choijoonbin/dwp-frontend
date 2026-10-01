import { useTranslation } from 'react-i18next';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { AuditPolicyRevision } from '@dwp-frontend/shared-utils';

import {
  policyImpactCount,
  policyImpactCounts,
  policyImpactCoverageLabelKey,
  policyImpactEvidenceAvailable,
  policyImpactExclusionLabelKey,
  policyImpactHashLabel,
  policyImpactOwnerLabelKey,
  policyRevisionEvidenceRows,
  policyRevisionFieldLabelKey,
} from './audit-policy-revision-evidence-model';

export function AuditPolicyRevisionEvidence({ revision }: { revision: AuditPolicyRevision }) {
  const { t } = useTranslation('admin');
  const rows = policyRevisionEvidenceRows(revision);
  const impact = revision.impactSnapshot;
  const impactCounts = policyImpactCounts(impact);
  const impactHash = policyImpactHashLabel(revision.impactSha256);
  const completeCoverage = policyImpactEvidenceAvailable(impact);
  const displayValue = (value: unknown): string => {
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') {
      return t(`auditControl.governance.revisions.values.${value ? 'enabled' : 'disabled'}`);
    }
    return t('auditControl.governance.revisions.values.unavailable');
  };

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
          {rows.map((row, index) => (
            <Box
              role="row"
              key={`${row.field}:${index}`}
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
                {t(policyRevisionFieldLabelKey(row.field))}
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

      <Box
        component="section"
        aria-labelledby={`policy-impact-${revision.revisionId}`}
        sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          gap={1}
        >
          <Box minWidth={0}>
            <Typography
              id={`policy-impact-${revision.revisionId}`}
              component="h4"
              variant="subtitle2"
            >
              {t('auditControl.governance.revisions.impact.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('auditControl.governance.revisions.impact.observedAt', {
                date: formatDate(impact.observedAt, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }),
              })}
            </Typography>
          </Box>
          <Chip
            size="small"
            variant="outlined"
            color={completeCoverage ? 'success' : 'warning'}
            label={t(policyImpactCoverageLabelKey(impact.coverageState))}
          />
        </Stack>

        {!completeCoverage && (
          <Alert severity="warning" sx={{ mt: 1.25 }}>
            {t('auditControl.governance.revisions.impact.incomplete')}
          </Alert>
        )}

        <Box
          component="dl"
          sx={{
            m: 0,
            mt: 1.5,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 1,
          }}
        >
          {impactCounts.map(({ field, value }) => (
            <Box key={field} sx={{ minWidth: 0, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography component="dt" variant="caption" color="text.secondary">
                {t(`auditControl.governance.revisions.impact.metrics.${field}`)}
              </Typography>
              <Typography component="dd" variant="body2" fontWeight={750} sx={{ m: 0 }}>
                {value ?? t('auditControl.governance.revisions.values.unavailable')}
              </Typography>
            </Box>
          ))}
          <ImpactTransition
            label={t('auditControl.governance.revisions.impact.metrics.exportableEvents')}
            before={impact.exportableEventCountBefore}
            after={impact.exportableEventCountAfter}
            evidenceAvailable={completeCoverage}
          />
          <ImpactTransition
            label={t('auditControl.governance.revisions.impact.metrics.integrityProtectedEvents')}
            before={impact.integrityProtectedEventCountBefore}
            after={impact.integrityProtectedEventCountAfter}
            evidenceAvailable={completeCoverage}
          />
        </Box>

        <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1.5 }}>
          {impact.includedOwners.map((owner, index) => (
            <Chip
              key={`${owner}:${index}`}
              size="small"
              variant="outlined"
              color="info"
              label={t(policyImpactOwnerLabelKey(owner))}
            />
          ))}
          {impact.exclusions.map((exclusion, index) => (
            <Chip
              key={`${exclusion}:${index}`}
              size="small"
              variant="outlined"
              color="warning"
              label={t(policyImpactExclusionLabelKey(exclusion))}
            />
          ))}
        </Stack>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 1.25, display: 'block', overflowWrap: 'anywhere' }}
        >
          {t('auditControl.governance.revisions.impact.hash', {
            hash: impactHash ?? t('auditControl.governance.revisions.values.unavailable'),
          })}
        </Typography>
      </Box>

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

function ImpactTransition({
  label,
  before,
  after,
  evidenceAvailable,
}: {
  label: string;
  before: unknown;
  after: unknown;
  evidenceAvailable: boolean;
}) {
  const { t } = useTranslation('admin');
  const beforeCount = evidenceAvailable ? policyImpactCount(before) : null;
  const afterCount = evidenceAvailable ? policyImpactCount(after) : null;
  const unavailable = t('auditControl.governance.revisions.values.unavailable');
  return (
    <Box sx={{ minWidth: 0, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
      <Typography component="dt" variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography component="dd" variant="body2" fontWeight={750} sx={{ m: 0 }}>
        {t('auditControl.governance.revisions.impact.transition', {
          before: beforeCount ?? unavailable,
          after: afterCount ?? unavailable,
        })}
      </Typography>
    </Box>
  );
}
