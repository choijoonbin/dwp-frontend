import { useTranslation } from 'react-i18next';
import { CopyPlus, Eye, MessageSquareReply, Pencil, Undo2 } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  foundationTokens,
  ProgressMeter,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { approvalRequestNextCommand, approvalRequestProgress } from './approval-request-model';
import { PriorityChip, StatusChip } from './approval-ui';
import { canCreateResubmissionDraft } from './use-approval-resubmit-draft';

import type { ApprovalRequest } from '@dwp-frontend/shared-utils';

type ApprovalRequestListPanelProps = {
  requests: readonly ApprovalRequest[];
  selectedId?: string;
  actionsReady: boolean;
  pending: boolean;
  onSelect: (request: ApprovalRequest, trigger?: HTMLElement) => void;
  onOpenDetails: (request: ApprovalRequest, trigger?: HTMLElement) => void;
  onEdit: (request: ApprovalRequest) => void;
  onRespond: (request: ApprovalRequest) => void;
  onWithdraw: (request: ApprovalRequest) => void;
  onResubmit?: (request: ApprovalRequest) => void;
  resubmitPendingId?: string;
};

export function ApprovalRequestListPanel({
  requests,
  selectedId,
  actionsReady,
  pending,
  onSelect,
  onOpenDetails,
  onEdit,
  onRespond,
  onWithdraw,
  onResubmit,
  resubmitPendingId,
}: ApprovalRequestListPanelProps) {
  const { t, i18n } = useTranslation('approvals');
  const korean = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language) === 'ko';

  return (
    <List disablePadding aria-label={t('requests.columns.request')}>
      {requests.map((request) => {
        const nextCommand = approvalRequestNextCommand(request.status);
        const progress = approvalRequestProgress(request);
        const selected = request.requestId === selectedId;
        return (
          <ListItem
            key={request.requestId}
            disablePadding
            divider
            sx={{ display: 'block', bgcolor: selected ? 'action.selected' : 'background.paper' }}
          >
            <ListItemButton
              selected={selected}
              aria-current={selected ? 'true' : undefined}
              onClick={(event) => onSelect(request, event.currentTarget)}
              sx={{ alignItems: 'stretch', px: 2, py: 1.75 }}
            >
              <Stack gap={1.1} width="100%" minWidth={0}>
                <Stack
                  direction="row"
                  gap={1}
                  justifyContent="space-between"
                  alignItems="flex-start"
                >
                  <Box minWidth={0}>
                    <Typography variant="caption" color="text.secondary">
                      {request.requestNumber}
                    </Typography>
                    <Typography component="p" variant="subtitle2">
                      {request.title.trim() || t('requests.autosave.untitled')}
                    </Typography>
                  </Box>
                  <Box
                    style={{ borderRadius: foundationTokens.radius.control }}
                    sx={{ display: 'flex', bgcolor: 'background.paper' }}
                  >
                    <StatusChip status={request.status} />
                  </Box>
                </Stack>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {request.summary}
                </Typography>
                {request.status === 'NEEDS_INFO' && request.latestInformationRequest && (
                  <Stack
                    direction="row"
                    gap={0.75}
                    alignItems="flex-start"
                    sx={{
                      color: (theme) =>
                        theme.palette.mode === 'dark' ? 'warning.light' : 'warning.dark',
                    }}
                  >
                    <MessageSquareReply size={14} aria-hidden="true" style={{ marginTop: 2 }} />
                    <Typography variant="caption" color="inherit">
                      {request.latestInformationRequest}
                    </Typography>
                  </Stack>
                )}
                <Stack direction="row" gap={0.75} useFlexGap flexWrap="wrap" alignItems="center">
                  <Box
                    style={{ borderRadius: foundationTokens.radius.control }}
                    sx={{ display: 'flex', bgcolor: 'background.paper' }}
                  >
                    <PriorityChip priority={request.priority} />
                  </Box>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={korean ? request.workflowNameKo : request.workflowNameEn}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ ml: { sm: 'auto' } }}>
                    {request.dueAt
                      ? formatDate(request.dueAt, { dateStyle: 'medium' })
                      : t('home.commandCenter.noDueDate')}
                  </Typography>
                </Stack>
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
            </ListItemButton>
            <Stack
              direction="row"
              gap={0.75}
              justifyContent="flex-end"
              alignItems="center"
              sx={{ px: 2, pb: 1.5 }}
            >
              <ActionIconButton
                label={t('actions.openDetails')}
                tooltip={t('actions.openDetails')}
                size="small"
                data-approval-request-detail-id={request.requestId}
                onClick={(event) => onOpenDetails(request, event.currentTarget)}
              >
                <Eye size={17} />
              </ActionIconButton>
              {actionsReady && nextCommand === 'EDIT' && (
                <ActionButton
                  intent="secondary"
                  size="small"
                  startIcon={<Pencil size={15} />}
                  disabled={pending}
                  onClick={() => onEdit(request)}
                >
                  {t('actions.edit')}
                </ActionButton>
              )}
              {actionsReady && nextCommand === 'RESPOND' && (
                <ActionButton
                  intent="primary"
                  size="small"
                  startIcon={<MessageSquareReply size={15} />}
                  disabled={pending}
                  onClick={() => onRespond(request)}
                >
                  {t('actions.respondInfo')}
                </ActionButton>
              )}
              {actionsReady && nextCommand === 'WITHDRAW' && (
                <ActionButton
                  intent="secondary"
                  size="small"
                  startIcon={<Undo2 size={15} />}
                  disabled={pending}
                  onClick={() => onWithdraw(request)}
                >
                  {t('actions.withdraw')}
                </ActionButton>
              )}
              {actionsReady && onResubmit && canCreateResubmissionDraft(request) && (
                <ActionButton
                  intent="primary"
                  size="small"
                  startIcon={<CopyPlus size={15} />}
                  disabled={pending || Boolean(resubmitPendingId)}
                  onClick={() => onResubmit(request)}
                >
                  {t('requests.resubmit.action')}
                </ActionButton>
              )}
            </Stack>
          </ListItem>
        );
      })}
    </List>
  );
}
