import { FormDialog, FormField } from '@dwp-frontend/design-system';

import Stack from '@mui/material/Stack';

import type { ApprovalTemplateCloneDraft } from '@dwp-frontend/shared-utils/api/approval-admin-v2-template-api';

export function TemplateLibraryCloneDialog({
  draft,
  busy,
  title,
  description,
  templateKeyLabel,
  nameKoLabel,
  nameEnLabel,
  descriptionKoLabel,
  descriptionEnLabel,
  ownerLabel,
  categoryLabel,
  workflowLabel,
  cancelLabel,
  submitLabel,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: ApprovalTemplateCloneDraft | null;
  busy: boolean;
  title: string;
  description: string;
  templateKeyLabel: string;
  nameKoLabel: string;
  nameEnLabel: string;
  descriptionKoLabel: string;
  descriptionEnLabel: string;
  ownerLabel: string;
  categoryLabel: string;
  workflowLabel: string;
  cancelLabel: string;
  submitLabel: string;
  onChange: (draft: ApprovalTemplateCloneDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const patch = (value: Partial<ApprovalTemplateCloneDraft>) => {
    if (draft) onChange({ ...draft, ...value });
  };
  const complete = Boolean(
    draft?.templateKey.trim() &&
    draft.nameKo.trim() &&
    draft.nameEn.trim() &&
    draft.ownerGroupRef.trim() &&
    draft.categoryKey.trim() &&
    draft.defaultWorkflowKey.trim()
  );
  return (
    <FormDialog
      open={draft !== null}
      title={title}
      description={description}
      cancelLabel={cancelLabel}
      submitLabel={submitLabel}
      busy={busy}
      submitDisabled={!complete}
      mobileFullScreen
      onClose={onClose}
      onSubmit={onSubmit}
    >
      {draft ? (
        <Stack gap={1.5}>
          <FormField
            size="small"
            label={templateKeyLabel}
            value={draft.templateKey}
            slotProps={{ htmlInput: { maxLength: 100 } }}
            onChange={(event) => patch({ templateKey: event.target.value })}
          />
          <FormField
            size="small"
            label={nameKoLabel}
            value={draft.nameKo}
            slotProps={{ htmlInput: { maxLength: 200 } }}
            onChange={(event) => patch({ nameKo: event.target.value })}
          />
          <FormField
            size="small"
            label={nameEnLabel}
            value={draft.nameEn}
            slotProps={{ htmlInput: { maxLength: 200 } }}
            onChange={(event) => patch({ nameEn: event.target.value })}
          />
          <FormField
            size="small"
            multiline
            minRows={2}
            label={descriptionKoLabel}
            value={draft.descriptionKo}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
            onChange={(event) => patch({ descriptionKo: event.target.value })}
          />
          <FormField
            size="small"
            multiline
            minRows={2}
            label={descriptionEnLabel}
            value={draft.descriptionEn}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
            onChange={(event) => patch({ descriptionEn: event.target.value })}
          />
          <FormField
            size="small"
            label={ownerLabel}
            value={draft.ownerGroupRef}
            slotProps={{ htmlInput: { maxLength: 160 } }}
            onChange={(event) => patch({ ownerGroupRef: event.target.value })}
          />
          <FormField
            size="small"
            label={categoryLabel}
            value={draft.categoryKey}
            slotProps={{ htmlInput: { maxLength: 100 } }}
            onChange={(event) => patch({ categoryKey: event.target.value })}
          />
          <FormField
            size="small"
            label={workflowLabel}
            value={draft.defaultWorkflowKey}
            slotProps={{ htmlInput: { maxLength: 100 } }}
            onChange={(event) => patch({ defaultWorkflowKey: event.target.value })}
          />
        </Stack>
      ) : null}
    </FormDialog>
  );
}
