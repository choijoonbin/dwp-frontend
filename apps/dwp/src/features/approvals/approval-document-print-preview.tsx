import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormDialog, InlineFeedback } from '@dwp-frontend/design-system';
import { verifyApprovalGeneratedDocument } from '@dwp-frontend/shared-utils/api/approval-document-api';

import Box from '@mui/material/Box';

import { verifyApprovalPrintHtml } from './approval-document-delivery';

import type { ApprovalGeneratedDocument } from '@dwp-frontend/shared-utils/api/approval-document-contract';

export function ApprovalDocumentPrintPreview({
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
  const frame = useRef<HTMLIFrameElement>(null);
  const current = useRef(document);
  current.current = document;
  const [html, setHtml] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState(false);
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    let active = true;
    setHtml('');
    setReady(false);
    setError(false);
    setExpired(false);
    if (!document) return undefined;
    const expiry = Math.min(Date.parse(document.expiresAt), Date.parse(document.retainUntil));
    const timer = window.setTimeout(
      () => {
        if (active) {
          setExpired(true);
          setReady(false);
          setHtml('');
        }
      },
      Math.max(0, expiry - Date.now())
    );
    void verifyApprovalGeneratedDocument(document, document.policyVersion, 'PRINT')
      .then((value) => {
        if (active) setHtml(verifyApprovalPrintHtml(value.content));
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [document]);
  const print = async () => {
    if (!document || !ready || expired || busyRef.current) return;
    const expected = document;
    busyRef.current = true;
    setBusy(true);
    setError(false);
    try {
      await onVerify();
      await verifyApprovalGeneratedDocument(expected, expected.policyVersion, 'PRINT');
      if (current.current !== expected || !isCurrent() || !frame.current?.contentWindow)
        throw new Error('Print context changed');
      frame.current.contentWindow.focus();
      frame.current.contentWindow.print();
    } catch {
      if (current.current === expected) {
        setError(true);
        setReady(false);
        setHtml('');
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return (
    <FormDialog
      open={document !== null}
      title={t('requests.documents.preview')}
      cancelLabel={t('actions.close')}
      submitLabel={t('requests.documents.print')}
      busy={busy}
      submitDisabled={!ready || expired || error}
      onClose={onClose}
      onSubmit={print}
      maxWidth="lg"
      mobileFullScreen
    >
      {(error || expired) && (
        <InlineFeedback severity="warning">{t('requests.documents.expired')}</InlineFeedback>
      )}
      {html && (
        <Box
          component="iframe"
          ref={frame}
          srcDoc={html}
          title={t('requests.documents.preview')}
          sandbox="allow-same-origin allow-modals"
          referrerPolicy="no-referrer"
          onLoad={() => {
            if (
              current.current === document &&
              document &&
              Date.parse(document.expiresAt) > Date.now() &&
              Date.parse(document.retainUntil) > Date.now()
            )
              setReady(true);
          }}
          sx={{
            width: '100%',
            height: { xs: '60dvh', sm: 600 },
            border: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        />
      )}
    </FormDialog>
  );
}
