import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, ShieldCheck } from 'lucide-react';
import {
  ActionIconButton,
  EnterpriseDataGrid,
  FormDialog,
  FormField,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';
import {
  getDwaionActionPolicies,
  updateDwaionActionPolicy,
  type DwaionActionExecutionPolicy,
  type DwaionActionPolicy,
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

type ActionEditor = DwaionActionPolicy & { changeReason: string };
const EXECUTION_OPTIONS = (['USER_HANDOFF', 'APPROVAL_HANDOFF', 'BLOCKED'] as const).map(
  (value) => ({ value, label: value })
);

export function DwaionAdminActions() {
  const { t } = useTranslation('work');
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canUpdate =
    hasPermission('ADMIN.DWAION_ACTIONS', 'UPDATE') ||
    hasPermission('ADMIN.DWAION_ACTIONS', 'MANAGE');
  const [editor, setEditor] = useState<ActionEditor | null>(null);
  const [saved, setSaved] = useState(false);
  const query = useQuery({
    queryKey: ['dwaion', 'admin', 'actions'],
    queryFn: getDwaionActionPolicies,
    staleTime: 20_000,
  });
  const mutation = useMutation({
    mutationFn: (value: ActionEditor) =>
      updateDwaionActionPolicy(value.actionKey, {
        enabled: value.enabled,
        confirmationRequired: value.confirmationRequired,
        executionPolicy: value.executionPolicy,
        expectedVersion: value.policyVersion,
        changeReason: value.changeReason.trim(),
      }),
    onSuccess: async () => {
      setEditor(null);
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ['dwaion', 'admin', 'actions'] });
      await queryClient.invalidateQueries({ queryKey: ['dwaion', 'actions'] });
    },
  });
  const columns = useMemo<GridColDef<DwaionActionPolicy>[]>(
    () => [
      {
        field: 'title',
        headerName: t('dwaionAdmin.actions.columns.action'),
        minWidth: 230,
        flex: 1.1,
      },
      {
        field: 'actionKey',
        headerName: t('dwaionAdmin.actions.columns.key'),
        minWidth: 210,
        flex: 1,
      },
      {
        field: 'requiredPermission',
        headerName: t('dwaionAdmin.actions.columns.permission'),
        minWidth: 220,
        flex: 1,
      },
      { field: 'riskTier', headerName: t('dwaionAdmin.actions.columns.risk'), width: 86 },
      {
        field: 'executionPolicy',
        headerName: t('dwaionAdmin.actions.columns.policy'),
        width: 172,
        renderCell: ({ row }) => (
          <Chip size="small" variant="outlined" label={row.executionPolicy} />
        ),
      },
      {
        field: 'enabled',
        headerName: t('dwaionAdmin.actions.columns.enabled'),
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
              label={t('dwaionAdmin.actions.edit')}
              tooltip={t('dwaionAdmin.actions.edit')}
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
    !editor.confirmationRequired ||
    (editor.enabled && editor.executionPolicy === 'BLOCKED')
  );

  return (
    <PageCanvas>
      <DwaionAdminPageHeader
        eyebrow={t('dwaionAdmin.shared.governance')}
        title={t('dwaionAdmin.actions.title')}
        description={t('dwaionAdmin.actions.description')}
      />
      {saved && (
        <Alert severity="success" sx={{ mt: 2 }} onClose={() => setSaved(false)}>
          {t('dwaionAdmin.actions.saved')}
        </Alert>
      )}
      {(query.isError || mutation.isError) && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {t('dwaionAdmin.actions.error')}
        </Alert>
      )}
      <Alert severity="info" icon={<ShieldCheck size={19} />} sx={{ mt: 2 }}>
        {t('dwaionAdmin.actions.executionBoundary')}
      </Alert>
      <Box sx={{ mt: 3, borderBlock: 1, borderColor: 'divider' }}>
        <EnterpriseDataGrid
          ariaLabel={t('dwaionAdmin.actions.tableLabel')}
          rows={query.data ?? []}
          columns={columns}
          getRowId={(row) => row.actionKey}
          loading={query.isLoading}
          hideFooter
          sx={{ border: 0, borderRadius: 0 }}
        />
      </Box>
      <FormDialog
        open={Boolean(editor)}
        title={t('dwaionAdmin.actions.dialogTitle')}
        description={editor?.title}
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
                      executionPolicy:
                        event.target.checked && editor.executionPolicy === 'BLOCKED'
                          ? 'USER_HANDOFF'
                          : editor.executionPolicy,
                    })
                  }
                />
              }
              label={t('dwaionAdmin.actions.fields.enabled')}
            />
            <SelectField<DwaionActionExecutionPolicy>
              label={t('dwaionAdmin.actions.fields.policy')}
              value={editor.executionPolicy}
              options={EXECUTION_OPTIONS}
              onValueChange={(value) =>
                value &&
                setEditor({
                  ...editor,
                  executionPolicy: value,
                  enabled: value === 'BLOCKED' ? false : editor.enabled,
                })
              }
            />
            <FormControlLabel
              control={
                <Switch checked={editor.confirmationRequired} disabled onChange={() => undefined} />
              }
              label={t('dwaionAdmin.actions.fields.confirmation')}
            />
            <Alert severity="warning">{t('dwaionAdmin.actions.confirmationLocked')}</Alert>
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
