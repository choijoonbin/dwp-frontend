import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  FilePlus2,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActionButton, FormField, InlineFeedback, SelectField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';
import {
  availableWorkplacePlanningActions,
  buildWorkplacePlanningDraft,
  draftFormFromScenario,
  isWorkplacePlanningPreviewSubmittable,
} from './workplace-space-planning-model';

import type { WorkplaceResource } from '@dwp-frontend/shared-utils';
import type {
  WorkplacePlanningDraft,
  WorkplacePlanningEmission,
  WorkplacePlanningScenario,
} from '@dwp-frontend/shared-utils/api/workplace-planning-contract';
import type { WorkplacePlanningDraftForm } from './workplace-space-planning-model';

export type WorkplacePlanningEditorAction =
  'CREATE' | 'UPDATE' | 'PREVIEW' | 'BOOKING_IMPACT' | 'SUBMIT' | 'APPROVE' | 'REJECT' | 'PUBLISH';

export type WorkplacePlanningEditorSubmission = Readonly<{
  action: WorkplacePlanningEditorAction;
  form: WorkplacePlanningDraftForm;
  draft: WorkplacePlanningDraft | null;
}>;

function initialForm(
  scenario: WorkplacePlanningScenario | null,
  current: { capacity: number; roomCapacity: number; accessibleResourceCount: number }
) {
  const form = draftFormFromScenario(scenario);
  return scenario
    ? form
    : {
        ...form,
        proposedCapacity: String(current.capacity),
        proposedRoomCapacity: String(current.roomCapacity),
        proposedAccessibleResourceCount: String(current.accessibleResourceCount),
      };
}

function draftIdentity(form: WorkplacePlanningDraftForm) {
  return JSON.stringify({
    name: form.name,
    description: form.description,
    proposedCapacity: form.proposedCapacity,
    proposedRoomCapacity: form.proposedRoomCapacity,
    proposedAccessibleResourceCount: form.proposedAccessibleResourceCount,
    operatingStart: form.operatingStart,
    operatingEnd: form.operatingEnd,
    policyReference: form.policyReference,
    affectedResourceIds: form.affectedResourceIds,
    neighborhoodAllocations: form.neighborhoodAllocations,
    emissionEvidenceId: form.emissionEvidenceId,
  });
}

export function WorkplaceSpacePlanningEditor({
  scenario,
  current,
  resources,
  emission,
  canManage,
  canApprove,
  elevated,
  resourceCatalogStatus,
  commandBlocked,
  pending,
  onSubmit,
}: {
  scenario: WorkplacePlanningScenario | null;
  current: { capacity: number; roomCapacity: number; accessibleResourceCount: number };
  resources: readonly WorkplaceResource[];
  emission: WorkplacePlanningEmission | null;
  canManage: boolean;
  canApprove: boolean;
  elevated: boolean;
  resourceCatalogStatus: 'loading' | 'ready' | 'error';
  commandBlocked: boolean;
  pending: boolean;
  onSubmit: (submission: WorkplacePlanningEditorSubmission) => void;
}) {
  const { t } = useTranslation('rooms');
  const [baseline] = useState(() => initialForm(scenario, current));
  const [form, setForm] = useState(baseline);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const expiresAt = scenario?.activePreview?.expiresAt;
    if (!expiresAt) return;
    const delay = Math.min(Math.max(Date.parse(expiresAt) - Date.now() + 25, 0), 2_147_483_647);
    const timer = window.setTimeout(() => setClock(Date.now()), delay);
    return () => window.clearTimeout(timer);
  }, [scenario?.activePreview?.expiresAt]);
  const patch = <K extends keyof WorkplacePlanningDraftForm>(
    key: K,
    nextValue: WorkplacePlanningDraftForm[K]
  ) => setForm((currentForm) => ({ ...currentForm, [key]: nextValue }));
  const draft = buildWorkplacePlanningDraft(form);
  const actions = new Set<string>(availableWorkplacePlanningActions(scenario?.state ?? null));
  const draftEditable =
    canManage && (!scenario || scenario.state === 'DRAFT' || scenario.state === 'PREVIEWED');
  const dirty = Boolean(scenario && draftIdentity(form) !== draftIdentity(baseline));
  const baseValid = Boolean(form.name.trim() && form.reason.trim() && form.explicitConfirmation);
  const resourceCatalogReady = resourceCatalogStatus === 'ready';
  const unknownResources = form.affectedResourceIds.filter(
    (id) => !resources.some((resource) => resource.resourceId === id)
  ).length;
  const draftValid = baseValid && Boolean(draft) && resourceCatalogReady && unknownResources === 0;
  const toggleResource = (resourceId: string, checked: boolean) => {
    const selected = new Set(form.affectedResourceIds);
    if (checked) selected.add(resourceId);
    else selected.delete(resourceId);
    patch('affectedResourceIds', [...selected]);
  };
  const patchAllocation = (index: number, key: 'neighborhood' | 'capacity', value: string) =>
    patch(
      'neighborhoodAllocations',
      form.neighborhoodAllocations.map((allocation, candidate) =>
        candidate === index ? { ...allocation, [key]: value } : allocation
      )
    );
  const transitionEnabled = canManage && baseValid && !dirty && !pending && !commandBlocked;
  const elevatedEnabled = transitionEnabled && elevated;
  const previewSubmitReady = scenario
    ? isWorkplacePlanningPreviewSubmittable(scenario, clock)
    : false;
  const run = (action: WorkplacePlanningEditorAction) => {
    if (
      action === 'SUBMIT' &&
      (!scenario || !isWorkplacePlanningPreviewSubmittable(scenario, Date.now()))
    ) {
      setClock(Date.now());
      return;
    }
    onSubmit({ action, form, draft });
  };

  return (
    <Box
      component="section"
      aria-labelledby="space-planning-editor-title"
      data-testid="space-planning-scenario-editor"
      data-preview-submit-ready={previewSubmitReady ? 'true' : 'false'}
      data-resource-catalog-status={resourceCatalogStatus}
      sx={workplaceMemberCard}
    >
      <Box p={{ xs: 1.5, md: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
          <Box>
            <Typography
              id="space-planning-editor-title"
              component="h2"
              variant="h6"
              fontWeight={780}
            >
              {scenario
                ? t('workplace.spacePlanning.editor.editTitle')
                : t('workplace.spacePlanning.editor.createTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('workplace.spacePlanning.editor.description')}
            </Typography>
          </Box>
          {scenario ? (
            <Chip
              size="small"
              variant="outlined"
              label={t(`workplace.spacePlanning.scenarioStates.${scenario.state}`)}
            />
          ) : null}
        </Stack>

        <Box
          sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1, mt: 2 }}
        >
          <FormField
            label={t('workplace.spacePlanning.editor.name')}
            value={form.name}
            disabled={!draftEditable || pending}
            inputProps={{ maxLength: 160 }}
            onChange={(event) => patch('name', event.target.value)}
          />
          <FormField
            label={t('workplace.spacePlanning.editor.descriptionLabel')}
            value={form.description}
            disabled={!draftEditable || pending}
            inputProps={{ maxLength: 1000 }}
            onChange={(event) => patch('description', event.target.value)}
          />
          <FormField
            type="number"
            label={t('workplace.spacePlanning.editor.capacity')}
            value={form.proposedCapacity}
            disabled={!draftEditable || pending}
            slotProps={{ htmlInput: { min: 0, step: 1 } }}
            onChange={(event) => patch('proposedCapacity', event.target.value)}
          />
          <FormField
            type="number"
            label={t('workplace.spacePlanning.editor.roomCapacity')}
            value={form.proposedRoomCapacity}
            disabled={!draftEditable || pending}
            slotProps={{ htmlInput: { min: 0, step: 1 } }}
            onChange={(event) => patch('proposedRoomCapacity', event.target.value)}
          />
          <FormField
            type="number"
            label={t('workplace.spacePlanning.editor.accessibleCapacity')}
            value={form.proposedAccessibleResourceCount}
            disabled={!draftEditable || pending}
            slotProps={{ htmlInput: { min: 0, step: 1 } }}
            onChange={(event) => patch('proposedAccessibleResourceCount', event.target.value)}
          />
          <SelectField
            label={t('workplace.spacePlanning.editor.emissionEvidence')}
            value={form.emissionEvidenceId ?? ''}
            disabled={!draftEditable || pending || !emission}
            options={
              emission
                ? [
                    {
                      value: '',
                      label: t('workplace.spacePlanning.editor.noEmissionEvidence'),
                    },
                    {
                      value: emission.emissionEvidenceId,
                      label: `${t(`workplace.spacePlanning.emission.kinds.${emission.evidenceKind}`)} · ${emission.factorVersion} · ${emission.regionCode}`,
                    },
                  ]
                : [
                    {
                      value: '',
                      label: t('workplace.spacePlanning.editor.noEmissionEvidence'),
                    },
                  ]
            }
            onValueChange={(value) => patch('emissionEvidenceId', value || null)}
          />
          <FormField
            type="time"
            label={t('workplace.spacePlanning.editor.operatingStart')}
            value={form.operatingStart.slice(0, 5)}
            disabled={!draftEditable || pending}
            slotProps={{ inputLabel: { shrink: true } }}
            onChange={(event) => patch('operatingStart', event.target.value)}
          />
          <FormField
            type="time"
            label={t('workplace.spacePlanning.editor.operatingEnd')}
            value={form.operatingEnd.slice(0, 5)}
            disabled={!draftEditable || pending}
            slotProps={{ inputLabel: { shrink: true } }}
            onChange={(event) => patch('operatingEnd', event.target.value)}
          />
          <FormField
            label={t('workplace.spacePlanning.editor.policyReference')}
            value={form.policyReference}
            disabled={!draftEditable || pending}
            inputProps={{ maxLength: 320 }}
            supportingText={t('workplace.spacePlanning.editor.policyReferenceHint')}
            onChange={(event) => patch('policyReference', event.target.value)}
          />
          {scenario?.state === 'SUBMITTED' ? (
            <FormField
              label={t('workplace.spacePlanning.editor.approvalAuthority')}
              value={form.approvalAuthorityReference}
              disabled={!canApprove || pending}
              inputProps={{ maxLength: 160 }}
              supportingText={t('workplace.spacePlanning.editor.approvalAuthorityHint')}
              onChange={(event) => patch('approvalAuthorityReference', event.target.value)}
            />
          ) : null}
        </Box>

        <Box sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.5, mt: 1.5 })}>
          <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
            <Box>
              <Typography variant="subtitle2" fontWeight={750}>
                {t('workplace.spacePlanning.editor.resources')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('workplace.spacePlanning.editor.resourcesHint')}
              </Typography>
            </Box>
            <Chip
              size="small"
              label={t('workplace.spacePlanning.editor.selectedCount', {
                count: form.affectedResourceIds.length,
              })}
            />
          </Stack>
          {resources.length ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 0.5,
                maxHeight: 210,
                overflowY: 'auto',
                mt: 1,
              }}
            >
              {resources.map((resource) => (
                <FormControlLabel
                  key={resource.resourceId}
                  control={
                    <Checkbox
                      size="small"
                      checked={form.affectedResourceIds.includes(resource.resourceId)}
                      disabled={!draftEditable || pending || !resourceCatalogReady}
                      inputProps={{
                        'aria-label': `${resource.name} · ${resource.code} · ${resource.type}`,
                      }}
                      onChange={(event) =>
                        toggleResource(resource.resourceId, event.target.checked)
                      }
                    />
                  }
                  label={
                    <Stack direction="row" gap={0.5} alignItems="center" minWidth={0}>
                      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                        {resource.name} · {resource.code}
                      </Typography>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t(`workplace.spacePlanning.resourceTypes.${resource.type}`)}
                      />
                    </Stack>
                  }
                  sx={{ m: 0, minWidth: 0 }}
                />
              ))}
            </Box>
          ) : resourceCatalogStatus === 'loading' ? (
            <Typography variant="body2" color="text.secondary" mt={1} role="status">
              {t('workplace.spacePlanning.editor.resourceCatalogLoading')}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary" mt={1}>
              {t('workplace.spacePlanning.editor.resourceCatalogUnavailable')}
            </Typography>
          )}
          {unknownResources ? (
            <InlineFeedback severity="warning">
              {t('workplace.spacePlanning.editor.unknownResources', { count: unknownResources })}
            </InlineFeedback>
          ) : null}
        </Box>

        <Box sx={{ mt: 1.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
            <Box>
              <Typography variant="subtitle2" fontWeight={750}>
                {t('workplace.spacePlanning.editor.allocations')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('workplace.spacePlanning.editor.allocationsHint')}
              </Typography>
            </Box>
            <ActionButton
              intent="quiet"
              size="small"
              disabled={!draftEditable || pending || form.neighborhoodAllocations.length >= 20}
              onClick={() =>
                patch('neighborhoodAllocations', [
                  ...form.neighborhoodAllocations,
                  { neighborhood: '', capacity: '0' },
                ])
              }
            >
              {t('workplace.spacePlanning.editor.addAllocation')}
            </ActionButton>
          </Stack>
          <Stack gap={0.75} mt={1}>
            {form.neighborhoodAllocations.map((allocation, index) => (
              <Stack key={index} direction="row" gap={0.75} alignItems="flex-start">
                <FormField
                  size="small"
                  label={t('workplace.spacePlanning.editor.neighborhood')}
                  value={allocation.neighborhood}
                  disabled={!draftEditable || pending}
                  inputProps={{ maxLength: 120 }}
                  onChange={(event) => patchAllocation(index, 'neighborhood', event.target.value)}
                />
                <FormField
                  size="small"
                  type="number"
                  label={t('workplace.spacePlanning.editor.allocationCapacity')}
                  value={allocation.capacity}
                  disabled={!draftEditable || pending}
                  slotProps={{ htmlInput: { min: 0, step: 1 } }}
                  onChange={(event) => patchAllocation(index, 'capacity', event.target.value)}
                />
                <ActionButton
                  intent="quiet"
                  aria-label={t('workplace.spacePlanning.editor.removeAllocation', {
                    index: index + 1,
                  })}
                  disabled={!draftEditable || pending}
                  onClick={() =>
                    patch(
                      'neighborhoodAllocations',
                      form.neighborhoodAllocations.filter((_, candidate) => candidate !== index)
                    )
                  }
                >
                  <Trash2 size={16} aria-hidden="true" />
                </ActionButton>
              </Stack>
            ))}
          </Stack>
        </Box>

        {!draft ? (
          <InlineFeedback severity="warning" icon={<TriangleAlert size={17} />}>
            {t('workplace.spacePlanning.editor.invalidDraft')}
          </InlineFeedback>
        ) : null}
        {dirty ? (
          <InlineFeedback severity="warning" icon={<Save size={17} />}>
            {t('workplace.spacePlanning.editor.unsavedChanges')}
          </InlineFeedback>
        ) : null}
        {scenario?.state === 'PREVIEWED' && !previewSubmitReady ? (
          <InlineFeedback
            severity="warning"
            icon={<TriangleAlert size={17} />}
            data-testid="space-planning-preview-gate"
          >
            {t('workplace.spacePlanning.editor.previewGate')}
          </InlineFeedback>
        ) : null}
        {!elevated &&
        scenario &&
        ['PREVIEWED', 'SUBMITTED', 'APPROVED'].includes(scenario.state) ? (
          <InlineFeedback severity="warning" icon={<ShieldCheck size={17} />}>
            {t('workplace.spacePlanning.editor.stepUpRequired')}
          </InlineFeedback>
        ) : null}
        <FormField
          label={t('workplace.spacePlanning.editor.reason')}
          value={form.reason}
          disabled={!canManage || pending || commandBlocked}
          multiline
          minRows={2}
          inputProps={{ maxLength: 500 }}
          supportingText={t('workplace.spacePlanning.editor.reasonHint')}
          onChange={(event) => patch('reason', event.target.value)}
          sx={{ mt: 1.5 }}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={form.explicitConfirmation}
              disabled={!canManage || pending || commandBlocked}
              onChange={(event) => patch('explicitConfirmation', event.target.checked)}
            />
          }
          label={t('workplace.spacePlanning.editor.confirm')}
          sx={{ mt: 0.5, alignItems: 'flex-start' }}
        />
        <Stack direction="row" gap={1} flexWrap="wrap" mt={1.5}>
          {actions.has('CREATE') ? (
            <ActionButton
              intent="primary"
              startIcon={<FilePlus2 size={16} />}
              disabled={!canManage || !draftValid || pending || commandBlocked}
              onClick={() => run('CREATE')}
            >
              {t('workplace.spacePlanning.actions.create')}
            </ActionButton>
          ) : null}
          {actions.has('UPDATE') ? (
            <ActionButton
              intent="secondary"
              startIcon={<Save size={16} />}
              disabled={!canManage || !draftValid || !dirty || pending || commandBlocked}
              onClick={() => run('UPDATE')}
            >
              {t('workplace.spacePlanning.actions.update')}
            </ActionButton>
          ) : null}
          {actions.has('PREVIEW') ? (
            <ActionButton
              intent="primary"
              startIcon={<Eye size={16} />}
              disabled={!transitionEnabled}
              onClick={() => run('PREVIEW')}
            >
              {t('workplace.spacePlanning.actions.preview')}
            </ActionButton>
          ) : null}
          {actions.has('BOOKING_IMPACT') ? (
            <ActionButton
              intent="secondary"
              startIcon={<Eye size={16} />}
              disabled={!transitionEnabled}
              onClick={() => run('BOOKING_IMPACT')}
            >
              {t('workplace.spacePlanning.actions.bookingImpact')}
            </ActionButton>
          ) : null}
          {actions.has('SUBMIT') ? (
            <ActionButton
              intent="primary"
              startIcon={<Send size={16} />}
              disabled={!elevatedEnabled || !previewSubmitReady}
              data-testid="space-planning-submit"
              onClick={() => run('SUBMIT')}
            >
              {t('workplace.spacePlanning.actions.submit')}
            </ActionButton>
          ) : null}
          {actions.has('APPROVE') ? (
            <ActionButton
              intent="primary"
              startIcon={<CheckCircle2 size={16} />}
              disabled={!elevatedEnabled || !canApprove || !form.approvalAuthorityReference.trim()}
              onClick={() => run('APPROVE')}
            >
              {t('workplace.spacePlanning.actions.approve')}
            </ActionButton>
          ) : null}
          {actions.has('REJECT') ? (
            <ActionButton
              intent="danger"
              disabled={!elevatedEnabled || !canApprove || !form.approvalAuthorityReference.trim()}
              onClick={() => run('REJECT')}
            >
              {t('workplace.spacePlanning.actions.reject')}
            </ActionButton>
          ) : null}
          {actions.has('PUBLISH') ? (
            <ActionButton
              intent="primary"
              startIcon={<Send size={16} />}
              disabled={!elevatedEnabled || !canApprove}
              onClick={() => run('PUBLISH')}
            >
              {t('workplace.spacePlanning.actions.publish')}
            </ActionButton>
          ) : null}
        </Stack>
      </Box>
    </Box>
  );
}
