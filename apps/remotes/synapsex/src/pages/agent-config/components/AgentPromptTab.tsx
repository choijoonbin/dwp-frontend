/**
 * Agent Studio — 프롬프트 탭: 시스템 지침 편집기 + 변수 가이드
 * Aura 런타임 치환 변수: {context}, {code} 만 사용. 가이드는 Aura와 동기화됨.
 * @see docs/reference/AGENT_STUDIO_CONTRACT_AND_BE_COLLABORATION.md §4, §6.7
 */

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';

import { useTranslation } from '@dwp-frontend/shared-i18n';

/** Aura 엔진에서 실제 치환하는 변수 (front.txt Aura 답변 기준) */
const RUNTIME_VARIABLE_GUIDE = [
  '{context} — 런타임에 context dict를 문자열로 치환 (아래 키들 사용)',
  '{code} — code_review 도메인에서만 치환',
];

/** context dict 키 (Aura가 사용하는 키 → 치환 문구) */
const CONTEXT_KEYS_GUIDE = [
  'activeApp, selectedItemIds, url, path, title',
  'itemId, caseId, documentIds, entityIds, openItemIds, metadata',
];

type AgentPromptTabProps = {
  systemPrompt: string;
  onSystemPromptChange: (value: string) => void;
};

export const AgentPromptTab = ({ systemPrompt, onSystemPromptChange }: AgentPromptTabProps) => {
  const { t } = useTranslation('common');
  return (
    <Box sx={{ p: 3 }}>
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} sx={{ alignItems: 'stretch' }}>
        <Card variant="outlined" sx={{ flex: { lg: '2 1 0%' } }}>
          <CardHeader title={t('agentConfig.prompts')} subheader={t('agentConfig.promptTemplatesDesc')} />
          <CardContent>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              {t('agentConfig.template')} — 저장하지 않아도 테스트 채팅에서 미리보기 가능
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={14}
              maxRows={24}
              id="agent-system-prompt"
              name="systemPrompt"
              label={t('agentConfig.prompts')}
              value={systemPrompt}
              onChange={(e) => onSystemPromptChange(e.target.value)}
              placeholder="SYSTEM: You are..."
              sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: 1.5 } }}
            />
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ flex: { lg: '1 1 0%' }, maxHeight: 420 }}>
          <CardHeader title={t('agentConfig.promptVariableGuideTitle')} subheader={t('agentConfig.promptVariableGuideSubheader')} />
          <CardContent>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              {t('agentConfig.promptVariableGuideAuraNote')}
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5, '& li': { mb: 1 } }}>
              {RUNTIME_VARIABLE_GUIDE.map((line) => (
                <Typography key={line} component="li" variant="body2" color="text.secondary">
                  <Box component="span" sx={{ fontFamily: 'monospace', color: 'text.primary' }}>
                    {line}
                  </Box>
                </Typography>
              ))}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5, fontWeight: 600 }}>
              context 키:
            </Typography>
            {CONTEXT_KEYS_GUIDE.map((line) => (
              <Typography key={line} variant="caption" color="text.secondary" component="div" sx={{ fontFamily: 'monospace', mt: 0.5 }}>
                {line}
              </Typography>
            ))}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};
