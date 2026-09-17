import { useMemo, useState } from 'react';
import { CheckCircle2, MessageSquareText, Reply } from 'lucide-react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { ActionButton, LoadingState } from '@dwp-frontend/design-system';

import type {
  DwaionArtifactProviderCapability,
  DwaionTeamArtifactComment,
} from '@dwp-frontend/shared-utils';

export function DwaionArtifactInlineComments({
  capability,
  workspaceAvailable,
  comments,
  loading,
  busy,
  error,
  canEdit,
  locale,
  formatTimestamp = (value) => value,
  onRetry,
  onCreate,
  onReply,
  onResolve,
}: {
  capability: DwaionArtifactProviderCapability | null;
  workspaceAvailable: boolean;
  comments: readonly DwaionTeamArtifactComment[];
  loading: boolean;
  busy: boolean;
  error: unknown;
  canEdit: boolean;
  locale: 'ko' | 'en';
  formatTimestamp?: (value: string) => string;
  onRetry: () => void;
  onCreate: (input: { body: string; anchor: string | null }) => Promise<unknown>;
  onReply: (input: { comment: DwaionTeamArtifactComment; body: string }) => Promise<unknown>;
  onResolve: (comment: DwaionTeamArtifactComment) => Promise<unknown>;
}) {
  const text = COPY[locale];
  const [body, setBody] = useState('');
  const [anchor, setAnchor] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const available = Boolean(capability?.available && capability.configured);
  const openCount = comments.filter((comment) => comment.state === 'OPEN').length;
  const resolvedCount = comments.length - openCount;
  const visibleComments = useMemo(
    () =>
      [...comments]
        .filter((comment) => showResolved || comment.state === 'OPEN')
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)),
    [comments, showResolved]
  );

  return (
    <Box
      component="section"
      aria-labelledby="dwaion-artifact-inline-comments-title"
      data-testid="dwaion-artifact-inline-comments"
      sx={{
        minWidth: 0,
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
        p: 1.5,
      }}
    >
      <Stack gap={1.25}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
          <Stack direction="row" alignItems="center" gap={0.75} sx={{ minWidth: 0 }}>
            <MessageSquareText size={17} aria-hidden="true" />
            <Typography
              id="dwaion-artifact-inline-comments-title"
              component="h3"
              variant="subtitle2"
            >
              {text.title} ({openCount})
            </Typography>
          </Stack>
          {resolvedCount > 0 ? (
            <ActionButton
              intent="quiet"
              aria-pressed={showResolved}
              onClick={() => setShowResolved((current) => !current)}
              sx={{ minHeight: 44, minWidth: 44, px: 1 }}
            >
              {showResolved
                ? text.hideResolved
                : text.showResolved.replace('{{count}}', String(resolvedCount))}
            </ActionButton>
          ) : null}
        </Stack>

        {loading ? <LoadingState label={text.loading} variant="skeleton" /> : null}
        {!loading && !workspaceAvailable ? (
          <Alert severity="info">{text.workspaceRequired}</Alert>
        ) : null}
        {!loading && workspaceAvailable && !available ? (
          <Alert severity="warning">
            {capability?.recoveryHint ?? capability?.reasonCode ?? text.unavailable}
          </Alert>
        ) : null}
        {error ? (
          <Alert
            severity="error"
            action={
              <ActionButton intent="quiet" onClick={onRetry} sx={{ minHeight: 44 }}>
                {text.retry}
              </ActionButton>
            }
          >
            {text.error}
          </Alert>
        ) : null}

        {workspaceAvailable && available ? (
          <Box
            component="form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!body.trim()) return;
              void onCreate({ body: body.trim(), anchor: anchor.trim() || null })
                .then(() => {
                  setBody('');
                  setAnchor('');
                })
                .catch(() => undefined);
            }}
          >
            <Stack gap={1}>
              <TextField
                label={text.anchor}
                placeholder={text.anchorPlaceholder}
                value={anchor}
                onChange={(event) => setAnchor(event.target.value.slice(0, 1_000))}
                disabled={!canEdit || busy}
                size="small"
              />
              <TextField
                label={text.newComment}
                placeholder={text.commentPlaceholder}
                value={body}
                onChange={(event) => setBody(event.target.value.slice(0, 4_000))}
                disabled={!canEdit || busy}
                multiline
                minRows={2}
                slotProps={{ htmlInput: { maxLength: 4_000 } }}
              />
              <ActionButton
                type="submit"
                intent="primary"
                disabled={!canEdit || busy || !body.trim()}
                sx={{ minHeight: 44, alignSelf: 'flex-start' }}
              >
                {text.submit}
              </ActionButton>
            </Stack>
          </Box>
        ) : null}

        {workspaceAvailable && available && !loading ? (
          visibleComments.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {showResolved ? text.noComments : text.noOpenComments}
            </Typography>
          ) : (
            <Stack divider={<Divider flexItem />}>
              {visibleComments.map((comment) => (
                <Box
                  key={comment.commentId}
                  component="article"
                  data-testid={`dwaion-artifact-comment-${comment.commentId}`}
                  sx={{ py: 1.25, minWidth: 0 }}
                >
                  <Stack gap={0.75}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      gap={1}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          fontWeight={700}
                          sx={{ overflowWrap: 'anywhere' }}
                        >
                          {comment.authorDisplayName ?? comment.authorSubjectId}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatTimestamp(comment.createdAt)}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        color={comment.state === 'RESOLVED' ? 'success' : 'default'}
                        label={comment.state === 'RESOLVED' ? text.resolved : text.open}
                      />
                    </Stack>
                    {comment.anchor ? (
                      <Typography
                        variant="caption"
                        color="primary.main"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {text.anchorPrefix} {comment.anchor}
                      </Typography>
                    ) : null}
                    <Typography
                      variant="body2"
                      sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                    >
                      {comment.body}
                    </Typography>
                    {comment.replies.map((reply) => (
                      <Box
                        key={reply.replyId}
                        sx={{ ml: 1, pl: 1, borderLeft: 2, borderColor: 'divider' }}
                      >
                        <Typography variant="caption" fontWeight={700}>
                          {reply.authorDisplayName ?? reply.authorSubjectId}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                        >
                          {reply.body}
                        </Typography>
                      </Box>
                    ))}
                    {replyTarget === comment.commentId ? (
                      <Box
                        component="form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (!replyBody.trim()) return;
                          void onReply({ comment, body: replyBody.trim() })
                            .then(() => {
                              setReplyBody('');
                              setReplyTarget(null);
                            })
                            .catch(() => undefined);
                        }}
                      >
                        <Stack gap={0.75}>
                          <TextField
                            autoFocus
                            label={text.reply}
                            value={replyBody}
                            onChange={(event) => setReplyBody(event.target.value.slice(0, 4_000))}
                            disabled={busy}
                            multiline
                            minRows={2}
                            slotProps={{ htmlInput: { maxLength: 4_000 } }}
                          />
                          <Stack direction="row" flexWrap="wrap" gap={0.75}>
                            <ActionButton
                              type="submit"
                              intent="secondary"
                              disabled={busy || !replyBody.trim()}
                              sx={{ minHeight: 44 }}
                            >
                              {text.submitReply}
                            </ActionButton>
                            <ActionButton
                              intent="quiet"
                              onClick={() => {
                                setReplyTarget(null);
                                setReplyBody('');
                              }}
                              sx={{ minHeight: 44 }}
                            >
                              {text.cancel}
                            </ActionButton>
                          </Stack>
                        </Stack>
                      </Box>
                    ) : null}
                    {comment.state === 'OPEN' ? (
                      <Stack direction="row" flexWrap="wrap" gap={0.75}>
                        <ActionButton
                          intent="quiet"
                          startIcon={<Reply size={15} aria-hidden="true" />}
                          disabled={!canEdit || busy}
                          onClick={() => {
                            setReplyTarget(comment.commentId);
                            setReplyBody('');
                          }}
                          sx={{ minHeight: 44 }}
                        >
                          {text.reply}
                        </ActionButton>
                        <ActionButton
                          intent="quiet"
                          startIcon={<CheckCircle2 size={15} aria-hidden="true" />}
                          disabled={!canEdit || busy}
                          onClick={() => void onResolve(comment).catch(() => undefined)}
                          sx={{ minHeight: 44 }}
                        >
                          {text.resolve}
                        </ActionButton>
                      </Stack>
                    ) : null}
                  </Stack>
                </Box>
              ))}
            </Stack>
          )
        ) : null}
      </Stack>
    </Box>
  );
}

const COPY = {
  ko: {
    title: '인라인 피드백 코멘트',
    loading: '댓글을 불러오는 중입니다.',
    workspaceRequired: '팀 작업공간을 만든 뒤 문서 맥락에 연결된 댓글을 사용할 수 있습니다.',
    unavailable: '인라인 댓글 제공자가 준비되지 않았습니다.',
    error: '댓글을 불러오거나 변경하지 못했습니다.',
    retry: '다시 시도',
    anchor: '문서 위치 (선택)',
    anchorPlaceholder: '예: 3. 환율 민감도 분석',
    newComment: '새 댓글',
    commentPlaceholder: '검토 의견을 입력하세요.',
    submit: '등록',
    showResolved: '해결됨 {{count}}',
    hideResolved: '해결됨 숨기기',
    noComments: '등록된 댓글이 없습니다.',
    noOpenComments: '열린 댓글이 없습니다.',
    resolved: '해결됨',
    open: '열림',
    anchorPrefix: '문서 위치 ·',
    reply: '답글',
    submitReply: '답글 등록',
    cancel: '취소',
    resolve: '해결 처리',
  },
  en: {
    title: 'Inline feedback comments',
    loading: 'Loading comments.',
    workspaceRequired: 'Create a team workspace to attach comments to document context.',
    unavailable: 'The inline comment provider is not ready.',
    error: 'Comments could not be loaded or changed.',
    retry: 'Retry',
    anchor: 'Document anchor (optional)',
    anchorPlaceholder: 'For example: 3. Exchange-rate sensitivity',
    newComment: 'New comment',
    commentPlaceholder: 'Enter review feedback.',
    submit: 'Add comment',
    showResolved: '{{count}} resolved',
    hideResolved: 'Hide resolved',
    noComments: 'No comments have been added.',
    noOpenComments: 'There are no open comments.',
    resolved: 'Resolved',
    open: 'Open',
    anchorPrefix: 'Document anchor ·',
    reply: 'Reply',
    submitReply: 'Add reply',
    cancel: 'Cancel',
    resolve: 'Resolve',
  },
} as const;
