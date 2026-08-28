import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Trash2 } from 'lucide-react';
import { ActionButton, FormDialog } from '@dwp-frontend/design-system';

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
  onAnalyze,
  onPreferenceChange,
  onClear,
}: DwaionProposalControlsProps) {
  const { t } = useTranslation('work');
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const preferenceReady = Boolean(preference) && !preferenceError;
  const analysisEnabled = preference?.proactiveAnalysisEnabled === true;

  return (
    <Box
      component="section"
      aria-labelledby="dwaion-proposal-controls-title"
      sx={{ mt: 3, py: 2, borderBlock: 1, borderColor: 'divider' }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ md: 'flex-start' }}
        gap={2}
      >
        <Box sx={{ minWidth: 0, maxWidth: 720 }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Sparkles size={18} color="var(--dwp-product-accent)" aria-hidden="true" />
            <Typography id="dwaion-proposal-controls-title" component="h2" variant="h6">
              {t('dwaionProposals.controls.title')}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('dwaionProposals.controls.description')}
          </Typography>
          <FormControlLabel
            sx={{ mt: 1.25, alignItems: 'flex-start', ml: -1.25 }}
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
                <Typography variant="body2" fontWeight={700}>
                  {t('dwaionProposals.controls.preference')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
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
        <Box role="status" aria-live="polite" sx={{ mt: 1.5 }}>
          <Typography variant="body2" fontWeight={700}>
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
