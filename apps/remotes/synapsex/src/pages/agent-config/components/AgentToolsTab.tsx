/**
 * Agent Studio — 도구 탭: 카테고리 그룹화, 스키마 미리보기, 위험도 배지 (Enterprise)
 */

import type {
  ToolSchemaJson,
  ToolParamSchema,
  AgentToolCatalogItemDto,
} from '@dwp-frontend/shared-utils';

import { useMemo, useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Checkbox from '@mui/material/Checkbox';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import ListSubheader from '@mui/material/ListSubheader';
import FormControlLabel from '@mui/material/FormControlLabel';

/** 실행형 도구 key 패턴 — 데이터 변경/외부 액션 */
const EXECUTIVE_TOOL_PATTERNS = [
  'execute_action',
  'propose_action',
  'simulate_action',
  'execute',
  'propose',
  'create',
  'update',
  'delete',
  'submit',
];

/** 금융 감사 도구 key 패턴 */
const FINANCE_TOOL_KEYS = [
  'get_case',
  'search_documents',
  'get_document',
  'get_open_items',
  'get_lineage',
  'get_entity',
];

/** DevOps 도구 key 패턴 */
const DEVOPS_TOOL_KEYS = [
  'git_diff',
  'github_list_prs',
  'git_log',
  'git_',
  'github_',
];

type CategoryKey = 'FINANCE' | 'DEVOPS' | 'COMMON';

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  FINANCE: '재무 감사 (Finance)',
  DEVOPS: '개발 협업 (DevOps)',
  COMMON: '공통/기타 (Common)',
};

const getCategory = (tool: AgentToolCatalogItemDto): CategoryKey => {
  if (tool.category) {
    const c = String(tool.category).toUpperCase();
    if (c.includes('FINANCE') || c.includes('금융')) return 'FINANCE';
    if (c.includes('DEVOPS') || c.includes('GIT')) return 'DEVOPS';
  }
  const key = (tool.key ?? '').toLowerCase();
  if (FINANCE_TOOL_KEYS.some((k) => key.includes(k.toLowerCase()))) return 'FINANCE';
  if (DEVOPS_TOOL_KEYS.some((k) => key.includes(k.toLowerCase()))) return 'DEVOPS';
  return 'COMMON';
};

const getRiskType = (tool: AgentToolCatalogItemDto): 'read' | 'execute' => {
  const key = (tool.key ?? '').toLowerCase();
  if (EXECUTIVE_TOOL_PATTERNS.some((p) => key.includes(p.toLowerCase()))) {
    return 'execute';
  }
  return 'read';
};

const parseSchemaJson = (schema: string | ToolSchemaJson | undefined): ToolSchemaJson | null => {
  if (!schema) return null;
  if (typeof schema === 'object') return schema;
  try {
    return JSON.parse(schema) as ToolSchemaJson;
  } catch {
    return null;
  }
};

type AgentToolsTabProps = {
  toolList: AgentToolCatalogItemDto[];
  selectedTools: Record<string, boolean>;
  onToggle: (key: string, checked: boolean) => void;
};

export const AgentToolsTab = ({
  toolList,
  selectedTools,
  onToggle,
}: AgentToolsTabProps) => {
  const { t } = useTranslation('common');
  const [selectedTool, setSelectedTool] = useState<AgentToolCatalogItemDto | null>(null);

  const groupedTools = useMemo(() => {
    const groups: Record<CategoryKey, AgentToolCatalogItemDto[]> = {
      FINANCE: [],
      DEVOPS: [],
      COMMON: [],
    };
    toolList
      .filter((tool) => tool && (tool.key ?? tool.label))
      .forEach((tool) => {
        const cat = getCategory(tool);
        groups[cat].push(tool);
      });
    return groups;
  }, [toolList]);

  const schemaData = useMemo(() => {
    const raw = selectedTool?.schemaJson;
    return parseSchemaJson(raw);
  }, [selectedTool?.schemaJson]);

  const params = useMemo(() => {
    const schema = schemaData;
    if (!schema?.properties) return [];
    const required = new Set(schema.required ?? []);
    return Object.entries(schema.properties).map(([name, def]) => ({
      name,
      required: required.has(name),
      ...(typeof def === 'object' ? def : {}),
    }));
  }, [schemaData]);

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
        {/* 좌측: 도구 목록 (카테고리 그룹) */}
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Card
            variant="outlined"
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              boxShadow: (theme) => theme.shadows[1],
              borderRadius: 2,
              bgcolor: 'background.paper',
              '& .MuiCardHeader-root': { minHeight: 72 },
            }}
          >
            <CardHeader
              title={t('agentConfig.toolPermissions')}
              subheader={t('agentConfig.toolPermissionsDesc')}
              sx={{ pb: 0 }}
            />
            <CardContent sx={{ pt: 1, flex: 1, overflow: 'auto' }}>
              <Stack spacing={2}>
                {(['FINANCE', 'DEVOPS', 'COMMON'] as const).map((cat) => {
                  const tools = groupedTools[cat];
                  if (tools.length === 0) return null;
                  return (
                    <Box key={cat}>
                      <ListSubheader
                        component="div"
                        sx={{
                          bgcolor: 'action.hover',
                          py: 1,
                          px: 1.5,
                          borderRadius: 1,
                          fontWeight: 600,
                          fontSize: '0.8rem',
                        }}
                      >
                        {CATEGORY_LABELS[cat]}
                      </ListSubheader>
                      <Stack spacing={0.5} sx={{ mt: 1 }}>
                        {tools.map((tool, index) => {
                          const toolIdentity =
                            tool.toolId != null ? String(tool.toolId) : tool.key || `tool-${index}`;
                          const toolLabelId = `tool-label-${toolIdentity}`;
                          const risk = getRiskType(tool);
                          const isSelected = selectedTool?.key === tool.key;
                          return (
                            <Box
                              key={toolIdentity}
                              onClick={() => setSelectedTool(tool)}
                              sx={{
                                p: 1.5,
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: isSelected ? 'primary.main' : 'divider',
                                ...(isSelected && {
                                  borderLeft: '4px solid',
                                  borderLeftColor: 'primary.main',
                                }),
                                bgcolor: isSelected ? 'primary.lighter' : 'transparent',
                                display: 'flex',
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 2,
                                cursor: 'pointer',
                                '&:hover': { bgcolor: isSelected ? 'primary.lighter' : 'action.hover' },
                              }}
                            >
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                                  <Typography id={toolLabelId} variant="body2" sx={{ fontWeight: 600 }}>
                                    {tool.label}
                                  </Typography>
                                  <Chip
                                    label={risk === 'read' ? '조회형' : '승인 필요'}
                                    size="small"
                                    color={risk === 'read' ? 'info' : 'warning'}
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: '0.65rem' }}
                                  />
                                </Stack>
                                {tool.description && (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                                    {tool.description}
                                  </Typography>
                                )}
                              </Box>
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    name={tool.key || toolIdentity}
                                    checked={!!selectedTools[tool.key]}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      onToggle(tool.key, e.target.checked);
                                    }}
                                    inputProps={{ 'aria-labelledby': toolLabelId }}
                                  />
                                }
                                label=""
                                onClick={(e) => e.stopPropagation()}
                                sx={{ ml: 'auto', flexShrink: 0 }}
                              />
                            </Box>
                          );
                        })}
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* 우측: 스키마 상세 */}
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
              title="파라미터 상세 (Schema)"
              subheader={
                selectedTool
                  ? `선택된 도구: ${selectedTool.label}`
                  : '도구를 선택하면 Aura 엔진이 사용하는 파라미터를 확인할 수 있습니다.'
              }
              avatar={selectedTool ? <Iconify icon="solar:wrench-bold-duotone" width={24} sx={{ color: 'primary.main' }} /> : null}
              sx={{ pb: 0 }}
            />
            <CardContent sx={{ pt: 1, flex: 1, overflow: 'auto' }}>
              {!selectedTool ? (
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
                    icon="solar:mouse-minimalistic-bold-duotone"
                    width={48}
                    sx={{ color: 'text.disabled', mb: 2 }}
                  />
                  <Typography variant="body2" color="text.secondary" align="center">
                    도구를 클릭하여 파라미터 상세를 확인하세요
                  </Typography>
                </Box>
              ) : params.length > 0 ? (
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>파라미터</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>필수</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>타입</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>설명</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {params.map((p) => (
                      <TableRow key={p.name}>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          {p.name}
                        </TableCell>
                        <TableCell>
                          {p.required ? (
                            <Chip label="필수" size="small" color="error" variant="outlined" sx={{ height: 20 }} />
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              -
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {(p as ToolParamSchema).type ?? '-'}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.8rem' }}>
                          {(p as ToolParamSchema).description ?? '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Box sx={{ py: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    이 도구는 schema_json 정보가 없습니다.
                  </Typography>
                  {schemaData && (
                    <Box
                      component="pre"
                      sx={{
                        mt: 2,
                        p: 2,
                        borderRadius: 1,
                        bgcolor: 'action.hover',
                        fontSize: '0.75rem',
                        overflow: 'auto',
                        fontFamily: 'monospace',
                      }}
                    >
                      {JSON.stringify(schemaData, null, 2)}
                    </Box>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};
