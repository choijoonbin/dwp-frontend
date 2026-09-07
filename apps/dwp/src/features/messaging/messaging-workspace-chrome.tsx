import { Command, Inbox, MessageSquarePlus, RefreshCw } from 'lucide-react';
import { ActionButton, ActionIconButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

type MessagingWorkspaceChromeProps = {
  eyebrow: string;
  title: string;
  description: string;
  mentionFilterActive: boolean;
  labels: {
    showAll: string;
    create: string;
    search: string;
    refresh: string;
  };
  onShowAll: () => void;
  onCreate: () => void;
  onSearch: () => void;
  onRefresh: () => void;
};

export function MessagingWorkspaceChrome({
  eyebrow,
  title,
  description,
  mentionFilterActive,
  labels,
  onShowAll,
  onCreate,
  onSearch,
  onRefresh,
}: MessagingWorkspaceChromeProps) {
  return (
    <Box
      component="header"
      data-testid="messaging-workspace-chrome"
      sx={{
        minWidth: 0,
        minHeight: 44,
        mb: 0.75,
        px: { xs: 0.25, sm: 0.75 },
        py: 0.25,
        display: 'flex',
        alignItems: { xs: 'flex-start', md: 'center' },
        justifyContent: 'space-between',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 1,
      }}
    >
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant="overline"
          color="primary.main"
          fontWeight="fontWeightBold"
          sx={{ display: { xs: 'block', md: 'none' } }}
        >
          {eyebrow}
        </Typography>
        <Stack direction="row" spacing={1.1} alignItems="center" sx={{ minWidth: 0 }}>
          <Typography component="h1" variant="h5" fontWeight="fontWeightBold">
            {title}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            noWrap
            sx={{ display: { xs: 'none', xl: 'block' }, minWidth: 0 }}
          >
            {description}
          </Typography>
        </Stack>
      </Box>
      <Stack direction="row" spacing={0.65} alignItems="center" flexWrap="wrap" useFlexGap>
        {mentionFilterActive ? (
          <ActionButton
            intent="quiet"
            size="small"
            startIcon={<Inbox size={16} />}
            onClick={onShowAll}
          >
            {labels.showAll}
          </ActionButton>
        ) : null}
        <ActionButton
          intent="quiet"
          size="small"
          startIcon={<Command size={16} />}
          onClick={onSearch}
          sx={(theme) => ({
            display: { xs: 'none', md: 'inline-flex' },
            minWidth: { md: 190, xl: 238 },
            justifyContent: 'flex-start',
            color: 'text.secondary',
            border: 1,
            borderColor: alpha(theme.palette.primary.main, 0.13),
            bgcolor: alpha(theme.palette.background.paper, 0.82),
          })}
        >
          {labels.search}
        </ActionButton>
        <ActionIconButton
          label={labels.search}
          size="small"
          onClick={onSearch}
          sx={{ display: { xs: 'inline-flex', md: 'none' } }}
        >
          <Command size={17} />
        </ActionIconButton>
        <ActionIconButton label={labels.refresh} size="small" onClick={onRefresh}>
          <RefreshCw size={17} />
        </ActionIconButton>
        <ActionIconButton
          label={labels.create}
          size="small"
          onClick={onCreate}
          sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
        >
          <MessageSquarePlus size={17} />
        </ActionIconButton>
        <ActionButton
          intent="primary"
          size="small"
          startIcon={<MessageSquarePlus size={16} />}
          onClick={onCreate}
          sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
        >
          {labels.create}
        </ActionButton>
      </Stack>
    </Box>
  );
}
