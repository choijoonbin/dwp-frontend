import { History, LockKeyhole, MessageSquarePlus, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ActionButton } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function DwaionStudioHeader({ expert, onNew }: { expert: boolean; onNew: () => void }) {
  const { t } = useTranslation('work');
  const navigate = useNavigate();
  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 2,
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
        <Box
          component="img"
          src="/assets/assistants/dwaion-link-v1.png"
          alt=""
          sx={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" color="primary.main">
            {t(expert ? 'askPage.approvalExpert.header.eyebrow' : 'askPage.header.eyebrow')}
          </Typography>
          <Typography component="h1" variant="h5">
            {t(expert ? 'askPage.approvalExpert.header.title' : 'askPage.header.title')}
          </Typography>
        </Box>
      </Stack>
      <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
        <Chip
          size="small"
          variant="outlined"
          icon={<ShieldCheck size={14} />}
          label={t('askPage.permissionScoped')}
        />
        <Chip
          size="small"
          variant="outlined"
          icon={<LockKeyhole size={14} />}
          label={t('askPage.readOnly')}
        />
        {!expert && (
          <ActionButton
            intent="quiet"
            startIcon={<History size={16} />}
            onClick={() => navigate('/dwaion/conversations')}
          >
            {t('dwaionConversations.title')}
          </ActionButton>
        )}
        <ActionButton intent="primary" startIcon={<MessageSquarePlus size={16} />} onClick={onNew}>
          {t('dwaionConversations.new')}
        </ActionButton>
      </Stack>
    </Box>
  );
}
