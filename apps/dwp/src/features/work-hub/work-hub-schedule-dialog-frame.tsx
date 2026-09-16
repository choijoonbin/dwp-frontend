import { useId } from 'react';
import { CalendarCheck2, ExternalLink, X } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha } from '@mui/material/styles';

export type WorkHubScheduleDialogFrameProps = {
  open: boolean;
  serviceCode: string;
  serviceName: string;
  title: string;
  subtitle: string;
  description: string;
  closeLabel: string;
  cancelLabel: string;
  submitLabel: string;
  submittingLabel: string;
  secondaryActionLabel: string;
  secondaryActionDisabled: boolean;
  children: React.ReactNode;
  busy: boolean;
  submitDisabled: boolean;
  showSubmit: boolean;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  onSecondaryAction: () => void;
};

export function WorkHubScheduleDialogFrame({
  open,
  serviceCode,
  serviceName,
  title,
  subtitle,
  description,
  closeLabel,
  cancelLabel,
  submitLabel,
  submittingLabel,
  secondaryActionLabel,
  secondaryActionDisabled,
  children,
  busy,
  submitDisabled,
  showSubmit,
  onClose,
  onSubmit,
  onSecondaryAction,
}: WorkHubScheduleDialogFrameProps) {
  const titleId = useId();
  const descriptionId = useId();
  const compact = useMediaQuery('(max-width:599.95px)', { noSsr: true });

  return (
    <Dialog
      data-testid="work-schedule-dialog"
      open={open}
      fullScreen={compact}
      maxWidth={false}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClose={busy ? undefined : onClose}
      slotProps={{
        paper: {
          sx: {
            width: compact ? 1 : 690,
            maxWidth: compact ? 1 : 'calc(100vw - 32px)',
            maxHeight: compact ? '100dvh' : 'calc(100dvh - 48px)',
            m: compact ? 0 : 2,
            borderRadius: compact ? 0 : 2,
            overflow: 'hidden',
            bgcolor: 'background.paper',
            '@media (forced-colors: active)': {
              border: '1px solid CanvasText',
            },
          },
        },
      }}
    >
      <Box
        component="form"
        sx={{
          display: 'flex',
          minHeight: 0,
          height: compact ? '100dvh' : 'auto',
          flexDirection: 'column',
        }}
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && !submitDisabled) void onSubmit();
        }}
      >
        <Box
          component="header"
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 2,
            px: { xs: 2, sm: 3 },
            pt: { xs: 2, sm: 3 },
            pb: 2,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75, flexWrap: 'wrap' }}
            >
              <Box
                component="span"
                sx={(theme) => ({
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 0.75,
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main',
                  fontFamily: 'monospace',
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  lineHeight: 1.45,
                  letterSpacing: '0.05em',
                  '@media (forced-colors: active)': { border: '1px solid ButtonText' },
                })}
              >
                {serviceCode}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                {serviceName}
              </Typography>
            </Box>
            <Typography
              component="h2"
              variant="h5"
              sx={{ fontWeight: 700, lineHeight: 1.3, letterSpacing: '-0.025em' }}
            >
              <Box component="span" id={titleId}>
                {title}
              </Box>{' '}
              <Typography component="span" variant="body1" color="text.secondary">
                {subtitle}
              </Typography>
            </Typography>
            <Typography
              id={descriptionId}
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5, lineHeight: 1.55 }}
            >
              {description}
            </Typography>
          </Box>
          <Tooltip title={closeLabel}>
            <span>
              <IconButton
                aria-label={closeLabel}
                onClick={onClose}
                disabled={busy}
                size="small"
                sx={{ width: 44, height: 44, mt: -0.75, mr: -0.75 }}
              >
                <X size={20} aria-hidden="true" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        <DialogContent
          tabIndex={0}
          sx={{
            minHeight: 0,
            overflowY: 'auto',
            px: { xs: 2, sm: 3 },
            pt: '8px !important',
            pb: 2,
          }}
        >
          {children}
        </DialogContent>

        <DialogActions
          sx={(theme) => ({
            flex: '0 0 auto',
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
            gap: 1.5,
            px: { xs: 2, sm: 3 },
            py: 1.5,
            bgcolor: alpha(
              theme.palette.primary.main,
              theme.palette.mode === 'dark' ? 0.09 : 0.055
            ),
            borderTop: '1px solid',
            borderColor: 'divider',
          })}
        >
          <ActionButton
            intent="quiet"
            endIcon={<ExternalLink size={16} aria-hidden="true" />}
            onClick={onSecondaryAction}
            disabled={busy || secondaryActionDisabled}
            sx={{ minHeight: 44, justifyContent: { xs: 'center', sm: 'flex-start' } }}
          >
            {secondaryActionLabel}
          </ActionButton>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column-reverse', sm: 'row' },
              alignItems: 'stretch',
              justifyContent: 'flex-end',
              gap: 1,
              '& > *': { minHeight: 44 },
            }}
          >
            <ActionButton intent="quiet" onClick={onClose} disabled={busy}>
              {cancelLabel}
            </ActionButton>
            {showSubmit && (
              <ActionButton
                type="submit"
                intent="primary"
                startIcon={<CalendarCheck2 size={16} aria-hidden="true" />}
                loading={busy}
                loadingLabel={submittingLabel}
                disabled={submitDisabled}
                sx={{ whiteSpace: { xs: 'normal', sm: 'nowrap' } }}
              >
                {submitLabel}
              </ActionButton>
            )}
          </Box>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
