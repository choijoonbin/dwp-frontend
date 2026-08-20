import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquarePlus, Search, Trash2 } from 'lucide-react';
import {
  ActionButton,
  ConfirmDialog,
  FormField,
  GuidedEmptyState,
  PageCanvas,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  deleteDwaionConversation,
  getDwaionConversations,
  type DwaionConversationSummary,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function DwaionConversations() {
  const { t, i18n } = useTranslation('work');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DwaionConversationSummary | null>(null);
  const conversations = useQuery({
    queryKey: ['dwaion', 'conversations'],
    queryFn: getDwaionConversations,
    staleTime: 20_000,
  });
  const deleteConversation = useMutation({
    mutationFn: (conversationId: string) => deleteDwaionConversation(conversationId),
    onSuccess: async () => {
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['dwaion', 'conversations'] });
    },
  });
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filtered = useMemo(
    () =>
      (conversations.data ?? []).filter((conversation) =>
        conversation.title.toLocaleLowerCase().includes(normalizedSearch)
      ),
    [conversations.data, normalizedSearch]
  );
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);

  return (
    <PageCanvas>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
        <Box>
          <Typography component="h1" variant="h4">
            {t('dwaionConversations.title', { defaultValue: '대화 기록' })}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>
            {t('dwaionConversations.description', {
              defaultValue: '내 권한 범위에서 생성된 DWAI·ON 대화를 이어서 확인합니다.',
            })}
          </Typography>
        </Box>
        <ActionButton
          intent="primary"
          startIcon={<MessageSquarePlus size={16} />}
          onClick={() => navigate('/dwaion/new')}
        >
          {t('dwaionConversations.new', { defaultValue: '새 대화' })}
        </ActionButton>
      </Stack>

      <FormField
        fullWidth
        size="small"
        label={t('dwaionConversations.searchLabel', { defaultValue: '대화 검색' })}
        placeholder={t('dwaionConversations.searchPlaceholder', {
          defaultValue: '대화 제목으로 검색',
        })}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search size={16} aria-hidden="true" />
              </InputAdornment>
            ),
          },
        }}
        sx={{ mt: 3, maxWidth: 560 }}
      />

      {conversations.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {t('dwaionConversations.loadError', {
            defaultValue: '대화 기록을 불러오지 못했습니다. 잠시 후 다시 시도하세요.',
          })}
        </Alert>
      )}

      <Box component="section" aria-live="polite" sx={{ mt: 2 }}>
        {conversations.isLoading ? (
          <Stack spacing={1}>
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} variant="rounded" height={76} />
            ))}
          </Stack>
        ) : filtered.length ? (
          <Box sx={{ borderBlock: 1, borderColor: 'divider' }}>
            {filtered.map((conversation, index) => (
              <Box key={conversation.conversationId}>
                {index > 0 && <Divider />}
                <Stack direction="row" alignItems="center" gap={1} sx={{ py: 1.5 }}>
                  <Box
                    component="button"
                    type="button"
                    onClick={() =>
                      navigate(
                        `/dwaion/conversations/${encodeURIComponent(conversation.conversationId)}`
                      )
                    }
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      border: 0,
                      bgcolor: 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      py: 0.5,
                    }}
                  >
                    <Typography variant="body2" fontWeight={800} noWrap>
                      {conversation.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('dwaionConversations.meta', {
                        defaultValue: '{{count}}개 메시지 · {{date}}',
                        count: conversation.messageCount,
                        date: formatDate(
                          conversation.lastMessageAt,
                          { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
                          locale
                        ),
                      })}
                    </Typography>
                  </Box>
                  <ActionButton
                    intent="quiet"
                    size="small"
                    startIcon={<Trash2 size={15} />}
                    onClick={() => setDeleteTarget(conversation)}
                  >
                    {t('dwaionConversations.delete', { defaultValue: '삭제' })}
                  </ActionButton>
                </Stack>
              </Box>
            ))}
          </Box>
        ) : (
          <GuidedEmptyState
            kind={normalizedSearch ? 'no-results' : 'empty'}
            title={t(
              normalizedSearch
                ? 'dwaionConversations.noResultsTitle'
                : 'dwaionConversations.emptyTitle',
              { defaultValue: normalizedSearch ? '검색 결과가 없습니다' : '아직 대화가 없습니다' }
            )}
            description={t(
              normalizedSearch
                ? 'dwaionConversations.noResultsDescription'
                : 'dwaionConversations.emptyDescription',
              {
                defaultValue: normalizedSearch
                  ? '다른 검색어를 입력해 보세요.'
                  : '새 대화를 시작하면 이곳에서 안전하게 이어갈 수 있습니다.',
              }
            )}
            actionLabel={
              normalizedSearch
                ? undefined
                : t('dwaionConversations.new', { defaultValue: '새 대화' })
            }
            onAction={normalizedSearch ? undefined : () => navigate('/dwaion/new')}
          />
        )}
      </Box>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t('dwaionConversations.deleteTitle', { defaultValue: '대화를 삭제할까요?' })}
        description={t('dwaionConversations.deleteDescription', {
          defaultValue: '이 대화와 메시지는 복구할 수 없습니다.',
        })}
        cancelLabel={t('dwaionConversations.cancel', { defaultValue: '취소' })}
        confirmLabel={t('dwaionConversations.confirmDelete', { defaultValue: '삭제' })}
        confirmingLabel={t('dwaionConversations.deleting', { defaultValue: '삭제 중' })}
        busy={deleteConversation.isPending}
        intent="danger"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() =>
          deleteTarget ? deleteConversation.mutateAsync(deleteTarget.conversationId) : undefined
        }
      />
    </PageCanvas>
  );
}
