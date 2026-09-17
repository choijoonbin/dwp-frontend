import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PhoneCall, Plus, RefreshCw, RotateCcw, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  configureWorkplaceEmergencyContact,
  createWorkplaceIdempotencyKey,
  executeWorkplaceEmergencyHandoff,
  getAdminWorkplaceEmergencyContacts,
  getWorkplaceEmergencyHandoff,
  previewWorkplaceEmergencyHandoff,
  reconcileWorkplaceEmergencyHandoff,
  resolveIdempotentMutationIntent,
} from '@dwp-frontend/shared-utils';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { ActionButton, FormField, InlineFeedback, SelectField } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberSoftSurface } from './workplace-member-surfaces';
import { WorkplaceSafetyActionSection } from './workplace-safety-action-section';

import type {
  IdempotentMutationIntent,
  WorkplaceEmergencyContact,
  WorkplaceEmergencyContactActionMode,
  WorkplaceEmergencyContactKind,
  WorkplaceEmergencyHandoffPreview,
  WorkplaceEmergencyHandoffReceipt,
  WorkplaceSafetyIncident,
} from '@dwp-frontend/shared-utils';

type ContactDraft = {
  contactId: string;
  kind: WorkplaceEmergencyContactKind;
  nameKo: string;
  nameEn: string;
  actionMode: WorkplaceEmergencyContactActionMode;
  telUri: string;
  directTelAllowed: boolean;
  active: boolean;
  sortOrder: string;
  expectedVersion: number;
};

function emptyDraft(): ContactDraft {
  return {
    contactId: crypto.randomUUID(),
    kind: 'HOTLINE',
    nameKo: '',
    nameEn: '',
    actionMode: 'TEL_URI',
    telUri: '',
    directTelAllowed: false,
    active: true,
    sortOrder: '0',
    expectedVersion: 0,
  };
}

function draftFrom(contact: WorkplaceEmergencyContact): ContactDraft {
  return {
    contactId: contact.contactId,
    kind: contact.kind,
    nameKo: contact.displayNameKo,
    nameEn: contact.displayNameEn,
    actionMode: contact.actionMode,
    telUri: contact.telUri ?? '',
    directTelAllowed: contact.directTelAllowed,
    active: contact.active,
    sortOrder: String(contact.sortOrder),
    expectedVersion: contact.version,
  };
}

export function WorkplaceSafetyEmergencyHandoff({
  incident,
  canManage,
  onChanged,
}: {
  incident: WorkplaceSafetyIncident;
  canManage: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const { t, i18n } = useTranslation('rooms');
  const korean = resolveSupportedLocale(i18n.resolvedLanguage) === 'ko';
  const queryClient = useQueryClient();
  const intents = useRef<Record<string, IdempotentMutationIntent | null>>({});
  const [draft, setDraft] = useState<ContactDraft>(emptyDraft);
  const [configReason, setConfigReason] = useState('');
  const [configConfirmed, setConfigConfirmed] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [handoffReason, setHandoffReason] = useState('');
  const [preview, setPreview] = useState<WorkplaceEmergencyHandoffPreview | null>(null);
  const [executeConfirmed, setExecuteConfirmed] = useState(false);
  const [receipt, setReceipt] = useState<WorkplaceEmergencyHandoffReceipt | null>(null);
  const [reconcileConfirmed, setReconcileConfirmed] = useState(false);

  const contactsQuery = useQuery({
    queryKey: ['workplace', 'safety', 'admin', 'emergency-contacts'],
    queryFn: getAdminWorkplaceEmergencyContacts,
    retry: false,
  });
  const contacts = useMemo(() => contactsQuery.data ?? [], [contactsQuery.data]);
  const selectedContact = contacts.find((contact) => contact.contactId === selectedContactId);
  const governedContacts = contacts.filter(
    (contact) => contact.active && contact.actionMode === 'GOVERNED_HANDOFF'
  );
  const resultUnknown = receipt?.state === 'RESULT_UNKNOWN';

  useEffect(() => {
    if (
      selectedContactId &&
      governedContacts.some((item) => item.contactId === selectedContactId)
    ) {
      return;
    }
    setSelectedContactId(governedContacts[0]?.contactId ?? '');
  }, [governedContacts, selectedContactId]);

  const options = (kind: string, fingerprint: unknown) => {
    const next = resolveIdempotentMutationIntent(intents.current[kind] ?? null, fingerprint, () =>
      createWorkplaceIdempotencyKey(`safety-emergency-${kind}`)
    );
    intents.current[kind] = next;
    return {
      idempotencyKey: next.key,
      correlationId: crypto.randomUUID(),
      activeAccessMode: 'ELEVATED' as const,
    };
  };
  const clearIntent = (kind: string) => {
    intents.current[kind] = null;
  };
  const refreshContacts = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['workplace', 'safety', 'admin', 'emergency-contacts'],
    });
  };

  const configMutation = useMutation({
    mutationFn: () => {
      const sortOrder = Number(draft.sortOrder);
      const input = {
        kind: draft.kind,
        displayNameKo: draft.nameKo.trim(),
        displayNameEn: draft.nameEn.trim(),
        actionMode: draft.actionMode,
        telUri: draft.actionMode === 'TEL_URI' ? draft.telUri.trim() : null,
        directTelAllowed: draft.actionMode === 'TEL_URI' && draft.directTelAllowed,
        active: draft.active,
        sortOrder,
        expectedVersion: draft.expectedVersion,
        reason: configReason.trim(),
        explicitConfirmation: true as const,
      };
      return configureWorkplaceEmergencyContact(
        draft.contactId,
        input,
        options('configure', { contactId: draft.contactId, ...input })
      );
    },
    retry: false,
    onSuccess: async (result) => {
      clearIntent('configure');
      setConfigConfirmed(false);
      setDraft(draftFrom(result.contact));
      await refreshContacts();
    },
  });

  const previewMutation = useMutation({
    mutationFn: () => {
      if (!selectedContact) throw new Error('EMERGENCY_CONTACT_NOT_SELECTED');
      const input = {
        contactId: selectedContact.contactId,
        expectedIncidentVersion: incident.version,
        expectedContactVersion: selectedContact.version,
        reason: handoffReason.trim(),
      };
      return previewWorkplaceEmergencyHandoff(
        incident.incidentId,
        input,
        options('preview', { incidentId: incident.incidentId, ...input })
      );
    },
    retry: false,
    onSuccess: (result) => {
      clearIntent('preview');
      setPreview(result.preview);
      setExecuteConfirmed(false);
      setReceipt(null);
    },
  });

  const executeMutation = useMutation({
    mutationFn: () => {
      if (!preview) throw new Error('EMERGENCY_HANDOFF_PREVIEW_REQUIRED');
      const input = {
        previewId: preview.previewId,
        expectedIncidentVersion: preview.expectedIncidentVersion,
        expectedContactVersion: preview.expectedContactVersion,
        reason: handoffReason.trim(),
        explicitConfirmation: true as const,
      };
      return executeWorkplaceEmergencyHandoff(
        incident.incidentId,
        input,
        options('execute', { incidentId: incident.incidentId, ...input })
      );
    },
    retry: false,
    onSuccess: async (result) => {
      clearIntent('execute');
      setReceipt(result);
      setExecuteConfirmed(false);
      await onChanged();
    },
  });

  const recheckMutation = useMutation({
    mutationFn: () => getWorkplaceEmergencyHandoff(incident.incidentId, receipt?.commandId ?? ''),
    retry: false,
    onSuccess: setReceipt,
  });

  const reconcileMutation = useMutation({
    mutationFn: () => {
      if (!receipt) throw new Error('EMERGENCY_HANDOFF_RECEIPT_REQUIRED');
      return reconcileWorkplaceEmergencyHandoff(
        incident.incidentId,
        receipt.commandId,
        handoffReason.trim(),
        options('reconcile', {
          incidentId: incident.incidentId,
          commandId: receipt.commandId,
          reason: handoffReason.trim(),
        })
      );
    },
    retry: false,
    onSuccess: (result) => {
      clearIntent('reconcile');
      setReceipt(result);
      setReconcileConfirmed(false);
    },
  });

  const configValid =
    canManage &&
    draft.nameKo.trim().length > 0 &&
    draft.nameEn.trim().length > 0 &&
    Number.isInteger(Number(draft.sortOrder)) &&
    Number(draft.sortOrder) >= 0 &&
    Number(draft.sortOrder) <= 10_000 &&
    configReason.trim().length > 0 &&
    configConfirmed &&
    (draft.actionMode === 'GOVERNED_HANDOFF' ||
      (/^tel:\+[1-9][0-9]{6,14}$/u.test(draft.telUri.trim()) && draft.directTelAllowed));
  const canPreview =
    canManage &&
    !resultUnknown &&
    selectedContact?.providerState === 'READY' &&
    handoffReason.trim().length > 0;

  return (
    <>
      <WorkplaceSafetyActionSection
        title={t('workplace.safety.emergencyContacts.directoryTitle')}
        description={t('workplace.safety.emergencyContacts.directoryDescription')}
      >
        <Stack spacing={1.25}>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            <SelectField
              label={t('workplace.safety.emergencyContacts.editContact')}
              value={draft.expectedVersion ? draft.contactId : ''}
              placeholder={t('workplace.safety.emergencyContacts.newContact')}
              options={contacts.map((contact) => ({
                value: contact.contactId,
                label: korean ? contact.displayNameKo : contact.displayNameEn,
              }))}
              onValueChange={(value) => {
                const contact = contacts.find((item) => item.contactId === value);
                if (contact) setDraft(draftFrom(contact));
              }}
            />
            <ActionButton
              intent="secondary"
              startIcon={<Plus size={16} />}
              onClick={() => setDraft(emptyDraft())}
            >
              {t('workplace.safety.emergencyContacts.newContact')}
            </ActionButton>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            <SelectField
              label={t('workplace.safety.emergencyContacts.kind')}
              value={draft.kind}
              options={(['HOTLINE', 'RADIO', 'PUBLIC_EMERGENCY'] as const).map((kind) => ({
                value: kind,
                label: t(`workplace.safety.emergencyContacts.kinds.${kind}`),
              }))}
              onValueChange={(value) => value && setDraft({ ...draft, kind: value })}
            />
            <SelectField
              label={t('workplace.safety.emergencyContacts.actionMode')}
              value={draft.actionMode}
              options={(['TEL_URI', 'GOVERNED_HANDOFF'] as const).map((mode) => ({
                value: mode,
                label: t(`workplace.safety.emergencyContacts.actionModes.${mode}`),
              }))}
              onValueChange={(value) =>
                value &&
                setDraft({
                  ...draft,
                  actionMode: value,
                  telUri: value === 'GOVERNED_HANDOFF' ? '' : draft.telUri,
                  directTelAllowed: value === 'GOVERNED_HANDOFF' ? false : draft.directTelAllowed,
                })
              }
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            <FormField
              label={t('workplace.safety.emergencyContacts.nameKo')}
              value={draft.nameKo}
              onChange={(event) => setDraft({ ...draft, nameKo: event.target.value })}
            />
            <FormField
              label={t('workplace.safety.emergencyContacts.nameEn')}
              value={draft.nameEn}
              onChange={(event) => setDraft({ ...draft, nameEn: event.target.value })}
            />
          </Stack>
          {draft.actionMode === 'TEL_URI' && (
            <FormField
              label={t('workplace.safety.emergencyContacts.telUri')}
              supportingText={t('workplace.safety.emergencyContacts.telHint')}
              value={draft.telUri}
              onChange={(event) => setDraft({ ...draft, telUri: event.target.value })}
            />
          )}
          <FormField
            label={t('workplace.safety.emergencyContacts.sortOrder')}
            type="number"
            slotProps={{ htmlInput: { min: 0, max: 10_000 } }}
            value={draft.sortOrder}
            onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })}
          />
          <Stack>
            {draft.actionMode === 'TEL_URI' && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={draft.directTelAllowed}
                    onChange={(event) =>
                      setDraft({ ...draft, directTelAllowed: event.target.checked })
                    }
                  />
                }
                label={t('workplace.safety.emergencyContacts.directTelAllowed')}
              />
            )}
            <FormControlLabel
              control={
                <Checkbox
                  checked={draft.active}
                  onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
                />
              }
              label={t('workplace.safety.emergencyContacts.active')}
            />
          </Stack>
          <FormField
            label={t('workplace.safety.fields.reason')}
            value={configReason}
            onChange={(event) => setConfigReason(event.target.value)}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={configConfirmed}
                onChange={(event) => setConfigConfirmed(event.target.checked)}
              />
            }
            label={t('workplace.safety.emergencyContacts.configureConfirmation')}
          />
          <ActionButton
            intent="secondary"
            startIcon={<Save size={16} />}
            disabled={!configValid}
            loading={configMutation.isPending}
            onClick={() => configMutation.mutate()}
          >
            {t('workplace.safety.emergencyContacts.save')}
          </ActionButton>
          {configMutation.isError && (
            <InlineFeedback severity="error">
              {t('workplace.safety.emergencyContacts.configureError')}
            </InlineFeedback>
          )}
        </Stack>
      </WorkplaceSafetyActionSection>

      <WorkplaceSafetyActionSection
        title={t('workplace.safety.emergencyContacts.handoffTitle')}
        description={t('workplace.safety.emergencyContacts.handoffDescription')}
      >
        <Stack spacing={1.25}>
          {contactsQuery.isError && (
            <InlineFeedback severity="error">
              {t('workplace.safety.emergencyContacts.loadError')}
            </InlineFeedback>
          )}
          <SelectField
            label={t('workplace.safety.emergencyContacts.handoffContact')}
            value={selectedContactId}
            placeholder={t('workplace.safety.emergencyContacts.noGovernedContact')}
            options={governedContacts.map((contact) => ({
              value: contact.contactId,
              label: `${korean ? contact.displayNameKo : contact.displayNameEn} · ${t(
                `workplace.safety.emergencyContacts.providerStates.${contact.providerState}`
              )}`,
            }))}
            onValueChange={(value) => {
              setSelectedContactId(value);
              setPreview(null);
              setReceipt(null);
            }}
          />
          {selectedContact && (
            <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
              <Chip
                size="small"
                color={selectedContact.providerState === 'READY' ? 'success' : 'warning'}
                label={t(
                  `workplace.safety.emergencyContacts.providerStates.${selectedContact.providerState}`
                )}
              />
              <Typography variant="caption" color="text.secondary">
                {selectedContact.providerCode ??
                  t('workplace.safety.emergencyContacts.providerNotConfigured')}
              </Typography>
            </Stack>
          )}
          <FormField
            label={t('workplace.safety.fields.reason')}
            value={handoffReason}
            onChange={(event) => setHandoffReason(event.target.value)}
          />
          {!preview && (
            <ActionButton
              intent="secondary"
              startIcon={<PhoneCall size={16} />}
              disabled={!canPreview}
              loading={previewMutation.isPending}
              onClick={() => previewMutation.mutate()}
            >
              {t('workplace.safety.emergencyContacts.preview')}
            </ActionButton>
          )}
          {preview && (
            <Box sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.25 })}>
              <Stack spacing={0.75}>
                <Typography fontWeight="fontWeightBold">
                  {preview.eligible
                    ? t('workplace.safety.emergencyContacts.previewEligible')
                    : t('workplace.safety.emergencyContacts.previewBlocked')}
                </Typography>
                {preview.impact.map((item) => (
                  <Typography key={item} variant="body2">
                    • {t(`workplace.safety.emergencyContacts.impact.${item}`)}
                  </Typography>
                ))}
                {preview.limitations.map((item) => (
                  <Typography key={item} variant="body2" color="error.main">
                    • {item}
                  </Typography>
                ))}
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={executeConfirmed}
                      onChange={(event) => setExecuteConfirmed(event.target.checked)}
                    />
                  }
                  label={t('workplace.safety.emergencyContacts.executeConfirmation')}
                />
                <ActionButton
                  intent="danger"
                  disabled={!canManage || !preview.eligible || !executeConfirmed || resultUnknown}
                  loading={executeMutation.isPending}
                  onClick={() => executeMutation.mutate()}
                >
                  {t('workplace.safety.emergencyContacts.execute')}
                </ActionButton>
              </Stack>
            </Box>
          )}
          {(previewMutation.isError || executeMutation.isError) && (
            <InlineFeedback severity="error">
              {t('workplace.safety.emergencyContacts.handoffError')}
            </InlineFeedback>
          )}
          {receipt && (
            <InlineFeedback
              severity={
                resultUnknown ? 'warning' : receipt.state === 'SUCCEEDED' ? 'success' : 'error'
              }
            >
              {t('workplace.safety.emergencyContacts.receipt', {
                state: t(`workplace.safety.commandStates.${receipt.state}`),
                correlation: receipt.correlationId,
              })}
            </InlineFeedback>
          )}
          {resultUnknown && (
            <Stack spacing={1}>
              <InlineFeedback severity="warning">
                {t('workplace.safety.emergencyContacts.unknownRecovery')}
              </InlineFeedback>
              <ActionButton
                intent="quiet"
                startIcon={<RefreshCw size={16} />}
                loading={recheckMutation.isPending}
                onClick={() => recheckMutation.mutate()}
              >
                {t('workplace.safety.emergencyContacts.recheckReceipt')}
              </ActionButton>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={reconcileConfirmed}
                    onChange={(event) => setReconcileConfirmed(event.target.checked)}
                  />
                }
                label={t('workplace.safety.emergencyContacts.reconcileConfirmation')}
              />
              <ActionButton
                intent="secondary"
                startIcon={<RotateCcw size={16} />}
                disabled={!canManage || !reconcileConfirmed || !handoffReason.trim()}
                loading={reconcileMutation.isPending}
                onClick={() => reconcileMutation.mutate()}
              >
                {t('workplace.safety.emergencyContacts.reconcile')}
              </ActionButton>
            </Stack>
          )}
          {(recheckMutation.isError || reconcileMutation.isError) && (
            <InlineFeedback severity="error">
              {t('workplace.safety.emergencyContacts.reconcileError')}
            </InlineFeedback>
          )}
        </Stack>
      </WorkplaceSafetyActionSection>
    </>
  );
}
