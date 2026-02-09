/**
 * Case Detail 좌측 — 라인 항목(Line Items) 카드
 * evidence.documentOrOpenItem.items[] 기반 라인별 증거 표시
 * @see docs/job/PROMPT - Case Detail 좌측 라인 항목 영역
 */

import { useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import { alpha, useTheme } from '@mui/material/styles';

import type { FiDocItem } from '../hooks/use-case-detail';

// ----------------------------------------------------------------------

export type CaseLineItemsCardProps = {
  items: FiDocItem[];
  /** BE lineCount (없으면 items.length 사용) */
  lineCount?: number;
  /** 케이스 buzei (isTarget 미제공 시 fallback 강조용) */
  targetBuzei?: string;
};

const emptyValue = '-';

const formatAmount = (
  wrbtr: number | undefined,
  dmbtr: number | undefined,
  waers: string | undefined
) => {
  const amt = wrbtr ?? dmbtr;
  if (amt == null) return emptyValue;
  const curr = waers ?? 'USD';
  return `${Number(amt).toLocaleString()} ${curr}`;
};

export const CaseLineItemsCard = ({ items, lineCount, targetBuzei }: CaseLineItemsCardProps) => {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /** BE isTarget 우선, 없으면 targetBuzei 비교 */
  const isTargetLine = (item: FiDocItem) => {
    if (item.isTarget === true) return true;
    if (!targetBuzei) return false;
    const itemBuzei = item.buzei ?? '';
    return itemBuzei === targetBuzei || String(item.buzei).trim() === String(targetBuzei).trim();
  };

  /** 상세 영역 표시 — 10개 필드 중 하나라도 있으면 펼치기 버튼 표시 */
  const hasDetailFields = (item: FiDocItem) =>
    Boolean(
      item.bschl ||
        item.shkzg ||
        item.mwskz ||
        item.kostl ||
        item.prctr ||
        item.aufnr ||
        item.zterm ||
        item.zfbdt ||
        item.zuonr ||
        item.sgtxt
    );

  const count = lineCount ?? items.length;

  if (items.length === 0) {
    return (
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
          {t('caseDetail.lineItems')} ({count})
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('caseDetail.noLineItems')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        {t('caseDetail.lineItems')} ({count})
      </Typography>
      <Stack spacing={0.5}>
        {items.map((item) => {
          const expanded = expandedIds.has(item.id);
          const isTarget = isTargetLine(item);
          const hasDetail = hasDetailFields(item);

          return (
            <Box
              key={item.id}
              sx={{
                borderRadius: 0.5,
                border: 1,
                borderColor: isTarget ? 'primary.main' : 'divider',
                bgcolor: isTarget ? alpha(theme.palette.primary.main, 0.08) : alpha(theme.palette.primary.main, 0.04),
                overflow: 'hidden',
              }}
            >
              {/* 요약 행 */}
              <Box
                sx={{
                  p: 0.75,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 0.5,
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 0 }} flexWrap="wrap">
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', minWidth: 32 }}>
                    {item.buzei ?? emptyValue}
                  </Typography>
                  <Typography variant="caption" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80 }}>
                    {item.partner ?? emptyValue}
                  </Typography>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                    {item.hkont ?? emptyValue}
                  </Typography>
                  {item.dueDate && (
                    <Typography variant="caption" color="text.secondary">
                      {item.dueDate}
                    </Typography>
                  )}
                  {(item.paymentBlock || item.disputeFlag) && (
                    <Stack direction="row" spacing={0.25}>
                      {item.paymentBlock && (
                        <Typography variant="caption" color="warning.main">
                          ⚠
                        </Typography>
                      )}
                      {item.disputeFlag && (
                        <Typography variant="caption" color="error.main">
                          !
                        </Typography>
                      )}
                    </Stack>
                  )}
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 500,
                      color: item.shkzg === 'S' ? 'error.main' : 'success.main',
                    }}
                  >
                    {(item.wrbtr != null || item.dmbtr != null)
                      ? `${item.shkzg === 'S' ? '-' : '+'}${formatAmount(item.wrbtr, item.dmbtr, item.waers)}`
                      : formatAmount(item.wrbtr, item.dmbtr, item.waers)}
                  </Typography>
                  {hasDetail && (
                    <IconButton
                      size="small"
                      onClick={() => toggleExpand(item.id)}
                      sx={{ p: 0.25 }}
                      aria-label={expanded ? 'collapse' : 'expand'}
                    >
                      <Iconify
                        icon={expanded ? 'eva:chevron-up-fill' : 'eva:chevron-down-fill'}
                        width={16}
                      />
                    </IconButton>
                  )}
                </Stack>
              </Box>

              {/* 상세(펼치기): bschl, shkzg, mwskz, kostl, prctr, aufnr, zterm, zfbdt, zuonr, sgtxt */}
              {hasDetail && (
                <Collapse in={expanded}>
                  <Box
                    sx={{
                      px: 0.75,
                      pb: 0.75,
                      pt: 0,
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                      gap: 0.5,
                    }}
                  >
                    {[
                      { key: 'bschl', label: t('caseDetail.lineItem.bschl'), val: item.bschl },
                      { key: 'shkzg', label: t('caseDetail.lineItem.shkzg'), val: item.shkzg },
                      { key: 'mwskz', label: t('caseDetail.lineItem.mwskz'), val: item.mwskz },
                      { key: 'kostl', label: t('caseDetail.lineItem.kostl'), val: item.kostl },
                      { key: 'prctr', label: t('caseDetail.lineItem.prctr'), val: item.prctr },
                      { key: 'aufnr', label: t('caseDetail.lineItem.aufnr'), val: item.aufnr },
                      { key: 'zterm', label: t('caseDetail.lineItem.zterm'), val: item.zterm },
                      { key: 'zfbdt', label: t('caseDetail.lineItem.zfbdt'), val: item.zfbdt },
                      { key: 'zuonr', label: t('caseDetail.lineItem.zuonr'), val: item.zuonr },
                      { key: 'sgtxt', label: t('caseDetail.lineItem.sgtxt'), val: item.sgtxt },
                    ].map((f) => (
                      <Box key={f.key}>
                        <Typography variant="caption" color="text.secondary">
                          {f.label}:
                        </Typography>
                        <Typography variant="caption" sx={{ ml: 0.5, fontFamily: 'monospace' }}>
                          {f.val != null && String(f.val).trim() !== '' ? f.val : emptyValue}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Collapse>
              )}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
};
