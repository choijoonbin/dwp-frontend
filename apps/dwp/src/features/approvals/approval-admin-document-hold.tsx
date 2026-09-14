import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History, LockKeyhole, RefreshCcw, Search, ShieldCheck, UnlockKeyhole } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  ErrorState,
  FormDialog,
  FormField,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';

import { ApprovalSurface } from './approval-ui';
import { approvalDocumentRequestIdValid } from './approval-admin-document-model';
import type { ApprovalDocumentHold } from '@dwp-frontend/shared-utils/api/approval-document-contract';

export function ApprovalAdminDocumentHold({
  hold,
  input,
  selectedId,
  loading,
  unavailable,
  busy,
  canRead,
  canEdit,
  canPublish,
  makerBlocked,
  completedProposals,
  onInput,
  onLookup,
  onRefresh,
  onPropose,
  onPublish,
}: {
  hold?: ApprovalDocumentHold;
  input: string;
  selectedId: string | null;
  loading: boolean;
  unavailable: boolean;
  busy: boolean;
  canRead: boolean;
  canEdit: boolean;
  canPublish: boolean;
  makerBlocked: boolean;
  completedProposals: number;
  onInput: (value: string) => void;
  onLookup: () => void;
  onRefresh: () => void;
  onPropose: (operation: 'PLACE' | 'RELEASE', reason: string, version: number) => boolean;
  onPublish: (comment: string, version: number, proposalId: string) => boolean;
}) {
  const { t, i18n } = useTranslation('approvals');
  const [proposal, setProposal] = useState<{
    operation: 'PLACE' | 'RELEASE';
    version: number;
    requestId: string;
    reason: string;
  } | null>(null);
  const [review, setReview] = useState<{
    version: number;
    proposalId: string;
    comment: string;
  } | null>(null);
  useEffect(() => {
    setProposal(null);
  }, [completedProposals]);
  const proposalReady = Boolean(
    canEdit &&
    hold &&
    !hold.pending &&
    proposal &&
    proposal.version === hold.version &&
    proposal.requestId === hold.requestId &&
    (proposal.operation === 'PLACE') !== hold.active
  );
  const reviewReady = Boolean(
    canPublish &&
    !makerBlocked &&
    hold &&
    review &&
    review.version === hold.version &&
    review.proposalId === hold.pending?.proposalId
  );
  const restricted = Boolean(hold?.active || hold?.pending?.operation === 'PLACE');
  const timestamp = (value: string) =>
    formatDate(
      value,
      { dateStyle: 'medium', timeStyle: 'short' },
      resolveSupportedLocale(i18n.resolvedLanguage, i18n.language)
    );
  return (
    <>
      <ApprovalSurface
        title={t('admin.document.holdTitle')}
        meta={selectedId ?? t('admin.document.requestId')}
        action={
          <ActionIconButton
            label={t('admin.document.refreshHold')}
            disabled={!selectedId || !canRead}
            loading={loading}
            onClick={onRefresh}
          >
            <RefreshCcw size={16} />
          </ActionIconButton>
        }
      >
        <Stack gap={2} sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'flex-start' }}>
            <FormField
              fullWidth
              label={t('admin.document.requestId')}
              value={input}
              disabled={busy || !canRead}
              slotProps={{ htmlInput: { maxLength: 36 } }}
              onChange={(event) => onInput(event.target.value)}
            />
            <ActionButton
              intent="secondary"
              startIcon={<Search size={16} />}
              disabled={busy || !canRead || !approvalDocumentRequestIdValid(input)}
              onClick={onLookup}
            >
              {t('admin.document.lookup')}
            </ActionButton>
          </Stack>
          {loading ? <LoadingState label={t('admin.document.holdTitle')} size="compact" /> : null}
          {unavailable ? (
            <ErrorState
              title={t('admin.document.sourceUnavailable')}
              size="compact"
              retryLabel={t('admin.document.refreshHold')}
              onRetry={onRefresh}
            />
          ) : null}
          <InlineFeedback severity="warning" icon={<ShieldCheck size={18} />}>
            {t('admin.document.preservationGate')}
          </InlineFeedback>
          {hold ? (
            <Stack gap={2}>
              <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                {restricted ? <LockKeyhole size={18} /> : <UnlockKeyhole size={18} />}
                <Chip
                  size="small"
                  variant="outlined"
                  sx={{ color: 'text.primary' }}
                  color={restricted ? 'warning' : 'default'}
                  label={t(
                    restricted ? 'admin.document.holdRestricted' : 'admin.document.holdUnrestricted'
                  )}
                />
                <Chip size="small" variant="outlined" label={`v${hold.version}`} />
                {hold.preservationPending ? (
                  <Chip
                    size="small"
                    variant="outlined"
                    sx={{ color: 'text.primary' }}
                    color="warning"
                    label={t('admin.document.preservationPending')}
                  />
                ) : null}
              </Stack>
              <Box
                component="dl"
                sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: 1 }}
              >
                <Box component="dt" sx={{ typography: 'caption', color: 'text.secondary' }}>
                  {t('admin.document.purgeState')}
                </Box>
                <Box component="dd" sx={{ m: 0, typography: 'caption', overflowWrap: 'anywhere' }}>
                  <Box component="code">{hold.purgeState}</Box>
                </Box>
                <Box component="dt" sx={{ typography: 'caption', color: 'text.secondary' }}>
                  {t('admin.document.retainUntil')}
                </Box>
                <Box component="dd" sx={{ m: 0, typography: 'caption', overflowWrap: 'anywhere' }}>
                  {timestamp(hold.retainUntil)}
                </Box>
              </Box>
              {hold.pending ? (
                <InlineFeedback severity="warning">
                  <Box sx={{ typography: 'subtitle2' }}>
                    {t('admin.document.pending')} /{' '}
                    {t(
                      hold.pending.operation === 'PLACE'
                        ? 'admin.document.place'
                        : 'admin.document.release'
                    )}
                  </Box>
                  <Box
                    sx={{ typography: 'body2', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                  >
                    {hold.pending.reason}
                  </Box>
                </InlineFeedback>
              ) : null}
              {hold.pending && makerBlocked ? (
                <InlineFeedback severity="warning">
                  {t('admin.document.makerBlocked')}
                </InlineFeedback>
              ) : null}
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                {canEdit && !hold.pending ? (
                  <ActionButton
                    intent="secondary"
                    disabled={busy}
                    startIcon={
                      hold.active ? <UnlockKeyhole size={16} /> : <LockKeyhole size={16} />
                    }
                    onClick={() =>
                      setProposal({
                        operation: hold.active ? 'RELEASE' : 'PLACE',
                        version: hold.version,
                        requestId: hold.requestId,
                        reason: '',
                      })
                    }
                  >
                    {t(hold.active ? 'admin.document.release' : 'admin.document.place')}
                  </ActionButton>
                ) : null}
                {canPublish && hold.pending ? (
                  <ActionButton
                    intent="primary"
                    disabled={busy || makerBlocked}
                    onClick={() =>
                      setReview({
                        version: hold.version,
                        proposalId: hold.pending!.proposalId,
                        comment: '',
                      })
                    }
                  >
                    {t('actions.publish')}
                  </ActionButton>
                ) : null}
              </Stack>
              <Stack direction="row" gap={1} alignItems="center">
                <History size={16} />
                <Box sx={{ typography: 'subtitle2' }}>{t('admin.document.journal')}</Box>
              </Stack>
              {hold.journal.length ? (
                <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
                  {hold.journal.map((entry) => (
                    <Box
                      component="li"
                      key={entry.entryId}
                      sx={{ py: 1, borderTop: 1, borderColor: 'divider' }}
                    >
                      <Stack direction="row" gap={1} justifyContent="space-between" flexWrap="wrap">
                        <Box sx={{ typography: 'body2' }}>
                          {t(
                            entry.operation === 'PLACE'
                              ? 'admin.document.place'
                              : 'admin.document.release'
                          )}
                        </Box>
                        <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                          {timestamp(entry.occurredAt)}
                        </Box>
                      </Stack>
                      <Box
                        sx={{
                          typography: 'caption',
                          whiteSpace: 'pre-wrap',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {entry.reason}
                      </Box>
                      <Box
                        sx={{
                          typography: 'caption',
                          color: 'text.secondary',
                          whiteSpace: 'pre-wrap',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {entry.reviewComment}
                      </Box>
                    </Box>
                  ))}
                </Box>
              ) : (
                <InlineFeedback severity="info">{t('admin.document.noJournal')}</InlineFeedback>
              )}
            </Stack>
          ) : null}
        </Stack>
      </ApprovalSurface>
      <FormDialog
        open={Boolean(proposal)}
        title={t(
          proposal?.operation === 'RELEASE' ? 'admin.document.release' : 'admin.document.place'
        )}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('actions.save')}
        busy={busy}
        submitDisabled={!proposalReady || (proposal?.reason.trim().length ?? 0) < 10}
        onClose={() => setProposal(null)}
        onSubmit={() => {
          if (proposal) onPropose(proposal.operation, proposal.reason, proposal.version);
        }}
        maxWidth="sm"
        mobileFullScreen
      >
        {!proposalReady ? (
          <InlineFeedback severity="warning">{t('admin.document.versionChanged')}</InlineFeedback>
        ) : null}
        <FormField
          label={t('admin.document.reason')}
          value={proposal?.reason ?? ''}
          multiline
          minRows={3}
          disabled={busy || !proposalReady}
          slotProps={{ htmlInput: { maxLength: 1000 } }}
          onChange={(event) =>
            setProposal((value) => value && { ...value, reason: event.target.value })
          }
        />
      </FormDialog>
      <FormDialog
        open={Boolean(review)}
        title={t('actions.publish')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('actions.publish')}
        busy={busy}
        submitDisabled={!reviewReady || (review?.comment.trim().length ?? 0) < 10}
        onClose={() => setReview(null)}
        onSubmit={() => {
          if (review && onPublish(review.comment, review.version, review.proposalId))
            setReview(null);
        }}
        maxWidth="sm"
        mobileFullScreen
      >
        {!reviewReady ? (
          <InlineFeedback severity="warning">{t('admin.document.formDisabled')}</InlineFeedback>
        ) : null}
        <FormField
          label={t('admin.document.reviewComment')}
          value={review?.comment ?? ''}
          multiline
          minRows={3}
          disabled={busy || !reviewReady}
          slotProps={{ htmlInput: { maxLength: 1000 } }}
          onChange={(event) =>
            setReview((value) => value && { ...value, comment: event.target.value })
          }
        />
      </FormDialog>
    </>
  );
}
