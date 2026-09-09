import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Trash2 } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  FormDialog,
  foundationTokens,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import type {
  DwaionProposalAnalysisPreference,
  DwaionProposalAnalysisReceipt,
} from '@dwp-frontend/shared-utils';

type DwaionProposalControlsProps = {
  preference: DwaionProposalAnalysisPreference | undefined;
  preferenceLoading: boolean;
  preferenceError: boolean;
  analysisReceipt: DwaionProposalAnalysisReceipt | null;
  analyzing: boolean;
  updatingPreference: boolean;
  clearing: boolean;
  sourceTypeCount: number;
  onAnalyze: () => void;
  onPreferenceChange: (enabled: boolean) => void;
  onClear: () => Promise<void>;
};

export function DwaionProposalControls({
  preference,
  preferenceLoading,
  preferenceError,
  analysisReceipt,
  analyzing,
  updatingPreference,
  clearing,
  sourceTypeCount,
  onAnalyze,
  onPreferenceChange,
  onClear,
}: DwaionProposalControlsProps) {
  const { t } = useTranslation('work');
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const preferenceReady = Boolean(preference) && !preferenceError;
  const analysisEnabled = preference?.proactiveAnalysisEnabled === true;

  const statusKey = preferenceError
    ? 'dwaionProposals.controls.statusUnavailable'
    : analysisEnabled
      ? 'dwaionProposals.controls.statusReady'
      : 'dwaionProposals.controls.statusOff';

  return (
    <Box
      component="section"
      aria-label={t('dwaionProposals.controls.title')}
      sx={{
        mt: { xs: 1.25, md: 0 },
        p: { xs: 0.8, md: 0 },
        border: { xs: 1, md: 0 },
        borderColor: { xs: 'divider', md: 'transparent' },
        borderRadius: foundationTokens.radius.surface + foundationTokens.radius.compact + 'px',
        bgcolor: { xs: 'var(--dwp-product-soft)', md: 'transparent' },
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        gap={0.75}
        sx={{ display: { xs: 'flex', md: 'none' } }}
      >
        <Box
          aria-hidden="true"
          sx={{
            width: 34,
            height: 34,
            display: 'grid',
            placeItems: 'center',
            flex: '0 0 auto',
            borderRadius: foundationTokens.radius.surface + 'px',
            bgcolor: analysisEnabled ? 'success.light' : 'background.paper',
            color: analysisEnabled ? 'success.dark' : 'var(--dwp-product-accent)',
          }}
        >
          <Sparkles size={18} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <FormControlLabel
            sx={{
              m: 0,
              gap: 0,
              '& .MuiSwitch-root': { ml: -0.5, mr: -0.25 },
              '& .MuiFormControlLabel-label': { minWidth: 0 },
            }}
            control={
              <Switch
                size="small"
                checked={analysisEnabled}
                disabled={preferenceLoading || preferenceError || updatingPreference}
                onChange={(_, checked) => onPreferenceChange(checked)}
                slotProps={{ input: { 'aria-label': t('dwaionProposals.controls.preference') } }}
              />
            }
            label={
              <Typography variant="caption" color="text.secondary">
                <Box component="span" sx={{ display: 'block' }}>
                  <Typography
                    component="span"
                    variant="subtitle2"
                    fontWeight="fontWeightBold"
                    sx={{
                      display: 'block',
                      fontSize: (theme) => theme.typography.pxToRem(12),
                      lineHeight: 'typography.subtitle2.lineHeight',
                    }}
                  >
                    {t('dwaionProposals.controls.title')}: {t(statusKey)}
                  </Typography>
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{ display: { xs: 'none', sm: 'block' } }}
                  >
                    {t('dwaionProposals.controls.sourceTypes', { count: sourceTypeCount })}
                  </Typography>
                </Box>
              </Typography>
            }
          />
        </Box>
        <ActionButton
          intent="primary"
          startIcon={<Sparkles size={16} aria-hidden="true" />}
          loading={analyzing}
          loadingLabel={t('dwaionProposals.controls.analyzing')}
          disabled={!preferenceReady || !analysisEnabled || clearing}
          onClick={onAnalyze}
          sx={{
            flex: '0 0 auto',
            minWidth: 0,
            px: 0.85,
            minHeight: 40,
            fontSize: (theme) => theme.typography.pxToRem(12),
          }}
        >
          {t('dwaionProposals.controls.analyze')}
        </ActionButton>
        <ActionIconButton
          label={t('dwaionProposals.controls.clear')}
          disabled={clearing || analyzing}
          onClick={() => setClearDialogOpen(true)}
          sx={{ width: 40, height: 40 }}
        >
          <Trash2 size={17} aria-hidden="true" />
        </ActionIconButton>
      </Stack>
      {preferenceError && (
        <Typography
          role="alert"
          variant="caption"
          color="error.main"
          sx={{ display: { xs: 'block', md: 'none' }, mt: 1 }}
        >
          {t('dwaionProposals.controls.preferenceError')}
        </Typography>
      )}
      {analysisReceipt && (
        <Box role="status" aria-live="polite" sx={{ display: { xs: 'block', md: 'none' }, mt: 1 }}>
          <Typography variant="caption" fontWeight="fontWeightBold">
            {t('dwaionProposals.controls.analysisResult', {
              sources: analysisReceipt.sourcesAnalyzed,
              count: analysisReceipt.actionableProposals,
            })}
          </Typography>
          {analysisReceipt.unavailableSources.length > 0 && (
            <Typography variant="caption" color="warning.main" display="block">
              {t('dwaionProposals.controls.unavailableSources', {
                count: analysisReceipt.unavailableSources.length,
              })}
            </Typography>
          )}
        </Box>
      )}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        gap={2}
        sx={{ display: { xs: 'none', md: 'flex' } }}
      >
        <Box sx={{ minWidth: 0, maxWidth: 520 }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Sparkles size={18} color="var(--dwp-product-accent)" aria-hidden="true" />
            <Typography id="dwaion-proposal-controls-title" component="h2" variant="h6">
              {t('dwaionProposals.controls.title')}: {t(statusKey)}
            </Typography>
          </Stack>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.35, display: { xs: 'none', md: 'block' } }}
          >
            {t('dwaionProposals.controls.sourceTypes', { count: sourceTypeCount })}
          </Typography>
          <FormControlLabel
            sx={{ mt: 0.75, alignItems: 'flex-start', ml: -1.25 }}
            control={
              <Switch
                checked={analysisEnabled}
                disabled={preferenceLoading || preferenceError || updatingPreference}
                onChange={(_, checked) => onPreferenceChange(checked)}
                slotProps={{ input: { 'aria-label': t('dwaionProposals.controls.preference') } }}
              />
            }
            label={
              <Box sx={{ pt: 0.5 }}>
                <Typography variant="body2" fontWeight="fontWeightBold">
                  {t('dwaionProposals.controls.preference')}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: { xs: 'none', md: 'block' } }}
                >
                  {t('dwaionProposals.controls.preferenceHelp')}
                </Typography>
              </Box>
            }
          />
          {preferenceError && (
            <Typography role="alert" variant="caption" color="error.main" display="block">
              {t('dwaionProposals.controls.preferenceError')}
            </Typography>
          )}
        </Box>

        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ flex: '0 0 auto' }}>
          <ActionButton
            intent="primary"
            startIcon={<Sparkles size={17} aria-hidden="true" />}
            loading={analyzing}
            loadingLabel={t('dwaionProposals.controls.analyzing')}
            disabled={!preferenceReady || !analysisEnabled || clearing}
            onClick={onAnalyze}
          >
            {t('dwaionProposals.controls.analyze')}
          </ActionButton>
          <ActionButton
            intent="quiet"
            startIcon={<Trash2 size={17} aria-hidden="true" />}
            disabled={clearing || analyzing}
            onClick={() => setClearDialogOpen(true)}
          >
            {t('dwaionProposals.controls.clear')}
          </ActionButton>
        </Stack>
      </Stack>

      {analysisReceipt && (
        <Box
          role="status"
          aria-live="polite"
          sx={{ display: { xs: 'none', md: 'block' }, mt: 1.5 }}
        >
          <Typography variant="body2" fontWeight="fontWeightBold">
            {t('dwaionProposals.controls.analysisResult', {
              sources: analysisReceipt.sourcesAnalyzed,
              count: analysisReceipt.actionableProposals,
            })}
          </Typography>
          {analysisReceipt.unavailableSources.length > 0 && (
            <Typography variant="caption" color="warning.main">
              {t('dwaionProposals.controls.unavailableSources', {
                count: analysisReceipt.unavailableSources.length,
              })}
            </Typography>
          )}
        </Box>
      )}

      <FormDialog
        open={clearDialogOpen}
        title={t('dwaionProposals.controls.clearDialog.title')}
        description={t('dwaionProposals.controls.clearDialog.description')}
        cancelLabel={t('dwaionProposals.controls.clearDialog.cancel')}
        submitLabel={t('dwaionProposals.controls.clearDialog.confirm')}
        submittingLabel={t('dwaionProposals.controls.clearDialog.clearing')}
        submitIntent="danger"
        busy={clearing}
        onClose={() => setClearDialogOpen(false)}
        onSubmit={async () => {
          await onClear();
          setClearDialogOpen(false);
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {t('dwaionProposals.controls.clearDialog.boundary')}
        </Typography>
      </FormDialog>
    </Box>
  );
}
