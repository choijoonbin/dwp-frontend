/**
 * Agent Studio — 모델 탭: Two-Column Layout (7:5)
 * 좌: Configuration 폼 | 우: Configuration Spec Card (실시간 요약)
 */

import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Slider from '@mui/material/Slider';
import Select from '@mui/material/Select';
import Tooltip from '@mui/material/Tooltip';
import { alpha } from '@mui/material/styles';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';
import LinearProgress from '@mui/material/LinearProgress';

type AgentModelTabProps = {
  hasSelectedAgent?: boolean;
  engines: { key: string; label: string }[];
  engineKey: string;
  onEngineChange: (key: string) => void;
  domains: { key: string; label: string }[];
  domainKey: string;
  onDomainChange: (key: string) => void;
  temperature: number;
  onTemperatureChange: (value: number) => void;
  maxTokens: number;
  onMaxTokensChange: (value: number) => void;
};

const MAX_TOKENS_MIN = 1024;
const MAX_TOKENS_MAX = 128000;
const CONTEXT_WINDOW = 128000;

const getProviderIcon = (key: string): string => {
  const k = key.toLowerCase();
  if (k.startsWith('gpt') || k.includes('openai')) return 'simple-icons:openai';
  if (k.startsWith('claude') || k.includes('anthropic')) return 'simple-icons:anthropic';
  if (k.includes('azure')) return 'simple-icons:microsoftazure';
  return 'solar:cpu-bold-duotone';
};

const temperatureTone = (value: number): string => {
  if (value <= 0.3) return '일관적/논리적';
  if (value <= 1.0) return '균형 잡힌';
  if (value < 1.2) return '풍부한';
  return '창의적/다양함';
};

const temperatureCreativeLevel = (value: number): 'Low' | 'Medium' | 'High' => {
  if (value <= 0.3) return 'Low';
  if (value <= 1.0) return 'Medium';
  return 'High';
};

const maxTokensResponseLevel = (tokens: number): 'Short' | 'Medium' | 'Long' => {
  if (tokens <= 4096) return 'Short';
  if (tokens <= 32768) return 'Medium';
  return 'Long';
};

const getSummaryInsight = (
  temperature: number,
  maxTokens: number,
  domainLabel: string
): string => {
  const creative = temperatureCreativeLevel(temperature);
  const response = maxTokensResponseLevel(maxTokens);
  if (creative === 'Low' && response === 'Short') {
    return '이 에이전트는 빠른 응답 속도와 논리적 일관성에 최적화되어 있습니다.';
  }
  if (creative === 'High' && response === 'Long') {
    return '이 에이전트는 창의적이고 상세한 분석을 제공하도록 구성되어 있습니다.';
  }
  if (creative === 'Low') {
    return '이 에이전트는 사실 기반 답변과 정확한 인용에 중점을 둡니다.';
  }
  if (response === 'Long') {
    return '이 에이전트는 맥락이 풍부한 긴 응답을 생성하도록 설정되어 있습니다.';
  }
  return '이 에이전트는 균형 잡힌 응답과 적절한 상세도를 제공합니다.';
};

export const AgentModelTab = ({
  hasSelectedAgent = true,
  engines,
  engineKey,
  onEngineChange,
  domains,
  domainKey,
  onDomainChange,
  temperature,
  onTemperatureChange,
  maxTokens,
  onMaxTokensChange,
}: AgentModelTabProps) => {
  const { t } = useTranslation('common');
  const selectedEngine = engines.find((eng) => eng.key === engineKey);
  const selectedDomain = domains.find((d) => d.key === domainKey);
  const contextRatio = Math.min(100, (maxTokens / CONTEXT_WINDOW) * 100);
  const creativeLevel = temperatureCreativeLevel(temperature);
  const responseLevel = maxTokensResponseLevel(maxTokens);

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 7fr) minmax(0, 5fr)' },
          gap: { xs: 2, md: 4 },
          alignItems: 'stretch',
          '& > *': { minHeight: 0 },
        }}
      >
        {/* 좌측: Configuration (7) */}
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Stack spacing={{ xs: 2, md: 3 }}>
            {/* 모델 & 도메인 섹션 */}
            <Card
              variant="outlined"
              sx={{
                boxShadow: (theme) => theme.shadows[1],
                borderRadius: 2,
                '& .MuiCardHeader-root': { minHeight: 72 },
              }}
            >
              <CardHeader
                title={
                  <Stack direction="row" alignItems="baseline" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    <Typography variant="h5" component="span">
                      {t('agentConfig.modelSettings')}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" component="span">
                      ({t('agentConfig.modelSettingsDesc')})
                    </Typography>
                  </Stack>
                }
                sx={{ pb: 0 }}
              />
              <CardContent sx={{ pt: 1 }}>
                <Stack spacing={2.5}>
                  <Box sx={{ width: '100%', maxWidth: 480 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel id="agent-engine-label">{t('agentConfig.providerModel')}</InputLabel>
                      <Select
                      id="agent-engine-select"
                      labelId="agent-engine-label"
                      value={engineKey}
                      label={t('agentConfig.providerModel')}
                      onChange={(e) => onEngineChange(e.target.value)}
                      renderValue={(val) => {
                        const eng = engines.find((e) => e.key === val);
                        if (!eng) return val;
                        return (
                          <Stack direction="row" alignItems="center" spacing={1.5}>
                            <Iconify
                              icon={getProviderIcon(eng.key)}
                              width={24}
                              sx={{ color: 'text.secondary' }}
                            />
                            <Typography variant="body2">{eng.label}</Typography>
                          </Stack>
                        );
                      }}
                    >
                      {engines.map((eng) => (
                        <MenuItem key={eng.key} value={eng.key}>
                          <Stack direction="row" alignItems="center" spacing={1.5}>
                            <Iconify
                              icon={getProviderIcon(eng.key)}
                              width={20}
                              sx={{ color: 'text.secondary' }}
                            />
                            <span>{eng.label}</span>
                          </Stack>
                        </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                  {domains.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        도메인
                      </Typography>
                      <Stack direction="row" flexWrap="wrap" gap={1}>
                        {domains.map((d) => (
                          <Chip
                            key={d.key}
                            label={d.label}
                            onClick={() => onDomainChange(d.key)}
                            color={domainKey === d.key ? 'primary' : 'default'}
                            variant={domainKey === d.key ? 'filled' : 'outlined'}
                            sx={{ borderRadius: 1.5 }}
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>

            {/* 추론 파라미터 섹션 */}
            <Card
              variant="outlined"
              sx={{
                boxShadow: (theme) => theme.shadows[1],
                borderRadius: 2,
                '& .MuiCardHeader-root': { minHeight: 72 },
              }}
            >
              <CardHeader title="추론 파라미터" sx={{ pb: 0 }} />
              <CardContent sx={{ pt: 1 }}>
                <Stack spacing={3}>
                  {/* Temperature: 그라데이션 슬라이더 */}
                  <Box sx={{ maxWidth: 400 }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {t('agentConfig.temperature')} — {temperature}
                      </Typography>
                      <Tooltip title="값이 낮을수록 정해진 사실에 충실하며, 높을수록 답변이 풍부하고 창의적입니다.">
                        <IconButton size="small" aria-label="온도 도움말">
                          <Iconify icon="solar:question-circle-bold" width={16} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                    <Box
                      sx={{
                        position: 'relative',
                        borderRadius: 1,
                        overflow: 'hidden',
                        py: 2,
                        px: 3.5,
                        background: (theme) =>
                          `linear-gradient(90deg, ${alpha(theme.palette.info.main, 0.15)} 0%, ${alpha(theme.palette.success.main, 0.12)} 35%, ${alpha(theme.palette.warning.main, 0.12)} 65%, ${alpha(theme.palette.warning.main, 0.2)} 100%)`,
                        '& .MuiSlider-markLabel': { fontSize: '0.75rem' },
                      }}
                    >
                      <Slider
                        aria-label={t('agentConfig.temperature')}
                        value={temperature}
                        min={0}
                        max={2}
                        step={0.1}
                        valueLabelDisplay="auto"
                        onChange={(_, value) => onTemperatureChange(value as number)}
                        marks={[
                          { value: 0, label: '0' },
                          { value: 1, label: '1' },
                          { value: 2, label: '2' },
                        ]}
                        sx={{
                          '& .MuiSlider-rail': { opacity: 0.3 },
                          '& .MuiSlider-track': { height: 8, borderRadius: 1 },
                          '& .MuiSlider-thumb': { width: 20, height: 20 },
                        }}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      현재: {temperatureTone(temperature)}
                    </Typography>
                    {domainKey === 'FINANCE' && (
                      <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
                        보수적 답변 권장 (0.2)
                      </Typography>
                    )}
                  </Box>

                  {/* Max Tokens: 프로그레스 바 */}
                  <Box sx={{ maxWidth: 400 }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {t('agentConfig.maxTokens')}
                      </Typography>
                      <Tooltip title="AI가 한 번에 생성할 수 있는 답변의 최대 길이를 제한합니다.">
                        <IconButton size="small" aria-label="최대 토큰 도움말">
                          <Iconify icon="solar:question-circle-bold" width={16} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <TextField
                        type="number"
                        size="small"
                        value={maxTokens}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          if (Number.isNaN(next)) return;
                          onMaxTokensChange(
                            Math.min(MAX_TOKENS_MAX, Math.max(MAX_TOKENS_MIN, next))
                          );
                        }}
                        inputProps={{ min: MAX_TOKENS_MIN, max: MAX_TOKENS_MAX, step: 1 }}
                        sx={{ width: 120 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        / {CONTEXT_WINDOW.toLocaleString()}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={contextRatio}
                      sx={{
                        mt: 1,
                        height: 6,
                        borderRadius: 1,
                        bgcolor: 'action.hover',
                        '& .MuiLinearProgress-bar': { borderRadius: 1 },
                      }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {t('agentConfig.contextWindowRatio', {
                        percent: contextRatio.toFixed(1),
                      })}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Box>

        {/* 우측: Configuration Spec Card (5) */}
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Card
            variant="outlined"
            sx={{
              flex: 1,
              minHeight: 320,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: (theme) => theme.shadows[1],
              borderRadius: 2,
              bgcolor: 'background.paper',
              '& .MuiCardHeader-root': { minHeight: 72 },
            }}
          >
            <CardHeader
              title={
                <Stack direction="row" alignItems="baseline" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  <Typography variant="h5" component="span">
                    {t('agentConfig.modelSpecTitle')}
                  </Typography>
                  <Typography variant="body1" color="text.secondary" component="span">
                    ({t('agentConfig.modelSpecSubheader')})
                  </Typography>
                </Stack>
              }
              sx={{ pb: 0 }}
            />
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', pt: 1 }}>
              {!hasSelectedAgent ? (
                <Box
                  sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    py: 6,
                    px: 2,
                  }}
                >
                  <Iconify
                    icon="solar:user-id-bold-duotone"
                    width={64}
                    sx={{ color: 'text.disabled', mb: 2 }}
                  />
                  <Typography variant="body2" color="text.secondary" align="center">
                    {t('agentConfig.selectAgentPrompt')}
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={2}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      모델
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      {selectedEngine && (
                        <>
                          <Iconify
                            icon={getProviderIcon(selectedEngine.key)}
                            width={20}
                            sx={{ color: 'text.secondary' }}
                          />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {selectedEngine.label}
                          </Typography>
                        </>
                      )}
                    </Stack>
                  </Stack>
                  {selectedDomain && (
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body2" color="text.secondary">
                        도메인
                      </Typography>
                      <Chip
                        label={selectedDomain.label}
                        size="small"
                        variant="outlined"
                        sx={{ borderRadius: 1 }}
                      />
                    </Stack>
                  )}
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      {t('agentConfig.creativeLevel')}
                    </Typography>
                    <Chip
                      label={creativeLevel}
                      size="small"
                      color={creativeLevel === 'High' ? 'warning' : creativeLevel === 'Medium' ? 'info' : 'default'}
                      variant="outlined"
                      sx={{ borderRadius: 1 }}
                    />
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      {t('agentConfig.maxResponse')}
                    </Typography>
                    <Chip
                      label={responseLevel}
                      size="small"
                      color={responseLevel === 'Long' ? 'success' : responseLevel === 'Medium' ? 'info' : 'default'}
                      variant="outlined"
                      sx={{ borderRadius: 1 }}
                    />
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      Temperature
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {temperature}
                    </Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      Max Tokens
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {maxTokens.toLocaleString()}
                    </Typography>
                  </Stack>
                  <Box
                    sx={{
                      mt: 1,
                      pt: 2,
                      borderTop: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        fontStyle: 'italic',
                        lineHeight: 1.6,
                      }}
                    >
                      {getSummaryInsight(
                        temperature,
                        maxTokens,
                        selectedDomain?.label ?? ''
                      )}
                    </Typography>
                  </Box>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};
