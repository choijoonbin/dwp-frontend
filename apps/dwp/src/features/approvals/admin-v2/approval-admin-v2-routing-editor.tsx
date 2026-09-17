import { FormDialog, FormField, InlineFeedback } from '@dwp-frontend/design-system';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ApprovalAdminV2RoutingGroupDraft } from '@dwp-frontend/shared-utils/api/approval-admin-v2-governed-api';

export function ApprovalAdminV2RoutingEditor({
  draft,
  busy,
  title,
  description,
  displayNameLabel,
  descriptionLabel,
  preservedLabel,
  cancelLabel,
  saveLabel,
  savingLabel,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: ApprovalAdminV2RoutingGroupDraft | null;
  busy: boolean;
  title: string;
  description: string;
  displayNameLabel: string;
  descriptionLabel: string;
  preservedLabel: string;
  cancelLabel: string;
  saveLabel: string;
  savingLabel: string;
  onChange: (draft: ApprovalAdminV2RoutingGroupDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const valid = Boolean(draft?.displayName.trim()) && (draft?.description.length ?? 0) <= 1000;
  return (
    <FormDialog
      open={Boolean(draft)}
      title={title}
      description={description}
      cancelLabel={cancelLabel}
      submitLabel={saveLabel}
      submittingLabel={savingLabel}
      submitDisabled={!valid}
      busy={busy}
      mobileFullScreen
      onClose={onClose}
      onSubmit={onSubmit}
    >
      {draft ? (
        <Stack gap={2}>
          <FormField
            autoFocus
            required
            fullWidth
            label={displayNameLabel}
            value={draft.displayName}
            inputProps={{ maxLength: 200 }}
            onChange={(event) => onChange({ ...draft, displayName: event.target.value })}
          />
          <FormField
            fullWidth
            multiline
            minRows={3}
            label={descriptionLabel}
            value={draft.description}
            inputProps={{ maxLength: 1000 }}
            onChange={(event) => onChange({ ...draft, description: event.target.value })}
          />
          <InlineFeedback severity="info">{preservedLabel}</InlineFeedback>
          <Typography variant="caption" color="text.secondary">
            {`${draft.groupKey} · ${draft.lifecycle} · v${draft.expectedVersion} · ${draft.members.length}`}
          </Typography>
        </Stack>
      ) : null}
    </FormDialog>
  );
}
