import Box from '@mui/material/Box';

import type { MessagingMention } from '@dwp-frontend/shared-utils';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function MessagingMessageBody({
  body,
  mentions = [],
}: {
  body: string;
  mentions?: MessagingMention[];
}) {
  const tokens = [
    ...(mentions.some((mention) => mention.mentionKind === 'ALL')
      ? ['@모두', '@everyone', '@all']
      : []),
    ...mentions
      .filter((mention) => mention.mentionKind === 'USER')
      .map((mention) => `@${mention.displayName}`),
  ]
    .filter((token, index, all) => all.indexOf(token) === index)
    .sort((left, right) => right.length - left.length);
  if (!tokens.length) return <>{body}</>;

  const matcher = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'gu');
  return (
    <>
      {body.split(matcher).map((part, index) =>
        tokens.includes(part) ? (
          <Box
            component="span"
            key={`${part}-${index}`}
            sx={{
              display: 'inline',
              px: 0.35,
              py: 0.1,
              borderRadius: 0.5,
              bgcolor: 'var(--dwp-product-soft)',
              color: 'var(--dwp-product-accent)',
              fontWeight: 780,
            }}
          >
            {part}
          </Box>
        ) : (
          part
        )
      )}
    </>
  );
}
