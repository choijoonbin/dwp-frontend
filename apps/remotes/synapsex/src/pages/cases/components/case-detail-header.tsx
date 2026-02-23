/**
 * Case Detail Header — Insight Dashboard, 제목, 상태 셀렉트, 메타
 */

import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Select from '@mui/material/Select';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import FormControl from '@mui/material/FormControl';
import CardContent from '@mui/material/CardContent';
import { alpha, useTheme } from '@mui/material/styles';
import LinearProgress from '@mui/material/LinearProgress';

import { SeverityBadge } from '../../../components/finance/severity-badge';
import { StatusPill, type Status } from '../../../components/finance/status-pill';

import type { CaseDetailUi } from '../adapters/case-detail-adapter';
import type { CaseStatusApi } from '../hooks/use-case-status-select';

export type CaseDetailHeaderProps = {
  caseData: CaseDetailUi;
  statusOptions: Array<{ value: CaseStatusApi; label: string }>;
  currentStatusApi: CaseStatusApi;
  onStatusChange: (status: CaseStatusApi) => void;
  isStatusMutating: boolean;
  onBack: () => void;
  onOpenDebug?: () => void;
  isDev?: boolean;
  /** AI 최종 권고 (없으면 severity 기반 기본 문구) */
  recommendationLabel?: string;
};

const getDefaultRecommendation = (severity: string, t: (k: string) => string): string => {
  const s = severity?.toLowerCase() ?? '';
  if (s === 'critical' || s === 'high') return t('caseDetail.insight.recommendAction');
  if (s === 'medium') return t('caseDetail.insight.recommendReview');
  return t('caseDetail.insight.recommendMonitor');
};

export const CaseDetailHeader = ({
  caseData,
  statusOptions,
  currentStatusApi,
  onStatusChange,
  isStatusMutating,
  onBack,
  onOpenDebug,
  isDev = false,
  recommendationLabel,
}: CaseDetailHeaderProps) => {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const riskPct = Math.round(Number(caseData.confidence ?? 0) || 0);
  const recommendation = recommendationLabel ?? getDefaultRecommendation(caseData.severity, t);

  return (
    <Card
      variant="outlined"
      sx={{
        mx: { xs: 1.5, sm: 0 },
        mt: { xs: 1, sm: 0 },
        mb: 0,
        borderRadius: { xs: 1.5, sm: 0 },
        borderWidth: { xs: 1, sm: 0 },
        borderBottom: { sm: 1 },
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: 'none',
        overflow: 'visible',
      }}
    >
      <CardContent sx={{ px: { xs: 1.5, sm: 3 }, pt: { xs: 1.5, sm: 2 }, pb: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
        {/* Insight Dashboard — 임원용 요약 */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'auto 1fr auto auto' },
            gap: 2,
            alignItems: 'center',
            mb: 2,
            p: 2,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.06),
            border: 1,
            borderColor: alpha(theme.palette.primary.main, 0.12),
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{ width: 56, height: 56, position: 'relative' }}>
              <Box
                component="span"
                sx={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: 2,
                  borderColor: riskPct >= 70 ? 'error.main' : riskPct >= 40 ? 'warning.main' : 'success.main',
                  opacity: 0.4,
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {riskPct}%
                </Typography>
              </Box>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('caseDetail.insight.riskGauge')}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(riskPct, 100)}
                color={riskPct >= 70 ? 'error' : riskPct >= 40 ? 'warning' : 'success'}
                sx={{ mt: 0.5, width: 80, height: 6, borderRadius: 1 }}
              />
            </Box>
          </Stack>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary">
              {t('caseDetail.insight.financialImpact')}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
              {caseData.amount.toLocaleString()} {caseData.currency}
            </Typography>
          </Box>
          <Chip
            icon={<Iconify icon="solar:shield-check-bold" width={16} />}
            label={recommendation}
            color={caseData.severity === 'critical' || caseData.severity === 'high' ? 'error' : 'default'}
            variant="filled"
            size="medium"
            sx={{ fontWeight: 600, justifySelf: { sm: 'end' } }}
          />
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ minWidth: 0, flex: 1 }}>
            <IconButton onClick={onBack} sx={{ flexShrink: 0, bgcolor: 'transparent' }}>
              <Iconify icon="solar:arrow-left-bold-duotone" width={20} />
            </IconButton>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                flexWrap="wrap"
                sx={{ mb: 1, gap: 1 }}
              >
                <Typography variant="h6" sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}>
                  {caseData.title}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ gap: 1 }}>
                  <SeverityBadge severity={caseData.severity} />
                  <StatusPill status={caseData.status as Status} />
                  <FormControl size="small" sx={{ minWidth: { xs: 120, sm: 140 } }}>
                    <InputLabel id="case-status-select-label">{t('caseDetail.status')}</InputLabel>
                    <Select
                      labelId="case-status-select-label"
                      label={t('caseDetail.status')}
                      value={currentStatusApi}
                      onChange={(e) => onStatusChange(e.target.value as CaseStatusApi)}
                      disabled={isStatusMutating}
                    >
                      {statusOptions.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              </Stack>
              <Stack
                direction="row"
                spacing={{ xs: 1.5, sm: 2 }}
                flexWrap="wrap"
                alignItems="center"
                sx={{ gap: 1 }}
              >
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Iconify icon="solar:hash-bold-duotone" width={14} />
                  <Typography variant="caption" color="text.secondary">
                    {caseData.caseNumber}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Iconify icon="solar:calendar-bold-duotone" width={14} />
                  <Typography variant="caption" color="text.secondary">
                    {new Date(caseData.detectedAt).toLocaleDateString()}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Iconify icon="solar:buildings-bold-duotone" width={14} />
                  <Typography variant="caption" color="text.secondary">
                    {caseData.companyCode}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Iconify icon="solar:dollar-minimalistic-bold-duotone" width={14} />
                  <Typography variant="caption" color="text.secondary">
                    {caseData.amount.toLocaleString()} {caseData.currency}
                  </Typography>
                </Stack>
                <Box sx={{ flex: 1, minWidth: 0 }} />
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
                  {isDev && onOpenDebug && (
                    <Tooltip title="Tab Debug (DEV)">
                      <IconButton size="small" sx={{ bgcolor: 'transparent', p: 0.5 }} onClick={onOpenDebug}>
                        <Iconify icon="solar:code-square-bold-duotone" width={16} />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title={t('caseDetail.copyCaseId')}>
                    <IconButton size="small" sx={{ bgcolor: 'transparent', p: 0.5 }}>
                      <Iconify icon="solar:copy-bold-duotone" width={16} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('caseDetail.openInSap')}>
                    <IconButton size="small" sx={{ bgcolor: 'transparent', p: 0.5 }}>
                      <Iconify icon="solar:external-link-bold-duotone" width={16} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            </Box>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};
