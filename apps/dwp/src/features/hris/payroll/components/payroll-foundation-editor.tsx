import { Plus, Trash2 } from 'lucide-react';
import {
  ActionButton,
  DatePickerField,
  FormDialog,
  FormField,
  InlineFeedback,
  SelectField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { FOUNDATION_ROUNDING_MODES } from '../model/payroll-foundation-model';

import type {
  FoundationDraftPeriod,
  FoundationDraftRounding,
  PayrollFoundationDraft,
} from '../model/payroll-foundation-model';
import type { PayrollFoundationCopy } from '../model/payroll-foundation-copy';

type Props = Readonly<{
  draft: PayrollFoundationDraft | null;
  copy: PayrollFoundationCopy;
  valid: boolean;
  busy: boolean;
  submitBlocked: boolean;
  onChange: (update: (current: PayrollFoundationDraft) => PayrollFoundationDraft) => void;
  onClose: () => void;
  onSave: () => void;
}>;

const grid = {
  display: 'grid',
  gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
  gap: 1.5,
};

function updatePeriod(
  draft: PayrollFoundationDraft,
  key: string,
  patch: Partial<FoundationDraftPeriod>
) {
  return {
    ...draft,
    periods: draft.periods.map((period) => (period.key === key ? { ...period, ...patch } : period)),
  };
}

function updateRounding(
  draft: PayrollFoundationDraft,
  key: string,
  patch: Partial<FoundationDraftRounding>
) {
  return {
    ...draft,
    rounding: draft.rounding.map((policy) =>
      policy.key === key ? { ...policy, ...patch } : policy
    ),
  };
}

function EditorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack component="section" gap={1.5}>
      <Typography component="h3" variant="subtitle1">
        {title}
      </Typography>
      {children}
    </Stack>
  );
}

export function PayrollFoundationEditor({
  draft,
  copy,
  valid,
  busy,
  submitBlocked,
  onChange,
  onClose,
  onSave,
}: Props) {
  const patch = (value: Partial<PayrollFoundationDraft>) =>
    onChange((current) => ({ ...current, ...value }));

  return (
    <FormDialog
      open={Boolean(draft)}
      title={draft?.configurationId ? copy.editorUpdate : copy.editorCreate}
      description={copy.editorDescription}
      cancelLabel={copy.cancel}
      submitLabel={copy.save}
      submittingLabel={copy.saving}
      busy={busy}
      submitDisabled={!valid || submitBlocked}
      maxWidth="md"
      mobileFullScreen
      onClose={onClose}
      onSubmit={onSave}
    >
      {draft && (
        <Stack gap={3}>
          {!valid && <InlineFeedback severity="info">{copy.invalidDraft}</InlineFeedback>}

          <EditorSection title={copy.legalEntity}>
            <Box sx={grid}>
              <FormField
                required
                label={copy.entityId}
                value={draft.legalEntityId}
                inputProps={{ maxLength: 80 }}
                onChange={(event) => patch({ legalEntityId: event.target.value })}
              />
              <FormField
                required
                label={copy.entityCode}
                value={draft.legalEntityCode}
                inputProps={{ maxLength: 80 }}
                onChange={(event) => patch({ legalEntityCode: event.target.value })}
              />
              <FormField
                required
                label={copy.entityName}
                value={draft.legalEntityName}
                inputProps={{ maxLength: 200 }}
                onChange={(event) => patch({ legalEntityName: event.target.value })}
              />
              <FormField
                required
                label={copy.packId}
                value={draft.countryPackId}
                inputProps={{ maxLength: 80 }}
                onChange={(event) => patch({ countryPackId: event.target.value })}
              />
              <FormField
                required
                type="number"
                label={copy.packVersion}
                value={draft.countryPackVersion}
                slotProps={{ htmlInput: { min: 1, step: 1 } }}
                onChange={(event) => patch({ countryPackVersion: event.target.value })}
              />
              <FormField
                required
                label={copy.packDigest}
                value={draft.countryPackDigest}
                inputProps={{ maxLength: 64 }}
                onChange={(event) => patch({ countryPackDigest: event.target.value })}
              />
            </Box>
          </EditorSection>

          <Divider />
          <EditorSection title={copy.payrollGroup}>
            <Box sx={grid}>
              <FormField
                required
                label={copy.groupId}
                value={draft.payrollGroupId}
                inputProps={{ maxLength: 80 }}
                onChange={(event) => patch({ payrollGroupId: event.target.value })}
              />
              <FormField
                required
                label={copy.groupCode}
                value={draft.payrollGroupCode}
                inputProps={{ maxLength: 80 }}
                onChange={(event) => patch({ payrollGroupCode: event.target.value })}
              />
              <FormField
                required
                label={copy.supportedCurrencies}
                supportingText={copy.currenciesHelp}
                value={draft.currencies}
                inputProps={{ maxLength: 200 }}
                onChange={(event) => patch({ currencies: event.target.value })}
              />
              <FormField
                required
                label={copy.settlementCurrency}
                value={draft.settlementCurrency}
                inputProps={{ maxLength: 3 }}
                onChange={(event) =>
                  patch({ settlementCurrency: event.target.value.toUpperCase() })
                }
              />
            </Box>
          </EditorSection>

          <Divider />
          <EditorSection title={copy.calendar}>
            <Box sx={grid}>
              <FormField
                required
                label={copy.calendarId}
                value={draft.calendarId}
                inputProps={{ maxLength: 80 }}
                onChange={(event) => patch({ calendarId: event.target.value })}
              />
              <SelectField
                required
                label={copy.cadence}
                value={draft.cadence}
                options={['WEEKLY', 'BIWEEKLY', 'SEMIMONTHLY', 'MONTHLY', 'CUSTOM'].map(
                  (value) => ({
                    value,
                    label: value,
                  })
                )}
                onValueChange={(value) => patch({ cadence: String(value) })}
              />
              <DatePickerField
                required
                label={copy.effectiveFrom}
                value={draft.effectiveStartsOn || null}
                onValueChange={(value) => patch({ effectiveStartsOn: value ?? '' })}
              />
              <DatePickerField
                label={copy.effectiveTo}
                value={draft.effectiveEndsOn || null}
                minDate={draft.effectiveStartsOn || null}
                onValueChange={(value) => patch({ effectiveEndsOn: value ?? '' })}
              />
            </Box>

            <Stack gap={1}>
              {draft.periods.map((period, index) => (
                <Paper key={period.key} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack gap={1.25}>
                    <Box sx={grid}>
                      <FormField
                        required
                        label={copy.periodCode}
                        value={period.code}
                        inputProps={{ maxLength: 80 }}
                        onChange={(event) =>
                          onChange((current) =>
                            updatePeriod(current, period.key, { code: event.target.value })
                          )
                        }
                      />
                      <DatePickerField
                        required
                        label={copy.paymentDate}
                        value={period.paymentDate || null}
                        onValueChange={(value) =>
                          onChange((current) =>
                            updatePeriod(current, period.key, { paymentDate: value ?? '' })
                          )
                        }
                      />
                      <DatePickerField
                        required
                        label={copy.periodStart}
                        value={period.startsOn || null}
                        onValueChange={(value) =>
                          onChange((current) =>
                            updatePeriod(current, period.key, { startsOn: value ?? '' })
                          )
                        }
                      />
                      <DatePickerField
                        required
                        label={copy.periodEnd}
                        value={period.endsOn || null}
                        minDate={period.startsOn || null}
                        onValueChange={(value) =>
                          onChange((current) =>
                            updatePeriod(current, period.key, { endsOn: value ?? '' })
                          )
                        }
                      />
                    </Box>
                    <ActionButton
                      intent="quiet"
                      size="small"
                      startIcon={<Trash2 size={14} aria-hidden="true" />}
                      disabled={draft.periods.length === 1}
                      onClick={() =>
                        onChange((current) => ({
                          ...current,
                          periods: current.periods.filter((item) => item.key !== period.key),
                        }))
                      }
                    >
                      {copy.removePeriod} {index + 1}
                    </ActionButton>
                  </Stack>
                </Paper>
              ))}
              <ActionButton
                intent="secondary"
                size="small"
                startIcon={<Plus size={14} aria-hidden="true" />}
                onClick={() =>
                  onChange((current) => ({
                    ...current,
                    periods: [
                      ...current.periods,
                      {
                        key: globalThis.crypto.randomUUID(),
                        code: '',
                        startsOn: '',
                        endsOn: '',
                        paymentDate: '',
                      },
                    ],
                  }))
                }
              >
                {copy.addPeriod}
              </ActionButton>
            </Stack>
          </EditorSection>

          <Divider />
          <EditorSection title={copy.currency}>
            <Stack gap={1}>
              {draft.rounding.map((policy, index) => (
                <Paper key={policy.key} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack gap={1.25}>
                    <Box sx={grid}>
                      <FormField
                        required
                        label={copy.roundingCurrency}
                        value={policy.currency}
                        inputProps={{ maxLength: 3 }}
                        onChange={(event) =>
                          onChange((current) =>
                            updateRounding(current, policy.key, {
                              currency: event.target.value.toUpperCase(),
                            })
                          )
                        }
                      />
                      <FormField
                        required
                        type="number"
                        label={copy.roundingScale}
                        value={policy.scale}
                        slotProps={{ htmlInput: { min: 0, max: 12, step: 1 } }}
                        onChange={(event) =>
                          onChange((current) =>
                            updateRounding(current, policy.key, { scale: event.target.value })
                          )
                        }
                      />
                      <SelectField
                        required
                        label={copy.roundingMode}
                        value={policy.mode}
                        options={FOUNDATION_ROUNDING_MODES.map((value) => ({
                          value,
                          label: value,
                        }))}
                        onValueChange={(value) =>
                          onChange((current) =>
                            updateRounding(current, policy.key, {
                              mode: value || 'HALF_EVEN',
                            })
                          )
                        }
                      />
                      <FormField
                        required
                        inputMode="decimal"
                        label={copy.roundingIncrement}
                        value={policy.increment}
                        inputProps={{ maxLength: 80 }}
                        onChange={(event) =>
                          onChange((current) =>
                            updateRounding(current, policy.key, { increment: event.target.value })
                          )
                        }
                      />
                    </Box>
                    <ActionButton
                      intent="quiet"
                      size="small"
                      startIcon={<Trash2 size={14} aria-hidden="true" />}
                      disabled={draft.rounding.length === 1}
                      onClick={() =>
                        onChange((current) => ({
                          ...current,
                          rounding: current.rounding.filter((item) => item.key !== policy.key),
                        }))
                      }
                    >
                      {copy.removeRounding} {index + 1}
                    </ActionButton>
                  </Stack>
                </Paper>
              ))}
              <ActionButton
                intent="secondary"
                size="small"
                startIcon={<Plus size={14} aria-hidden="true" />}
                onClick={() =>
                  onChange((current) => ({
                    ...current,
                    rounding: [
                      ...current.rounding,
                      {
                        key: globalThis.crypto.randomUUID(),
                        currency: '',
                        scale: '',
                        mode: 'HALF_EVEN',
                        increment: '',
                      },
                    ],
                  }))
                }
              >
                {copy.addRounding}
              </ActionButton>
            </Stack>
          </EditorSection>
        </Stack>
      )}
    </FormDialog>
  );
}
