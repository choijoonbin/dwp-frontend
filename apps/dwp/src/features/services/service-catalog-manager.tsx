import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FilePlus2, PencilLine, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAdminServiceCatalog,
  getServiceManagementCatalog,
  saveAdminServiceCatalogItem,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  FormDialog,
  FormField,
  GuidedEmptyState,
  OperationalKpiStrip,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import type {
  AdminServiceCatalogItem,
  ServiceCatalogLifecycle,
  ServiceDataClassification,
  ServiceFieldType,
  ServiceRequestField,
} from '@dwp-frontend/shared-utils';
import { useProductSurfaceCapabilityAccess } from '../../components/product-surface-capability-access';
import { useProductActionMutation } from '../../components/use-product-action-mutation';
import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';

type CatalogForm = {
  serviceKey: string;
  categoryKey: string;
  nameKo: string;
  nameEn: string;
  descriptionKo: string;
  descriptionEn: string;
  ownerGroup: string;
  lifecycleState: ServiceCatalogLifecycle;
  slaHours: number;
  estimatedResolutionHours: number;
  dataClassification: ServiceDataClassification;
  featured: boolean;
  tags: string;
  fields: ServiceRequestField[];
  version?: number | null;
};

const lifecycles: ServiceCatalogLifecycle[] = ['DRAFT', 'ACTIVE', 'RETIRED'];
const classifications: ServiceDataClassification[] = [
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
  'RESTRICTED',
];
const fieldTypes: ServiceFieldType[] = ['TEXT', 'TEXTAREA', 'SELECT', 'DATE', 'NUMBER', 'CHECKBOX'];

const emptyForm: CatalogForm = {
  serviceKey: '',
  categoryKey: '',
  nameKo: '',
  nameEn: '',
  descriptionKo: '',
  descriptionEn: '',
  ownerGroup: '',
  lifecycleState: 'DRAFT',
  slaHours: 24,
  estimatedResolutionHours: 8,
  dataClassification: 'INTERNAL',
  featured: false,
  tags: '',
  fields: [
    {
      key: 'requestDetail',
      type: 'TEXTAREA',
      labelKo: '요청 내용',
      labelEn: 'Request details',
      required: true,
    },
  ],
  version: null,
};

function formFrom(item: AdminServiceCatalogItem): CatalogForm {
  return {
    serviceKey: item.serviceKey,
    categoryKey: item.categoryKey,
    nameKo: item.nameKo,
    nameEn: item.nameEn,
    descriptionKo: item.descriptionKo,
    descriptionEn: item.descriptionEn,
    ownerGroup: item.ownerGroup,
    lifecycleState: item.lifecycleState,
    slaHours: item.slaHours,
    estimatedResolutionHours: item.estimatedResolutionHours,
    dataClassification: item.dataClassification,
    featured: item.featured,
    tags: item.tags.join(', '),
    fields: item.requestSchema.fields,
    version: item.version,
  };
}

function validForm(form: CatalogForm) {
  return Boolean(
    /^[a-z][a-z0-9.-]{2,79}$/.test(form.serviceKey) &&
    /^[A-Z][A-Z0-9_]{1,49}$/.test(form.categoryKey) &&
    form.nameKo.trim() &&
    form.nameEn.trim() &&
    form.descriptionKo.trim() &&
    form.descriptionEn.trim() &&
    form.ownerGroup.trim() &&
    form.slaHours > 0 &&
    form.estimatedResolutionHours > 0 &&
    form.fields.length > 0 &&
    form.fields.every(
      (field) =>
        /^[a-z][A-Za-z0-9]{1,49}$/.test(field.key) &&
        field.labelKo.trim() &&
        field.labelEn.trim() &&
        (field.type !== 'SELECT' || Boolean(field.options?.length))
    ) &&
    new Set(form.fields.map((field) => field.key)).size === form.fields.length
  );
}

function ServiceDefinitionDialog({
  open,
  item,
  categoryKeys,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  item: AdminServiceCatalogItem | null;
  categoryKeys: string[];
  busy: boolean;
  onClose: () => void;
  onSave: (form: CatalogForm) => void;
}) {
  const { t } = useTranslation('admin');
  const [form, setForm] = useState<CatalogForm>(emptyForm);
  const [validationVisible, setValidationVisible] = useState(false);
  const initialCategoryKey = categoryKeys[0] ?? '';

  useEffect(() => {
    if (!open) return;
    setForm(item ? formFrom(item) : { ...emptyForm, categoryKey: initialCategoryKey });
    setValidationVisible(false);
  }, [initialCategoryKey, item, open]);

  const updateField = (index: number, patch: Partial<ServiceRequestField>) =>
    setForm((current) => ({
      ...current,
      fields: current.fields.map((field, position) =>
        position === index ? { ...field, ...patch } : field
      ),
    }));

  return (
    <FormDialog
      open={open}
      title={t(
        item ? 'serviceCenter.catalog.editor.editTitle' : 'serviceCenter.catalog.editor.newTitle'
      )}
      cancelLabel={t('serviceCenter.catalog.editor.cancel')}
      submitLabel={t('serviceCenter.catalog.editor.save')}
      onClose={onClose}
      onSubmit={() => {
        if (validForm(form)) onSave(form);
        else setValidationVisible(true);
      }}
      busy={busy}
      maxWidth="lg"
    >
      <Stack gap={3}>
        <Box component="section">
          <Typography component="h3" variant="subtitle2" sx={{ mb: 1.5 }}>
            {t('serviceCenter.catalog.editor.identity')}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            <FormField
              required
              disabled={Boolean(item)}
              label={t('serviceCenter.catalog.editor.serviceKey')}
              value={form.serviceKey}
              errorMessage={
                validationVisible && !/^[a-z][a-z0-9.-]{2,79}$/.test(form.serviceKey)
                  ? 'lowercase.key-format'
                  : undefined
              }
              onChange={(event) =>
                setForm((current) => ({ ...current, serviceKey: event.target.value }))
              }
            />
            <FormField
              select
              required
              label={t('serviceCenter.catalog.editor.categoryKey')}
              value={form.categoryKey}
              onChange={(event) =>
                setForm((current) => ({ ...current, categoryKey: event.target.value }))
              }
            >
              {categoryKeys.map((category) => (
                <MenuItem key={category} value={category}>
                  {category}
                </MenuItem>
              ))}
            </FormField>
            <FormField
              required
              label={t('serviceCenter.catalog.editor.nameKo')}
              value={form.nameKo}
              onChange={(event) =>
                setForm((current) => ({ ...current, nameKo: event.target.value.slice(0, 160) }))
              }
            />
            <FormField
              required
              label={t('serviceCenter.catalog.editor.nameEn')}
              value={form.nameEn}
              onChange={(event) =>
                setForm((current) => ({ ...current, nameEn: event.target.value.slice(0, 160) }))
              }
            />
            <FormField
              required
              multiline
              minRows={2}
              label={t('serviceCenter.catalog.editor.descriptionKo')}
              value={form.descriptionKo}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  descriptionKo: event.target.value.slice(0, 1000),
                }))
              }
            />
            <FormField
              required
              multiline
              minRows={2}
              label={t('serviceCenter.catalog.editor.descriptionEn')}
              value={form.descriptionEn}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  descriptionEn: event.target.value.slice(0, 1000),
                }))
              }
            />
          </Box>
        </Box>
        <Divider />
        <Box component="section">
          <Typography component="h3" variant="subtitle2" sx={{ mb: 1.5 }}>
            {t('serviceCenter.catalog.editor.delivery')}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
              gap: 2,
            }}
          >
            <FormField
              required
              label={t('serviceCenter.catalog.editor.ownerGroup')}
              value={form.ownerGroup}
              onChange={(event) =>
                setForm((current) => ({ ...current, ownerGroup: event.target.value.slice(0, 160) }))
              }
              sx={{ gridColumn: { sm: 'span 2' } }}
            />
            <FormField
              select
              label={t('serviceCenter.catalog.editor.lifecycleState')}
              value={form.lifecycleState}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  lifecycleState: event.target.value as ServiceCatalogLifecycle,
                }))
              }
            >
              {lifecycles.map((value) => (
                <MenuItem key={value} value={value}>
                  {t(`serviceCenter.lifecycle.${value}`)}
                </MenuItem>
              ))}
            </FormField>
            <FormField
              select
              label={t('serviceCenter.catalog.editor.classification')}
              value={form.dataClassification}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  dataClassification: event.target.value as ServiceDataClassification,
                }))
              }
            >
              {classifications.map((value) => (
                <MenuItem key={value} value={value}>
                  {t(`serviceCenter.classification.${value}`)}
                </MenuItem>
              ))}
            </FormField>
            <FormField
              type="number"
              label={t('serviceCenter.catalog.editor.slaHours')}
              value={form.slaHours}
              onChange={(event) =>
                setForm((current) => ({ ...current, slaHours: Number(event.target.value) }))
              }
            />
            <FormField
              type="number"
              label={t('serviceCenter.catalog.editor.estimatedHours')}
              value={form.estimatedResolutionHours}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  estimatedResolutionHours: Number(event.target.value),
                }))
              }
            />
            <FormField
              label={t('serviceCenter.catalog.editor.tags')}
              value={form.tags}
              supportingText={t('serviceCenter.catalog.editor.tagsHelp')}
              onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
              sx={{ gridColumn: { sm: 'span 2' } }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.featured}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, featured: event.target.checked }))
                  }
                />
              }
              label={t('serviceCenter.catalog.editor.featured')}
              sx={{ gridColumn: { sm: 'span 2' } }}
            />
          </Box>
        </Box>
        <Divider />
        <Box component="section">
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={2}
            sx={{ mb: 1.5 }}
          >
            <Typography component="h3" variant="subtitle2">
              {t('serviceCenter.catalog.editor.form')}
            </Typography>
            <ActionButton
              intent="secondary"
              startIcon={<Plus size={16} />}
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  fields: [
                    ...current.fields,
                    {
                      key: `field${current.fields.length + 1}`,
                      type: 'TEXT',
                      labelKo: '',
                      labelEn: '',
                      required: false,
                    },
                  ],
                }))
              }
            >
              {t('serviceCenter.catalog.editor.addField')}
            </ActionButton>
          </Stack>
          <Stack gap={1.5}>
            {form.fields.map((field, index) => (
              <Box
                key={`${field.key}-${index}`}
                sx={{
                  p: 2,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '1fr .8fr 1.2fr 1.2fr 42px' },
                  gap: 1.5,
                  alignItems: 'start',
                  bgcolor: 'background.default',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                <FormField
                  required
                  label={t('serviceCenter.catalog.editor.fieldKey')}
                  value={field.key}
                  onChange={(event) => updateField(index, { key: event.target.value })}
                />
                <FormField
                  select
                  label={t('serviceCenter.catalog.editor.fieldType')}
                  value={field.type}
                  onChange={(event) =>
                    updateField(index, {
                      type: event.target.value as ServiceFieldType,
                      options:
                        event.target.value === 'SELECT'
                          ? (field.options ?? ['OPTION_1'])
                          : undefined,
                    })
                  }
                >
                  {fieldTypes.map((value) => (
                    <MenuItem key={value} value={value}>
                      {value}
                    </MenuItem>
                  ))}
                </FormField>
                <FormField
                  required
                  label={t('serviceCenter.catalog.editor.labelKo')}
                  value={field.labelKo}
                  onChange={(event) => updateField(index, { labelKo: event.target.value })}
                />
                <FormField
                  required
                  label={t('serviceCenter.catalog.editor.labelEn')}
                  value={field.labelEn}
                  onChange={(event) => updateField(index, { labelEn: event.target.value })}
                />
                <ActionIconButton
                  label={t('serviceCenter.catalog.editor.removeField')}
                  disabled={form.fields.length === 1}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      fields: current.fields.filter((_value, position) => position !== index),
                    }))
                  }
                  sx={{ mt: 1 }}
                >
                  <Trash2 size={17} />
                </ActionIconButton>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={Boolean(field.required)}
                      onChange={(event) => updateField(index, { required: event.target.checked })}
                    />
                  }
                  label={t('serviceCenter.catalog.editor.required')}
                />
                {field.type === 'SELECT' && (
                  <FormField
                    label={t('serviceCenter.catalog.editor.options')}
                    value={(field.options ?? []).join(', ')}
                    supportingText={t('serviceCenter.catalog.editor.optionsHelp')}
                    onChange={(event) =>
                      updateField(index, {
                        options: event.target.value
                          .split(',')
                          .map((value) => value.trim())
                          .filter(Boolean),
                      })
                    }
                    sx={{ gridColumn: { md: '2 / span 3' } }}
                  />
                )}
              </Box>
            ))}
          </Stack>
        </Box>
        {validationVisible && !validForm(form) && (
          <Alert severity="warning">{t('serviceCenter.catalog.editor.invalid')}</Alert>
        )}
      </Stack>
    </FormDialog>
  );
}

export function ServiceCatalogManager() {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const capabilityAccess = useProductSurfaceCapabilityAccess();
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'services',
    surfaceKey: 'services.management',
  });
  const createCatalogItem = useProductActionMutation(
    'route.services.management.catalog-create.action'
  );
  const updateCatalogItem = useProductActionMutation(
    'route.services.management.catalog-update.action'
  );
  const canCreate = capabilityAccess.governed
    ? capabilityAccess.hasWritableCapability('services.catalog.create')
    : hasPermission('ADMIN.SERVICE_CATALOG', 'CREATE');
  const canUpdate = capabilityAccess.governed
    ? capabilityAccess.hasWritableCapability('services.catalog.update')
    : hasPermission('ADMIN.SERVICE_CATALOG', 'UPDATE');
  const [search, setSearch] = useState('');
  const [lifecycle, setLifecycle] = useState<'ALL' | ServiceCatalogLifecycle>('ALL');
  const [selected, setSelected] = useState<AdminServiceCatalogItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const definitions = useQuery({
    queryKey: ['admin', 'services', 'catalog', ...requestScope.cacheKey],
    queryFn: ({ signal }) => getAdminServiceCatalog(requestScope.contextScopeKey, signal),
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
    retry: 1,
  });
  const publicCatalog = useQuery({
    queryKey: ['services', 'catalog', 'view', 'management', ...requestScope.cacheKey],
    queryFn: ({ signal }) => getServiceManagementCatalog(requestScope.contextScopeKey, signal),
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const mutation = useMutation({
    mutationFn: (form: CatalogForm) => {
      const persist = form.version == null ? createCatalogItem : updateCatalogItem;
      return persist((authority) =>
        saveAdminServiceCatalogItem(
          {
            serviceKey: form.serviceKey,
            categoryKey: form.categoryKey,
            nameKo: form.nameKo.trim(),
            nameEn: form.nameEn.trim(),
            descriptionKo: form.descriptionKo.trim(),
            descriptionEn: form.descriptionEn.trim(),
            ownerGroup: form.ownerGroup.trim(),
            lifecycleState: form.lifecycleState,
            requestSchema: { fields: form.fields },
            slaHours: form.slaHours,
            estimatedResolutionHours: form.estimatedResolutionHours,
            dataClassification: form.dataClassification,
            featured: form.featured,
            tags: form.tags
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean),
            version: form.version,
          },
          authority
        )
      );
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'services', 'catalog'] }),
        queryClient.invalidateQueries({ queryKey: ['services', 'catalog'] }),
      ]);
      toast.success(t('serviceCenter.catalog.saved'));
      setDialogOpen(false);
    },
    onError: () => toast.error(t('serviceCenter.catalog.saveError')),
  });
  const items = useMemo(() => definitions.data ?? [], [definitions.data]);
  const filtered = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();
    return items.filter(
      (item) =>
        (lifecycle === 'ALL' || item.lifecycleState === lifecycle) &&
        (!normalized ||
          `${item.nameKo} ${item.nameEn} ${item.serviceKey} ${item.ownerGroup}`
            .toLocaleLowerCase()
            .includes(normalized))
    );
  }, [items, lifecycle, search]);
  const averageSla = items.length
    ? Math.round(items.reduce((sum, item) => sum + item.slaHours, 0) / items.length)
    : 0;

  return (
    <Stack gap={2.5}>
      <Alert severity="info" icon={<ShieldCheck size={18} />}>
        {t('serviceCenter.catalog.governanceNotice')}
      </Alert>
      <OperationalKpiStrip
        ariaLabel={t('navigation.items.service-catalog.title')}
        items={[
          {
            key: 'active',
            label: t('serviceCenter.catalog.active'),
            value: items.filter((item) => item.lifecycleState === 'ACTIVE').length,
            tone: 'success',
          },
          {
            key: 'draft',
            label: t('serviceCenter.catalog.draft'),
            value: items.filter((item) => item.lifecycleState === 'DRAFT').length,
            tone: 'neutral',
          },
          {
            key: 'retired',
            label: t('serviceCenter.catalog.retired'),
            value: items.filter((item) => item.lifecycleState === 'RETIRED').length,
            tone: 'warning',
          },
          {
            key: 'sla',
            label: t('serviceCenter.catalog.averageSla'),
            value: t('serviceCenter.catalog.hours', { count: averageSla }),
            tone: 'info',
          },
        ]}
      />
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        gap={1.5}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.25} sx={{ flex: 1 }}>
          <FormField
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('serviceCenter.catalog.search')}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={17} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ maxWidth: 420 }}
          />
          <FormField
            select
            label={t('serviceCenter.catalog.lifecycle')}
            value={lifecycle}
            onChange={(event) => setLifecycle(event.target.value as typeof lifecycle)}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="ALL">{t('serviceCenter.catalog.all')}</MenuItem>
            {lifecycles.map((value) => (
              <MenuItem key={value} value={value}>
                {t(`serviceCenter.lifecycle.${value}`)}
              </MenuItem>
            ))}
          </FormField>
        </Stack>
        <ActionButton
          intent="primary"
          startIcon={<FilePlus2 size={17} />}
          disabled={!canCreate}
          onClick={() => {
            setSelected(null);
            setDialogOpen(true);
          }}
        >
          {t('serviceCenter.catalog.new')}
        </ActionButton>
      </Stack>
      {definitions.isLoading ? (
        <Skeleton variant="rounded" height={280} />
      ) : definitions.isError ? (
        <Alert severity="error">{t('serviceCenter.catalog.loadError')}</Alert>
      ) : filtered.length === 0 ? (
        <GuidedEmptyState
          kind="no-results"
          title={t('serviceCenter.catalog.emptyTitle')}
          description={t('serviceCenter.catalog.emptyDescription')}
        />
      ) : (
        <Box
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'background.paper',
            overflowX: 'auto',
          }}
        >
          <Table aria-label={t('serviceCenter.catalog.tableLabel')} sx={{ minWidth: 960 }}>
            <TableHead>
              <TableRow>
                <TableCell>{t('serviceCenter.catalog.service')}</TableCell>
                <TableCell>{t('serviceCenter.catalog.category')}</TableCell>
                <TableCell>{t('serviceCenter.catalog.owner')}</TableCell>
                <TableCell>{t('serviceCenter.catalog.sla')}</TableCell>
                <TableCell>{t('serviceCenter.catalog.classification')}</TableCell>
                <TableCell>{t('serviceCenter.catalog.state')}</TableCell>
                <TableCell padding="checkbox" />
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.serviceKey} hover sx={{ '& > td': { height: 68 } }}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={750}>
                      {item.nameKo}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.serviceKey}
                    </Typography>
                  </TableCell>
                  <TableCell>{item.categoryKey}</TableCell>
                  <TableCell>{item.ownerGroup}</TableCell>
                  <TableCell>
                    {t('serviceCenter.catalog.hours', { count: item.slaHours })}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t(`serviceCenter.classification.${item.dataClassification}`)}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={
                        item.lifecycleState === 'ACTIVE'
                          ? 'success'
                          : item.lifecycleState === 'RETIRED'
                            ? 'warning'
                            : 'default'
                      }
                      variant="outlined"
                      label={t(`serviceCenter.lifecycle.${item.lifecycleState}`)}
                    />
                  </TableCell>
                  <TableCell padding="checkbox">
                    <ActionIconButton
                      label={t('serviceCenter.catalog.edit')}
                      disabled={!canUpdate}
                      onClick={() => {
                        setSelected(item);
                        setDialogOpen(true);
                      }}
                    >
                      <PencilLine size={17} />
                    </ActionIconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
      <ServiceDefinitionDialog
        open={dialogOpen}
        item={selected}
        categoryKeys={(publicCatalog.data?.categories ?? []).map(
          (category) => category.categoryKey
        )}
        busy={mutation.isPending}
        onClose={() => setDialogOpen(false)}
        onSave={(form) => mutation.mutate(form)}
      />
    </Stack>
  );
}
