import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormDialog, InlineFeedback } from '@dwp-frontend/design-system';
import Typography from '@mui/material/Typography';
import { downloadApprovalDocumentArtifact } from './approval-document-delivery';
import type { ApprovalGeneratedDocument } from '@dwp-frontend/shared-utils/api/approval-document-contract';

export function ApprovalDocumentDownloadDialog({
  document,
  onVerify,
  isCurrent,
  onClose,
}: {
  document: ApprovalGeneratedDocument | null;
  onVerify: () => Promise<void>;
  isCurrent: () => boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('approvals');
  const current = useRef(document);
  current.current = document;
  const active = useRef(true);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    setExpired(false);
    setError(false);
    if (!document) return undefined;
    const timer = window.setTimeout(
      () => setExpired(true),
      Math.max(
        0,
        Math.min(Date.parse(document.expiresAt), Date.parse(document.retainUntil)) - Date.now()
      )
    );
    return () => window.clearTimeout(timer);
  }, [document]);
  const download = async () => {
    if (!document || expired || busyRef.current) return;
    const expected = document;
    busyRef.current = true;
    setBusy(true);
    try {
      await downloadApprovalDocumentArtifact(
        expected,
        onVerify,
        () => active.current && current.current === expected && isCurrent()
      );
      if (active.current && current.current === expected) onClose();
    } catch {
      if (active.current && current.current === expected) setError(true);
    } finally {
      busyRef.current = false;
      if (active.current) setBusy(false);
    }
  };
  return (
    <FormDialog
      open={document !== null}
      title={t('requests.documents.download')}
      cancelLabel={t('actions.close')}
      submitLabel={t('requests.documents.download')}
      onClose={onClose}
      onSubmit={download}
      busy={busy}
      submitDisabled={expired || error}
      mobileFullScreen
    >
      {(expired || error) && (
        <InlineFeedback severity="warning">{t('requests.documents.expired')}</InlineFeedback>
      )}
      <Typography sx={{ overflowWrap: 'anywhere' }}>{document?.fileName}</Typography>
    </FormDialog>
  );
}
