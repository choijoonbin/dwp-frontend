/**
 * Re-Chunking Control
 * 관리자가 문서별로 청킹 전략을 변경하고 재벡터화할 수 있는 컨트롤러
 */

import { useState, useCallback } from 'react';

import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import {
  reChunkRagDocument,
  CHUNKING_STRATEGY_INFO,
  type ChunkingStrategy,
  type ReChunkRequest,
} from '@dwp-frontend/shared-utils';

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
import LinearProgress from '@mui/material/LinearProgress';
import { alpha, useTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------

interface ReChunkControlProps {
  docId: string;
  docTitle: string;
  currentStrategy?: ChunkingStrategy;
  currentChunkCount?: number;
  onReChunkComplete?: () => void;
}

const STRATEGIES: ChunkingStrategy[] = ['REGULATION', 'MANUAL', 'POLICY', 'GENERAL', 'SEMANTIC'];

export function ReChunkControl({
  docId,
  docTitle,
  currentStrategy = 'GENERAL',
  currentChunkCount,
  onReChunkComplete,
}: ReChunkControlProps) {
  const theme = useTheme();
  const { t } = useTranslation('common');

  const [selectedStrategy, setSelectedStrategy] = useState<ChunkingStrategy>(currentStrategy);
  const [chunkSize, setChunkSize] = useState(512);
  const [chunkOverlap, setChunkOverlap] = useState(50);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null);

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

  const strategyInfo = CHUNKING_STRATEGY_INFO[selectedStrategy];
  const isChanged = selectedStrategy !== currentStrategy;

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2.5}>
          {/* Header */}
          <Stack direction="row" spacing={1} alignItems="center">
            <Iconify icon="solar:settings-bold-duotone" width={20} sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {t('rag.rechunk.title', { defaultValue: '청킹 전략 설정' })}
            </Typography>
          </Stack>

          {/* Current Status */}
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
                label={CHUNKING_STRATEGY_INFO[currentStrategy]?.label || currentStrategy}
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

          {/* Strategy Selector */}
          <FormControl fullWidth size="small">
            <InputLabel>{t('rag.rechunk.strategyLabel', { defaultValue: '청킹 전략' })}</InputLabel>
            <Select
              value={selectedStrategy}
              label={t('rag.rechunk.strategyLabel', { defaultValue: '청킹 전략' })}
              onChange={(e) => setSelectedStrategy(e.target.value as ChunkingStrategy)}
              disabled={isProcessing}
            >
              {STRATEGIES.map((strategy) => (
                <MenuItem key={strategy} value={strategy}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {CHUNKING_STRATEGY_INFO[strategy].label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      — {CHUNKING_STRATEGY_INFO[strategy].description}
                    </Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Strategy Description */}
          {strategyInfo && (
            <Alert severity="info" icon={<Iconify icon="solar:info-circle-bold" width={20} />}>
              <Typography variant="body2">{strategyInfo.description}</Typography>
            </Alert>
          )}

          {/* GENERAL 전략 추가 옵션 */}
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

          {/* Processing Indicator */}
          {isProcessing && (
            <Box>
              <LinearProgress />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {t('rag.rechunk.processing', { defaultValue: '재청킹 중... 잠시만 기다려 주세요.' })}
              </Typography>
            </Box>
          )}

          {/* Result */}
          {result && (
            <Alert severity={result.status === 'success' ? 'success' : 'error'}>
              {result.message}
            </Alert>
          )}

          {/* Actions */}
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button
              variant="contained"
              color="primary"
              startIcon={<Iconify icon="solar:refresh-bold" width={18} />}
              onClick={handleReChunk}
              disabled={isProcessing || !isChanged}
            >
              {t('rag.rechunk.apply', { defaultValue: '재청킹 실행' })}
            </Button>
          </Stack>

          {/* Warning */}
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
