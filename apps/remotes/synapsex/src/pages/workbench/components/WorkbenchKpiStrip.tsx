/**
 * Batch Commander — 상단 KPI 섹션 (4개 스태츠 카드)
 * 듀얼 모드: 케이스 미선택 시 배치 통계, 선택 시 해당 케이스 통계 (카운트업 애니메이션)
 */

import type { Theme, SxProps } from '@mui/material/styles';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

import { Iconify } from '@dwp-frontend/design-system';

const COUNT_UP_MS = 400;
const COUNT_UP_TICK_MS = 32;

function useCountUp(value: number, active: boolean): number {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  useEffect(() => {
    if (!active) {
      prevRef.current = value;
      setDisplay(value);
      return;
    }
    const start = prevRef.current;
    const diff = value - start;
    if (diff === 0) return;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / COUNT_UP_MS);
      const eased = 1 - (1 - progress) ** 2;
      const next = Math.round(start + diff * eased);
      setDisplay(diff > 0 ? Math.min(next, value) : Math.max(next, value));
      if (progress < 1) requestAnimationFrame(tick);
      else prevRef.current = value;
    };
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [value, active]);
  return active ? display : value;
}

export type WorkbenchKpiStripProps = {
  /** 배치 모드: true면 오늘/전체 배치 통계, false면 현재 케이스 통계 */
  batchMode?: boolean;
  /** 총 검토 전표 수 (배치: 전체 케이스 수 등, 케이스: fi_doc_items.length) */
  totalVouchers: number;
  /** 고위험 탐지 건 */
  highRiskCount: number;
  /** 진행률 0–100 */
  progressPercent: number;
  /** 절감 예상액 (미제공 시 —) */
  savingsEstimate?: number | string | null;
  /** 통화 코드 */
  currency?: string;
  /** 카운트업 애니메이션 사용 (케이스 선택 시 전환 시) */
  animateCountUp?: boolean;
  sx?: SxProps<Theme>;
};

export const WorkbenchKpiStrip = ({
  batchMode = false,
  totalVouchers,
  highRiskCount,
  progressPercent,
  savingsEstimate,
  currency = 'KRW',
  animateCountUp = true,
  sx,
}: WorkbenchKpiStripProps) => {
  const { t } = useTranslation('common');
  const theme = useTheme();

  const displayTotal = useCountUp(totalVouchers, animateCountUp);
  const displayRisks = useCountUp(highRiskCount, animateCountUp);
  const displayProgress = useCountUp(Math.round(progressPercent), animateCountUp);

  const savingsDisplay =
    savingsEstimate != null && savingsEstimate !== ''
      ? typeof savingsEstimate === 'number'
        ? `${Number(savingsEstimate).toLocaleString()} ${currency}`
        : String(savingsEstimate)
      : '—';

  const cards: Array<{
    labelKey: string;
    value: string | number;
    icon: string;
    color: 'primary' | 'error' | 'warning' | 'success';
  }> = [
    { labelKey: batchMode ? 'workbench.kpiBatchTotalVouchers' : 'workbench.kpiTotalVouchers', value: displayTotal, icon: 'solar:document-text-bold-duotone', color: 'primary' },
    { labelKey: batchMode ? 'workbench.kpiBatchRiskCount' : 'workbench.kpiHighRiskCount', value: displayRisks, icon: 'solar:danger-triangle-bold-duotone', color: 'error' },
    { labelKey: 'workbench.kpiProgressPercent', value: `${displayProgress}%`, icon: 'solar:graph-up-bold-duotone', color: 'warning' },
    { labelKey: 'workbench.kpiSavingsEstimate', value: savingsDisplay, icon: 'solar:wallet-money-bold-duotone', color: 'success' },
  ];

  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{
        flexShrink: 0,
        overflowX: 'auto',
        pb: 0.5,
        ...sx,
      }}
    >
      {cards.map((card) => (
        <Card
          key={card.labelKey}
          variant="outlined"
          sx={{
            minWidth: 140,
            flex: 1,
            p: 1.5,
            bgcolor: alpha(theme.palette[card.color].main, 0.06),
            borderColor: alpha(theme.palette[card.color].main, 0.2),
            borderRadius: 2,
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: alpha(theme.palette[card.color].main, 0.12),
                color: `${card.color}.main`,
              }}
            >
              <Iconify icon={card.icon} width={20} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                {t(card.labelKey)}
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: `${card.color}.dark` }}>
                {card.value}
              </Typography>
            </Box>
          </Stack>
        </Card>
      ))}
    </Stack>
  );
};
