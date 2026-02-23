/**
 * Re-Chunking Control
 * 청킹 전략 옵션은 GET /api/synapse/agents/catalog docTypes (key/value/description) 사용.
 */

import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useRef, useState, useEffect, useCallback } from 'react';
import { reChunkRagDocument, type ReChunkRequest, getRagDocumentChunkingStatus } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import Slider from '@mui/material/Slider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputLabel from '@mui/material/InputLabel';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';
import { alpha, useTheme } from '@mui/material/styles';
import LinearProgress from '@mui/material/LinearProgress';

// ----------------------------------------------------------------------

export type ChunkingStrategyOption = { key: string; value: string; description?: string };

interface ReChunkControlProps {
  docId: string;
  docTitle: string;
  /** catalog docTypes (key=전략 키, value=표시명, description=선택 시 설명) */
  chunkingStrategies: ChunkingStrategyOption[];
  /** 현재 적용된 전략 키 (문서 상세 API에서 오는 값) */
  currentStrategy?: string;
  currentChunkCount?: number;
  onReChunkComplete?: () => void;
}

const strategyLabel = (strategies: ChunkingStrategyOption[], key: string | undefined): string =>
  key ? (strategies.find((s) => s.key === key)?.value ?? key) : '—';

/** 청킹 상태가 "진행 중"이면 true. 그 외(COMPLETED, indexed 등)는 완료로 간주 */
const isChunkingInProgress = (status: string | undefined): boolean => {
  const u = (status ?? '').toUpperCase();
  return ['PROCESSING', 'PENDING', 'RUNNING'].includes(u) || u === 'INDEXING';
};

export function ReChunkControl({
  docId,
  docTitle,
  chunkingStrategies,
  currentStrategy,
  currentChunkCount,
  onReChunkComplete,
}: ReChunkControlProps) {
  const theme = useTheme();
  const { t } = useTranslation('common');

  const firstKey = chunkingStrategies[0]?.key ?? '';
  const [selectedStrategy, setSelectedStrategy] = useState<string>(currentStrategy ?? firstKey);
  const [chunkSize, setChunkSize] = useState(512);
  const [chunkOverlap, setChunkOverlap] = useState(50);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    if (chunkingStrategies.length > 0 && !chunkingStrategies.some((s) => s.key === selectedStrategy)) {
      setSelectedStrategy(chunkingStrategies[0].key);
    }
  }, [chunkingStrategies, selectedStrategy]);

  const handleReChunk = useCallback(async () => {
    setIsProcessing(true);
    setResult(null);

    const body: ReChunkRequest = {
      strategy: selectedStrategy,
    };

    if (selectedStrategy === 'GENERAL') {
      body.chunkSize = chunkSize;
      body.chunkOverlap = chunkOverlap;
    }

    try {
      const res = await reChunkRagDocument(docId, body);
      if (res.status === 'SUCCESS' || res.status === 'OK') {
        setResult({
          status: 'success',
          message: t('rag.rechunk.success', {
            defaultValue: '재청킹이 시작되었습니다. 완료까지 몇 분이 소요될 수 있습니다.',
          }),
        });
        onReChunkComplete?.();

        // 완료 감지: chunking-status 폴링 후 완료 시 메시지를 "재청킹이 완료되었습니다"로 변경
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        const POLL_MS = 3000;
        const MAX_POLL_MS = 10 * 60 * 1000;
        const startedAt = Date.now();
        pollIntervalRef.current = setInterval(async () => {
          if (Date.now() - startedAt > MAX_POLL_MS) {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            return;
          }
          try {
            const statusRes = await getRagDocumentChunkingStatus(docId);
            const status = statusRes?.data?.status ?? statusRes?.status;
            if (!isChunkingInProgress(status)) {
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
              setResult({
                status: 'success',
                message: t('rag.rechunk.successComplete', { defaultValue: '재청킹이 완료되었습니다.' }),
              });
              onReChunkComplete?.();
            }
          } catch {
            // 폴링 중 오류는 무시, 다음 주기에 재시도
          }
        }, POLL_MS);
      } else {
        setResult({
          status: 'error',
          message: res.message || t('rag.rechunk.failed', { defaultValue: '재청킹에 실패했습니다.' }),
        });
      }
    } catch (err) {
      setResult({
        status: 'error',
        message: err instanceof Error ? err.message : t('rag.rechunk.failed', { defaultValue: '재청킹에 실패했습니다.' }),
      });
    } finally {
      setIsProcessing(false);
    }
  }, [docId, selectedStrategy, chunkSize, chunkOverlap, onReChunkComplete, t]);

  const isChanged = currentStrategy === undefined || selectedStrategy !== currentStrategy;

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Iconify icon="solar:settings-bold-duotone" width={20} sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {t('rag.rechunk.title', { defaultValue: '청킹 전략 설정' })}
            </Typography>
          </Stack>

          <Box
            sx={{
              p: 1.5,
              borderRadius: 1,
              bgcolor: alpha(theme.palette.info.main, 0.08),
              border: `1px solid ${alpha(theme.palette.info.main, 0.24)}`,
            }}
          >
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              <Typography variant="caption" color="text.secondary">
                {t('rag.rechunk.currentDoc', { defaultValue: '문서' })}:
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {docTitle}
              </Typography>
              <Chip
                label={strategyLabel(chunkingStrategies, currentStrategy)}
                size="small"
                color="info"
                variant="filled"
              />
              {currentChunkCount != null && (
                <Typography variant="caption" color="text.secondary">
                  ({currentChunkCount} {t('rag.rechunk.chunks', { defaultValue: '청크' })})
                </Typography>
              )}
            </Stack>
          </Box>

          <FormControl fullWidth size="small">
            <InputLabel>{t('rag.rechunk.strategyLabel', { defaultValue: '청킹 전략' })}</InputLabel>
            <Select
              value={selectedStrategy}
              label={t('rag.rechunk.strategyLabel', { defaultValue: '청킹 전략' })}
              onChange={(e) => setSelectedStrategy(e.target.value)}
              disabled={isProcessing}
            >
              {chunkingStrategies.map((s) => (
                <MenuItem key={s.key} value={s.key}>
                  {s.value}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {(() => {
            const selected = chunkingStrategies.find((s) => s.key === selectedStrategy);
            return selected?.description ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: -1 }}>
                {selected.description}
              </Typography>
            ) : null;
          })()}

          {selectedStrategy === 'GENERAL' && (
            <Box sx={{ px: 1 }}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    {t('rag.rechunk.chunkSize', { defaultValue: '청크 크기 (토큰)' })}: {chunkSize}
                  </Typography>
                  <Slider
                    value={chunkSize}
                    onChange={(_, val) => setChunkSize(val as number)}
                    min={128}
                    max={2048}
                    step={64}
                    marks={[
                      { value: 128, label: '128' },
                      { value: 512, label: '512' },
                      { value: 1024, label: '1K' },
                      { value: 2048, label: '2K' },
                    ]}
                    disabled={isProcessing}
                  />
                </Box>
                <TextField
                  label={t('rag.rechunk.chunkOverlap', { defaultValue: '청크 오버랩 (토큰)' })}
                  type="number"
                  size="small"
                  value={chunkOverlap}
                  onChange={(e) => setChunkOverlap(Number(e.target.value))}
                  inputProps={{ min: 0, max: 200, step: 10 }}
                  disabled={isProcessing}
                />
              </Stack>
            </Box>
          )}

          {isProcessing && (
            <Box>
              <LinearProgress />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {t('rag.rechunk.processing', { defaultValue: '재청킹 중... 잠시만 기다려 주세요.' })}
              </Typography>
            </Box>
          )}

          {result && (
            <Alert severity={result.status === 'success' ? 'success' : 'error'}>
              {result.message}
            </Alert>
          )}

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button
              variant="contained"
              color="primary"
              startIcon={<Iconify icon="solar:refresh-bold" width={18} />}
              onClick={handleReChunk}
              disabled={isProcessing || !isChanged || chunkingStrategies.length === 0}
            >
              {t('rag.rechunk.apply', { defaultValue: '재청킹 실행' })}
            </Button>
          </Stack>

          {isChanged && (
            <Alert severity="warning" icon={<Iconify icon="solar:danger-triangle-bold" width={20} />}>
              <Typography variant="caption">
                {t('rag.rechunk.warning', {
                  defaultValue:
                    '청킹 전략을 변경하면 기존 청크가 삭제되고 새로운 전략으로 재생성됩니다. 진행 중인 검색에 일시적으로 영향을 줄 수 있습니다.',
                })}
              </Typography>
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
