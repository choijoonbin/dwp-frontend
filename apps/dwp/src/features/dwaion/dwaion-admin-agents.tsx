import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CopyPlus, Pencil, Plus, RotateCcw, ShieldCheck } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  EnterpriseDataGrid,
  FormDialog,
  FormField,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';
import {
  activateDwaionAdminAgentRevision,
  createDwaionAdminAgent,
  createDwaionAdminAgentRevision,
  listDwaionAdminAgents,
  retireDwaionAdminAgentRevision,
  updateDwaionAdminAgentRevision,
  type RegistryEntry,
  type RiskTier,
  usePermissions,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';

import { DwaionAdminPageHeader } from './dwaion-admin-ui';

import type { GridColDef } from '@mui/x-data-grid';

type EditorMode = 'create' | 'edit' | 'revision';
type EditorState = {
  mode: EditorMode;
  source?: RegistryEntry;
  entryKey: string;
  name: string;
  description: string;
  ownerRef: string;
  riskTier: RiskTier;
  artifactVersion: string;
};

const EMPTY_EDITOR: EditorState = {
  mode: 'create',
  entryKey: '',
  name: '',
  description: '',
  ownerRef: '',
  riskTier: 'MEDIUM',
  artifactVersion: '1.0.0',
};

const RISK_OPTIONS = (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((value) => ({
  value,
  label: value,
}));

export function DwaionAdminAgents() {
  const { t } = useTranslation('work');
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canCreate =
    hasPermission('ADMIN.DWAION_AGENTS', 'CREATE') ||
    hasPermission('ADMIN.DWAION_AGENTS', 'MANAGE');
  const canUpdate =
    hasPermission('ADMIN.DWAION_AGENTS', 'UPDATE') ||
    hasPermission('ADMIN.DWAION_AGENTS', 'MANAGE');
  const canApprove =
    hasPermission('ADMIN.DWAION_AGENTS', 'APPROVE') ||
    hasPermission('ADMIN.DWAION_AGENTS', 'MANAGE');
  const canManage = hasPermission('ADMIN.DWAION_AGENTS', 'MANAGE');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['dwaion', 'admin', 'agents'],
    queryFn: () => listDwaionAdminAgents(),
    staleTime: 20_000,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['dwaion', 'admin', 'agents'] });
    await queryClient.invalidateQueries({ queryKey: ['dwaion', 'runtime-agents'] });
  };
  const editorMutation = useMutation({
    mutationFn: async (state: EditorState) => {
      const definition = {
        name: state.name.trim(),
        description: state.description.trim() || null,
        ownerRef: state.ownerRef.trim(),
        riskTier: state.riskTier,
        artifactVersion: state.artifactVersion.trim(),
      };
      if (state.mode === 'create') {
        return createDwaionAdminAgent({
          entryKey: state.entryKey.trim().toUpperCase(),
          ...definition,
        });
      }
      if (!state.source) throw new Error('Agent source is missing.');
      if (state.mode === 'revision') {
        return createDwaionAdminAgentRevision(state.source, definition);
      }
      return updateDwaionAdminAgentRevision(state.source, {
        ...definition,
        version: state.source.version,
      });
    },
    onSuccess: async () => {
      setEditor(null);
      setNotice(t('dwaionAdmin.agents.saved'));
      await refresh();
    },
  });
  const lifecycleMutation = useMutation({
    mutationFn: async ({
      entry,
      transition,
    }: {
      entry: RegistryEntry;
      transition: 'activate' | 'retire';
    }) =>
      transition === 'activate'
        ? activateDwaionAdminAgentRevision(entry)
        : retireDwaionAdminAgentRevision(entry),
    onSuccess: async (_, variables) => {
      setNotice(t(`dwaionAdmin.agents.${variables.transition}d`));
      await refresh();
    },
  });

  const openEditor = (mode: EditorMode, source?: RegistryEntry) => {
    setEditor(
      source
        ? {
            mode,
            source,
            entryKey: source.entryKey,
            name: source.name,
            description: source.description ?? '',
            ownerRef: source.ownerRef,
            riskTier: source.riskTier,
            artifactVersion: source.artifactVersion,
          }
        : { ...EMPTY_EDITOR }
    );
  };
  const valid = Boolean(
    editor?.entryKey.trim() &&
    editor.name.trim() &&
    editor.ownerRef.trim() &&
    editor.artifactVersion.trim()
  );

  const columns = useMemo<GridColDef<RegistryEntry>[]>(
    () => [
      { field: 'name', headerName: t('dwaionAdmin.agents.columns.name'), minWidth: 220, flex: 1.2 },
      {
        field: 'entryKey',
        headerName: t('dwaionAdmin.agents.columns.key'),
        minWidth: 190,
        flex: 1,
      },
      {
        field: 'lifecycleState',
        headerName: t('dwaionAdmin.agents.columns.state'),
        width: 118,
        renderCell: ({ row }) => (
          <Chip
            size="small"
            variant="outlined"
            color={
              row.lifecycleState === 'ACTIVE'
                ? 'success'
                : row.lifecycleState === 'DRAFT'
                  ? 'warning'
                  : 'default'
            }
            label={row.lifecycleState}
          />
        ),
      },
      { field: 'revision', headerName: t('dwaionAdmin.agents.columns.revision'), width: 92 },
      { field: 'artifactVersion', headerName: t('dwaionAdmin.agents.columns.version'), width: 120 },
      { field: 'riskTier', headerName: t('dwaionAdmin.agents.columns.risk'), width: 108 },
      {
        field: 'actions',
        headerName: t('dwaionAdmin.agents.columns.actions'),
        sortable: false,
        filterable: false,
        width: 176,
        renderCell: ({ row }) => (
          <Stack direction="row" spacing={0.25}>
            {row.lifecycleState === 'DRAFT' && canUpdate && (
              <ActionIconButton
                label={t('dwaionAdmin.agents.edit')}
                tooltip={t('dwaionAdmin.agents.edit')}
                onClick={() => openEditor('edit', row)}
              >
                <Pencil size={17} />
              </ActionIconButton>
            )}
            {row.lifecycleState !== 'DRAFT' && canCreate && (
              <ActionIconButton
                label={t('dwaionAdmin.agents.newRevision')}
                tooltip={t('dwaionAdmin.agents.newRevision')}
                onClick={() => openEditor('revision', row)}
              >
                <CopyPlus size={17} />
              </ActionIconButton>
            )}
            {row.lifecycleState === 'DRAFT' && canApprove && (
              <ActionIconButton
                label={t('dwaionAdmin.agents.activate')}
                tooltip={t('dwaionAdmin.agents.activate')}
                intent="primary"
                onClick={() => lifecycleMutation.mutate({ entry: row, transition: 'activate' })}
              >
                <CheckCircle2 size={17} />
              </ActionIconButton>
            )}
            {row.lifecycleState !== 'RETIRED' && canManage && (
              <ActionIconButton
                label={t('dwaionAdmin.agents.retire')}
                tooltip={t('dwaionAdmin.agents.retire')}
                onClick={() => lifecycleMutation.mutate({ entry: row, transition: 'retire' })}
              >
                <RotateCcw size={17} />
              </ActionIconButton>
            )}
          </Stack>
        ),
      },
    ],
    [canApprove, canCreate, canManage, canUpdate, lifecycleMutation, t]
  );

  return (
    <PageCanvas>
      <DwaionAdminPageHeader
        eyebrow={t('dwaionAdmin.shared.governance')}
        title={t('dwaionAdmin.agents.title')}
        description={t('dwaionAdmin.agents.description')}
        actions={
          canCreate ? (
            <ActionButton
              intent="primary"
              startIcon={<Plus size={16} />}
              onClick={() => openEditor('create')}
            >
              {t('dwaionAdmin.agents.create')}
            </ActionButton>
          ) : undefined
        }
      />
      {notice && (
        <Alert severity="success" sx={{ mt: 2 }} onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}
      {(query.isError || editorMutation.isError || lifecycleMutation.isError) && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {t('dwaionAdmin.agents.error')}
        </Alert>
      )}
      <Alert severity="info" icon={<ShieldCheck size={19} />} sx={{ mt: 2 }}>
        {t('dwaionAdmin.agents.lifecycleNotice')}
      </Alert>
      <Box sx={{ mt: 3, borderBlock: 1, borderColor: 'divider' }}>
        <EnterpriseDataGrid
          ariaLabel={t('dwaionAdmin.agents.tableLabel')}
          rows={query.data?.content ?? []}
          columns={columns}
          getRowId={(row) => `${row.entryKey}:${row.revision}`}
          loading={query.isLoading}
          hideFooter={(query.data?.content.length ?? 0) <= 25}
          sx={{ border: 0, borderRadius: 0 }}
        />
      </Box>

      <FormDialog
        open={Boolean(editor)}
        title={t(`dwaionAdmin.agents.dialog.${editor?.mode ?? 'create'}.title`)}
        description={t(`dwaionAdmin.agents.dialog.${editor?.mode ?? 'create'}.description`)}
        cancelLabel={t('dwaionAdmin.shared.cancel')}
        submitLabel={t('dwaionAdmin.shared.save')}
        submittingLabel={t('dwaionAdmin.shared.saving')}
        busy={editorMutation.isPending}
        submitDisabled={!valid}
        onClose={() => setEditor(null)}
        onSubmit={() => {
          if (editor) editorMutation.mutate(editor);
        }}
      >
        {editor && (
          <Stack spacing={2}>
            <FormField
              label={t('dwaionAdmin.agents.fields.key')}
              value={editor.entryKey}
              disabled={editor.mode !== 'create'}
              onChange={(event) => setEditor({ ...editor, entryKey: event.target.value })}
            />
            <FormField
              label={t('dwaionAdmin.agents.fields.name')}
              value={editor.name}
              onChange={(event) => setEditor({ ...editor, name: event.target.value })}
            />
            <FormField
              label={t('dwaionAdmin.agents.fields.description')}
              value={editor.description}
              multiline
              minRows={3}
              onChange={(event) => setEditor({ ...editor, description: event.target.value })}
            />
            <FormField
              label={t('dwaionAdmin.agents.fields.owner')}
              value={editor.ownerRef}
              onChange={(event) => setEditor({ ...editor, ownerRef: event.target.value })}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <SelectField
                label={t('dwaionAdmin.agents.fields.risk')}
                value={editor.riskTier}
                options={RISK_OPTIONS}
                onValueChange={(value) => value && setEditor({ ...editor, riskTier: value })}
              />
              <FormField
                label={t('dwaionAdmin.agents.fields.version')}
                value={editor.artifactVersion}
                onChange={(event) => setEditor({ ...editor, artifactVersion: event.target.value })}
              />
            </Stack>
          </Stack>
        )}
      </FormDialog>
    </PageCanvas>
  );
}
