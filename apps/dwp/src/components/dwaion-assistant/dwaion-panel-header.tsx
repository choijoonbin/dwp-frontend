import { Maximize2, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActionIconButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

type DwaionPanelHeaderProps = {
  busy: boolean;
  hasQuestion: boolean;
  canExpand: boolean;
  onNewQuestion: () => void;
  onExpand: () => void;
  onClose: () => void;
};

export function DwaionPanelHeader({
  busy,
  hasQuestion,
  canExpand,
  onNewQuestion,
  onExpand,
  onClose,
}: DwaionPanelHeaderProps) {
  const { t } = useTranslation('home');

  return (
    <Stack
      component="header"
      direction="row"
      alignItems="center"
      gap={1}
      sx={{
        minHeight: 62,
        px: { xs: 1.25, sm: 1.75 },
        py: 1,
        borderBottom: 1,
        borderColor: 'divider',
        flex: '0 0 auto',
      }}
    >
      <Box
        component="img"
        src="/assets/assistants/dwaion-link-v1.png"
        alt=""
        sx={{ width: 36, height: 36, flex: '0 0 auto', objectFit: 'contain' }}
      />
      <Box minWidth={0} flex={1}>
        <Stack direction="row" alignItems="center" gap={0.75}>
          <Typography component="h1" variant="subtitle1" fontWeight={850} lineHeight="21px">
            {t('dwaion.name')}
          </Typography>
          <Chip
            label={t('dwaion.aiLabel')}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ height: 20 }}
          />
        </Stack>
        <Stack direction="row" alignItems="center" gap={0.6} sx={{ mt: 0.15 }}>
          <Box
            aria-hidden="true"
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: busy ? 'warning.main' : 'success.main',
            }}
          />
          <Typography variant="caption" color="text.secondary" noWrap>
            {busy ? t('dwaion.status.thinking') : t('dwaion.status.ready')}
          </Typography>
        </Stack>
      </Box>
      <ActionIconButton
        label={t('dwaion.newQuestion')}
        size="small"
        disabled={!hasQuestion}
        onClick={onNewQuestion}
        sx={{ width: 44, height: 44, display: { xs: 'none', sm: 'inline-flex' } }}
      >
        <Plus size={17} aria-hidden="true" />
      </ActionIconButton>
      <ActionIconButton
        label={t('dwaion.expand')}
        size="small"
        disabled={!canExpand}
        onClick={onExpand}
        sx={{ width: 44, height: 44, display: { xs: 'none', sm: 'inline-flex' } }}
      >
        <Maximize2 size={17} aria-hidden="true" />
      </ActionIconButton>
      <ActionIconButton
        label={t('dwaion.close')}
        size="small"
        onClick={onClose}
        sx={{ width: 44, height: 44, order: { xs: -1, sm: 0 } }}
      >
        <X size={18} aria-hidden="true" />
      </ActionIconButton>
    </Stack>
  );
}
