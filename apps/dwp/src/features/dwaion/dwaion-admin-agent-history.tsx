import { useQuery } from '@tanstack/react-query';
import { getDwaionAdminAgent } from '@dwp-frontend/shared-utils';
import { LocalErrorState, LoadingState } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useAdminRegistryCopy } from './dwaion-admin-registry';

export function DwaionAdminAgentHistory({ entryKey }: { entryKey: string }) {
  const copy = useAdminRegistryCopy();
  const query = useQuery({
    queryKey: ['dwaion', 'admin', 'agent-detail', entryKey],
    queryFn: () => getDwaionAdminAgent(entryKey),
    staleTime: 20_000,
    retry: false,
  });
  return (
    <Box component="section" aria-label={copy.history}>
      <Typography component="h3" variant="subtitle2">
        {copy.history}
      </Typography>
      {query.isLoading && (
        <LoadingState label={copy.loading} variant="skeleton" skeletonRows={1} embedded />
      )}
      {query.isError && <LocalErrorState title={copy.historyError} size="compact" />}
      {query.isSuccess &&
        query.data.history.map((entry) => (
          <Typography key={entry.revision} variant="body2" sx={{ mt: 1 }}>
            {entry.revision} · {entry.artifactVersion} · {entry.lifecycleState} · {entry.ownerRef}
          </Typography>
        ))}
    </Box>
  );
}
