import { FormDialog, FormField, InlineFeedback } from '@dwp-frontend/design-system';

export function NotificationDraftDecisionDialog({
  open,
  title,
  description,
  target,
  reasonLabel,
  reasonHelp,
  reason,
  confirmLabel,
  submittingLabel,
  cancelLabel,
  busy,
  onReasonChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description: string;
  target: string;
  reasonLabel: string;
  reasonHelp: string;
  reason: string;
  confirmLabel: string;
  submittingLabel: string;
  cancelLabel: string;
  busy: boolean;
  onReasonChange: (reason: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <FormDialog
      open={open}
      title={title}
      description={description}
      cancelLabel={cancelLabel}
      submitLabel={confirmLabel}
      submittingLabel={submittingLabel}
      submitIntent="danger"
      busy={busy}
      submitDisabled={reason.trim().length < 10}
      onClose={onClose}
      onSubmit={onSubmit}
      maxWidth="sm"
    >
      <InlineFeedback severity="warning">{target}</InlineFeedback>
      <FormField
        label={reasonLabel}
        value={reason}
        onChange={(event) => onReasonChange(event.target.value)}
        multiline
        minRows={3}
        required
        supportingText={reasonHelp}
        sx={{ mt: 2 }}
      />
    </FormDialog>
  );
}
