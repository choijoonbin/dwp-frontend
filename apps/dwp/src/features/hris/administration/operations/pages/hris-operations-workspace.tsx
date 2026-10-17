import { useCallback, useEffect, useState } from 'react';
import { InlineFeedback } from '@dwp-frontend/design-system';

import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { hrisOperationsDataSource } from '../api/hris-operations-api';
import {
  HRIS_OPERATIONS_DEFAULT_COPY,
  HrisOperationsWorkspaceView,
} from '../components/hris-operations-workspace-view';
import { useHrisOperationsWorkspace } from '../hooks/use-hris-operations-workspace';
import {
  mergeHrisOperationsQueryState,
  parseHrisOperationsQueryState,
} from '../model/hris-operations-contract';

import type { HrisOperationsDataSource } from '../api/hris-operations-api';
import type { HrisOperationsWorkspaceCopy } from '../components/hris-operations-workspace-view';
import type { HrisOperationsQueryState } from '../model/hris-operations-contract';

export const HRIS_OPERATIONS_RUNTIME_STATE =
  import.meta.env.VITE_HRIS_OPERATIONS_EXCEPTION_CENTER_ENABLED === 'true'
    ? ('ON' as const)
    : ('OFF' as const);

export type HrisOperationsWorkspaceProps = Readonly<{
  runtimeEnabled?: boolean;
  tenantEnrolled?: boolean;
  exceptionContextScopeKey?: string;
  dataSource?: HrisOperationsDataSource;
  copy?: HrisOperationsWorkspaceCopy;
}>;

function currentSearch(): URLSearchParams {
  return new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
}

function useOperationsQueryState() {
  const [queryState, setQueryState] = useState(() =>
    parseHrisOperationsQueryState(currentSearch())
  );
  useEffect(() => {
    const update = () => setQueryState(parseHrisOperationsQueryState(currentSearch()));
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  const updateQueryState = useCallback((patch: Partial<HrisOperationsQueryState>) => {
    const nextSearch = mergeHrisOperationsQueryState(currentSearch(), patch);
    const next = parseHrisOperationsQueryState(nextSearch);
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}?${nextSearch.toString()}${window.location.hash}`
    );
    setQueryState(next);
  }, []);
  return [queryState, updateQueryState] as const;
}

function ActiveHrisOperationsWorkspace({
  dataSource,
  copy,
  exceptionContextScopeKey,
}: Readonly<{
  dataSource: HrisOperationsDataSource;
  copy?: HrisOperationsWorkspaceCopy;
  exceptionContextScopeKey?: string;
}>) {
  const [queryState, updateQueryState] = useOperationsQueryState();
  const workspace = useHrisOperationsWorkspace({
    queryState,
    onQueryStateChange: updateQueryState,
    featureEnabled: true,
    tenantEnrolled: true,
    ...(exceptionContextScopeKey === undefined ? {} : { exceptionContextScopeKey }),
    dataSource,
  });
  return (
    <Stack
      data-runtime-state="ON"
      data-tenant-enrolled="true"
      sx={{ minWidth: 0, maxWidth: '100%' }}
    >
      <HrisOperationsWorkspaceView {...workspace} copy={copy} />
    </Stack>
  );
}

function DisabledHrisOperationsWorkspace({
  copy,
  tenantEnrolled,
}: Readonly<{
  copy: HrisOperationsWorkspaceCopy;
  tenantEnrolled: boolean;
}>) {
  return (
    <Stack
      gap={2}
      data-testid="hris-operations-workspace"
      data-runtime-state="OFF"
      data-tenant-enrolled={String(tenantEnrolled)}
      sx={{ minWidth: 0, maxWidth: '100%' }}
    >
      <InlineFeedback severity="info" title="HRIS operations exception center is unavailable">
        The module is installed but remains default-off for this tenant. No entry, exception,
        projection or receipt request has been started.
      </InlineFeedback>
      <Paper component="section" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
        <Stack gap={1.25} alignItems="flex-start" minWidth={0}>
          <Chip size="small" variant="outlined" label="Feature state: OFF" />
          <Typography component="h1" variant="h5" sx={{ overflowWrap: 'anywhere' }}>
            {copy.title}
          </Typography>
          <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {copy.description}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            Recovery commands and owner automation remain in their owning domains and are never
            mounted here.
          </Typography>
        </Stack>
      </Paper>
    </Stack>
  );
}

/**
 * SYS-002 source-complete workspace. Control must explicitly enable the feature and enroll a tenant
 * before the active subtree (including request-scope and query hooks) is mounted.
 */
export function HrisOperationsWorkspace({
  runtimeEnabled = HRIS_OPERATIONS_RUNTIME_STATE === 'ON',
  tenantEnrolled = false,
  exceptionContextScopeKey,
  dataSource = hrisOperationsDataSource,
  copy = HRIS_OPERATIONS_DEFAULT_COPY,
}: HrisOperationsWorkspaceProps) {
  if (!runtimeEnabled || !tenantEnrolled) {
    return <DisabledHrisOperationsWorkspace copy={copy} tenantEnrolled={tenantEnrolled} />;
  }
  return (
    <ActiveHrisOperationsWorkspace
      dataSource={dataSource}
      copy={copy}
      {...(exceptionContextScopeKey === undefined ? {} : { exceptionContextScopeKey })}
    />
  );
}
