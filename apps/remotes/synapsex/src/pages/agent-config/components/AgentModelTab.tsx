import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Radio from '@mui/material/Radio';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import IconButton from '@mui/material/IconButton';
import { Iconify } from '@dwp-frontend/design-system';

type AgentModelTabProps = {
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

const parseModelLabel = (label: string) => {
  const match = label.match(/^(.*?)(?:\s*\((.+)\))?$/);
  return {
    name: (match?.[1] ?? label).trim(),
    badge: match?.[2]?.trim() ?? '',
  };
};

const temperatureTone = (value: number) => {
  if (value <= 0.3) return '일관적/논리적';
  if (value <= 1.0) return '균형 잡힌';
  if (value < 1.2) return '풍부한';
  return '창의적/다양함';
};

export const AgentModelTab = ({
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
  const selectedMeta = selectedEngine ? parseModelLabel(selectedEngine.label) : null;
  return (
    <Box sx={{ p: 3 }}>
      <Card variant="outlined">
        <CardHeader title="기본 설정" />
        <CardContent>
          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                {t('agentConfig.modelSettings')} ({t('agentConfig.modelSettingsDesc')})
              </Typography>
              <Stack spacing={2}>
                <FormControl fullWidth>
                  <Box
                    id="agent-engine-label"
                    sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mb: 1 }}
                  >
                    <Typography variant="subtitle2">{t('agentConfig.providerModel')}</Typography>
                    <Tooltip title="모델별 성능과 특성이 다를 수 있습니다.">
                      <IconButton size="small" aria-label="모델 도움말">
                        <Iconify icon="solar:question-circle-bold" width={16} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Select
                    id="agent-engine-select"
                    labelId="agent-engine-label"
                    value={engineKey}
                    label={t('agentConfig.providerModel')}
                    onChange={(e) => onEngineChange(e.target.value)}
                  >
                    {engines.map((eng) => (
                      <MenuItem key={eng.key} value={eng.key}>{eng.label}</MenuItem>
                    ))}
                  </Select>
                  {selectedMeta && (
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {selectedMeta.name}
                      </Typography>
                      {selectedMeta.badge && (
                        <Tooltip title={selectedEngine?.label ?? selectedMeta.badge}>
                          <Chip size="small" label={selectedMeta.badge} />
                        </Tooltip>
                      )}
                    </Stack>
                  )}
                </FormControl>
                {domains.length > 0 && (
                  <FormControl component="fieldset">
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>도메인</Typography>
                    <RadioGroup
                      row
                      name="agent-domain"
                      aria-label="도메인"
                      value={domainKey}
                      onChange={(e) => onDomainChange(e.target.value)}
                    >
                      {domains.map((d) => (
                        <FormControlLabel key={d.key} value={d.key} control={<Radio />} label={d.label} />
                      ))}
                    </RadioGroup>
                  </FormControl>
                )}
              </Stack>
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                추론 파라미터
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography gutterBottom sx={{ fontWeight: 600 }}>
                      {t('agentConfig.temperature')} — {temperature}
                    </Typography>
                    <Tooltip title="값이 낮을수록 정해진 사실에 충실하며, 높을수록 답변이 풍부하고 창의적입니다.">
                      <IconButton size="small" aria-label="온도 도움말">
                        <Iconify icon="solar:question-circle-bold" width={16} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                  <Slider
                    aria-label={t('agentConfig.temperature')}
                    value={temperature}
                    min={0}
                    max={2}
                    step={0.1}
                    valueLabelDisplay="auto"
                    onChange={(_, value) => onTemperatureChange(value as number)}
                    marks={[{ value: 0, label: '0' }, { value: 1, label: '1' }, { value: 2, label: '2' }]}
                    sx={{ maxWidth: 400 }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    현재 설정: {temperatureTone(temperature)}
                  </Typography>
                  {domainKey === 'FINANCE' && (
                    <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
                      보수적 답변 권장(0.2)
                    </Typography>
                  )}
                </Box>
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography gutterBottom sx={{ fontWeight: 600 }}>
                      최대 토큰
                    </Typography>
                    <Tooltip title="AI가 한 번에 생성할 수 있는 답변의 최대 길이를 제한합니다. 값이 클수록 긴 답변이 가능하지만 응답 속도가 느려질 수 있습니다.">
                      <IconButton size="small" aria-label="최대 토큰 도움말">
                        <Iconify icon="solar:question-circle-bold" width={16} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                  <TextField
                    type="number"
                    size="small"
                    value={maxTokens}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      if (Number.isNaN(next)) return;
                      onMaxTokensChange(Math.min(MAX_TOKENS_MAX, Math.max(MAX_TOKENS_MIN, next)));
                    }}
                    inputProps={{ min: MAX_TOKENS_MIN, max: MAX_TOKENS_MAX, step: 1 }}
                    helperText={`입력 범위: ${MAX_TOKENS_MIN} ~ ${MAX_TOKENS_MAX} (기본값 4096)`}
                    sx={{ maxWidth: 280 }}
                  />
                </Box>
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};
