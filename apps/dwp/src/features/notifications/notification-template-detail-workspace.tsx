import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Braces, RotateCcw } from 'lucide-react';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import type {
  NotificationTemplateContent,
  NotificationTemplateVariant,
} from '@dwp-frontend/shared-utils/api/notification-api';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function NotificationTemplateDetailWorkspace({
  variant,
  content,
  canManage,
  onEdit,
  children,
}: {
  variant: NotificationTemplateVariant;
  content: NotificationTemplateContent;
  canManage: boolean;
  onEdit: (content?: NotificationTemplateContent) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation('notifications');
  const revision = variant.publishedOverride ?? null;
  return (
    <>
      <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ my: 1.5 }}>
        <Braces size={18} aria-hidden />
        {variant.allowedVariables.length > 0 ? (
          variant.allowedVariables.map((variable) => (
            <Chip key={variable} size="small" variant="outlined" label={`{{${variable}}}`} />
          ))
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t('admin.templates.noVariables')}
          </Typography>
        )}
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(0, 1fr)' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Box component="section" sx={{ minWidth: 0, borderBlock: 1, borderColor: 'divider' }}>
          <Typography
            component="h3"
            variant="subtitle2"
            sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}
          >
            {t('admin.templates.fields.body')}
          </Typography>
          <Box component="dl" sx={{ m: 0 }}>
            {(['title', 'preview', 'body', 'actionLabel'] as const).map((field) => (
              <Box
                key={field}
                sx={{
                  py: 1,
                  borderBottom: 1,
                  borderColor: 'divider',
                  '&:last-child': { borderBottom: 0 },
                }}
              >
                <Typography component="dt" variant="caption" color="text.secondary">
                  {t(`admin.templates.fields.${field}`)}
                </Typography>
                <Typography
                  component="dd"
                  variant="body2"
                  sx={{
                    m: 0,
                    mt: 0.5,
                    fontFamily: foundationTokens.font.mono,
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {content[field] || t('admin.templates.emptyContent')}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
        <Box sx={{ minWidth: 0 }}>{children}</Box>
      </Box>

      <Box
        component="dl"
        sx={{
          m: 0,
          mt: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
        }}
      >
        {[
          [
            t('admin.templates.fields.source'),
            t(revision ? 'admin.templates.tenantOverride' : 'admin.templates.providerDefault'),
          ],
          [t('admin.templates.fields.revision'), revision ? `r${revision.revision}` : 'Provider'],
          [
            t('admin.templates.fields.approvedAt'),
            revision?.approvedAt
              ? formatDate(revision.approvedAt, { dateStyle: 'medium', timeStyle: 'short' })
              : '—',
          ],
        ].map(([term, value]) => (
          <Box key={term} sx={{ py: 1.25, pr: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography component="dt" variant="caption" color="text.secondary">
              {term}
            </Typography>
            <Typography
              component="dd"
              variant="body2"
              fontWeight="fontWeightBold"
              sx={{ m: 0, mt: 0.35 }}
            >
              {value}
            </Typography>
          </Box>
        ))}
      </Box>

      {variant.history.length > 0 && (
        <Box component="section" sx={{ mt: 2.5 }}>
          <Typography component="h3" variant="subtitle1">
            {t('admin.templates.historyTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {t('admin.templates.historyDescription')}
          </Typography>
          <Box sx={{ mt: 1, borderBlock: 1, borderColor: 'divider' }}>
            {variant.history.slice(0, 8).map((item) => {
              const current = revision?.revisionId === item.revisionId;
              const restorable = item.state === 'PUBLISHED' && !current && !variant.draft;
              return (
                <Box
                  key={item.revisionId}
                  sx={{
                    minHeight: 58,
                    py: 1,
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'auto minmax(0, 1fr)',
                      sm: 'auto minmax(0, 1fr) auto',
                    },
                    gap: 1,
                    alignItems: 'center',
                    borderBottom: 1,
                    borderColor: 'divider',
                    '&:last-of-type': { borderBottom: 0 },
                  }}
                >
                  <Chip
                    size="small"
                    variant="outlined"
                    color={current ? 'success' : item.state === 'DRAFT' ? 'warning' : 'default'}
                    label={`r${item.revision}`}
                  />
                  <Box minWidth={0}>
                    <Typography variant="body2" fontWeight="fontWeightBold" noWrap>
                      {t(`admin.templates.state.${item.state}`)}
                      {current ? ` · ${t('admin.templates.current')}` : ''}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {item.changeReason} ·{' '}
                      {formatDate(item.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
                    </Typography>
                  </Box>
                  {canManage && restorable && (
                    <ActionButton
                      intent="quiet"
                      size="small"
                      startIcon={<RotateCcw size={16} />}
                      onClick={() => onEdit(item.content)}
                      sx={{ gridColumn: { xs: '2', sm: 'auto' } }}
                    >
                      {t('admin.templates.proposeRestore')}
                    </ActionButton>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </>
  );
}
