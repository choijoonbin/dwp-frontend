import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, RefreshCw } from 'lucide-react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';
import {
  downloadDwaionArtifactExport,
  getDwaionArtifactExport,
  useAuth,
} from '@dwp-frontend/shared-utils';

import type { DwaionArtifactCopy } from './dwaion-artifact-copy';
import type { DwaionArtifactExportEvidence } from './dwaion-artifact-model';

export function DwaionArtifactExportStatus({
  artifactId,
  receipt,
  permitted,
  copy,
}: {
  artifactId: string;
  receipt: DwaionArtifactExportEvidence;
  permitted: boolean;
  copy: DwaionArtifactCopy;
}) {
  const { user } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);
  const status = useQuery({
    queryKey: [
      'dwaion',
      'artifact-export',
      user?.tenantId,
      user?.userId,
      artifactId,
      receipt.exportJobId,
    ],
    queryFn: () => getDwaionArtifactExport(artifactId, receipt.exportJobId),
    enabled: permitted,
    refetchInterval: (query) =>
      query.state.data?.executionAvailable &&
      ['PENDING', 'CLAIMED'].includes(query.state.data.state)
        ? 3_000
        : false,
    retry: false,
    meta: { accessSensitive: true },
  });
  if (!permitted) return null;
  // Never keep a previously successful file actionable after status revalidation fails.
  const current = status.isError ? null : (status.data ?? receipt);
  const file = !status.isError && status.data?.fileAvailable ? status.data : null;
  const failed = !current || ['FAILED', 'CANCELLED', 'PARTIAL'].includes(current.state);
  return (
    <InlineFeedback severity={failed ? 'warning' : file ? 'success' : 'info'} sx={{ mt: 1.25 }}>
      <Stack gap={1}>
        <Typography variant="body2" fontWeight="fontWeightBold">
          {current ? copy.exportStates[current.state] : copy.commandFailed}
        </Typography>
        <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
          {copy.exportFormats[receipt.exportFormat]} {copy.separator} {receipt.exportJobId}
        </Typography>
        {current && !current.executionAvailable && !current.fileAvailable ? (
          <Typography variant="caption">{copy.exportUnavailable}</Typography>
        ) : null}
        {downloadFailed ? <Typography variant="caption">{copy.commandFailed}</Typography> : null}
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
          <ActionButton
            intent="quiet"
            startIcon={<RefreshCw size={16} />}
            disabled={status.isFetching}
            onClick={() => {
              setDownloadFailed(false);
              void status.refetch();
            }}
          >
            {copy.exportRefresh}
          </ActionButton>
          {file ? (
            <ActionButton
              intent="secondary"
              startIcon={<Download size={16} />}
              disabled={downloading || status.isFetching}
              onClick={async () => {
                setDownloading(true);
                setDownloadFailed(false);
                try {
                  const blob = await downloadDwaionArtifactExport(file);
                  const url = URL.createObjectURL(blob);
                  const anchor = document.createElement('a');
                  anchor.href = url;
                  anchor.download = file.fileName!;
                  anchor.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1_000);
                } catch {
                  setDownloadFailed(true);
                  void status.refetch();
                } finally {
                  setDownloading(false);
                }
              }}
            >
              {copy.exportDownload}
            </ActionButton>
          ) : null}
        </Stack>
      </Stack>
    </InlineFeedback>
  );
}
