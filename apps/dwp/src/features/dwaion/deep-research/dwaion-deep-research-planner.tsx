import { ArrowLeft, FlaskConical, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import {
  ActionButton,
  FormField,
  InlineFeedback,
  foundationTokens,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  DWAION_RESEARCH_DELIVERABLES,
  DWAION_RESEARCH_SOURCES,
  type DwaionResearchDraft,
  type DwaionResearchDraftError,
} from './dwaion-deep-research-model';
import { deepResearchCopy } from './dwaion-deep-research-copy';

import type { DwaionResearchDeliverableType, DwaionResearchPlan } from '@dwp-frontend/shared-utils';

export function DwaionDeepResearchPlanner({
  locale,
  draft,
  plan,
  dirty,
  busy,
  error,
  operationError,
  onChange,
  onSave,
  onStart,
  onReset,
  onExit,
}: {
  locale: 'ko' | 'en';
  draft: DwaionResearchDraft;
  plan: DwaionResearchPlan | null;
  dirty: boolean;
  busy: 'SAVE' | 'START' | null;
  error: DwaionResearchDraftError | null;
  operationError: boolean;
  onChange: (draft: DwaionResearchDraft) => void;
  onSave: () => void;
  onStart: () => void;
  onReset: () => void;
  onExit: () => void;
}) {
  const copy = deepResearchCopy(locale);
  const set = <Key extends keyof DwaionResearchDraft>(key: Key, value: DwaionResearchDraft[Key]) =>
    onChange({ ...draft, [key]: value });

  return (
    <Stack gap={2.5} data-testid="dwaion-deep-research-plan">
      <ResearchHeader copy={copy} onExit={onExit} />
      {operationError ? (
        <InlineFeedback severity="error">{copy.operationFailed}</InlineFeedback>
      ) : null}
      {error ? <InlineFeedback severity="warning">{copy.errors[error]}</InlineFeedback> : null}
      {plan ? (
        <InlineFeedback severity={dirty ? 'warning' : plan.state === 'READY' ? 'success' : 'info'}>
          {dirty ? copy.unsaved : plan.state === 'READY' ? copy.planReady : copy.planDraft}
        </InlineFeedback>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            lg: 'minmax(0, 1.7fr) minmax(300px, 0.8fr)',
          },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Stack gap={2}>
          <Panel title={copy.objective}>
            <Stack gap={1.5}>
              <FormField
                label={copy.goal}
                value={draft.goal}
                multiline
                minRows={2}
                supportingText={copy.goalHint}
                onChange={(event) => set('goal', event.target.value)}
                inputProps={{ maxLength: 4_000 }}
              />
              <FormField
                label={copy.question}
                value={draft.question}
                multiline
                minRows={2}
                supportingText={copy.questionHint}
                onChange={(event) => set('question', event.target.value)}
                inputProps={{ maxLength: 4_000 }}
              />
              <FormField
                label={copy.criteria}
                value={draft.successCriteria}
                multiline
                minRows={4}
                supportingText={copy.criteriaHint}
                onChange={(event) => set('successCriteria', event.target.value)}
              />
            </Stack>
          </Panel>

          <Panel title={copy.sources}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 1,
              }}
            >
              {DWAION_RESEARCH_SOURCES.map((source) => {
                const selected = draft.allowedSources.includes(source);
                return (
                  <FormControlLabel
                    key={source}
                    control={<Checkbox checked={selected} />}
                    label={copy.sourceLabels[source]}
                    onChange={() =>
                      set(
                        'allowedSources',
                        selected
                          ? draft.allowedSources.filter((item) => item !== source)
                          : [...draft.allowedSources, source]
                      )
                    }
                    sx={{
                      m: 0,
                      minHeight: 48,
                      px: 1,
                      border: 1,
                      borderColor: selected ? 'primary.light' : 'divider',
                      borderRadius: 1,
                    }}
                  />
                );
              })}
            </Box>
            <FormControlLabel
              sx={{ mt: 1.25, alignItems: 'flex-start' }}
              control={<Checkbox checked={draft.requireAllAllowedSources} />}
              label={copy.requireAll}
              onChange={(_, checked) => set('requireAllAllowedSources', checked)}
            />
          </Panel>

          <Panel title={copy.deliverables}>
            <Stack direction="row" gap={1} useFlexGap flexWrap="wrap">
              {DWAION_RESEARCH_DELIVERABLES.map((type) => (
                <Chip
                  key={type}
                  label={copy.deliverableLabels[type]}
                  color={draft.deliverableTypes.includes(type) ? 'primary' : 'default'}
                  variant={draft.deliverableTypes.includes(type) ? 'filled' : 'outlined'}
                  clickable
                  aria-pressed={draft.deliverableTypes.includes(type)}
                  onClick={() => toggleDeliverable(draft, type, onChange)}
                  sx={{ minHeight: 44 }}
                />
              ))}
            </Stack>
          </Panel>
        </Stack>

        <Stack gap={2} sx={{ position: { lg: 'sticky' }, top: { lg: 88 } }}>
          <Panel title={copy.limits}>
            <Stack gap={1.5}>
              <NumberField
                label={copy.minutes}
                value={draft.maximumMinutes}
                min={1}
                max={240}
                onChange={(value) => set('maximumMinutes', value)}
              />
              <NumberField
                label={copy.sourceLimit}
                value={draft.maximumSources}
                min={1}
                max={500}
                onChange={(value) => set('maximumSources', value)}
              />
              <NumberField
                label={copy.tokenLimit}
                value={draft.maximumTokens}
                min={128}
                max={2_000_000}
                step={1_000}
                onChange={(value) => set('maximumTokens', value)}
              />
            </Stack>
          </Panel>
          <Box
            sx={{
              p: 2,
              borderRadius: foundationTokens.radius.surface + 'px',
              bgcolor: 'primary.50',
              border: 1,
              borderColor: 'primary.light',
            }}
          >
            <Typography
              variant="subtitle2"
              color="primary.main"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}
            >
              <ShieldCheck size={18} aria-hidden="true" /> {copy.guardTitle}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {copy.guardBody}
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Stack
        direction={{ xs: 'column-reverse', sm: 'row' }}
        justifyContent="flex-end"
        gap={1}
        sx={{
          p: 1.5,
          position: 'sticky',
          bottom: 0,
          zIndex: 2,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1.5,
          boxShadow: 2,
        }}
      >
        <ActionButton
          intent="quiet"
          startIcon={<RotateCcw size={16} />}
          disabled={Boolean(busy)}
          onClick={onReset}
        >
          {copy.reset}
        </ActionButton>
        <ActionButton
          intent="secondary"
          startIcon={<Save size={16} />}
          loading={busy === 'SAVE'}
          disabled={Boolean(busy)}
          onClick={onSave}
        >
          {busy === 'SAVE' ? copy.saving : copy.save}
        </ActionButton>
        <ActionButton
          intent="primary"
          startIcon={<FlaskConical size={16} />}
          loading={busy === 'START'}
          disabled={Boolean(busy) || dirty || plan?.state !== 'READY'}
          onClick={onStart}
        >
          {busy === 'START' ? copy.starting : copy.start}
        </ActionButton>
      </Stack>
    </Stack>
  );
}

function ResearchHeader({
  copy,
  onExit,
}: {
  copy: ReturnType<typeof deepResearchCopy>;
  onExit: () => void;
}) {
  return (
    <Box
      sx={{
        p: { xs: 1.5, sm: 2.5 },
        bgcolor: 'primary.50',
        borderRadius: foundationTokens.radius.surface + 'px',
        border: 1,
        borderColor: 'primary.light',
      }}
    >
      <ActionButton
        intent="quiet"
        size="small"
        startIcon={<ArrowLeft size={16} />}
        onClick={onExit}
      >
        {copy.back}
      </ActionButton>
      <Typography variant="overline" color="primary.main" display="block" sx={{ mt: 1 }}>
        {copy.eyebrow}
      </Typography>
      <Typography component="h1" variant="h4">
        {copy.title}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5 }}>
        {copy.description}
      </Typography>
    </Box>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box
      component="section"
      sx={{
        p: { xs: 1.5, sm: 2 },
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.radius.surface + 'px',
      }}
    >
      <Typography component="h2" variant="h6" sx={{ mb: 1.75 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <FormField
      label={label}
      type="number"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      inputProps={{ min, max, step }}
    />
  );
}

function toggleDeliverable(
  draft: DwaionResearchDraft,
  type: DwaionResearchDeliverableType,
  onChange: (draft: DwaionResearchDraft) => void
) {
  const selected = draft.deliverableTypes.includes(type);
  onChange({
    ...draft,
    deliverableTypes: selected
      ? draft.deliverableTypes.filter((item) => item !== type)
      : [...draft.deliverableTypes, type],
  });
}
