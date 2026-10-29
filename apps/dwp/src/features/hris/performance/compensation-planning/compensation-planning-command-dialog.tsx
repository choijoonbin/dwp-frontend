import type { Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DatePickerField,
  FormDialog,
  FormField,
  InlineFeedback,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { CompensationPlanningCopy } from './compensation-planning-copy';
import { translatePerformance } from '../performance-i18n';
import type {
  CompensationCycle,
  CompensationCycleAuthoringContext,
} from './compensation-planning-contract';
import type { DialogState, Fields } from './compensation-planning-workspace-model';

type CompensationPlanningCommandDialogProps = Readonly<{
  dialog: DialogState | null;
  dialogTitle: string;
  highRisk: boolean;
  copy: CompensationPlanningCopy;
  commandBusy: boolean;
  submitDisabled: boolean;
  setDialog: Dispatch<SetStateAction<DialogState | null>>;
  onSubmit: () => void | Promise<void>;
  formError: string | null;
  fields: Fields;
  setFields: Dispatch<SetStateAction<Fields>>;
  cycleAuthoringContext: CompensationCycleAuthoringContext | null;
  selectedAuthoringGuideline:
    CompensationCycleAuthoringContext['guidelines']['components'][number] | undefined;
  authoringAssignments: number;
  authoringComponentLinks: number;
  approvalReady: boolean;
  selected: CompensationCycle | undefined;
  submittedCount: number;
  actorId: string | null | undefined;
  confirmed: boolean;
  setConfirmed: Dispatch<SetStateAction<boolean>>;
}>;

function field(
  fields: Fields,
  setFields: Dispatch<SetStateAction<Fields>>,
  name: string,
  label: string,
  options: Record<string, unknown> = {}
) {
  return (
    <FormField
      {...options}
      name={name}
      label={label}
      value={fields[name] ?? ''}
      onChange={(event) => setFields((current) => ({ ...current, [name]: event.target.value }))}
      fullWidth
    />
  );
}

export function CompensationPlanningCommandDialog({
  dialog,
  dialogTitle,
  highRisk,
  copy,
  commandBusy,
  submitDisabled,
  setDialog,
  onSubmit,
  formError,
  fields,
  setFields,
  cycleAuthoringContext,
  selectedAuthoringGuideline,
  authoringAssignments,
  authoringComponentLinks,
  approvalReady,
  selected,
  submittedCount,
  actorId,
  confirmed,
  setConfirmed,
}: CompensationPlanningCommandDialogProps) {
  const { t } = useTranslation('hcm');
  return (
    <FormDialog
      open={Boolean(dialog)}
      title={dialogTitle}
      description={highRisk ? copy.highRiskDescription : undefined}
      cancelLabel={copy.close}
      submitLabel={copy.confirm}
      submittingLabel={copy.recordingCommand}
      busy={commandBusy}
      submitDisabled={submitDisabled}
      submitIntent={dialog?.kind === 'CANCEL' ? 'danger' : 'primary'}
      onClose={() => !commandBusy && setDialog(null)}
      onSubmit={onSubmit}
      maxWidth="md"
      mobileFullScreen
    >
      <Stack gap={2}>
        {formError ? (
          <InlineFeedback severity="error" title={copy.commandNotSubmitted}>
            {formError}
          </InlineFeedback>
        ) : null}
        {dialog?.kind === 'CREATE' || dialog?.kind === 'REVISE' ? (
          <>
            {dialog.kind === 'CREATE'
              ? field(fields, setFields, 'cycleCode', copy.cycleCode, { required: true })
              : null}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1.5,
              }}
            >
              <DatePickerField
                name="effectiveFrom"
                label={copy.effectiveFrom}
                required
                value={fields.effectiveFrom ?? ''}
                onValueChange={(value) =>
                  setFields((current) => ({ ...current, effectiveFrom: value ?? '' }))
                }
              />
              <DatePickerField
                name="effectiveTo"
                label={copy.effectiveTo}
                value={fields.effectiveTo ?? ''}
                onValueChange={(value) =>
                  setFields((current) => ({ ...current, effectiveTo: value ?? '' }))
                }
              />
            </Box>
            <FormField label={copy.budgetMode} value="HARD_CAP" disabled fullWidth />
            <FormField
              select
              required
              label={copy.guidelineComponent}
              value={fields.guidelineComponentCode ?? ''}
              onChange={(event) => {
                const component = cycleAuthoringContext?.guidelines.components.find(
                  (item) => item.componentCode === event.target.value
                );
                setFields((current) => ({
                  ...current,
                  guidelineComponentCode: event.target.value,
                  guidelineMinimumAmount: component?.minimumAmount ?? '',
                  guidelineMaximumAmount: component?.maximumAmount ?? '',
                }));
              }}
              fullWidth
            >
              {(cycleAuthoringContext?.guidelines.components ?? []).map((item) => (
                <MenuItem key={item.componentCode} value={item.componentCode}>
                  {item.componentCode} · {item.currency}
                </MenuItem>
              ))}
            </FormField>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1.5,
              }}
            >
              {field(fields, setFields, 'guidelineMinimumAmount', copy.minimumAmount, {
                required: true,
              })}
              {field(fields, setFields, 'guidelineMaximumAmount', copy.maximumAmount, {
                required: true,
              })}
            </Box>
            {selectedAuthoringGuideline ? (
              <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(3,minmax(0,1fr))' },
                    gap: 1,
                  }}
                >
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {copy.currency}
                    </Typography>
                    <Typography>{selectedAuthoringGuideline.currency}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {copy.exceptionPolicy}
                    </Typography>
                    <Typography>{selectedAuthoringGuideline.exceptionPolicyCode}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {copy.roundingPolicy}
                    </Typography>
                    <Typography className="compplan-identifier">
                      {selectedAuthoringGuideline.roundingPolicyVersionPublicId}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            ) : null}
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography component="h3" variant="subtitle2">
                {copy.authoritativePopulationSource}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 1,
                  mt: 1,
                }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {copy.snapshotId}
                  </Typography>
                  <Typography className="compplan-identifier">
                    {cycleAuthoringContext?.populationSourceRef.snapshotPublicId}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {copy.ownerRevision}
                  </Typography>
                  <Typography>
                    {cycleAuthoringContext?.populationSourceRef.ownerRevision}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {copy.sourceAsOf}
                  </Typography>
                  <Typography className="compplan-identifier">
                    {cycleAuthoringContext?.populationSourceRef.asOf}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {copy.sourceDigest}
                  </Typography>
                  <Typography className="compplan-identifier">
                    {cycleAuthoringContext?.populationSourceRef.sha256}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {copy.eligiblePopulationSummary}
                  </Typography>
                  <Typography>
                    {authoringAssignments} / {authoringComponentLinks}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </>
        ) : null}
        {dialog?.kind === 'BUDGET' ? (
          <>
            <FormField
              select
              label={copy.ledgerOperation}
              value={fields.ledgerEntryType ?? 'ALLOCATE'}
              onChange={(event) =>
                setFields((current) => ({ ...current, ledgerEntryType: event.target.value }))
              }
              fullWidth
            >
              <MenuItem value="ALLOCATE">
                {t('hrisPerformance.compensationPlanning.ledger.allocate', {
                  defaultValue: 'ALLOCATE',
                })}
              </MenuItem>
              <MenuItem value="REVERSE">
                {t('hrisPerformance.compensationPlanning.ledger.reverse', {
                  defaultValue: 'REVERSE',
                })}
              </MenuItem>
            </FormField>
            {field(fields, setFields, 'organizationPublicId', copy.organizationId, {
              required: true,
            })}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1.5,
              }}
            >
              {field(fields, setFields, 'currency', copy.currency, { required: true })}
              {field(fields, setFields, 'amount', copy.canonicalAmount, {
                required: true,
                supportingText: copy.canonicalAmountHelp,
              })}
            </Box>
            {fields.ledgerEntryType === 'REVERSE'
              ? field(fields, setFields, 'reversesEntryPublicId', copy.reverseSourceEntryId, {
                  required: true,
                })
              : null}
          </>
        ) : null}
        {dialog?.kind === 'PROPOSAL' ? (
          <>
            {field(fields, setFields, 'proposalId', copy.proposalId, {
              required: true,
              disabled: Boolean(dialog.proposal),
            })}
            {field(fields, setFields, 'workerPublicId', copy.workerId, { required: true })}
            {field(fields, setFields, 'assignmentPublicId', copy.assignmentId, {
              required: true,
            })}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3,1fr)' },
                gap: 1.5,
              }}
            >
              {field(fields, setFields, 'componentCode', copy.component, { required: true })}
              {field(fields, setFields, 'proposalCurrency', copy.currency, { required: true })}
              {field(fields, setFields, 'proposalAmount', copy.canonicalAmount, {
                required: true,
              })}
            </Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1.5,
              }}
            >
              <DatePickerField
                name="proposalFrom"
                label={copy.effectiveFrom}
                required
                value={fields.proposalFrom ?? ''}
                onValueChange={(value) =>
                  setFields((current) => ({ ...current, proposalFrom: value ?? '' }))
                }
              />
              <DatePickerField
                name="proposalTo"
                label={copy.effectiveTo}
                value={fields.proposalTo ?? ''}
                onValueChange={(value) =>
                  setFields((current) => ({ ...current, proposalTo: value ?? '' }))
                }
              />
            </Box>
            {field(fields, setFields, 'supersedesProposalPublicId', copy.supersedesProposalId)}
          </>
        ) : null}
        {dialog?.kind === 'SUBMIT' ? (
          <>
            <InlineFeedback severity="info" title={copy.boundProposal}>
              {translatePerformance(
                t,
                'hrisPerformance.compensationPlanning.boundProposalVersion',
                '{{proposalId}} · v{{version}}',
                {
                  proposalId: dialog.proposal?.proposalId,
                  version: dialog.proposal?.aggregateVersion,
                }
              )}
              <br />
              {copy.sourceDigest}{' '}
              <span className="compplan-identifier">{dialog.proposal?.contentDigest}</span>
            </InlineFeedback>
            {field(fields, setFields, 'submissionDigest', copy.submissionDigest, {
              required: true,
              disabled: true,
            })}
            <DatePickerField
              name="submissionDate"
              label={copy.effectiveDate}
              value={fields.submissionDate ?? ''}
              onValueChange={(value) =>
                setFields((current) => ({ ...current, submissionDate: value ?? '' }))
              }
            />
          </>
        ) : null}
        {dialog?.kind === 'APPROVE' || dialog?.kind === 'PUBLISH' ? (
          <>
            <InlineFeedback
              severity={approvalReady || dialog.kind === 'PUBLISH' ? 'warning' : 'error'}
              title={copy.impactPreview}
            >
              {translatePerformance(
                t,
                'hrisPerformance.compensationPlanning.impactSummary',
                '{{cycleLabel}} {{cycleCode}} · {{sourceVersion}} v{{version}}; {{submittedCount}} {{submittedSuffix}}. {{impactRevalidation}}',
                {
                  cycleLabel: copy.cycleLabel,
                  cycleCode: selected?.cycleCode,
                  sourceVersion: copy.sourceVersion,
                  version: selected?.aggregateVersion,
                  submittedCount,
                  submittedSuffix: copy.submittedProposalsSuffix,
                  impactRevalidation: copy.impactRevalidation,
                }
              )}
            </InlineFeedback>
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
              <Typography variant="caption" color="text.secondary">
                {copy.makerCheckerContext}
              </Typography>
              <Typography variant="body2">
                {copy.checkerLabel}:{' '}
                <span className="compplan-identifier">{actorId || copy.currentActor}</span>
              </Typography>
              <Typography variant="body2">{copy.lineageDescription}</Typography>
            </Paper>
            {dialog.kind === 'APPROVE'
              ? field(fields, setFields, 'reasonCode', copy.approvalReasonCode, {
                  required: true,
                  supportingText: copy.approvalReasonHelp,
                })
              : field(fields, setFields, 'approvalReceiptId', copy.approvalReceiptId, {
                  required: true,
                })}
            <FormControlLabel
              control={
                <Checkbox
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
              }
              label={copy.immutable}
              sx={{ alignItems: 'flex-start' }}
            />
          </>
        ) : null}
        {dialog?.kind === 'CANCEL' ? (
          <>
            <InlineFeedback severity="warning" title={copy.cycleImpact}>
              {copy.cancelDescription}
            </InlineFeedback>
            <FormControlLabel
              control={
                <Checkbox
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
              }
              label={copy.cancelConfirmation}
            />
          </>
        ) : null}
      </Stack>
    </FormDialog>
  );
}
