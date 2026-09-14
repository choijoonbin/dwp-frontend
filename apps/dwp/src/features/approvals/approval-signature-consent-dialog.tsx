import { useTranslation } from 'react-i18next';
import { FormDialog, InlineFeedback } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ApprovalSignatureDocument } from './approval-signature-source-model';

export function ApprovalSignatureConsentDialog({
  document,
  ready,
  accepted,
  busy,
  onAccepted,
  onClose,
  onSubmit,
}: {
  document?: ApprovalSignatureDocument;
  ready: boolean;
  accepted: boolean;
  busy: boolean;
  onAccepted: (accepted: boolean) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation('approvals');
  return (
    <FormDialog
      open={Boolean(document)}
      title={t('signatureCeremony.terms')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('signatureCeremony.consent')}
      submitDisabled={!ready || !accepted}
      busy={busy}
      onClose={onClose}
      onSubmit={onSubmit}
      maxWidth="sm"
      mobileFullScreen
    >
      {document ? (
        <Stack gap={2}>
          <InlineFeedback severity={ready ? 'info' : 'warning'}>
            {t(ready ? 'signatureCeremony.notExternal' : 'signatureCeremony.sourceChanged')}
          </InlineFeedback>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {document.terms.text}
          </Typography>
          <Box component="dl" sx={{ m: 0, typography: 'caption', overflowWrap: 'anywhere' }}>
            <Box component="dt" color="text.secondary">
              {t('signatureCeremony.termsVersion')}
            </Box>
            <Box component="dd" sx={{ m: 0, mb: 1 }}>
              {document.terms.version} · {document.terms.locale}
            </Box>
            <Box component="dt" color="text.secondary">
              {t('signatureCeremony.termsSha')}
            </Box>
            <Box component="dd" sx={{ m: 0, mb: 1 }}>
              {document.terms.sha256}
            </Box>
            <Box component="dt" color="text.secondary">
              {t('signatureCeremony.expiresAt')}
            </Box>
            <Box component="dd" sx={{ m: 0 }}>
              {formatDate(document.terms.expiresAt, { dateStyle: 'medium', timeStyle: 'short' })}
            </Box>
          </Box>
          <FormControlLabel
            control={
              <Checkbox
                checked={accepted}
                disabled={!ready || busy}
                onChange={(_, value) => onAccepted(value)}
              />
            }
            label={t('signatureCeremony.consentLabel')}
            sx={{
              alignItems: 'flex-start',
              '& .MuiFormControlLabel-label': { pt: 1, typography: 'body2' },
            }}
          />
        </Stack>
      ) : null}
    </FormDialog>
  );
}
