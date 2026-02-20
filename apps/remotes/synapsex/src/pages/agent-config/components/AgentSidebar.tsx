import type { AgentListItemDto } from '@dwp-frontend/shared-utils';

import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { usePermissions } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

type AgentSidebarProps = {
  agents: AgentListItemDto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddClick: () => void;
  onDelete: (id: string) => void;
};

const ADMIN_RESOURCE = 'menu.governance-config.admin';

export const AgentSidebar = (props: AgentSidebarProps) => {
  const { agents, selectedId, onSelect, onAddClick, onDelete } = props;
  const { t } = useTranslation('common');
  const { hasPermission } = usePermissions();
  const isAdmin = hasPermission(ADMIN_RESOURCE, 'VIEW');

  return (
    <Box sx={{ width: 280, flexShrink: 0, borderRight: 1, borderColor: 'divider', overflow: 'auto', height: '100%' }}>
      <Stack spacing={1.5} sx={{ p: 2 }}>
        <Button variant="outlined" fullWidth startIcon={<Iconify icon="solar:add-circle-bold" width={20} />} onClick={onAddClick}>
          {t('agentConfig.addAgentButton')}
        </Button>
        {agents.map((a) => {
          const sel = selectedId === a.id;
          const deletable = a.isDeletable !== false;
          return (
            <Card
              key={a.id}
              variant="outlined"
              sx={{
                cursor: 'pointer',
                p: 1.5,
                borderWidth: 1,
                borderColor: sel ? 'primary.main' : 'divider',
                bgcolor: sel ? 'primary.lighter' : 'background.paper',
              }}
              onClick={() => onSelect(a.id)}
            >
              <Stack spacing={0.5}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Iconify icon="solar:robot-bold-duotone" width={24} sx={{ color: sel ? 'primary.main' : 'text.secondary' }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" noWrap>{a.name}</Typography>
                    {a.description && <Typography variant="caption" color="text.secondary" noWrap display="block">{a.description}</Typography>}
                  </Box>
                  {a.isActive && <Chip label={t('agentConfig.active')} color="success" size="small" />}
                {deletable && (
                  <IconButton
                    color="error"
                    size="medium"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(a.id);
                    }}
                    aria-label={t('agentConfig.deleteConfirmTitle')}
                    sx={{ minWidth: 44, minHeight: 44 }}
                  >
                    <Iconify icon="solar:trash-bin-trash-bold" width={18} />
                  </IconButton>
                )}
                </Stack>
                {a.tenantId != null && (
                  <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
                    {isAdmin && a.tenantId === 0 ? (
                      <Chip label={t('agentConfig.systemAgentBadge')} size="small" color="info" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        {t('agentConfig.tenantId', { id: String(a.tenantId) })}
                      </Typography>
                    )}
                  </Stack>
                )}
              </Stack>
            </Card>
          );
        })}
      </Stack>
    </Box>
  );
};
