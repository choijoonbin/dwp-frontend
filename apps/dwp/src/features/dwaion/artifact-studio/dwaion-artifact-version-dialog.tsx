import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { FormDialog, LoadingState, SelectField } from '@dwp-frontend/design-system';

import { DWAION_ARTIFACT_COPY_KO } from './dwaion-artifact-copy';
import { artifactVersionsComparable } from './dwaion-artifact-model';

import type { DwaionArtifactCopy } from './dwaion-artifact-copy';
import type { DwaionArtifactVersion } from './dwaion-artifact-model';

export function DwaionArtifactVersionDialog({
  open,
  versions,
  onLoadVersion,
  onClose,
  copy = DWAION_ARTIFACT_COPY_KO,
  formatTimestamp = (value) => value,
}: {
  open: boolean;
  versions: readonly DwaionArtifactVersion[];
  onLoadVersion: (versionNumber: number) => Promise<DwaionArtifactVersion>;
  onClose: () => void;
  copy?: DwaionArtifactCopy;
  formatTimestamp?: (value: string) => string;
}) {
  const [leftNumber, setLeftNumber] = useState<number | null>(null);
  const [rightNumber, setRightNumber] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, DwaionArtifactVersion>>({});
  const [loading, setLoading] = useState<readonly number[]>([]);
  const [failed, setFailed] = useState(false);
  const left = leftNumber ? (details[leftNumber] ?? null) : null;
  const right = rightNumber ? (details[rightNumber] ?? null) : null;
  const comparable = artifactVersionsComparable(left, right);
  const options = useMemo(
    () =>
      versions.map((version) => ({
        value: String(version.versionNumber),
        label: `${copy.versionPrefix}${version.versionNumber} ${copy.separator} ${formatTimestamp(version.createdAt)}`,
      })),
    [copy.separator, copy.versionPrefix, formatTimestamp, versions]
  );

  const load = async (versionNumber: number) => {
    if (details[versionNumber]) return;
    setFailed(false);
    setLoading((current) => [...current, versionNumber]);
    try {
      const detail = await onLoadVersion(versionNumber);
      setDetails((current) => ({ ...current, [versionNumber]: detail }));
    } catch {
      setFailed(true);
    } finally {
      setLoading((current) => current.filter((value) => value !== versionNumber));
    }
  };

  return (
    <FormDialog
      open={open}
      title={copy.versionTitle}
      description={copy.versionDescription}
      cancelLabel={copy.closeAction}
      submitLabel={copy.compare}
      showSubmit={false}
      mobileFullScreen
      maxWidth="md"
      onClose={onClose}
      onSubmit={() => undefined}
    >
      {versions.length ? (
        <Stack gap={2}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) minmax(0, 1fr)' },
              gap: 2,
            }}
          >
            <SelectField
              label={copy.leftVersion}
              value={leftNumber ? String(leftNumber) : ''}
              options={options}
              onValueChange={(value) => {
                const next = Number(value);
                setLeftNumber(next);
                void load(next);
              }}
            />
            <SelectField
              label={copy.rightVersion}
              value={rightNumber ? String(rightNumber) : ''}
              options={options}
              onValueChange={(value) => {
                const next = Number(value);
                setRightNumber(next);
                void load(next);
              }}
            />
          </Box>
          {loading.length ? (
            <LoadingState
              label={copy.loadingVersion}
              variant="skeleton"
              embedded
              skeletonRows={1}
              skeletonHeight={18}
            />
          ) : null}
          {failed ? (
            <Typography role="alert" variant="body2" color="error.main">
              {copy.commandFailed}
            </Typography>
          ) : null}
          {comparable && left && right ? (
            <Box
              aria-label={copy.versionTitle}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' },
                borderBlock: 1,
                borderColor: 'divider',
              }}
            >
              <VersionSnapshot version={left} versionPrefix={copy.versionPrefix} />
              <VersionSnapshot version={right} versionPrefix={copy.versionPrefix} bordered />
            </Box>
          ) : (
            <Typography role="status" variant="body2" color="text.secondary">
              {copy.versionDescription}
            </Typography>
          )}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {copy.versionEmpty}
        </Typography>
      )}
    </FormDialog>
  );
}

function VersionSnapshot({
  version,
  versionPrefix,
  bordered = false,
}: {
  version: DwaionArtifactVersion;
  versionPrefix: string;
  bordered?: boolean;
}) {
  return (
    <Box
      sx={{
        minWidth: 0,
        p: 2,
        borderLeft: { xs: 0, md: bordered ? 1 : 0 },
        borderTop: { xs: bordered ? 1 : 0, md: 0 },
        borderColor: 'divider',
      }}
    >
      <Typography component="h3" variant="subtitle2">
        {versionPrefix}
        {version.versionNumber} {version.content?.title}
      </Typography>
      <Typography
        component="pre"
        variant="body2"
        sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', m: 0, mt: 1 }}
      >
        {version.content?.body}
      </Typography>
    </Box>
  );
}
