/**
 * Agent Studio — 프롬프트 탭: 시스템 지침 편집기 + 변수 가이드 (Enterprise)
 * Aura 런타임 치환 변수: {context}, {code}. 클릭 시 커서 위치에 삽입.
 * @see docs/reference/AGENT_STUDIO_CONTRACT_AND_BE_COLLABORATION.md §4, §6.7
 */

import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useRef, useState, useEffect, useCallback } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { getUserId, getAgentContext } from '@dwp-frontend/shared-utils';
import { oneLight, vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { useTheme } from '@mui/material/styles';
import CardHeader from '@mui/material/CardHeader';
import InputLabel from '@mui/material/InputLabel';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';

/** Aura 런타임 변수 + 설명 */
const RUNTIME_VARIABLES = [
  { token: '{context}', desc: '런타임에 context dict를 문자열로 치환' },
  { token: '{code}', desc: 'code_review 도메인에서만 치환' },
] as const;

/** context dict 키 (클릭 시 삽입) */
const CONTEXT_KEYS = [
  'activeApp',
  'selectedItemIds',
  'url',
  'path',
  'title',
  'itemId',
  'caseId',
  'documentIds',
  'entityIds',
  'openItemIds',
  'metadata',
] as const;

/** 템플릿 프리셋 */
const PROMPT_TEMPLATES: { key: string; label: string; content: string }[] = [
  {
    key: 'default',
    label: '기본 (재무 요약)',
    content: `SYSTEM: You are a safe enterprise finance agent.

INPUT: {context}

TASK: Produce (1) summary, (2) evidence table, (3) proposed actions with guardrail checks.
(케이스 정보는 런타임에 context에 caseId, documentIds 등으로 전달됩니다.)`,
  },
  {
    key: 'code-review',
    label: '코드 리뷰',
    content: `SYSTEM: You are a code review assistant.

INPUT: {context}
CODE: {code}

TASK: Analyze the code and provide structured feedback (security, style, performance).`,
  },
  {
    key: 'custom',
    label: '사용자 정의',
    content: '',
  },
];

type AgentPromptTabProps = {
  systemPrompt: string;
  onSystemPromptChange: (value: string) => void;
  /** 저장 성공 시 부모가 증가. 이 값 변경 시 버전 기록 */
  saveSuccessCount?: number;
};

export const AgentPromptTab = ({
  systemPrompt,
  onSystemPromptChange,
  saveSuccessCount = 0,
}: AgentPromptTabProps) => {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [templateKey, setTemplateKey] = useState(PROMPT_TEMPLATES[0].key);
  const [version, setVersion] = useState(1);
  const [lastModifiedBy, setLastModifiedBy] = useState<string | null>(null);
  const [lastModifiedAt, setLastModifiedAt] = useState<string | null>(null);

  const isDark = theme.palette.mode === 'dark';
  const prismStyle = isDark ? vscDarkPlus : oneLight;

  const insertAtCursor = useCallback(
    (text: string) => {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const before = systemPrompt.slice(0, start);
      const after = systemPrompt.slice(end);
      const next = before + text + after;
      onSystemPromptChange(next);
      requestAnimationFrame(() => {
        const pos = start + text.length;
        el.setSelectionRange(pos, pos);
        el.focus();
      });
    },
    [systemPrompt, onSystemPromptChange]
  );

  useEffect(() => {
    if (saveSuccessCount > 0) {
      setVersion((v) => Math.round(v * 10 + 1) / 10);
      setLastModifiedBy(getUserId() ?? 'unknown');
      setLastModifiedAt(new Date().toISOString());
    }
  }, [saveSuccessCount]);

  const handleTemplateChange = (key: string) => {
    setTemplateKey(key);
    const tpl = PROMPT_TEMPLATES.find((template) => template.key === key);
    if (tpl && tpl.content) onSystemPromptChange(tpl.content);
    // 'custom' 선택 시 기존 내용 유지 (덮어쓰지 않음)
  };

  const contextSample = getAgentContext();
  const lineCount = Math.max(14, systemPrompt.split('\n').length);

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
        {/* 좌측: 편집기 (7) */}
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Card
            variant="outlined"
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              boxShadow: (muiTheme) => muiTheme.shadows[1],
              borderRadius: 2,
              bgcolor: 'background.paper',
              '& .MuiCardHeader-root': { minHeight: 72 },
            }}
          >
            <CardHeader
              title={t('agentConfig.prompts')}
              subheader={t('agentConfig.promptTemplatesDesc')}
              action={
                <FormControl size="small" sx={{ minWidth: 180, display: { xs: 'none', md: 'flex' } }}>
                  <InputLabel id="prompt-template-label">프롬프트 템플릿</InputLabel>
                  <Select
                    labelId="prompt-template-label"
                    label="프롬프트 템플릿"
                    value={templateKey}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                  >
                    {PROMPT_TEMPLATES.map((tpl) => (
                      <MenuItem key={tpl.key} value={tpl.key}>
                        {tpl.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              }
              sx={{ pb: 0 }}
            />
            <CardContent sx={{ pt: 1, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <FormControl fullWidth size="small" sx={{ display: { xs: 'flex', md: 'none' }, mb: 2 }}>
                <InputLabel id="prompt-template-mobile">프롬프트 템플릿</InputLabel>
                <Select
                  labelId="prompt-template-mobile"
                  label="프롬프트 템플릿"
                  value={templateKey}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                >
                  {PROMPT_TEMPLATES.map((tpl) => (
                    <MenuItem key={tpl.key} value={tpl.key}>
                      {tpl.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {t('agentConfig.template')} — 저장하지 않아도 테스트 채팅에서 미리보기 가능
              </Typography>
              <Box
                sx={{
                  flex: 1,
                  minHeight: 320,
                  display: 'flex',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  overflow: 'hidden',
                  bgcolor: 'background.paper',
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    flexShrink: 0,
                    py: 1.5,
                    px: 1,
                    borderRight: 1,
                    borderColor: 'divider',
                    bgcolor: 'action.hover',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    lineHeight: 1.5,
                    color: 'text.secondary',
                    overflow: 'hidden',
                    userSelect: 'none',
                  }}
                >
                  {Array.from({ length: lineCount }, (_, i) => (
                    <Box key={i} component="span" sx={{ display: 'block', textAlign: 'right' }}>
                      {i + 1}
                    </Box>
                  ))}
                </Box>
                <TextField
                  inputRef={(el) => {
                    textareaRef.current = el;
                  }}
                  fullWidth
                  multiline
                  minRows={14}
                  maxRows={24}
                  id="agent-system-prompt"
                  name="systemPrompt"
                  value={systemPrompt}
                  onChange={(e) => onSystemPromptChange(e.target.value)}
                  placeholder="SYSTEM: You are..."
                  variant="standard"
                  InputProps={{
                    disableUnderline: true,
                    sx: {
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      lineHeight: 1.5,
                      py: 1.5,
                      px: 2,
                      height: '100%',
                      alignItems: 'flex-start',
                      '& textarea': { resize: 'none' },
                    },
                  }}
                  sx={{ flex: 1, '& .MuiInputBase-root': { height: '100%' } }}
                />
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* 우측: 가이드 (5) */}
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Card
            variant="outlined"
            sx={{
              flex: 1,
              minHeight: 320,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: (muiTheme) => muiTheme.shadows[1],
              borderRadius: 2,
              bgcolor: 'background.paper',
              '& .MuiCardHeader-root': { minHeight: 72 },
            }}
          >
            <CardHeader
              title={t('agentConfig.promptVariableGuideTitle')}
              subheader={t('agentConfig.promptVariableGuideSubheader')}
              sx={{ pb: 0 }}
            />
            <CardContent sx={{ pt: 1, flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {t('agentConfig.promptVariableGuideAuraNote')}
              </Typography>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  변수 (클릭 시 편집기에 삽입)
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={0.5}>
                  {RUNTIME_VARIABLES.map((v) => (
                    <Chip
                      key={v.token}
                      label={v.token}
                      size="small"
                      variant="outlined"
                      onClick={() => insertAtCursor(v.token)}
                      sx={{
                        fontFamily: 'monospace',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    />
                  ))}
                </Stack>
                {RUNTIME_VARIABLES.map((v) => (
                  <Typography key={v.token} variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    {v.token} — {v.desc}
                  </Typography>
                ))}
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  context 키
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={0.5}>
                  {CONTEXT_KEYS.map((key) => (
                    <Chip
                      key={key}
                      label={key}
                      size="small"
                      variant="outlined"
                      onClick={() => insertAtCursor(key)}
                      sx={{
                        fontFamily: 'monospace',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    />
                  ))}
                </Stack>
              </Box>

              {/* 버전/수정자 */}
              <Box sx={{ pt: 1, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                  버전 기록
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  v{version.toFixed(1)}
                  {lastModifiedBy && ` · ${lastModifiedBy}`}
                  {lastModifiedAt && ` · ${new Date(lastModifiedAt).toLocaleString()}`}
                </Typography>
              </Box>

              {/* 최근 실행 컨텍스트 샘플 */}
              <Box sx={{ pt: 1, borderTop: 1, borderColor: 'divider', flex: 1, minHeight: 0 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  최근 실행 컨텍스트 샘플
                </Typography>
                <Box
                  sx={{
                    borderRadius: 1,
                    overflow: 'hidden',
                    border: 1,
                    borderColor: 'divider',
                    '& pre': { margin: 0, fontSize: '0.7rem !important' },
                    '& code': { fontSize: '0.7rem !important' },
                  }}
                >
                  <SyntaxHighlighter
                    language="json"
                    style={prismStyle}
                    customStyle={{
                      margin: 0,
                      padding: 12,
                      background: 'transparent',
                      fontSize: '0.7rem',
                    }}
                    codeTagProps={{ style: { fontFamily: 'monospace' } }}
                  >
                    {JSON.stringify(contextSample, null, 2)}
                  </SyntaxHighlighter>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};
