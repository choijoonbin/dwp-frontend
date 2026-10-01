import Avatar from '@mui/material/Avatar';

import { identityInitials } from './access-manager-model';

export function IdentityAvatar({
  displayName,
  size,
  fontSize,
}: {
  displayName: string;
  size: number;
  fontSize: number;
}) {
  return (
    <Avatar
      sx={{
        width: size,
        height: size,
        flex: '0 0 auto',
        bgcolor: 'primary.main',
        fontSize,
        '@media (forced-colors: active)': { bgcolor: 'CanvasText', color: 'Canvas' },
      }}
    >
      {identityInitials(displayName)}
    </Avatar>
  );
}
