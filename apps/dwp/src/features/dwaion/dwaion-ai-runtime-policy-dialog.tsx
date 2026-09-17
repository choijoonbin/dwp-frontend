import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  ActionButton,
  FormDialog,
  FormField,
  InlineFeedback,
  LocalErrorState,
  SelectField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import type {
  AIRuntimePolicyEditor,
  AIRuntimePolicyIssue,
} from './dwaion-ai-runtime-control-model';

export function DwaionAIRuntimePolicyDialog({
  open,
  bootstrap,
  editor,
  issues,
  busy,
  error,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  bootstrap: boolean;
  editor: AIRuntimePolicyEditor;
  issues: AIRuntimePolicyIssue[];
  busy: boolean;
  error: boolean;
  onChange: (editor: AIRuntimePolicyEditor) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation('work');
  const copy = 'dwaionAdmin.aiRuntime';

  return (
    <FormDialog
      open={open}
      title={t(`${copy}.editor.${bootstrap ? 'bootstrapTitle' : 'updateTitle'}`)}
      description={t(`${copy}.editor.description`)}
      cancelLabel={t('dwaionAdmin.shared.cancel')}
      submitLabel={t(`${copy}.editor.${bootstrap ? 'bootstrap' : 'save'}`)}
      submittingLabel={t('dwaionAdmin.shared.saving')}
      busy={busy}
      submitDisabled={issues.length > 0}
      maxWidth="md"
      desktopMaxWidth={860}
      mobileFullScreen
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <Stack spacing={2.5}>
        {error && <LocalErrorState title={t(`${copy}.commandError`)} size="compact" />}
        <InlineFeedback severity="info">{t(`${copy}.editor.evidenceBoundary`)}</InlineFeedback>

        <Box component="section" aria-labelledby="ai-runtime-model-routes-heading">
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Box>
              <Typography id="ai-runtime-model-routes-heading" component="h3" variant="subtitle1">
                {t(`${copy}.editor.modelRoutes`)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t(`${copy}.editor.modelRoutesDescription`)}
              </Typography>
            </Box>
            <ActionButton
              intent="secondary"
              size="small"
              startIcon={<Plus size={16} aria-hidden="true" />}
              disabled={editor.routes.length >= 50}
              onClick={() =>
                onChange({
                  ...editor,
                  routes: [
                    ...editor.routes,
                    { id: crypto.randomUUID(), provider: '', model: '', region: '' },
                  ],
                })
              }
            >
              {t(`${copy}.editor.addRoute`)}
            </ActionButton>
          </Stack>
          <Stack spacing={1.5} sx={{ mt: 1.5 }}>
            {editor.routes.map((route, index) => (
              <Box
                key={route.id}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
                    sm: 'minmax(120px, .7fr) minmax(180px, 1.4fr) minmax(110px, .7fr) auto',
                  },
                  gap: 1,
                  alignItems: 'start',
                  p: 1.5,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 'shape.borderRadius',
                }}
              >
                <FormField
                  label={t(`${copy}.editor.provider`)}
                  value={route.provider}
                  onChange={(event) =>
                    onChange({
                      ...editor,
                      routes: editor.routes.map((item) =>
                        item.id === route.id ? { ...item, provider: event.target.value } : item
                      ),
                    })
                  }
                />
                <FormField
                  label={t(`${copy}.editor.model`)}
                  value={route.model}
                  onChange={(event) =>
                    onChange({
                      ...editor,
                      routes: editor.routes.map((item) =>
                        item.id === route.id ? { ...item, model: event.target.value } : item
                      ),
                    })
                  }
                />
                <FormField
                  label={t(`${copy}.editor.region`)}
                  value={route.region}
                  placeholder={t(`${copy}.editor.optional`)}
                  onChange={(event) =>
                    onChange({
                      ...editor,
                      routes: editor.routes.map((item) =>
                        item.id === route.id ? { ...item, region: event.target.value } : item
                      ),
                    })
                  }
                />
                <ActionButton
                  intent="quiet"
                  size="small"
                  aria-label={t(`${copy}.editor.removeRoute`, { index: index + 1 })}
                  startIcon={<Trash2 size={16} aria-hidden="true" />}
                  onClick={() =>
                    onChange({
                      ...editor,
                      routes: editor.routes.filter((item) => item.id !== route.id),
                    })
                  }
                  sx={{ minWidth: 44, minHeight: 44, mt: { sm: 2.75 } }}
                >
                  <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                    {t(`${copy}.editor.remove`)}
                  </Box>
                </ActionButton>
              </Box>
            ))}
          </Stack>
        </Box>

        <Divider />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          <FormField
            label={t(`${copy}.editor.knowledgeSources`)}
            supportingText={t(`${copy}.editor.identifierHelp`)}
            value={editor.knowledgeSources}
            multiline
            minRows={3}
            onChange={(event) => onChange({ ...editor, knowledgeSources: event.target.value })}
          />
          <FormField
            label={t(`${copy}.editor.toolKeys`)}
            supportingText={t(`${copy}.editor.toolBoundary`)}
            value={editor.toolKeys}
            multiline
            minRows={3}
            onChange={(event) => onChange({ ...editor, toolKeys: event.target.value })}
          />
        </Box>

        <Divider />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          <FormField
            label={t(`${copy}.editor.maxOutputTokens`)}
            type="number"
            value={editor.maxOutputTokens}
            onChange={(event) => onChange({ ...editor, maxOutputTokens: event.target.value })}
          />
          <SelectField
            label={t(`${copy}.editor.budgetMode`)}
            value={editor.budgetMode}
            options={(['ALERT_ONLY', 'ENFORCED'] as const).map((value) => ({
              value,
              label: t(`${copy}.budgetModes.${value}`),
            }))}
            onValueChange={(value) =>
              value && onChange({ ...editor, budgetMode: value as typeof editor.budgetMode })
            }
          />
          <FormField
            label={t(`${copy}.editor.periodTokenLimit`)}
            type="number"
            value={editor.periodTokenLimit}
            required={editor.budgetMode === 'ENFORCED'}
            onChange={(event) => onChange({ ...editor, periodTokenLimit: event.target.value })}
          />
          <FormField
            label={t(`${copy}.editor.alertThreshold`)}
            type="number"
            value={editor.alertThresholdPercent}
            onChange={(event) => onChange({ ...editor, alertThresholdPercent: event.target.value })}
          />
        </Box>
        <FormControlLabel
          control={
            <Switch
              checked={editor.requireEvaluationPass}
              onChange={(_, checked) => onChange({ ...editor, requireEvaluationPass: checked })}
            />
          }
          label={t(`${copy}.editor.requireEvaluation`)}
        />
        <InlineFeedback severity="info">
          {editor.requireEvaluationPass
            ? t(`${copy}.editor.evaluationPending`)
            : t(`${copy}.editor.evaluationNotRequired`)}
        </InlineFeedback>

        <FormField
          label={t('dwaionAdmin.shared.reason')}
          value={editor.changeReason}
          multiline
          minRows={3}
          onChange={(event) => onChange({ ...editor, changeReason: event.target.value })}
          errorMessage={
            editor.changeReason && editor.changeReason.trim().length < 10
              ? t('dwaionAdmin.shared.reasonError')
              : undefined
          }
        />
        {issues.length > 0 && (
          <InlineFeedback severity="warning">
            <Typography component="span" variant="body2">
              {issues.map((issue) => t(`${copy}.validation.${issue}`)).join(' · ')}
            </Typography>
          </InlineFeedback>
        )}
      </Stack>
    </FormDialog>
  );
}
