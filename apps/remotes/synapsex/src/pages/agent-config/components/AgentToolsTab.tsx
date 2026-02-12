/**
 * Agent Studio — 도구 탭: 백엔드 도구 인벤토리를 체크박스 리스트로 노출
 */

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { useTranslation } from '@dwp-frontend/shared-i18n';

import type { AgentToolCatalogItemDto } from '@dwp-frontend/shared-utils';

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

  return (
    <Box sx={{ p: 3 }}>
      <Card variant="outlined">
        <CardHeader
          title={t('agentConfig.toolPermissions')}
          subheader={t('agentConfig.toolPermissionsDesc')}
        />
        <CardContent>
          <Stack spacing={1}>
            {toolList.map((tool, index) => {
              const toolIdentity = tool.toolId != null ? String(tool.toolId) : tool.key || tool.label || `tool-${index}`;
              const toolLabelId = `tool-label-${toolIdentity}`;
              return (
              <Box
                key={toolIdentity}
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  border: 1,
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Box>
                  <Typography id={toolLabelId} variant="body2" sx={{ fontWeight: 600 }}>
                    {tool.label}
                  </Typography>
                  {tool.description && (
                    <Typography variant="caption" color="text.secondary">
                      {tool.description}
                    </Typography>
                  )}
                </Box>
                <FormControlLabel
                  control={
                    <Checkbox
                      name={tool.key || toolIdentity}
                      checked={!!selectedTools[tool.key]}
                      onChange={(e) => onToggle(tool.key, e.target.checked)}
                      inputProps={{ 'aria-labelledby': toolLabelId }}
                    />
                  }
                  label=""
                />
              </Box>
              );
            })}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};
