import { useTranslation } from 'react-i18next';
import { FormDialog, LoadingState } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  MailAccount,
  MailContactGroup,
  MailGroupSendReceipt,
} from '@dwp-frontend/shared-utils';

export function MailGroupReceiptDialog({
  group,
  receipts,
  latestReceipt,
  accounts,
  loading,
  error,
  onClose,
}: {
  group: MailContactGroup | null;
  receipts: MailGroupSendReceipt[];
  latestReceipt: MailGroupSendReceipt | null;
  accounts: MailAccount[];
  loading: boolean;
  error: boolean;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation('mail');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage ?? i18n.language);
  const items = latestReceipt
    ? [latestReceipt, ...receipts.filter((item) => item.receiptId !== latestReceipt.receiptId)]
    : receipts;
  return (
    <FormDialog
      open={Boolean(group)}
      title={t('addressBook.receipts.title', { name: group?.displayName ?? '' })}
      description={t('addressBook.receipts.description')}
      cancelLabel={t('actions.close')}
      submitLabel=""
      showSubmit={false}
      mobileFullScreen
      maxWidth="md"
      onClose={onClose}
      onSubmit={() => undefined}
    >
      {loading ? (
        <LoadingState label={t('common:labels.loading')} size="compact" />
      ) : error ? (
        <Alert severity="error">{t('addressBook.receipts.error')}</Alert>
      ) : items.length ? (
        <Stack spacing={0} sx={{ borderBlock: 1, borderColor: 'divider' }}>
          {items.map((receipt, index) => (
            <Box
              key={receipt.receiptId}
              sx={{
                py: 1.25,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
                gap: 1,
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Stack
                  direction="row"
                  spacing={0.75}
                  alignItems="center"
                  flexWrap="wrap"
                  useFlexGap
                >
                  {index === 0 && latestReceipt?.receiptId === receipt.receiptId && (
                    <Chip size="small" color="primary" label={t('addressBook.receipts.latest')} />
                  )}
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t(`addressBook.receipts.state.${receipt.state}`)}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t(`addressBook.send.mode.${receipt.recipientMode}`)}
                  />
                </Stack>
                <Typography variant="body2" fontWeight={750} sx={{ mt: 0.75 }}>
                  {t('addressBook.receipts.recipientCount', { count: receipt.recipientCount })}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('addressBook.receipts.groupVersion', { version: receipt.groupVersion })}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {t('addressBook.receipts.senderAccount', {
                    account:
                      accounts.find((account) => account.accountId === receipt.accountId)
                        ?.emailAddress ?? receipt.accountId,
                  })}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                {formatDate(
                  receipt.acceptedAt,
                  { dateStyle: 'medium', timeStyle: 'short' },
                  locale
                )}
              </Typography>
            </Box>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {t('addressBook.receipts.empty')}
        </Typography>
      )}
    </FormDialog>
  );
}
