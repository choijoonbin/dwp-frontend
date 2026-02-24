/**
 * 상세 내역 그리드 — fi_doc_item (계정, 금액, 거래처, 적요)
 * 무엇이 결제되었는지 한눈에 표시
 * 위반 행: 좌측 보더 흐르는 Glow로 'AI 스캔 중' 시각화
 */

import { keyframes } from '@emotion/react';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Table from '@mui/material/Table';
import Paper from '@mui/material/Paper';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import TableContainer from '@mui/material/TableContainer';

import type { FiDocItem } from '../../cases/hooks/use-case-detail';

/** 좌측 보더 흐르는 Glow — AI에 의해 스캔 중임을 표시 */
const flowGlow = keyframes`
  0% { transform: translateY(-100%); opacity: 0.6; }
  50% { opacity: 1; }
  100% { transform: translateY(100%); opacity: 0.6; }
`;

export type WorkbenchItemDetailGridProps = {
  items: FiDocItem[];
  /** 통화 (전표 fallback) */
  currency?: string;
  /** 타겟 buzei 강조 */
  targetBuzei?: string;
};

const emptyValue = '—';

/**
 * 금액 표시 부호 기준: SAP FI shkzg (Soll/Haben)
 * - S (Soll, 차변) → 음수(−)로 표시
 * - H (Haben, 대변) → 양수로 표시
 * wrbtr/dmbtr은 보통 절대값으로 전달되고, 부호는 shkzg로 결정합니다.
 * (백엔드가 이미 부호를 포함한 금액을 보낼 경우를 위해 절대값으로 통일 후 shkzg 적용)
 */
function formatAmount(
  wrbtr: number | undefined,
  dmbtr: number | undefined,
  waers: string | undefined,
  shkzg?: string
): string {
  const raw = wrbtr ?? dmbtr;
  if (raw == null) return emptyValue;
  const amt = Math.abs(Number(raw));
  const curr = waers ?? 'USD';
  const sign = shkzg === 'S' ? '−' : '';
  return `${sign}${amt.toLocaleString()} ${curr}`;
}

export const WorkbenchItemDetailGrid = ({
  items,
  currency = 'USD',
  targetBuzei,
}: WorkbenchItemDetailGridProps) => {
  const { t } = useTranslation('common');
  const theme = useTheme();

  if (items.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'background.neutral' }}>
        <Typography variant="body2" color="text.secondary">
          {t('workbench.itemDetailEmpty')}
        </Typography>
      </Paper>
    );
  }

  const isTarget = (item: FiDocItem) => {
    if (item.isTarget === true) return true;
    if (!targetBuzei) return false;
    const buzei = item.buzei ?? '';
    return String(buzei).trim().padStart(3, '0') === String(targetBuzei).trim().padStart(3, '0');
  };

  const rowId = (item: FiDocItem) =>
    (item.buzei != null ? String(item.buzei).trim().padStart(3, '0') : null) ?? item.id;

  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{
        borderRadius: 2,
        overflow: 'auto',
        '& [data-row-id].workbench-red-glow': {
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: alpha(theme.palette.error.main, 0.08),
          borderLeft: '3px solid',
          borderLeftColor: 'error.main',
          boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.error.main, 0.35)}`,
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            background: `linear-gradient(to bottom, transparent 0%, ${theme.palette.error.main} 35%, ${theme.palette.error.main} 65%, transparent 100%)`,
            animation: `${flowGlow} 1.8s linear infinite`,
            boxShadow: `0 0 12px ${alpha(theme.palette.error.main, 0.8)}`,
          },
        },
      }}
    >
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>{t('workbench.itemDetail.buzei')}</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>{t('workbench.itemDetail.account')}</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>
              {t('workbench.itemDetail.amount')}
            </TableCell>
            <TableCell sx={{ fontWeight: 600 }}>{t('workbench.itemDetail.partner')}</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>{t('workbench.itemDetail.description')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => {
            const target = isTarget(item);
            return (
              <TableRow
                key={item.id}
                data-row-id={rowId(item)}
                className={target ? 'workbench-red-glow' : undefined}
                sx={{
                  '&:hover': {
                    bgcolor: target ? alpha(theme.palette.error.main, 0.12) : 'action.hover',
                  },
                }}
              >
                <TableCell sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                  {item.buzei ?? emptyValue}
                </TableCell>
                <TableCell sx={{ fontFamily: 'monospace' }}>{item.hkont ?? emptyValue}</TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontWeight: 500,
                    color: item.shkzg === 'S' ? 'error.main' : 'text.primary',
                  }}
                >
                  {formatAmount(item.wrbtr, item.dmbtr, item.waers ?? currency, item.shkzg)}
                </TableCell>
                <TableCell>{item.partner ?? emptyValue}</TableCell>
                <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.sgtxt ?? emptyValue}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
