import { useState } from 'react';

import Stack from '@mui/material/Stack';

import { FormDialog, InlineFeedback, SelectField } from '@dwp-frontend/design-system';

import { DWAION_ARTIFACT_COPY_KO } from './dwaion-artifact-copy';

import type { DwaionArtifactCopy } from './dwaion-artifact-copy';

export type DwaionArtifactExportFormat = 'MARKDOWN' | 'DOCX' | 'PDF';

export function DwaionArtifactExportDialog({
  open,
  busy = false,
  onClose,
  onRequest,
  copy = DWAION_ARTIFACT_COPY_KO,
}: {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onRequest: (format: DwaionArtifactExportFormat) => Promise<void>;
  copy?: DwaionArtifactCopy;
}) {
  const [format, setFormat] = useState<DwaionArtifactExportFormat>('MARKDOWN');
  return (
    <FormDialog
      open={open}
      title={copy.exportRequest}
      description={copy.exportHelp}
      cancelLabel={copy.cancel}
      submitLabel={copy.exportRequest}
      submittingLabel={copy.exportRequesting}
      busy={busy}
      mobileFullScreen
      onClose={onClose}
      onSubmit={() => onRequest(format)}
    >
      <Stack gap={2}>
        <InlineFeedback severity="info">{copy.exportHelp}</InlineFeedback>
        <SelectField
          label={copy.exportRequest}
          value={format}
          options={(['MARKDOWN', 'DOCX', 'PDF'] as const).map((value) => ({
            value,
            label: copy.exportFormats[value],
          }))}
          onValueChange={(value) => {
            if (value) setFormat(value);
          }}
        />
      </Stack>
    </FormDialog>
  );
}
