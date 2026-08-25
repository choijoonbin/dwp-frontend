import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getSystemCodeSet } from '@dwp-frontend/shared-utils';
import { FormDialog, FormField, SelectField } from '@dwp-frontend/design-system';

import Stack from '@mui/material/Stack';

import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';

import type {
  CreateHrisConnectorRequest,
  HrisReconciliationIssue,
  createHrisMappingProfile,
  listHrisSources,
} from '@dwp-frontend/shared-utils';

const SOURCE_TYPES: CreateHrisConnectorRequest['sourceType'][] = [
  'WORKDAY',
  'ORACLE_HCM',
  'SAP_HCM',
  'SCIM',
  'CUSTOM',
];
const CONNECTOR_TYPES: CreateHrisConnectorRequest['connectorType'][] = [
  'WORKDAY_REST',
  'WORKDAY_SOAP',
  'ORACLE_HCM_REST',
  'SAP_SUCCESSFACTORS',
  'SCIM_BRIDGE',
  'CUSTOM_REST',
  'FILE_IMPORT',
];
const AUTH_MODES: CreateHrisConnectorRequest['authMode'][] = [
  'NONE',
  'BASIC',
  'OAUTH2_CLIENT_CREDENTIALS',
  'MTLS',
  'SIGNED_REQUEST',
];

export function ConnectorDialog({
  busy,
  onClose,
  onSave,
}: {
  busy: boolean;
  onClose: () => void;
  onSave: (request: CreateHrisConnectorRequest) => Promise<void>;
}) {
  const { t, i18n } = useTranslation('workforce');
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.management',
  });
  const sourceCatalog = useQuery({
    queryKey: ['system-code-set', 'PEOPLE.HRIS_SOURCE_TYPE', locale, ...requestScope.cacheKey],
    queryFn: ({ signal }) =>
      getSystemCodeSet('PEOPLE.HRIS_SOURCE_TYPE', locale, requestScope.contextScopeKey, signal),
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
    staleTime: 300_000,
  });
  const connectorCatalog = useQuery({
    queryKey: ['system-code-set', 'PEOPLE.HRIS_CONNECTOR_TYPE', locale, ...requestScope.cacheKey],
    queryFn: ({ signal }) =>
      getSystemCodeSet('PEOPLE.HRIS_CONNECTOR_TYPE', locale, requestScope.contextScopeKey, signal),
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
    staleTime: 300_000,
  });
  const authCatalog = useQuery({
    queryKey: ['system-code-set', 'PEOPLE.HRIS_AUTH_MODE', locale, ...requestScope.cacheKey],
    queryFn: ({ signal }) =>
      getSystemCodeSet('PEOPLE.HRIS_AUTH_MODE', locale, requestScope.contextScopeKey, signal),
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
    staleTime: 300_000,
  });
  const [sourceKey, setSourceKey] = useState('');
  const [sourceType, setSourceType] = useState<CreateHrisConnectorRequest['sourceType']>('WORKDAY');
  const [sourceName, setSourceName] = useState('');
  const [connectorKey, setConnectorKey] = useState('');
  const [connectorType, setConnectorType] =
    useState<CreateHrisConnectorRequest['connectorType']>('WORKDAY_REST');
  const [endpointUri, setEndpointUri] = useState('');
  const [authMode, setAuthMode] = useState<CreateHrisConnectorRequest['authMode']>(
    'OAUTH2_CLIENT_CREDENTIALS'
  );
  const [credentialReference, setCredentialReference] = useState('');
  const [scheduleExpression, setScheduleExpression] = useState('');
  const options = <T extends string>(catalog: typeof sourceCatalog, fallback: T[]) =>
    catalog.data?.values
      .filter((value) => fallback.includes(value.code as T))
      .map((value) => ({ value: value.code as T, label: value.label })) ??
    fallback.map((value) => ({ value, label: value }));
  const remote = connectorType !== 'FILE_IMPORT';
  const valid =
    sourceKey.trim() &&
    sourceName.trim() &&
    connectorKey.trim() &&
    (!remote || endpointUri.startsWith('https://')) &&
    (authMode === 'NONE' ||
      /^(vault|secret|env|aws-secretsmanager):\/\//.test(credentialReference));
  return (
    <FormDialog
      open
      title={t('provisioning.hris.create.title')}
      description={t('provisioning.hris.create.secretNotice')}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('common.actions.create')}
      busy={busy}
      submitDisabled={!valid}
      maxWidth="md"
      onClose={onClose}
      onSubmit={() =>
        onSave({
          sourceKey: sourceKey.trim(),
          sourceType,
          sourceName: sourceName.trim(),
          connectorKey: connectorKey.trim(),
          connectorType,
          endpointUri: endpointUri.trim() || undefined,
          authMode,
          credentialReference: credentialReference.trim() || undefined,
          scheduleExpression: scheduleExpression.trim() || undefined,
        })
      }
    >
      <Stack gap={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <FormField
            required
            label={t('provisioning.hris.create.sourceKey')}
            value={sourceKey}
            onChange={(event) => setSourceKey(event.target.value)}
          />
          <SelectField
            label={t('provisioning.hris.create.sourceType')}
            value={sourceType}
            options={options(sourceCatalog, SOURCE_TYPES)}
            onValueChange={(value) => value && setSourceType(value)}
          />
          <FormField
            required
            label={t('provisioning.hris.create.sourceName')}
            value={sourceName}
            onChange={(event) => setSourceName(event.target.value)}
          />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <FormField
            required
            label={t('provisioning.hris.create.connectorKey')}
            value={connectorKey}
            onChange={(event) => setConnectorKey(event.target.value)}
          />
          <SelectField
            label={t('provisioning.hris.create.connectorType')}
            value={connectorType}
            options={options(connectorCatalog, CONNECTOR_TYPES)}
            onValueChange={(value) => {
              if (!value) return;
              setConnectorType(value);
              if (value === 'FILE_IMPORT') setAuthMode('NONE');
            }}
          />
        </Stack>
        <FormField
          required={remote}
          disabled={!remote}
          label={t('provisioning.hris.create.endpoint')}
          value={endpointUri}
          onChange={(event) => setEndpointUri(event.target.value)}
          supportingText={t(
            remote ? 'provisioning.hris.create.httpsOnly' : 'provisioning.hris.create.fileManaged'
          )}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <SelectField
            label={t('provisioning.hris.create.authMode')}
            value={authMode}
            options={options(authCatalog, AUTH_MODES)}
            onValueChange={(value) => value && setAuthMode(value)}
          />
          <FormField
            required={authMode !== 'NONE'}
            disabled={authMode === 'NONE'}
            label={t('provisioning.hris.create.credentialReference')}
            value={credentialReference}
            placeholder={t('provisioning.hris.create.credentialReferencePlaceholder')}
            onChange={(event) => setCredentialReference(event.target.value)}
          />
          <FormField
            label={t('provisioning.hris.create.schedule')}
            value={scheduleExpression}
            onChange={(event) => setScheduleExpression(event.target.value)}
          />
        </Stack>
      </Stack>
    </FormDialog>
  );
}

export function MappingDialog({
  sources,
  busy,
  onClose,
  onSave,
}: {
  sources: Awaited<ReturnType<typeof listHrisSources>>;
  busy: boolean;
  onClose: () => void;
  onSave: (request: Parameters<typeof createHrisMappingProfile>[0]) => Promise<void>;
}) {
  const { t } = useTranslation('workforce');
  const [sourceSystemId, setSourceSystemId] = useState<number | ''>(
    sources[0]?.sourceSystemId ?? ''
  );
  const [profileKey, setProfileKey] = useState('');
  const [sourceVersion, setSourceVersion] = useState('');
  const [definition, setDefinition] = useState('{\n  "mappings": []\n}');
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(definition) as Record<string, unknown>;
  } catch {
    parsed = null;
  }
  const valid =
    sourceSystemId !== '' &&
    profileKey.trim() &&
    sourceVersion.trim() &&
    Array.isArray(parsed?.mappings) &&
    parsed.mappings.length > 0;
  return (
    <FormDialog
      open
      title={t('provisioning.hris.mapping.createTitle')}
      description={t('provisioning.hris.mapping.createDescription')}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('common.actions.create')}
      busy={busy}
      submitDisabled={!valid}
      maxWidth="md"
      onClose={onClose}
      onSubmit={() =>
        parsed && sourceSystemId !== ''
          ? onSave({
              sourceSystemId,
              profileKey: profileKey.trim(),
              adapterType: 'WORKDAY_REST',
              sourceSchemaVersion: sourceVersion.trim(),
              targetSchemaVersion: 'dwp.workforce-projection.v1',
              mappingDefinition: parsed,
            })
          : undefined
      }
    >
      <Stack gap={2}>
        <SelectField<number>
          label={t('provisioning.hris.mapping.source')}
          value={sourceSystemId}
          options={sources.map((source) => ({ value: source.sourceSystemId, label: source.name }))}
          onValueChange={setSourceSystemId}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <FormField
            label={t('provisioning.hris.mapping.key')}
            value={profileKey}
            onChange={(event) => setProfileKey(event.target.value)}
          />
          <FormField
            label={t('provisioning.hris.mapping.sourceVersion')}
            value={sourceVersion}
            onChange={(event) => setSourceVersion(event.target.value)}
          />
        </Stack>
        <FormField
          multiline
          minRows={10}
          label={t('provisioning.hris.mapping.definition')}
          value={definition}
          errorMessage={!parsed ? t('provisioning.hris.mapping.invalidJson') : undefined}
          onChange={(event) => setDefinition(event.target.value)}
          inputProps={{ spellCheck: false }}
        />
      </Stack>
    </FormDialog>
  );
}

export function IssueResolutionDialog({
  issue,
  busy,
  onClose,
  onSave,
}: {
  issue: HrisReconciliationIssue;
  busy: boolean;
  onClose: () => void;
  onSave: (state: 'RESOLVED' | 'ACCEPTED', note: string) => Promise<void>;
}) {
  const { t } = useTranslation('workforce');
  const [state, setState] = useState<'RESOLVED' | 'ACCEPTED'>('RESOLVED');
  const [note, setNote] = useState('');
  return (
    <FormDialog
      open
      title={t('provisioning.hris.reconciliation.resolveTitle')}
      description={`${issue.issueCode} · ${issue.redactedSummary}`}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('common.actions.save')}
      busy={busy}
      submitDisabled={!note.trim()}
      onClose={onClose}
      onSubmit={() => onSave(state, note.trim())}
    >
      <Stack gap={2}>
        <SelectField
          label={t('provisioning.hris.reconciliation.disposition')}
          value={state}
          options={[
            { value: 'RESOLVED', label: t('provisioning.hris.reconciliation.resolved') },
            { value: 'ACCEPTED', label: t('provisioning.hris.reconciliation.accepted') },
          ]}
          onValueChange={(value) => value && setState(value)}
        />
        <FormField
          multiline
          minRows={4}
          label={t('provisioning.hris.reconciliation.note')}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}
