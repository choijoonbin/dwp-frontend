import { useTranslation } from 'react-i18next';
import { FormDialog, FormField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { DwaionSourceKey } from '@dwp-frontend/shared-utils';

const SOURCE_KEYS: DwaionSourceKey[] = [
  'WORK_ITEM',
  'MAIL',
  'CALENDAR',
  'APPROVAL_TASK',
  'APPROVAL_REQUEST',
  'APPROVAL_FORM',
  'APPROVAL_OPERATION',
];

export type EvaluationSetDraft = { name: string; description: string; locale: string };
export type EvaluationCaseDraft = {
  name: string;
  prompt: string;
  expectedTerms: string;
  sourceScopes: DwaionSourceKey[];
};

export const EMPTY_EVALUATION_SET: EvaluationSetDraft = {
  name: '',
  description: '',
  locale: 'ko-KR',
};
export const EMPTY_EVALUATION_CASE: EvaluationCaseDraft = {
  name: '',
  prompt: '',
  expectedTerms: '',
  sourceScopes: ['WORK_ITEM'],
};

export function EvaluationSetDialog({
  draft,
  busy,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: EvaluationSetDraft | null;
  busy: boolean;
  onChange: (draft: EvaluationSetDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation('work');
  return (
    <FormDialog
      open={Boolean(draft)}
      title={t('dwaionAdmin.evaluation.setDialogTitle')}
      cancelLabel={t('dwaionAdmin.shared.cancel')}
      submitLabel={t('dwaionAdmin.shared.create')}
      submittingLabel={t('dwaionAdmin.shared.saving')}
      busy={busy}
      submitDisabled={!draft?.name.trim()}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      {draft && (
        <Stack spacing={2}>
          <FormField
            label={t('dwaionAdmin.evaluation.fields.name')}
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
          />
          <FormField
            label={t('dwaionAdmin.evaluation.fields.description')}
            value={draft.description}
            multiline
            minRows={3}
            onChange={(event) => onChange({ ...draft, description: event.target.value })}
          />
          <FormField
            label={t('dwaionAdmin.evaluation.fields.locale')}
            value={draft.locale}
            onChange={(event) => onChange({ ...draft, locale: event.target.value })}
          />
        </Stack>
      )}
    </FormDialog>
  );
}

export function EvaluationCaseDialog({
  draft,
  busy,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: EvaluationCaseDraft | null;
  busy: boolean;
  onChange: (draft: EvaluationCaseDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation('work');
  return (
    <FormDialog
      open={Boolean(draft)}
      title={t('dwaionAdmin.evaluation.caseDialogTitle')}
      cancelLabel={t('dwaionAdmin.shared.cancel')}
      submitLabel={t('dwaionAdmin.shared.create')}
      submittingLabel={t('dwaionAdmin.shared.saving')}
      busy={busy}
      submitDisabled={!draft?.name.trim() || !draft?.prompt.trim() || !draft.sourceScopes.length}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      {draft && (
        <Stack spacing={2}>
          <FormField
            label={t('dwaionAdmin.evaluation.fields.caseName')}
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
          />
          <FormField
            label={t('dwaionAdmin.evaluation.fields.prompt')}
            value={draft.prompt}
            multiline
            minRows={4}
            onChange={(event) => onChange({ ...draft, prompt: event.target.value })}
          />
          <FormField
            label={t('dwaionAdmin.evaluation.fields.expectedTerms')}
            supportingText={t('dwaionAdmin.evaluation.fields.expectedTermsHelp')}
            value={draft.expectedTerms}
            onChange={(event) => onChange({ ...draft, expectedTerms: event.target.value })}
          />
          <Box>
            <Typography variant="body2" fontWeight="fontWeightBold">
              {t('dwaionAdmin.evaluation.fields.sources')}
            </Typography>
            <FormGroup row>
              {SOURCE_KEYS.map((source) => (
                <FormControlLabel
                  key={source}
                  control={
                    <Checkbox
                      checked={draft.sourceScopes.includes(source)}
                      onChange={(event) =>
                        onChange({
                          ...draft,
                          sourceScopes: event.target.checked
                            ? [...draft.sourceScopes, source]
                            : draft.sourceScopes.filter((item) => item !== source),
                        })
                      }
                    />
                  }
                  label={t(`dwaionAdmin.sources.sourceNames.${source}`, { defaultValue: source })}
                />
              ))}
            </FormGroup>
          </Box>
        </Stack>
      )}
    </FormDialog>
  );
}
