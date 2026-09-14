import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import {
  ActionButton,
  FormDialog,
  FormField,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';

import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { downloadApprovalDocumentArtifact } from './approval-document-delivery';
import { useApprovalRequestArchiveExport } from './use-approval-request-archive-export';

import type { ApprovalRequest } from '@dwp-frontend/shared-utils';

export function ApprovalRequestArchiveExport({
  requests,
  onBlockedChange,
  onRefreshRequests,
}: {
  requests: readonly ApprovalRequest[];
  onBlockedChange: (blocked: boolean, isBlocked: () => boolean) => void;
  onRefreshRequests: () => Promise<readonly ApprovalRequest[] | undefined>;
}) {
  const { t } = useTranslation('approvals');
  const archive = useApprovalRequestArchiveExport(requests);
  const [delivering, setDelivering] = useState(false);
  const [error, setError] = useState(false);
  const flight = useRef(false);
  const notify = useRef(onBlockedChange);
  notify.current = onBlockedChange;
  const archiveGuard = useRef(archive.isBlocked);
  archiveGuard.current = archive.isBlocked;
  const locked = archive.pending || archive.unknown || delivering;
  useEffect(() => {
    notify.current(locked, () => archiveGuard.current() || flight.current);
    return () => notify.current(false, () => false);
  }, [locked]);
  const refresh = async () => {
    const refreshedRequests = await onRefreshRequests();
    if (refreshedRequests) await archive.refresh(refreshedRequests);
  };
  const download = async () => {
    if (!archive.artifact || flight.current) return;
    flight.current = true;
    setDelivering(true);
    setError(false);
    try {
      await downloadApprovalDocumentArtifact(
        archive.artifact.document,
        archive.verifyArtifact,
        archive.artifactCurrent
      );
      archive.clearArtifact();
    } catch {
      setError(true);
    } finally {
      flight.current = false;
      setDelivering(false);
    }
  };
  return (
    <>
      <ActionButton
        intent="secondary"
        size="small"
        startIcon={<Download size={16} />}
        disabled={!archive.available || requests.length === 0 || archive.pending || delivering}
        onClick={() => archive.setOpen(true)}
      >
        {t('requests.documents.archiveExport')}
      </ActionButton>
      <FormDialog
        open={archive.open}
        title={t('requests.documents.archiveExport')}
        description={t('requests.documents.selectArchive')}
        cancelLabel={t('actions.close')}
        submitLabel={t('requests.documents.archiveExport')}
        busy={archive.pending || delivering}
        mobileFullScreen
        submitDisabled={!archive.ready || locked || archive.reason.trim().length < 4}
        onClose={() => {
          if (!archive.pending && !delivering) archive.setOpen(false);
        }}
        onSubmit={archive.begin}
      >
        <Stack gap={2}>
          {archive.queries.some((query) => query.isFetching) && (
            <LoadingState label={t('common:labels.loading')} size="compact" embedded />
          )}
          {(archive.verificationError || archive.queries.some((query) => query.isError)) && (
            <InlineFeedback severity="error">{t('requests.documents.sourceError')}</InlineFeedback>
          )}
          <Typography variant="caption" color="text.secondary">
            {t('requests.documents.selected', { count: archive.selected.length })}
          </Typography>
          <Stack component="fieldset" sx={{ border: 0, m: 0, p: 0 }}>
            <Typography component="legend" variant="subtitle2">
              {t('requests.documents.selectArchive')}
            </Typography>
            {requests.slice(0, 50).map((request, index) => (
              <FormControlLabel
                key={request.requestId}
                control={
                  <Checkbox
                    checked={archive.selected.includes(request.requestId)}
                    disabled={
                      !archive.queryReady ||
                      locked ||
                      !archive.queries[index]?.data?.archiveExport.allowed
                    }
                    onChange={() => archive.toggle(request.requestId)}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                    {request.requestNumber} · {request.title}
                  </Typography>
                }
              />
            ))}
          </Stack>
          {archive.selected.length > 0 && !archive.ready && (
            <InlineFeedback severity="warning">
              {t('requests.documents.archiveUnavailable')}
            </InlineFeedback>
          )}
          <FormField
            required
            multiline
            minRows={3}
            label={t('requests.documents.exportReason')}
            value={archive.reason}
            disabled={locked}
            inputProps={{ maxLength: 1000 }}
            onChange={(event) => archive.setReason(event.target.value)}
          />
          {archive.recovery && (
            <InlineFeedback severity="warning">
              {t(archive.unknown ? 'requests.documents.unknown' : 'requests.documents.conflict')}
            </InlineFeedback>
          )}
          {Boolean(archive.recovery || archive.verificationError) && (
            <ActionButton
              intent="quiet"
              disabled={archive.pending || delivering}
              onClick={() => void refresh()}
            >
              {t('actions.refresh')}
            </ActionButton>
          )}
          {archive.unknown && (
            <ActionButton
              intent="secondary"
              disabled={!archive.retryAllowed || archive.pending || delivering}
              onClick={archive.retryOriginal}
            >
              {t('requests.documents.retryOriginal')}
            </ActionButton>
          )}
          {archive.artifact && (
            <InlineFeedback
              severity="success"
              action={
                <ActionButton
                  intent="secondary"
                  size="small"
                  startIcon={<Download size={16} />}
                  disabled={delivering}
                  loading={delivering}
                  onClick={() => void download()}
                >
                  {t('requests.documents.download')}
                </ActionButton>
              }
            >
              {t('requests.documents.generated')}
            </InlineFeedback>
          )}
          {error && (
            <InlineFeedback severity="error">{t('requests.documents.expired')}</InlineFeedback>
          )}
        </Stack>
      </FormDialog>
    </>
  );
}
