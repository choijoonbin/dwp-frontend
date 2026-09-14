import { GitBranch, Play, RefreshCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@dwp-frontend/shared-i18n/lib/formatters';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n/lib/locales';
import {
  ActionButton,
  ActionIconButton,
  InlineFeedback,
  SelectField,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { evaluateApprovalTypedForm } from './approval-form-typed-evaluator';
import { ApprovalRequestTypedFields } from './approval-request-typed-fields';
import { useApprovalWorkflowPlanning } from './use-approval-workflow-planning';
import type { ApprovalTypedFormEvaluation } from '@dwp-frontend/shared-utils';
import type { ApprovalWorkflowPlanningOwner } from './approval-workflow-planning-model';

export function ApprovalWorkflowPlanningPanel({ owner }: { owner: ApprovalWorkflowPlanningOwner }) {
  const { t, i18n } = useTranslation('approvals');
  const model = useApprovalWorkflowPlanning(owner);
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const korean = locale === 'ko';
  const compiled = model.loaded?.formSource?.compiled;
  let evaluation: ApprovalTypedFormEvaluation | undefined;
  if (compiled) {
    try {
      evaluation = evaluateApprovalTypedForm(compiled, model.values, 'DRAFT');
    } catch {
      /* Retain editable invalid input. */
    }
  }
  return (
    <Box
      component="section"
      aria-label={t('admin.planning.title')}
      sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider', minWidth: 0 }}
    >
      <Stack
        direction="row"
        gap={1}
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1.5 }}
      >
        <Stack direction="row" gap={1} alignItems="center">
          <GitBranch size={18} />
          <Typography variant="subtitle2">{t('admin.planning.title')}</Typography>
        </Stack>
        <ActionIconButton
          label={t('actions.retry')}
          size="small"
          disabled={!model.available || model.pending}
          onClick={() => void model.load(model.loaded?.selection.selectedFormId ?? undefined)}
        >
          <RefreshCcw size={16} />
        </ActionIconButton>
      </Stack>
      {!model.available ? (
        <InlineFeedback severity="warning">{t('admin.planning.legacyUnavailable')}</InlineFeedback>
      ) : (
        <Stack gap={1.5}>
          {model.error && (
            <InlineFeedback severity="warning">{t('admin.planning.unavailable')}</InlineFeedback>
          )}
          <SelectField
            size="small"
            label={t('admin.planning.form')}
            placeholder={t('admin.planning.selectForm')}
            value={model.loaded?.selection.selectedFormId ?? ''}
            disabled={!model.loaded || model.pending || (model.readOnly && Boolean(model.error))}
            options={(model.loaded?.forms ?? []).map((form) => ({
              value: form.formId,
              label: t('admin.planning.formVersionLabel', {
                name: korean ? form.nameKo : form.nameEn,
                version: form.currentVersion,
              }),
            }))}
            onValueChange={(value) => {
              if (value) void model.load(value);
            }}
          />
          {compiled && (
            <Box component="fieldset" sx={{ m: 0, p: 0, border: 0, minWidth: 0 }}>
              <Typography component="legend" variant="subtitle2" sx={{ mb: 1 }}>
                {t('admin.planning.sample')}
              </Typography>
              <ApprovalRequestTypedFields
                compiled={compiled}
                evaluation={evaluation}
                values={model.values}
                korean={korean}
                disabled={model.readOnly}
                includeSummary
                onChange={model.change}
              />
            </Box>
          )}
          <ActionButton
            intent="primary"
            size="small"
            startIcon={<Play size={16} />}
            loading={model.pending}
            disabled={!compiled || model.readOnly}
            onClick={() => void model.preview()}
            sx={{ alignSelf: 'flex-start' }}
          >
            {t('admin.planning.run')}
          </ActionButton>
          {model.result && (
            <Box aria-live="polite" sx={{ minWidth: 0 }}>
              <Stack direction="row" useFlexGap flexWrap="wrap" gap={1} sx={{ mb: 1 }}>
                <Chip size="small" label={t('admin.planning.rolePoolPreview')} />
                <Chip size="small" variant="outlined" label={t('admin.planning.notEvaluated')} />
              </Stack>
              <Stack component="ol" sx={{ listStyle: 'none', p: 0, m: 0 }}>
                {model.result.stages.map((stage) => (
                  <Box
                    component="li"
                    key={stage.stepKey}
                    sx={{ py: 1.5, borderBottom: 1, borderColor: 'divider', minWidth: 0 }}
                  >
                    <Stack gap={0.5}>
                      <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                        {owner.definition.stages.find((item) => item.key === stage.stepKey)?.name ??
                          stage.stepKey}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {stage.roleCode} · {stage.quorumMode}
                      </Typography>
                      {!stage.selected && (
                        <Typography variant="caption">{t('admin.planning.skipped')}</Typography>
                      )}
                      <Box
                        component="dl"
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1fr) auto',
                          columnGap: 2,
                          rowGap: 0.5,
                          m: 0,
                        }}
                      >
                        <Typography component="dt" variant="body2">
                          {t('admin.planning.activeMembers')}
                        </Typography>
                        <Typography component="dd" variant="body2" sx={{ m: 0 }}>
                          {stage.activeMemberCount}
                        </Typography>
                        <Typography component="dt" variant="body2">
                          {t('admin.planning.indicativeThreshold')}
                        </Typography>
                        <Typography component="dd" variant="body2" sx={{ m: 0 }}>
                          {stage.indicativeThreshold ?? t('admin.planning.notEvaluated')}
                        </Typography>
                      </Box>
                      {stage.poolWarning && (
                        <InlineFeedback severity="warning">
                          {t(
                            stage.poolWarning === 'EMPTY_POOL'
                              ? 'admin.planning.emptyPool'
                              : 'admin.planning.insufficientPool'
                          )}
                        </InlineFeedback>
                      )}
                    </Stack>
                  </Box>
                ))}
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                {t('admin.planning.noRuntimeEligibility')}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {t('admin.planning.requesterNotExcluded')}
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                {t('admin.planning.expiresAt')}:{' '}
                {formatDate(model.result.expiresAt, { timeStyle: 'short' }, locale)}
              </Typography>
            </Box>
          )}
        </Stack>
      )}
    </Box>
  );
}
