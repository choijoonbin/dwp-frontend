import { useTranslation } from 'react-i18next';
import { useDisplayDictionary } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';

import { buildApprovalPolicyComparisonRows } from './approval-policy-model';

import type { ApprovalPolicy } from '@dwp-frontend/shared-utils';

function formatPolicyValue(value: unknown): string {
  if (value == null) return '\u2014';
  if (Array.isArray(value)) return value.map(formatPolicyValue).join(', ');
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${key}: ${formatPolicyValue(entry)}`)
      .join(' \u00b7 ');
  }
  return String(value);
}

export function ApprovalPolicyComparison({
  policy,
  publishedVersionLabel,
}: {
  policy: ApprovalPolicy;
  publishedVersionLabel?: string;
}) {
  const { t } = useTranslation('approvals');
  const display = useDisplayDictionary();
  const rows = buildApprovalPolicyComparisonRows(policy);
  const labelFor = (field: (typeof rows)[number]['field'], ruleKey?: string) => {
    if (field === 'enforcement') return t('admin.studio.enforcement');
    if (field === 'severity') return t('admin.studio.severity');
    if (field === 'lifecycle') return t('admin.studio.lifecycle');
    return `${t('admin.studio.ruleValue')} \u00b7 ${ruleKey ?? ''}`;
  };
  const formatValue = (field: (typeof rows)[number]['field'], value: unknown) => {
    if (field === 'enforcement')
      return t(`admin.studio.enforcementModes.${value}`, { defaultValue: String(value) });
    if (field === 'severity')
      return display('severities', typeof value === 'string' ? value : null);
    if (field === 'lifecycle') return display('states', typeof value === 'string' ? value : null);
    return formatPolicyValue(value);
  };
  return (
    <Box role="table" aria-label={t('admin.studio.changeComparison')}>
      <Box
        role="row"
        sx={{
          display: 'grid',
          gridTemplateColumns: policy.pendingReview ? 'repeat(2,minmax(0,1fr))' : 'minmax(0,1fr)',
          py: 1.5,
          gap: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box
          role="columnheader"
          sx={{ gridColumn: '1 / -1', typography: 'caption', color: 'text.secondary' }}
        >
          {t('admin.studio.changeField')}
        </Box>
        <Box role="columnheader">
          <Box sx={{ typography: 'subtitle2' }}>{t('admin.studio.currentValue')}</Box>
          <Box sx={{ mt: 0.5, typography: 'caption', color: 'text.secondary' }}>
            {publishedVersionLabel ?? t('admin.studio.policyVersionUnavailable')}
          </Box>
        </Box>
        {policy.pendingReview ? (
          <Box role="columnheader" sx={{ color: 'primary.main' }}>
            <Box sx={{ typography: 'subtitle2' }}>{t('admin.studio.proposedValue')}</Box>
            <Box sx={{ mt: 0.5, typography: 'caption' }}>{t('admin.studio.pendingTitle')}</Box>
          </Box>
        ) : null}
      </Box>
      {rows.map((row) => (
        <Box
          role="row"
          key={row.key}
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0,1fr)',
              sm: policy.pendingReview ? 'repeat(2,minmax(0,1fr))' : 'minmax(0,1fr)',
            },
            columnGap: 1.5,
            rowGap: 1,
            py: 1.5,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Stack
            role="cell"
            direction="row"
            gap={1}
            alignItems="center"
            flexWrap="wrap"
            sx={{ gridColumn: '1 / -1' }}
          >
            <Box
              sx={{ typography: 'body2', fontWeight: 'fontWeightBold', overflowWrap: 'anywhere' }}
            >
              {labelFor(row.field, row.ruleKey)}
            </Box>
            {row.changed ? (
              <Chip
                size="small"
                color="warning"
                variant="outlined"
                label={t('admin.studio.changed')}
              />
            ) : null}
          </Stack>
          {[
            { key: 'current', label: t('admin.studio.currentValue'), value: row.current },
            ...(policy.pendingReview
              ? [{ key: 'proposed', label: t('admin.studio.proposedValue'), value: row.proposed }]
              : []),
          ].map(({ key, label, value }) => (
            <Box
              key={key}
              role="cell"
              sx={(theme) => ({
                minWidth: 0,
                p: 1.5,
                borderInlineStart: 2,
                borderColor: key === 'proposed' && row.changed ? 'primary.main' : 'divider',
                bgcolor:
                  key === 'proposed' ? alpha(theme.palette.primary.main, 0.07) : 'action.hover',
              })}
            >
              <Box sx={{ typography: 'caption', color: 'text.secondary' }}>{label}</Box>
              <Box
                sx={{
                  mt: 0.75,
                  typography: 'body2',
                  fontWeight:
                    key === 'proposed' && row.changed ? 'fontWeightBold' : 'fontWeightRegular',
                  overflowWrap: 'anywhere',
                }}
              >
                {formatValue(row.field, value)}
              </Box>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}
