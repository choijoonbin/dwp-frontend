import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookKey, LockKeyhole, Pencil, RefreshCw } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionIconButton,
  EnterpriseDataGrid,
  ErrorState,
  FormDialog,
  FormField,
  LoadingState,
  SelectField,
} from '@dwp-frontend/design-system';
import {
  listWorkforceReferenceCatalogs,
  updateWorkforceReferenceValue,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { GridColDef } from '@mui/x-data-grid';
import type {
  WorkforceReferenceCatalog,
  WorkforceReferenceValue,
} from '@dwp-frontend/shared-utils';

function ReferenceEditDialog({
  catalog,
  value,
  busy,
  onClose,
  onSave,
}: {
  catalog: WorkforceReferenceCatalog;
  value: WorkforceReferenceValue | null;
  busy: boolean;
  onClose: () => void;
  onSave: (request: {
    displayName: string;
    description?: string;
    labels: Record<string, string>;
    lifecycleState: 'ACTIVE' | 'INACTIVE';
  }) => Promise<void>;
}) {
  const { t } = useTranslation('workforce');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [labelKo, setLabelKo] = useState('');
  const [labelEn, setLabelEn] = useState('');
  const [lifecycleState, setLifecycleState] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

  useEffect(() => {
    setDisplayName(value?.displayName ?? '');
    setDescription(value?.description ?? '');
    setLabelKo(value?.labels.ko ?? '');
    setLabelEn(value?.labels.en ?? '');
    setLifecycleState(value?.lifecycleState === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE');
  }, [value]);

  return (
    <FormDialog
      open={Boolean(value)}
      title={t('reference.edit.title')}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('common.actions.save')}
      busy={busy}
      submitDisabled={!displayName.trim()}
      onClose={onClose}
      onSubmit={() =>
        onSave({
          displayName: displayName.trim(),
          description: description.trim() || undefined,
          labels: {
            ...value?.labels,
            ...(labelKo.trim() ? { ko: labelKo.trim() } : {}),
            ...(labelEn.trim() ? { en: labelEn.trim() } : {}),
          },
          lifecycleState,
        })
      }
    >
      <Stack gap={2}>
        <Stack direction="row" gap={1} flexWrap="wrap" useFlexGap>
          <Chip size="small" variant="outlined" label={catalog.catalogKey} />
          <Chip size="small" label={value?.code} />
        </Stack>
        <FormField
          autoFocus
          required
          label={t('reference.edit.displayName')}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
        <FormField
          multiline
          minRows={2}
          label={t('reference.edit.description')}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <FormField
            label={t('reference.edit.labelKo')}
            value={labelKo}
            onChange={(event) => setLabelKo(event.target.value)}
          />
          <FormField
            label={t('reference.edit.labelEn')}
            value={labelEn}
            onChange={(event) => setLabelEn(event.target.value)}
          />
        </Stack>
        <SelectField
          label={t('reference.edit.lifecycle')}
          value={lifecycleState}
          onValueChange={(value) => setLifecycleState(value as 'ACTIVE' | 'INACTIVE')}
          options={[
            { value: 'ACTIVE', label: t('reference.states.ACTIVE') },
            { value: 'INACTIVE', label: t('reference.states.INACTIVE') },
          ]}
        />
        <Typography variant="caption" color="text.secondary">
          {t('reference.edit.localeHelp')}
        </Typography>
      </Stack>
    </FormDialog>
  );
}

export function WorkforceReferenceData() {
  const { t, i18n } = useTranslation('workforce');
  const locale = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [catalogKey, setCatalogKey] = useState<string>();
  const [editing, setEditing] = useState<WorkforceReferenceValue | null>(null);
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ['workforce', 'reference-data', locale],
    queryFn: () => listWorkforceReferenceCatalogs(locale),
  });
  const catalogs = query.data ?? [];
  const selected = catalogs.find((catalog) => catalog.catalogKey === catalogKey) ?? catalogs[0];
  const canEdit = (auth.user?.roles ?? []).some((role) => ['ADMIN', 'HR_ADMIN'].includes(role));

  const columns = useMemo<GridColDef<WorkforceReferenceValue>[]>(
    () => [
      {
        field: 'code',
        headerName: t('reference.columns.code'),
        minWidth: 180,
        flex: 0.7,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={750} noWrap>
              {row.localizedLabel}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" noWrap>
              {row.code}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'description',
        headerName: t('reference.columns.description'),
        minWidth: 280,
        flex: 1.2,
        valueGetter: (_value, row) => row.description || '-',
      },
      {
        field: 'detail',
        headerName: t('reference.columns.contract'),
        minWidth: 220,
        flex: 0.8,
        valueGetter: (_value, row) => row.detail || '-',
      },
      {
        field: 'labels',
        headerName: t('reference.columns.locales'),
        width: 130,
        renderCell: ({ row }) => (
          <Stack direction="row" gap={0.4}>
            {Object.keys(row.labels)
              .slice(0, 3)
              .map((item) => (
                <Chip key={item} size="small" variant="outlined" label={item.toUpperCase()} />
              ))}
          </Stack>
        ),
      },
      {
        field: 'lifecycleState',
        headerName: t('reference.columns.state'),
        width: 120,
        renderCell: ({ row }) => (
          <Chip
            size="small"
            variant="outlined"
            color={row.lifecycleState === 'ACTIVE' ? 'success' : 'default'}
            label={t(`reference.states.${row.lifecycleState}`, {
              defaultValue: row.lifecycleState,
            })}
          />
        ),
      },
      {
        field: 'actions',
        headerName: '',
        width: 54,
        sortable: false,
        renderCell: ({ row }) =>
          selected?.editable && canEdit ? (
            <ActionIconButton
              size="small"
              label={t('reference.edit.action')}
              onClick={() => setEditing(row)}
            >
              <Pencil size={16} />
            </ActionIconButton>
          ) : (
            <ActionIconButton size="small" disabled label={t('reference.readOnly')}>
              <LockKeyhole size={15} />
            </ActionIconButton>
          ),
      },
    ],
    [canEdit, selected?.editable, t]
  );

  if (query.isLoading) return <LoadingState label={t('reference.loading')} size="page" />;
  if (query.isError || !selected) {
    return (
      <ErrorState
        title={t('common.loadError')}
        description={t('reference.loadError')}
        size="standard"
      />
    );
  }

  return (
    <>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '250px minmax(0, 1fr)' },
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'background.paper',
        }}
      >
        <Box
          sx={{ borderRight: { lg: 1 }, borderBottom: { xs: 1, lg: 0 }, borderColor: 'divider' }}
        >
          <Stack direction="row" alignItems="center" gap={1} sx={{ px: 2, py: 1.5 }}>
            <BookKey size={18} />
            <Typography component="h2" variant="subtitle1">
              {t('reference.catalogs')}
            </Typography>
          </Stack>
          <List disablePadding sx={{ px: 1, pb: 1.5 }}>
            {catalogs.map((catalog) => (
              <ListItemButton
                key={catalog.catalogKey}
                selected={catalog.catalogKey === selected.catalogKey}
                onClick={() => setCatalogKey(catalog.catalogKey)}
                sx={{ borderRadius: 1, mb: 0.35 }}
              >
                <ListItemText
                  primary={t(`reference.catalog.${catalog.catalogKey}.name`)}
                  secondary={t('reference.valueCount', { count: catalog.values.length })}
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 700 }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={t(`reference.ownership.${catalog.ownership}`)}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="space-between"
            gap={1}
            sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
          >
            <Box>
              <Typography component="h2" variant="subtitle1">
                {t(`reference.catalog.${selected.catalogKey}.name`)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t(`reference.catalog.${selected.catalogKey}.description`)}
              </Typography>
            </Box>
            <Stack direction="row" alignItems="center" justifyContent="flex-end" gap={0.5}>
              {!selected.editable && <Chip size="small" label={t('reference.productGoverned')} />}
              <ActionIconButton
                label={t('common.actions.refresh')}
                onClick={() => void query.refetch()}
              >
                <RefreshCw size={18} />
              </ActionIconButton>
            </Stack>
          </Stack>
          <EnterpriseDataGrid
            ariaLabel={t(`reference.catalog.${selected.catalogKey}.name`)}
            rows={selected.values}
            columns={columns}
            getRowId={(row) => row.code}
            hideFooter
            minVisibleRows={6}
            maxVisibleRows={13}
            sx={{ border: 0, borderRadius: 0 }}
          />
        </Box>
      </Box>
      <ReferenceEditDialog
        catalog={selected}
        value={editing}
        busy={busy}
        onClose={() => setEditing(null)}
        onSave={async (request) => {
          if (!editing) return;
          setBusy(true);
          try {
            await updateWorkforceReferenceValue(selected.catalogKey, editing.code, locale, {
              ...request,
              version: editing.version,
            });
            await queryClient.invalidateQueries({ queryKey: ['workforce', 'reference-data'] });
            toast.success(t('reference.saved'));
            setEditing(null);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : t('common.operationError'));
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
