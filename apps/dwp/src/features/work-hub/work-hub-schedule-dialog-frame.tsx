import { useId } from 'react';
import { CalendarCheck2, ExternalLink } from 'lucide-react';
import { ActionButton, ContentDialog, foundationTokens } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
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
  const formId = useId();
  const compact = useMediaQuery('(max-width:599.95px)', { noSsr: true });

  return (
    <ContentDialog
      open={open}
      title={`${title} ${subtitle}`.trim()}
      description={description}
      closeLabel={closeLabel}
      onClose={onClose}
      busy={busy}
      fullScreen={compact}
      maxWidth={false}
      testId="work-schedule-dialog"
      closeButtonSx={{ width: 44, height: 44, mt: -0.75, mr: -0.75 }}
      titleStart={
        <Box
          component="span"
          sx={(theme) => ({
            px: 0.75,
            py: 0.25,
            borderRadius: foundationTokens.radius.control + 'px',
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            color: 'primary.main',
            fontFamily: foundationTokens.font.mono,
            fontSize: foundationTokens.workplace.typography.caption.fontSize,
            fontWeight: foundationTokens.workplace.typography.pageTitle.fontWeight,
            lineHeight: foundationTokens.workplace.typography.caption.lineHeight,
            letterSpacing: foundationTokens.workplace.typography.caption.letterSpacing,
            '@media (forced-colors: active)': { border: '1px solid ButtonText' },
          })}
        >
          {serviceCode}
        </Box>
      }
      titleEnd={
        <Typography variant="caption" color="text.secondary">
          {serviceName}
        </Typography>
      }
      slotProps={{
        paper: {
          sx: {
            width: compact ? 1 : 690,
            maxWidth: compact ? 1 : 'calc(100vw - 32px)',
            maxHeight: compact ? '100dvh' : 'calc(100dvh - 48px)',
            m: compact ? 0 : 2,
            borderRadius: compact ? 0 : foundationTokens.radius.surface * 2 + 'px',
            overflow: 'hidden',
            bgcolor: 'background.paper',
            '@media (forced-colors: active)': {
              border: '1px solid CanvasText',
            },
          },
        },
      }}
      contentSx={{
        minHeight: 0,
        overflowY: 'auto',
        px: { xs: 2, sm: 3 },
        pt: '8px !important',
        pb: 2,
      }}
      contentTabIndex={0}
      footerSx={(theme) => ({
        flex: '0 0 auto',
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'stretch', sm: 'center' },
        justifyContent: 'space-between',
        gap: 1.5,
        px: { xs: 2, sm: 3 },
        py: 1.5,
        bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.09 : 0.055),
        borderTop: '1px solid',
        borderColor: 'divider',
      })}
      footerContent={
        <>
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
                form={formId}
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
        </>
      }
    >
      <Box
        component="form"
        id={formId}
        sx={{
          display: 'flex',
          minHeight: 0,
          flexDirection: 'column',
        }}
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && !submitDisabled) void onSubmit();
        }}
      >
        {children}
      </Box>
    </ContentDialog>
  );
}
