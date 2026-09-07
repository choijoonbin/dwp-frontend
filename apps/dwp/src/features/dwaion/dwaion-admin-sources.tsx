import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, ShieldCheck } from 'lucide-react';
import {
  ActionIconButton,
  ErrorState,
  EnterpriseDataGrid,
  FormDialog,
  FormField,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';
import {
  getDwaionDataSourcePolicies,
  updateDwaionDataSourcePolicy,
  type DwaionDataClassification,
  type DwaionDataSourcePolicy,
  type DwaionSourceAccessMode,
  usePermissions,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';

import { DwaionAdminPageHeader } from './dwaion-admin-ui';

import type { GridColDef } from '@mui/x-data-grid';

type SourceEditor = DwaionDataSourcePolicy & { changeReason: string };
const CLASSIFICATION_OPTIONS = (['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] as const).map(
  (value) => ({ value, label: value })
);
const ACCESS_OPTIONS = (['SOURCE_PERMISSIONS', 'TENANT_ALLOWLIST', 'BLOCKED'] as const).map(
  (value) => ({ value, label: value })
);

export function DwaionAdminSources() {
  const { t } = useTranslation('work');
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canUpdate =
    hasPermission('ADMIN.DWAION_SOURCES', 'UPDATE') ||
    hasPermission('ADMIN.DWAION_SOURCES', 'MANAGE');
  const [editor, setEditor] = useState<SourceEditor | null>(null);
  const [saved, setSaved] = useState(false);
  const query = useQuery({
    queryKey: ['dwaion', 'admin', 'sources'],
    queryFn: getDwaionDataSourcePolicies,
    staleTime: 20_000,
  });
  const mutation = useMutation({
    mutationFn: (value: SourceEditor) =>
      updateDwaionDataSourcePolicy(value.sourceKey, {
        enabled: value.enabled,
        accessMode: value.accessMode,
        classification: value.classification,
        connectorRef: value.connectorRef,
        expectedVersion: value.policyVersion,
        changeReason: value.changeReason.trim(),
      }),
    onSuccess: async () => {
      setEditor(null);
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ['dwaion', 'admin', 'sources'] });
    },
  });

  const columns = useMemo<GridColDef<DwaionDataSourcePolicy>[]>(
    () => [
      {
        field: 'displayName',
        headerName: t('dwaionAdmin.sources.columns.source'),
        minWidth: 210,
        flex: 1,
        valueGetter: (_, row) =>
          t(`dwaionAdmin.sources.sourceNames.${row.sourceKey}`, { defaultValue: row.displayName }),
      },
      { field: 'providerType', headerName: t('dwaionAdmin.sources.columns.provider'), width: 148 },
      {
        field: 'classification',
        headerName: t('dwaionAdmin.sources.columns.classification'),
        width: 144,
      },
      {
        field: 'accessMode',
        headerName: t('dwaionAdmin.sources.columns.access'),
        minWidth: 170,
        flex: 0.8,
      },
      {
        field: 'connectionState',
        headerName: t('dwaionAdmin.sources.columns.state'),
        width: 148,
        renderCell: ({ row }) => (
          <Chip
            size="small"
            variant="outlined"
            color={row.connectionState === 'CONNECTED' ? 'info' : 'default'}
            label={t(`dwaionAdmin.sources.connectionStates.${row.connectionState}`, {
              defaultValue: row.connectionState,
            })}
          />
        ),
      },
      {
        field: 'enabled',
        headerName: t('dwaionAdmin.sources.columns.enabled'),
        width: 92,
        renderCell: ({ row }) => (
          <Chip
            size="small"
            color={row.enabled ? 'success' : 'default'}
            variant="outlined"
            label={row.enabled ? t('dwaionAdmin.shared.enabled') : t('dwaionAdmin.shared.disabled')}
          />
        ),
      },
      {
        field: 'actions',
        headerName: '',
        width: 64,
        sortable: false,
        filterable: false,
        renderCell: ({ row }) =>
          canUpdate ? (
            <ActionIconButton
              label={t('dwaionAdmin.sources.edit')}
              tooltip={t('dwaionAdmin.sources.edit')}
              onClick={() => setEditor({ ...row, changeReason: '' })}
            >
              <Pencil size={17} />
            </ActionIconButton>
          ) : null,
      },
    ],
    [canUpdate, t]
  );

  const invalid = Boolean(
    !editor ||
    editor.changeReason.trim().length < 10 ||
    (editor.enabled && editor.accessMode === 'BLOCKED')
  );
  return (
    <PageCanvas>
      <DwaionAdminPageHeader
        eyebrow={t('dwaionAdmin.shared.governance')}
        title={t('dwaionAdmin.sources.title')}
        description={t('dwaionAdmin.sources.description')}
      />
      {saved && (
        <Alert severity="success" sx={{ mt: 2 }} onClose={() => setSaved(false)}>
          {t('dwaionAdmin.sources.saved')}
        </Alert>
      )}
      {mutation.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {t('dwaionAdmin.sources.error')}
        </Alert>
      )}
      <Alert severity="info" icon={<ShieldCheck size={19} />} sx={{ mt: 2 }}>
        {t('dwaionAdmin.sources.secretBoundary')}
      </Alert>
      {query.isError ? (
        <Box sx={{ mt: 3 }}>
          <ErrorState
            size="page"
            title={t('dwaionAdmin.sources.error')}
            description={t('dwaionAdmin.sources.unavailableDescription')}
            retryLabel={t('dwaionAdmin.shared.retry')}
            retrying={query.isFetching}
            onRetry={() => void query.refetch()}
          />
        </Box>
      ) : (
        <Box sx={{ mt: 3, borderBlock: 1, borderColor: 'divider' }}>
          <EnterpriseDataGrid
            ariaLabel={t('dwaionAdmin.sources.tableLabel')}
            rows={query.data ?? []}
            columns={columns}
            getRowId={(row) => row.sourceKey}
            loading={query.isLoading}
            hideFooter
            sx={{ border: 0, borderRadius: 0 }}
          />
        </Box>
      )}
      <FormDialog
        open={Boolean(editor)}
        title={t('dwaionAdmin.sources.dialogTitle')}
        description={
          editor
            ? t(`dwaionAdmin.sources.sourceNames.${editor.sourceKey}`, {
                defaultValue: editor.displayName,
              })
            : undefined
        }
        cancelLabel={t('dwaionAdmin.shared.cancel')}
        submitLabel={t('dwaionAdmin.shared.save')}
        submittingLabel={t('dwaionAdmin.shared.saving')}
        busy={mutation.isPending}
        submitDisabled={invalid}
        onClose={() => setEditor(null)}
        onSubmit={() => {
          if (editor) mutation.mutate(editor);
        }}
      >
        {editor && (
          <Stack spacing={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={editor.enabled}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      enabled: event.target.checked,
                      accessMode:
                        event.target.checked && editor.accessMode === 'BLOCKED'
                          ? 'SOURCE_PERMISSIONS'
                          : editor.accessMode,
                    })
                  }
                />
              }
              label={t('dwaionAdmin.sources.fields.enabled')}
            />
            <SelectField<DwaionSourceAccessMode>
              label={t('dwaionAdmin.sources.fields.access')}
              value={editor.accessMode}
              options={ACCESS_OPTIONS}
              onValueChange={(value) =>
                value &&
                setEditor({
                  ...editor,
                  accessMode: value,
                  enabled: value === 'BLOCKED' ? false : editor.enabled,
                })
              }
            />
            <SelectField<DwaionDataClassification>
              label={t('dwaionAdmin.sources.fields.classification')}
              value={editor.classification}
              options={CLASSIFICATION_OPTIONS}
              onValueChange={(value) => value && setEditor({ ...editor, classification: value })}
            />
            <FormField
              label={t('dwaionAdmin.sources.fields.connector')}
              value={editor.connectorRef ?? ''}
              onChange={(event) => setEditor({ ...editor, connectorRef: event.target.value })}
              supportingText={t('dwaionAdmin.sources.fields.connectorHelp')}
            />
            <FormField
              label={t('dwaionAdmin.shared.reason')}
              value={editor.changeReason}
              multiline
              minRows={3}
              onChange={(event) => setEditor({ ...editor, changeReason: event.target.value })}
              errorMessage={
                editor.changeReason && editor.changeReason.trim().length < 10
                  ? t('dwaionAdmin.shared.reasonError')
                  : undefined
              }
            />
          </Stack>
        )}
      </FormDialog>
    </PageCanvas>
  );
}
