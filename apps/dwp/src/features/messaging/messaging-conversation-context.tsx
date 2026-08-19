import { ShieldCheck } from 'lucide-react';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { MessagingPersonLine } from './messaging-components';

import type { MessagingConversationDetail } from '@dwp-frontend/shared-utils';

type MessagingConversationContextProps = {
  detail?: MessagingConversationDetail;
  fallbackTopic?: string | null;
  labels: {
    members: string;
    governance: string;
    classification: string;
    spaceLinked: string;
    membershipBound: string;
    empty: string;
  };
};

export function MessagingConversationContext({
  detail,
  fallbackTopic,
  labels,
}: MessagingConversationContextProps) {
  if (!detail) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {fallbackTopic ?? labels.empty}
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Box>
        <Typography variant="overline" color="text.secondary">
          {labels.members}
        </Typography>
        <Stack spacing={1.25} sx={{ mt: 1 }}>
          {detail.members.slice(0, 8).map((member) => (
            <MessagingPersonLine key={member.userId} person={member} />
          ))}
        </Stack>
      </Box>
      <Divider />
      <Box>
        <Typography variant="overline" color="text.secondary">
          {labels.governance}
        </Typography>
        <Stack spacing={1} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <ShieldCheck size={16} color="var(--dwp-product-accent)" aria-hidden="true" />
            <Typography variant="body2" fontWeight={760}>
              {labels.classification}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {detail.conversation.linkedSpaceName ? labels.spaceLinked : labels.membershipBound}
          </Typography>
        </Stack>
      </Box>
    </Stack>
  );
}
