import {
  ChevronLeft,
  ChevronRight,
  Download,
  MessageSquareText,
  Printer,
  RefreshCw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  ActionButton,
  ActionIconButton,
  FormDialog,
  FormField,
  InlineFeedback,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ApprovalDocumentPrintPreview } from './approval-document-print-preview';
import { ApprovalDocumentDownloadDialog } from './approval-document-download-dialog';

import type { ApprovalTaskDocumentsController } from './use-approval-task-documents';

export function ApprovalTaskDocumentTools({
  controller: documents,
  mode = 'default',
}: {
  controller: ApprovalTaskDocumentsController;
  mode?: 'default' | 'evidence';
}) {
  const { t } = useTranslation('approvals');
  const open = documents.dialog;
  const text = documents.text;
  const submit = async () => {
    if (!open) return;
    const result = await documents.start(open, text);
    if (result) {
      documents.completeDialog();
    }
  };
  const tools = documents.ready ? documents.tools.data : undefined;
  return (
    <Box
      component="section"
      aria-label={t(
        mode === 'evidence' ? 'completed.evidence.documentTitle' : 'requests.documents.title'
      )}
      sx={{ mt: 1.5 }}
    >
      <Stack direction="row" alignItems="center" gap={0.5}>
        {mode === 'default' && (
          <ActionIconButton
            label={t('requests.documents.comments')}
            disabled={!tools?.comment.allowed || documents.busy || Boolean(documents.pending)}
            onClick={() => documents.openDialog('COMMENT')}
          >
            <MessageSquareText size={16} />
          </ActionIconButton>
        )}
        <ActionIconButton
          label={t('requests.documents.print')}
          disabled={!tools?.print.allowed || documents.busy || Boolean(documents.pending)}
          onClick={() => documents.openDialog('PRINT')}
        >
          <Printer size={16} />
        </ActionIconButton>
        <ActionIconButton
          label={t('requests.documents.download')}
          disabled={!tools?.jsonExport.allowed || documents.busy || Boolean(documents.pending)}
          onClick={() => documents.openDialog('DOWNLOAD')}
        >
          <Download size={16} />
        </ActionIconButton>
        {!documents.ready && (
          <Typography variant="caption" color="text.secondary">
            {t('requests.documents.policyBlocked')}
          </Typography>
        )}
      </Stack>
      {mode === 'default' &&
        documents.comments.isSuccess &&
        documents.comments.failureCount === 0 &&
        !documents.comments.isFetching &&
        documents.ready &&
        documents.comments.data.items.map((item) => (
          <Box key={item.commentId} sx={{ pt: 1, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">
              {t('requests.documents.author', { id: item.authorUserId })} ·{' '}
              {formatDate(item.createdAt, { dateStyle: 'short', timeStyle: 'short' })}
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {item.text}
            </Typography>
          </Box>
        ))}
      {mode === 'default' &&
        documents.comments.isSuccess &&
        documents.ready &&
        !documents.comments.isFetching &&
        documents.comments.failureCount === 0 &&
        documents.comments.data.totalElements > 25 && (
          <Stack direction="row" alignItems="center" justifyContent="flex-end">
            <ActionIconButton
              label={t('common:actions.previous')}
              disabled={documents.page === 0}
              onClick={() => documents.setPage(documents.page - 1)}
            >
              <ChevronLeft size={16} />
            </ActionIconButton>
            <Typography variant="caption">
              {documents.page + 1} / {Math.ceil(documents.comments.data.totalElements / 25)}
            </Typography>
            <ActionIconButton
              label={t('common:actions.next')}
              disabled={(documents.page + 1) * 25 >= documents.comments.data.totalElements}
              onClick={() => documents.setPage(documents.page + 1)}
            >
              <ChevronRight size={16} />
            </ActionIconButton>
          </Stack>
        )}
      {documents.failure && (
        <InlineFeedback severity="warning">
          {t(
            documents.failure === 'UNKNOWN'
              ? 'requests.documents.unknown'
              : documents.failure === 'CONFLICT'
                ? 'requests.documents.conflict'
                : 'requests.documents.sourceError'
          )}
        </InlineFeedback>
      )}
      {documents.pending && !open && (
        <ActionButton
          size="small"
          loading={documents.busy}
          disabled={!documents.retryAvailable}
          onClick={() => void documents.retryOriginal()}
        >
          {t('requests.documents.retryOriginal')}
        </ActionButton>
      )}
      {!documents.ready && !open && (
        <ActionIconButton
          label={t('actions.refresh')}
          disabled={documents.busy || documents.refreshing}
          onClick={() => void documents.refreshSource().catch(() => undefined)}
        >
          <RefreshCw size={16} />
        </ActionIconButton>
      )}
      <FormDialog
        open={open !== null}
        title={t(
          open === 'COMMENT' ? 'requests.documents.comments' : 'requests.documents.exportTitle'
        )}
        cancelLabel={t('actions.cancel')}
        submitLabel={t(
          open === 'COMMENT' ? 'requests.documents.addComment' : 'requests.documents.generate'
        )}
        secondaryActions={
          documents.pending && documents.ready ? (
            <ActionButton
              loading={documents.busy}
              disabled={!documents.retryAvailable}
              onClick={async () => {
                if (await documents.retryOriginal()) {
                  documents.completeDialog();
                }
              }}
            >
              {t('requests.documents.retryOriginal')}
            </ActionButton>
          ) : !documents.ready ? (
            <ActionIconButton
              label={t('actions.refresh')}
              disabled={documents.busy || documents.refreshing}
              onClick={() => void documents.refreshSource().catch(() => undefined)}
            >
              <RefreshCw size={16} />
            </ActionIconButton>
          ) : undefined
        }
        busy={documents.busy || documents.refreshing}
        submitDisabled={
          !documents.ready ||
          Boolean(documents.pending) ||
          text.trim().length < (open === 'COMMENT' ? 1 : 4)
        }
        onClose={documents.closeDialog}
        onSubmit={submit}
        mobileFullScreen
      >
        {documents.failure && (
          <InlineFeedback severity="warning">
            {t(
              documents.failure === 'UNKNOWN'
                ? 'requests.documents.unknown'
                : documents.failure === 'CONFLICT'
                  ? 'requests.documents.conflict'
                  : 'requests.documents.sourceError'
            )}
          </InlineFeedback>
        )}
        <FormField
          label={t(
            open === 'COMMENT'
              ? 'requests.documents.commentText'
              : 'requests.documents.exportReason'
          )}
          value={text}
          onChange={(event) => documents.setText(event.target.value)}
          multiline
          minRows={3}
          required
          disabled={!documents.ready || documents.busy || Boolean(documents.pending)}
          inputProps={{ maxLength: open === 'COMMENT' ? 2000 : 1000 }}
        />
      </FormDialog>
      <ApprovalDocumentDownloadDialog
        document={documents.artifact?.format === 'JSON' ? documents.artifact : null}
        onVerify={documents.verifyArtifact}
        isCurrent={documents.artifactCurrent}
        onClose={documents.closeArtifact}
      />
      <ApprovalDocumentPrintPreview
        document={documents.artifact?.format === 'HTML' ? documents.artifact : null}
        onVerify={documents.verifyArtifact}
        isCurrent={documents.artifactCurrent}
        onClose={documents.closeArtifact}
      />
    </Box>
  );
}
