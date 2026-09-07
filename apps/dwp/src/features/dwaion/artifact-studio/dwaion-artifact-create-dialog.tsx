import { useMemo, useState } from 'react';

import Stack from '@mui/material/Stack';

import { FormDialog, FormField, SelectField } from '@dwp-frontend/design-system';

import { DWAION_ARTIFACT_COPY_KO } from './dwaion-artifact-copy';

import type { DwaionArtifactCopy } from './dwaion-artifact-copy';
import type { DwaionArtifactType } from './dwaion-artifact-model';

const ARTIFACT_TYPES: readonly DwaionArtifactType[] = ['DOCUMENT', 'WORK_PLAN', 'COMPARISON'];

export function DwaionArtifactCreateDialog({
  open,
  busy = false,
  onClose,
  onCreate,
  copy = DWAION_ARTIFACT_COPY_KO,
}: {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onCreate: (input: {
    artifactType: DwaionArtifactType;
    title: string;
    body: string;
  }) => Promise<void>;
  copy?: DwaionArtifactCopy;
}) {
  const [artifactType, setArtifactType] = useState<DwaionArtifactType>('DOCUMENT');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const valid = useMemo(() => Boolean(title.trim() && body.trim()), [body, title]);
  const reset = () => {
    setArtifactType('DOCUMENT');
    setTitle('');
    setBody('');
  };

  return (
    <FormDialog
      open={open}
      title={copy.createTitle}
      description={copy.createDescription}
      cancelLabel={copy.cancel}
      submitLabel={copy.save}
      submittingLabel={copy.saving}
      submitDisabled={!valid}
      busy={busy}
      mobileFullScreen
      maxWidth="md"
      onClose={() => {
        reset();
        onClose();
      }}
      onSubmit={async () => {
        await onCreate({ artifactType, title: title.trim(), body: body.trim() });
        reset();
      }}
    >
      <Stack gap={2}>
        <SelectField
          label={copy.document}
          value={artifactType}
          options={ARTIFACT_TYPES.map((value) => ({
            value,
            label: copy.artifactTypes[value],
          }))}
          onValueChange={(value) => {
            if (value) setArtifactType(value);
          }}
        />
        <FormField
          label={copy.editorTitle}
          value={title}
          required
          onChange={(event) => setTitle(event.target.value)}
        />
        <FormField
          label={copy.editorLabel}
          value={body}
          required
          multiline
          minRows={8}
          onChange={(event) => setBody(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}
