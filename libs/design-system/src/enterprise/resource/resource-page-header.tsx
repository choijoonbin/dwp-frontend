import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export type ResourcePageHeaderProps = {
  title: string;
  description: string;
  eyebrow?: string;
  scope?: React.ReactNode;
  status?: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryActions?: React.ReactNode;
  helpAction?: React.ReactNode;
};

export function ResourcePageHeader({
  title,
  description,
  eyebrow,
  scope,
  status,
  primaryAction,
  secondaryActions,
  helpAction,
}: ResourcePageHeaderProps) {
  return (
    <Stack
      component="header"
      direction={{ xs: 'column', md: 'row' }}
      alignItems={{ md: 'flex-start' }}
      justifyContent="space-between"
      gap={2}
    >
      <Box sx={{ minWidth: 0, maxWidth: 820 }}>
        {eyebrow && (
          <Typography component="p" variant="overline" color="primary.main">
            {eyebrow}
          </Typography>
        )}
        <Typography component="h1" variant="h4">
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.35 }}>
          {description}
        </Typography>
        {(scope || status) && (
          <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap" sx={{ mt: 1.25 }}>
            {scope}
            {status}
          </Stack>
        )}
      </Box>
      {(primaryAction || secondaryActions || helpAction) && (
        <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
          {helpAction}
          {secondaryActions}
          {primaryAction}
        </Stack>
      )}
    </Stack>
  );
}
