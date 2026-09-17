import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { FormDialog, FormField, InlineFeedback, SelectField } from '@dwp-frontend/design-system';

import type { ScimConnector } from '@dwp-frontend/shared-utils';

type ScimCreateRequest = {
  connectorKey: string;
  displayName: string;
  purpose: string;
  allowedOperations: Array<'USERS' | 'GROUPS'>;
  credentialTtlDays: number;
};

type ScimRotationRequest = {
  expectedVersion: number;
  credentialTtlDays: number;
  explicitConfirmation: true;
  reason: string;
};

const TTL_OPTIONS = ['30', '90', '180', '365'];

export function ScimCreateDialog({
  open,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (request: ScimCreateRequest) => Promise<boolean>;
}) {
  const { t } = useTranslation('admin');
  const [connectorKey, setConnectorKey] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [credentialTtlDays, setCredentialTtlDays] = useState('180');
  const [users, setUsers] = useState(true);
  const [groups, setGroups] = useState(true);
  const allowedOperations = [
    ...(users ? (['USERS'] as const) : []),
    ...(groups ? (['GROUPS'] as const) : []),
  ];
  const ttl = Number(credentialTtlDays);
  const valid =
    Boolean(connectorKey.trim() && displayName.trim() && purpose.trim()) &&
    allowedOperations.length > 0 &&
    Number.isInteger(ttl) &&
    ttl >= 1 &&
    ttl <= 365;

  return (
    <FormDialog
      open={open}
      title={t('provisioning.scim.create.title')}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('common.actions.create')}
      onClose={onClose}
      onSubmit={async () => {
        const saved = await onSave({
          connectorKey: connectorKey.trim(),
          displayName: displayName.trim(),
          purpose: purpose.trim(),
          allowedOperations,
          credentialTtlDays: ttl,
        });
        if (saved) {
          setConnectorKey('');
          setDisplayName('');
          setPurpose('');
          setCredentialTtlDays('180');
          setUsers(true);
          setGroups(true);
        }
      }}
      busy={busy}
      submitDisabled={!valid}
    >
      <Stack gap={2}>
        <FormField
          autoFocus
          required
          label={t('provisioning.scim.create.key')}
          value={connectorKey}
          onChange={(event) => setConnectorKey(event.target.value)}
          supportingText={t('provisioning.scim.create.keyHelp')}
        />
        <FormField
          required
          label={t('provisioning.scim.create.name')}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
        <FormField
          required
          label={t('provisioning.scim.create.purpose')}
          value={purpose}
          inputProps={{ maxLength: 300 }}
          supportingText={t('provisioning.scim.create.purposeHelp')}
          onChange={(event) => setPurpose(event.target.value)}
        />
        <Box>
          <Typography component="h3" variant="subtitle2">
            {t('provisioning.scim.create.scope')}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={{ xs: 0, sm: 1 }}>
            <FormControlLabel
              control={
                <Checkbox checked={users} onChange={(event) => setUsers(event.target.checked)} />
              }
              label={t('provisioning.scim.create.usersScope')}
            />
            <FormControlLabel
              control={
                <Checkbox checked={groups} onChange={(event) => setGroups(event.target.checked)} />
              }
              label={t('provisioning.scim.create.groupsScope')}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {t('provisioning.scim.create.scopeHelp')}
          </Typography>
        </Box>
        <SelectField
          label={t('provisioning.scim.create.ttl')}
          value={credentialTtlDays}
          options={TTL_OPTIONS.map((value) => ({
            value,
            label: t('provisioning.scim.create.ttlDays', { count: Number(value) }),
          }))}
          onValueChange={setCredentialTtlDays}
        />
      </Stack>
    </FormDialog>
  );
}

export function ScimRotationDialog({
  connector,
  busy,
  onClose,
  onRotate,
}: {
  connector: ScimConnector | null;
  busy: boolean;
  onClose: () => void;
  onRotate: (connector: ScimConnector, request: ScimRotationRequest) => Promise<boolean>;
}) {
  const { t } = useTranslation('admin');
  const [reason, setReason] = useState('');
  const [credentialTtlDays, setCredentialTtlDays] = useState('180');
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    setReason('');
    setCredentialTtlDays('180');
    setConfirmed(false);
  }, [connector?.connectorId]);

  const ttl = Number(credentialTtlDays);
  const valid =
    Boolean(connector && reason.trim() && confirmed) &&
    Number.isInteger(ttl) &&
    ttl >= 1 &&
    ttl <= 365;

  return (
    <FormDialog
      open={Boolean(connector)}
      title={t('provisioning.scim.rotation.title')}
      description={t('provisioning.scim.rotation.description', {
        name: connector?.displayName ?? '',
      })}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('provisioning.scim.rotation.submit')}
      onClose={onClose}
      onSubmit={async () => {
        if (!connector) return;
        const saved = await onRotate(connector, {
          expectedVersion: connector.version,
          credentialTtlDays: ttl,
          explicitConfirmation: true,
          reason: reason.trim(),
        });
        if (saved) onClose();
      }}
      busy={busy}
      submitDisabled={!valid}
    >
      <Stack gap={2}>
        <InlineFeedback severity="warning">
          {t('provisioning.scim.rotation.immediateImpact')}
        </InlineFeedback>
        <SelectField
          label={t('provisioning.scim.create.ttl')}
          value={credentialTtlDays}
          options={TTL_OPTIONS.map((value) => ({
            value,
            label: t('provisioning.scim.create.ttlDays', { count: Number(value) }),
          }))}
          onValueChange={setCredentialTtlDays}
        />
        <FormField
          required
          label={t('provisioning.scim.rotation.reason')}
          value={reason}
          inputProps={{ maxLength: 500 }}
          onChange={(event) => setReason(event.target.value)}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
          }
          label={t('provisioning.scim.rotation.confirmation')}
        />
      </Stack>
    </FormDialog>
  );
}
