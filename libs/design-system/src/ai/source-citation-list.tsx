import { ExternalLink, FileText, LockKeyhole, RefreshCw } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import ListItem from '@mui/material/ListItem';
import Typography from '@mui/material/Typography';

export type SourceCitation = {
  id: string;
  title: string;
  sourceType: string;
  href?: string;
  detail?: string;
  state?: 'current' | 'stale' | 'restricted';
};

export type SourceCitationListProps = {
  sources: readonly SourceCitation[];
  ariaLabel?: string;
};

function citationState(state: SourceCitation['state']) {
  if (state === 'restricted') return { label: 'Restricted', icon: <LockKeyhole size={13} /> };
  if (state === 'stale') return { label: 'Refresh needed', icon: <RefreshCw size={13} /> };
  return null;
}

export function SourceCitationList({ sources, ariaLabel = 'Sources' }: SourceCitationListProps) {
  return (
    <List disablePadding aria-label={ariaLabel}>
      {sources.map((source) => {
        const state = citationState(source.state);
        const restricted = source.state === 'restricted';

        return (
          <ListItem
            key={source.id}
            disableGutters
            sx={{ py: 1.25, alignItems: 'flex-start', borderBottom: 1, borderColor: 'divider' }}
          >
            <FileText size={18} aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }} />
            <Box sx={{ ml: 1.25, minWidth: 0, flex: 1 }}>
              <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                {source.href && !restricted ? (
                  <Link
                    href={source.href}
                    target="_blank"
                    rel="noreferrer"
                    underline="hover"
                    sx={{ display: 'inline-flex', gap: 0.5, alignItems: 'center', fontWeight: 600 }}
                  >
                    {source.title}
                    <ExternalLink size={14} aria-hidden="true" />
                  </Link>
                ) : (
                  <Typography variant="body2" fontWeight={600}>
                    {source.title}
                  </Typography>
                )}
                {state && (
                  <Chip size="small" variant="outlined" icon={state.icon} label={state.label} />
                )}
              </Stack>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.25 }}
              >
                {[source.sourceType, source.detail].filter(Boolean).join(' · ')}
              </Typography>
            </Box>
          </ListItem>
        );
      })}
    </List>
  );
}
