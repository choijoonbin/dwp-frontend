import { useTranslation } from 'react-i18next';
import { Eye, MessageSquareReply, Pencil, Undo2 } from 'lucide-react';
import { ActionButton, ProgressMeter } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { approvalRequestNextCommand, approvalRequestProgress } from './approval-request-model';
import { PriorityChip, StatusChip } from './approval-ui';
import { ApprovalAttachmentPanel } from './approval-attachment-panel';
import type { ApprovalAttachmentClient } from './use-approval-attachment-client';

import type { ApprovalRequest } from '@dwp-frontend/shared-utils';

type ApprovalRequestLifecycleInspectorProps = {
  request?: ApprovalRequest;
  actionsReady: boolean;
  pending: boolean;
  onOpenDetails: (request: ApprovalRequest) => void;
  onEdit: (request: ApprovalRequest) => void;
  onRespond: (request: ApprovalRequest) => void;
  onWithdraw: (request: ApprovalRequest) => void;
  attachments: ApprovalAttachmentClient;
};

export function ApprovalRequestLifecycleInspector({
  request,
  actionsReady,
  pending,
  onOpenDetails,
  onEdit,
  onRespond,
  onWithdraw,
  attachments,
}: ApprovalRequestLifecycleInspectorProps) {
  const { t, i18n } = useTranslation('approvals');
  const korean = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language) === 'ko';

  if (!request) {
    return (
      <Box component="section" sx={{ border: 1, borderColor: 'divider' }}>
        <Typography component="h2" variant="subtitle1" sx={{ p: 2 }}>
          {t('requests.detail.title')}
        </Typography>
        <Divider />
        <Stack alignItems="center" gap={1} sx={{ p: 4, color: 'text.secondary' }}>
          <Eye size={28} aria-hidden="true" />
          <Typography variant="body2" textAlign="center">
            {t('requests.emptyDescription')}
          </Typography>
        </Stack>
        <Box sx={{ px: 2 }}>
          <ApprovalAttachmentPanel client={attachments} />
        </Box>
      </Box>
    );
  }

  const progress = approvalRequestProgress(request);
  const nextCommand = approvalRequestNextCommand(request.status);
  return (
    <Box sx={{ position: { lg: 'sticky' }, top: { lg: 88 } }}>
      <Box component="section" sx={{ border: 1, borderColor: 'divider' }}>
        <Stack direction="row" gap={2} justifyContent="space-between" sx={{ p: 2 }}>
          <Box minWidth={0}>
            <Typography component="h2" variant="subtitle1">
              {request.title.trim() || t('requests.autosave.untitled')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {request.requestNumber}
            </Typography>
          </Box>
          <StatusChip status={request.status} />
        </Stack>
        <Divider />
        <Stack divider={<Divider flexItem />}>
          <Stack gap={1.25} sx={{ p: 2 }}>
            <Stack direction="row" gap={0.75} useFlexGap flexWrap="wrap">
              <PriorityChip priority={request.priority} />
              <Typography variant="caption" color="text.secondary">
                {request.dataClassification}
              </Typography>
            </Stack>
            <Typography variant="body2">{request.summary}</Typography>
          </Stack>
          <Stack gap={1.25} sx={{ p: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('requests.columns.workflow')}
              </Typography>
              <Typography component="p" variant="subtitle2">
                {korean ? request.workflowNameKo : request.workflowNameEn}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('requests.columns.due')}
              </Typography>
              <Typography variant="body2">
                {request.dueAt
                  ? formatDate(request.dueAt, { dateStyle: 'medium', timeStyle: 'short' })
                  : t('home.commandCenter.noDueDate')}
              </Typography>
            </Box>
            {request.status !== 'DRAFT' && request.totalSteps > 0 && (
              <ProgressMeter
                size="compact"
                value={progress}
                label={
                  request.currentStepName
                    ? t('requests.currentStep', {
                        name: request.currentStepName,
                        current: request.currentStepSequence,
                        total: request.totalSteps,
                      })
                    : request.status
                }
                valueLabel={`${progress}%`}
              />
            )}
          </Stack>
          <Stack gap={1} sx={{ p: 2 }}>
            <ActionButton
              intent="secondary"
              startIcon={<Eye size={16} />}
              onClick={() => onOpenDetails(request)}
            >
              {t('actions.openDetails')}
            </ActionButton>
            {actionsReady && nextCommand === 'EDIT' && (
              <ActionButton
                intent="primary"
                startIcon={<Pencil size={16} />}
                disabled={pending}
                onClick={() => onEdit(request)}
              >
                {t('actions.edit')}
              </ActionButton>
            )}
            {actionsReady && nextCommand === 'RESPOND' && (
              <ActionButton
                intent="primary"
                startIcon={<MessageSquareReply size={16} />}
                disabled={pending}
                onClick={() => onRespond(request)}
              >
                {t('actions.respondInfo')}
              </ActionButton>
            )}
            {actionsReady && nextCommand === 'WITHDRAW' && (
              <ActionButton
                intent="secondary"
                startIcon={<Undo2 size={16} />}
                disabled={pending}
                onClick={() => onWithdraw(request)}
              >
                {t('actions.withdraw')}
              </ActionButton>
            )}
          </Stack>
        </Stack>
        <Box sx={{ px: 2 }}>
          <ApprovalAttachmentPanel client={attachments} />
        </Box>
      </Box>
    </Box>
  );
}
