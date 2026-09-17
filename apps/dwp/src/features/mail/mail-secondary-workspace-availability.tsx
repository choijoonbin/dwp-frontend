import { CheckCircle2, Clock3, Settings2 } from 'lucide-react';

import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';

import { MailPreferencesWorkspace } from './mail-preferences-workspace';
import { MailWritingAssetsWorkspace } from './mail-writing-assets-workspace';

import type { MailSecondaryCapabilityState } from './mail-secondary-workspace-model';

export const MailTemplatesWorkspace = MailWritingAssetsWorkspace;
export const MailAccountsPreferencesWorkspace = MailPreferencesWorkspace;

export function MailCapabilityNotice({
  state,
  title,
  description,
}: {
  state: MailSecondaryCapabilityState;
  title: string;
  description: string;
}) {
  const icon =
    state === 'AVAILABLE' ? (
      <CheckCircle2 size={18} />
    ) : state === 'READ_ONLY' ? (
      <Clock3 size={18} />
    ) : (
      <Settings2 size={18} />
    );
  return (
    <Alert
      severity={state === 'AVAILABLE' ? 'success' : state === 'READ_ONLY' ? 'info' : 'warning'}
      icon={icon}
      sx={{ mt: 2 }}
    >
      <Typography variant="body2" fontWeight={750}>
        {title}
      </Typography>
      <Typography variant="body2">{description}</Typography>
    </Alert>
  );
}
