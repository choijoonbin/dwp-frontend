import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Braces,
  Check,
  FileStack,
  FolderPlus,
  FolderTree,
  GitBranch,
  PencilLine,
  Plus,
  Rocket,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton, ActionIconButton, EmptyState, FormField } from '@dwp-frontend/design-system';
import {
  createApprovalFormCategory,
  createApprovalFormDraft,
  getApprovalForm,
  getApprovalFormCategories,
  getApprovalForms,
  getApprovalWorkflow,
  getApprovalWorkflows,
  publishApprovalForm,
  updateApprovalFormCategory,
  updateApprovalFormDraft,
  useToast,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { ApprovalSurface, StatusChip, approvalTone } from './approval-ui';
import { ApprovalHighRiskCommandDialog } from './approval-high-risk-command-dialog';
import { approvalFormPublishCommand } from './approval-high-risk-command-model';
import { CategoryEditorDialog, FormEditorDialog } from './approval-form-catalog-dialogs';
import {
  buildApprovalFormCategoryTree,
  descendantCategoryIds,
  validApprovalFormFields,
} from './approval-form-catalog-model';
import {
  useApprovalExperience,
  useApprovalManagementRequestScope,
} from './use-approval-experience';
import {
  isProductSurfaceOperationCancelledError,
  useApprovalGovernedMutation,
} from './use-approval-governed-mutation';
import { useApprovalHighRiskCommand } from './use-approval-high-risk-command';

import type { ApprovalForm, ApprovalFormCategory } from '@dwp-frontend/shared-utils';
import type { CategoryDraft, FormDraft } from './approval-form-catalog-dialogs';

const emptyFormDraft = (): FormDraft => ({
  formKey: '',
  categoryId: '',
  nameKo: '',
  nameEn: '',
  descriptionKo: '',
  descriptionEn: '',
  ownerGroupRef: 'APPROVAL_OPERATOR',
  defaultWorkflowId: '',
  fields: [
    {
      key: 'summary',
      labelKo: '요청 내용',
      labelEn: 'Request summary',
      helpKo: '결재자가 판단할 핵심 배경과 요청 내용을 입력합니다.',
      helpEn: 'Provide the context and request the approver needs to decide.',
      type: 'TEXTAREA',
      required: true,
      options: [],
    },
  ],
});

const emptyCategoryDraft = (): CategoryDraft => ({
  categoryKey: '',
  parentCategoryId: '',
  nameKo: '',
  nameEn: '',
  descriptionKo: '',
  descriptionEn: '',
  iconKey: 'files',
  sortOrder: 100,
  lifecycleState: 'ACTIVE',
});

export function ApprovalFormStudio() {
  const { t, i18n } = useTranslation('approvals');
  const toast = useToast();
  const experience = useApprovalExperience();
  const requestScope = useApprovalManagementRequestScope();
  const queryClient = useQueryClient();
  const korean = i18n.resolvedLanguage?.startsWith('ko');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [formEditorOpen, setFormEditorOpen] = useState(false);
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const [creatingForm, setCreatingForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ApprovalFormCategory | null>(null);
  const [formDraft, setFormDraft] = useState<FormDraft>(emptyFormDraft);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>(emptyCategoryDraft);

  const forms = useQuery({
    queryKey: ['approvals', 'admin', 'forms', ...requestScope.cacheKey],
    queryFn: ({ signal }) => getApprovalForms(requestScope.contextScopeKey, signal),
    staleTime: 30_000,
  });
  const categories = useQuery({
    queryKey: ['approvals', 'admin', 'form-categories', ...requestScope.cacheKey],
    queryFn: ({ signal }) => getApprovalFormCategories(requestScope.contextScopeKey, signal),
    staleTime: 30_000,
  });
  const workflows = useQuery({
    queryKey: ['approvals', 'admin', 'workflows', ...requestScope.cacheKey],
    queryFn: ({ signal }) => getApprovalWorkflows(requestScope.contextScopeKey, signal),
    staleTime: 30_000,
  });
  const detail = useQuery({
    queryKey: ['approvals', 'admin', 'forms', selectedId, ...requestScope.cacheKey],
    queryFn: ({ signal }) => getApprovalForm(selectedId!, requestScope.contextScopeKey, signal),
    enabled: Boolean(selectedId),
    staleTime: 30_000,
  });

  const categoryTree = useMemo(
    () => buildApprovalFormCategoryTree(categories.data ?? [], forms.data ?? []),
    [categories.data, forms.data]
  );
  const categoryScope = useMemo(() => {
    if (categoryFilter === 'ALL') return null;
    return descendantCategoryIds(categories.data ?? [], categoryFilter);
  }, [categories.data, categoryFilter]);

  const visibleForms = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return (forms.data ?? []).filter((form) => {
      if (categoryScope && !categoryScope.has(form.categoryId)) return false;
      if (!needle) return true;
      return [form.formKey, form.nameKo, form.nameEn, form.descriptionKo, form.descriptionEn]
        .join(' ')
        .toLocaleLowerCase()
        .includes(needle);
    });
  }, [categoryScope, forms.data, search]);

  useEffect(() => {
    if (!selectedId && visibleForms.length) setSelectedId(visibleForms[0].formId);
    if (selectedId && !visibleForms.some((form) => form.formId === selectedId)) {
      setSelectedId(visibleForms[0]?.formId ?? null);
    }
  }, [selectedId, visibleForms]);

  const refreshForms = async (formId?: string) => {
    await queryClient.invalidateQueries({ queryKey: ['approvals', 'admin', 'forms'] });
    if (formId) {
      setSelectedId(formId);
      await queryClient.invalidateQueries({ queryKey: ['approvals', 'admin', 'forms', formId] });
    }
  };
  const refreshCategories = () =>
    queryClient.invalidateQueries({ queryKey: ['approvals', 'admin', 'form-categories'] });
  const runCreateForm = useApprovalGovernedMutation('route.approvals.admin.form-create.action');
  const runUpdateForm = useApprovalGovernedMutation('route.approvals.admin.form-update.action');
  const runCreateCategory = useApprovalGovernedMutation(
    'route.approvals.admin.form-category-create.action'
  );
  const runUpdateCategory = useApprovalGovernedMutation(
    'route.approvals.admin.form-category-update.action'
  );
  const highRiskPublish = useApprovalHighRiskCommand({
    operation: 'FORM_PUBLISH',
    execute: (command, execution) =>
      publishApprovalForm(command.targetId, command.expectedObjectVersion, execution),
    onSuccess: async (result) => {
      await refreshForms(result.form.formId);
      toast.success(t('admin.studio.formPublished'));
    },
    onConflict: async () => {
      await refreshForms(selectedId ?? undefined);
    },
  });

  const createForm = useMutation({
    mutationFn: () => runCreateForm((execution) => createApprovalFormDraft(formDraft, execution)),
    onSuccess: async (result) => {
      await refreshForms(result.form.formId);
      setFormEditorOpen(false);
      toast.success(t('admin.studio.formCreated'));
    },
    onError: (error) =>
      !isProductSurfaceOperationCancelledError(error) && toast.error(t('admin.studio.saveError')),
  });
  const updateForm = useMutation({
    mutationFn: () =>
      runUpdateForm((execution) =>
        updateApprovalFormDraft(
          selectedId!,
          {
            categoryId: formDraft.categoryId,
            nameKo: formDraft.nameKo,
            nameEn: formDraft.nameEn,
            descriptionKo: formDraft.descriptionKo,
            descriptionEn: formDraft.descriptionEn,
            ownerGroupRef: formDraft.ownerGroupRef,
            defaultWorkflowId: formDraft.defaultWorkflowId,
            fields: formDraft.fields,
            expectedVersion: detail.data!.form.version,
          },
          execution
        )
      ),
    onSuccess: async (result) => {
      await refreshForms(result.form.formId);
      setFormEditorOpen(false);
      toast.success(t('admin.studio.formSaved'));
    },
    onError: (error) =>
      !isProductSurfaceOperationCancelledError(error) &&
      toast.error(t('admin.studio.saveConflict')),
  });
  const saveCategory = useMutation({
    mutationFn: () => {
      const input = {
        parentCategoryId: categoryDraft.parentCategoryId || null,
        nameKo: categoryDraft.nameKo,
        nameEn: categoryDraft.nameEn,
        descriptionKo: categoryDraft.descriptionKo,
        descriptionEn: categoryDraft.descriptionEn,
        iconKey: categoryDraft.iconKey,
        sortOrder: categoryDraft.sortOrder,
      };
      return editingCategory
        ? runUpdateCategory((execution) =>
            updateApprovalFormCategory(
              editingCategory.categoryId,
              {
                ...input,
                lifecycleState: categoryDraft.lifecycleState,
                expectedVersion: editingCategory.version,
              },
              execution
            )
          )
        : runCreateCategory((execution) =>
            createApprovalFormCategory(
              { ...input, categoryKey: categoryDraft.categoryKey },
              execution
            )
          );
    },
    onSuccess: async () => {
      await refreshCategories();
      setCategoryEditorOpen(false);
      toast.success(t('admin.studio.categorySaved'));
    },
    onError: (error) =>
      !isProductSurfaceOperationCancelledError(error) &&
      toast.error(t('admin.studio.saveConflict')),
  });

  const openCreateForm = () => {
    const draft = emptyFormDraft();
    draft.categoryId =
      categoryFilter === 'ALL' ? (categories.data?.[0]?.categoryId ?? '') : categoryFilter;
    draft.defaultWorkflowId = workflows.data?.[0]?.workflowId ?? '';
    setFormDraft(draft);
    setCreatingForm(true);
    setFormEditorOpen(true);
  };
  const openEditForm = () => {
    if (!detail.data) return;
    const route = detail.data.routes.find((item) => item.bindingType === 'DEFAULT');
    setFormDraft({
      formKey: detail.data.form.formKey,
      categoryId: detail.data.form.categoryId,
      nameKo: detail.data.form.nameKo,
      nameEn: detail.data.form.nameEn,
      descriptionKo: detail.data.form.descriptionKo,
      descriptionEn: detail.data.form.descriptionEn,
      ownerGroupRef: detail.data.form.ownerGroupRef ?? 'APPROVAL_OPERATOR',
      defaultWorkflowId: route?.workflowId ?? '',
      fields: detail.data.schema.fields.map((field) => ({
        ...field,
        labelKo: field.labelKo ?? field.key,
        labelEn: field.labelEn ?? field.key,
        helpKo: field.helpKo ?? '',
        helpEn: field.helpEn ?? '',
        options: field.options ?? [],
      })),
    });
    setCreatingForm(false);
    setFormEditorOpen(true);
  };
  const openCreateCategory = () => {
    setEditingCategory(null);
    setCategoryDraft(emptyCategoryDraft());
    setCategoryEditorOpen(true);
  };
  const openEditCategory = (category: ApprovalFormCategory) => {
    setEditingCategory(category);
    setCategoryDraft({
      categoryKey: category.categoryKey,
      parentCategoryId: category.parentCategoryId ?? '',
      nameKo: category.nameKo,
      nameEn: category.nameEn,
      descriptionKo: category.descriptionKo,
      descriptionEn: category.descriptionEn,
      iconKey: category.iconKey,
      sortOrder: category.sortOrder,
      lifecycleState: category.lifecycleState,
    });
    setCategoryEditorOpen(true);
  };

  const formValid =
    formDraft.formKey.trim().length >= 3 &&
    formDraft.categoryId &&
    formDraft.nameKo.trim() &&
    formDraft.nameEn.trim() &&
    formDraft.descriptionKo.trim() &&
    formDraft.descriptionEn.trim() &&
    formDraft.ownerGroupRef.trim() &&
    formDraft.defaultWorkflowId &&
    validApprovalFormFields(formDraft.fields);
  const categoryValid =
    categoryDraft.categoryKey.trim().length >= 2 &&
    categoryDraft.nameKo.trim() &&
    categoryDraft.nameEn.trim() &&
    categoryDraft.iconKey.trim();

  if (forms.isError || categories.isError || workflows.isError) {
    return <Alert severity="error">{t('admin.loadError')}</Alert>;
  }

  const publishedCount = (forms.data ?? []).filter(
    (form) => form.lifecycleState === 'PUBLISHED'
  ).length;
  const draftCount = (forms.data ?? []).filter((form) => form.lifecycleState === 'DRAFT').length;
  const routeCoverage = (forms.data ?? []).filter((form) => form.routeCount > 0).length;

  return (
    <>
      <CatalogMetrics
        values={[
          [t('admin.formCatalog.metrics.total'), forms.data?.length ?? 0, FileStack],
          [t('admin.formCatalog.metrics.published'), publishedCount, Rocket],
          [t('admin.formCatalog.metrics.draft'), draftCount, PencilLine],
          [t('admin.formCatalog.metrics.routed'), routeCoverage, GitBranch],
        ]}
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0,1fr)',
            lg: 'minmax(210px,.48fr) minmax(280px,.72fr) minmax(0,1.8fr)',
          },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <ApprovalSurface
          title={t('admin.formCatalog.categories.title')}
          meta={t('admin.formCatalog.categories.meta')}
          action={
            experience.canEditDesign ? (
              <ActionIconButton
                label={t('admin.formCatalog.categories.create')}
                size="small"
                onClick={openCreateCategory}
              >
                <FolderPlus size={17} />
              </ActionIconButton>
            ) : undefined
          }
        >
          <Stack component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
            <CategoryRow
              label={t('admin.formCatalog.categories.all')}
              count={forms.data?.length ?? 0}
              selected={categoryFilter === 'ALL'}
              onSelect={() => setCategoryFilter('ALL')}
            />
            {categoryTree.map(({ category, depth, count }) => (
              <CategoryRow
                key={category.categoryId}
                label={korean ? category.nameKo : category.nameEn}
                count={count}
                depth={depth}
                lifecycleState={category.lifecycleState}
                selected={categoryFilter === category.categoryId}
                onSelect={() => setCategoryFilter(category.categoryId)}
                onEdit={experience.canEditDesign ? () => openEditCategory(category) : undefined}
              />
            ))}
          </Stack>
        </ApprovalSurface>

        <ApprovalSurface
          title={t('admin.formCatalog.forms.title')}
          meta={t('admin.formCatalog.forms.meta', { count: visibleForms.length })}
          action={
            experience.canEditDesign ? (
              <ActionIconButton
                label={t('admin.formCatalog.forms.create')}
                size="small"
                intent="primary"
                onClick={openCreateForm}
              >
                <Plus size={17} />
              </ActionIconButton>
            ) : undefined
          }
        >
          <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <FormField
              fullWidth
              size="small"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('admin.formCatalog.forms.search')}
              inputProps={{ 'aria-label': t('admin.formCatalog.forms.search') }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={16} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          {visibleForms.length ? (
            <Stack
              component="ul"
              sx={{ m: 0, p: 0, listStyle: 'none', maxHeight: 600, overflowY: 'auto' }}
            >
              {visibleForms.map((form) => (
                <FormListItem
                  key={form.formId}
                  form={form}
                  selected={form.formId === selectedId}
                  locale={i18n.resolvedLanguage}
                  onSelect={() => setSelectedId(form.formId)}
                />
              ))}
            </Stack>
          ) : (
            <EmptyState
              title={t('admin.studio.noForm')}
              description={t('admin.studio.noFormDescription')}
              icon={<FileStack size={24} />}
            />
          )}
        </ApprovalSurface>

        {!selectedId ? (
          <EmptyState
            title={t('admin.studio.noForm')}
            description={t('admin.studio.noFormDescription')}
            icon={<FileStack size={24} />}
          />
        ) : detail.isError ? (
          <Alert severity="error">{t('admin.loadError')}</Alert>
        ) : detail.data ? (
          <FormInspector
            detail={detail.data}
            locale={i18n.resolvedLanguage}
            canEdit={experience.canEditDesign}
            canPublish={experience.canPublish}
            publishing={highRiskPublish.controller.busy}
            onEdit={openEditForm}
            onPublish={() =>
              void highRiskPublish.begin(
                approvalFormPublishCommand(detail.data.form.formId, detail.data.form.version)
              )
            }
          />
        ) : null}
      </Box>

      <FormEditorDialog
        open={formEditorOpen}
        creating={creatingForm}
        draft={formDraft}
        categories={categories.data ?? []}
        workflows={workflows.data ?? []}
        valid={Boolean(formValid)}
        busy={createForm.isPending || updateForm.isPending}
        onChange={setFormDraft}
        onClose={() => setFormEditorOpen(false)}
        onSave={() => (creatingForm ? createForm.mutate() : updateForm.mutate())}
      />
      <CategoryEditorDialog
        open={categoryEditorOpen}
        editing={Boolean(editingCategory)}
        draft={categoryDraft}
        categories={(categories.data ?? []).filter(
          (item) => item.categoryId !== editingCategory?.categoryId
        )}
        valid={Boolean(categoryValid)}
        busy={saveCategory.isPending}
        onChange={setCategoryDraft}
        onClose={() => setCategoryEditorOpen(false)}
        onSave={() => saveCategory.mutate()}
      />
      <ApprovalHighRiskCommandDialog controller={highRiskPublish.controller} />
    </>
  );
}

function CatalogMetrics({
  values,
}: {
  values: Array<[string, number, React.ComponentType<{ size?: number }>]>;
}) {
  return (
    <Box
      sx={{
        mb: 2,
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0,1fr))',
          lg: 'repeat(4, minmax(0,1fr))',
        },
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      {values.map(([label, value, Icon], index) => (
        <Stack
          key={label}
          direction="row"
          gap={1.25}
          alignItems="center"
          sx={{
            minHeight: 76,
            px: 2,
            borderRight: index % 4 === 3 ? 0 : 1,
            borderBottom: { xs: index < 2 ? 1 : 0, lg: 0 },
            borderColor: 'divider',
          }}
        >
          <Box sx={{ color: 'primary.main' }}>
            <Icon size={19} />
          </Box>
          <Box>
            <Typography variant="h6">{value}</Typography>
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
          </Box>
        </Stack>
      ))}
    </Box>
  );
}

function CategoryRow({
  label,
  count,
  selected,
  onSelect,
  onEdit,
  depth = 0,
  lifecycleState = 'ACTIVE',
}: {
  label: string;
  count: number;
  selected: boolean;
  onSelect: () => void;
  onEdit?: () => void;
  depth?: number;
  lifecycleState?: 'ACTIVE' | 'INACTIVE';
}) {
  const { t } = useTranslation('approvals');
  return (
    <Box component="li" sx={{ display: 'flex', borderBottom: 1, borderColor: 'divider' }}>
      <ButtonBase
        onClick={onSelect}
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 52,
          pr: 1.25,
          pl: 1.75 + depth * 1.5,
          justifyContent: 'flex-start',
          gap: 1,
          textAlign: 'left',
          bgcolor: selected ? alpha(approvalTone.primary, 0.075) : 'transparent',
        }}
      >
        <FolderTree size={16} color={selected ? approvalTone.primary : undefined} />
        <Typography variant="body2" fontWeight={selected ? 760 : 620} noWrap sx={{ flex: 1 }}>
          {label}
        </Typography>
        {lifecycleState === 'INACTIVE' && (
          <Chip
            size="small"
            variant="outlined"
            label={t('admin.formCatalog.categoryEditor.inactive')}
          />
        )}
        <Chip size="small" label={count} />
      </ButtonBase>
      {onEdit && selected && (
        <ActionIconButton
          label={t('admin.formCatalog.categories.edit', { name: label })}
          size="small"
          onClick={onEdit}
        >
          <PencilLine size={15} />
        </ActionIconButton>
      )}
    </Box>
  );
}

function FormListItem({
  form,
  selected,
  locale,
  onSelect,
}: {
  form: ApprovalForm;
  selected: boolean;
  locale?: string;
  onSelect: () => void;
}) {
  const { t } = useTranslation('approvals');
  return (
    <Box component="li">
      <ButtonBase
        onClick={onSelect}
        sx={{
          width: 1,
          minHeight: 82,
          px: 1.75,
          py: 1.25,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          textAlign: 'left',
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: selected ? alpha(approvalTone.primary, 0.075) : 'transparent',
          boxShadow: selected ? `inset 3px 0 0 ${approvalTone.primary}` : 'none',
          '&:hover': { bgcolor: alpha(approvalTone.primary, 0.05) },
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={760} noWrap>
            {locale?.startsWith('ko') ? form.nameKo : form.nameEn}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap display="block">
            {locale?.startsWith('ko') ? form.categoryNameKo : form.categoryNameEn}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('admin.formListMeta', {
              count: form.fieldCount,
              version: form.currentVersion,
            })}
          </Typography>
        </Box>
        <StatusChip status={form.lifecycleState} />
      </ButtonBase>
    </Box>
  );
}

function FormInspector({
  detail,
  locale,
  canEdit,
  canPublish,
  publishing,
  onEdit,
  onPublish,
}: {
  detail: Awaited<ReturnType<typeof getApprovalForm>>;
  locale?: string;
  canEdit: boolean;
  canPublish: boolean;
  publishing: boolean;
  onEdit: () => void;
  onPublish: () => void;
}) {
  const { t } = useTranslation('approvals');
  const requestScope = useApprovalManagementRequestScope();
  const form = detail.form;
  const korean = locale?.startsWith('ko');
  const route = detail.routes.find((item) => item.bindingType === 'DEFAULT');
  const routeDetail = useQuery({
    queryKey: [
      'approvals',
      'admin',
      'workflows',
      route?.workflowId,
      'route-preview',
      ...requestScope.cacheKey,
    ],
    queryFn: ({ signal }) =>
      getApprovalWorkflow(route!.workflowId, requestScope.contextScopeKey, signal),
    enabled: Boolean(route?.workflowId),
    staleTime: 30_000,
  });
  const routeReady = route?.workflowLifecycleState === 'PUBLISHED';
  const isDraft = form.lifecycleState === 'DRAFT';
  return (
    <Stack gap={2} minWidth={0}>
      <Box
        component="section"
        sx={{
          p: { xs: 2, md: 2.5 },
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
          <Box minWidth={0}>
            <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
              <Typography component="h2" variant="h5">
                {korean ? form.nameKo : form.nameEn}
              </Typography>
              <StatusChip status={form.lifecycleState} />
              <Chip
                size="small"
                variant="outlined"
                label={korean ? form.categoryNameKo : form.categoryNameEn}
              />
            </Stack>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              {korean ? form.descriptionKo : form.descriptionEn}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {form.formKey} · {detail.schemaHash.slice(0, 12)}
            </Typography>
          </Box>
          <Stack direction="row" gap={1} alignItems="flex-start">
            {canEdit && isDraft && (
              <ActionButton
                intent="secondary"
                startIcon={<PencilLine size={16} />}
                onClick={onEdit}
              >
                {t('admin.studio.editForm')}
              </ActionButton>
            )}
            {canPublish && isDraft && (
              <ActionButton
                intent="primary"
                startIcon={<Rocket size={16} />}
                loading={publishing}
                disabled={!routeReady}
                onClick={onPublish}
              >
                {t('actions.publish')}
              </ActionButton>
            )}
          </Stack>
        </Stack>
        <Box
          sx={{
            mt: 2,
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2,minmax(0,1fr))',
              md: 'repeat(4,minmax(0,1fr))',
            },
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          {[
            [t('admin.formCatalog.inspector.fields'), form.fieldCount],
            [t('admin.formCatalog.inspector.routes'), form.routeCount],
            [t('admin.formCatalog.inspector.usage'), form.usageCount],
            [t('admin.formCatalog.inspector.version'), `v${form.currentVersion}`],
          ].map(([label, value]) => (
            <Box key={String(label)} sx={{ pt: 1.5, pr: 2 }}>
              <Typography variant="caption" color="text.secondary">
                {String(label)}
              </Typography>
              <Typography variant="body2" fontWeight={760}>
                {String(value)}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <ApprovalSurface
        title={t('admin.formCatalog.route.title')}
        meta={t('admin.formCatalog.route.meta')}
        action={<GitBranch size={18} />}
      >
        {route ? (
          <Box>
            <Box
              sx={{
                px: 2,
                py: 1.75,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'minmax(0,1fr) auto auto' },
                gap: 1.5,
                alignItems: 'center',
              }}
            >
              <Box minWidth={0}>
                <Typography variant="body2" fontWeight={760}>
                  {korean ? route.workflowNameKo : route.workflowNameEn}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('admin.workflowRevision', {
                    key: route.workflowKey,
                    version: route.workflowVersion,
                  })}
                </Typography>
              </Box>
              <Typography variant="caption">
                {t('admin.minutes', { count: route.slaMinutes })}
              </Typography>
              <StatusChip status={route.workflowLifecycleState} />
            </Box>
            {routeDetail.data && (
              <Box sx={{ px: 2, py: 2, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="overline" color="text.secondary">
                  {t('admin.formCatalog.route.stepsMeta', {
                    count: routeDetail.data.definition.steps.length,
                  })}
                </Typography>
                <Box
                  component="ol"
                  sx={{
                    mt: 1,
                    mb: 0,
                    p: 0,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
                    gap: 1,
                    listStyle: 'none',
                  }}
                >
                  {routeDetail.data.definition.steps.map((step, index) => (
                    <Box
                      component="li"
                      key={step.key}
                      sx={{
                        minHeight: 92,
                        p: 1.5,
                        border: 1,
                        borderColor: 'divider',
                        bgcolor: 'background.default',
                      }}
                    >
                      <Stack direction="row" gap={1.25} alignItems="flex-start">
                        <Box
                          sx={{
                            width: 26,
                            height: 26,
                            flex: '0 0 auto',
                            display: 'grid',
                            placeItems: 'center',
                            bgcolor: alpha(approvalTone.primary, 0.1),
                            color: approvalTone.primary,
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          {index + 1}
                        </Box>
                        <Box minWidth={0}>
                          <Typography variant="body2" fontWeight={760} noWrap>
                            {step.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {step.candidateRole}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {step.mode} · {t('admin.minutes', { count: step.slaMinutes })}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
            {routeDetail.isError && (
              <Alert severity="warning">{t('admin.formCatalog.route.previewError')}</Alert>
            )}
          </Box>
        ) : (
          <Alert severity="warning">{t('admin.formCatalog.route.missing')}</Alert>
        )}
      </ApprovalSurface>

      <ApprovalSurface
        title={t('admin.studio.formFields')}
        meta={t('admin.studio.formFieldsMeta', { count: detail.schema.fields.length })}
        action={<Braces size={18} />}
      >
        <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {detail.schema.fields.map((field, index) => (
            <Box
              component="li"
              key={field.key}
              sx={{
                minHeight: 64,
                px: 2,
                display: 'grid',
                gridTemplateColumns: {
                  xs: '36px minmax(0,1fr) auto',
                  sm: '40px minmax(0,1.4fr) minmax(90px,.5fr) 82px',
                },
                gap: 1.25,
                alignItems: 'center',
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {String(index + 1).padStart(2, '0')}
              </Typography>
              <Box minWidth={0}>
                <Typography variant="body2" fontWeight={720} noWrap>
                  {korean ? (field.labelKo ?? field.key) : (field.labelEn ?? field.key)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {field.key}
                </Typography>
              </Box>
              <Chip size="small" variant="outlined" label={field.type} />
              <Stack
                direction="row"
                gap={0.5}
                alignItems="center"
                sx={{ display: { xs: 'none', sm: 'flex' } }}
              >
                {field.required && <Check size={14} color={approvalTone.teal} />}
                <Typography variant="caption" color="text.secondary">
                  {t(field.required ? 'admin.studio.required' : 'admin.studio.optional')}
                </Typography>
              </Stack>
            </Box>
          ))}
        </Box>
      </ApprovalSurface>

      <Box
        component="section"
        sx={{
          p: 2,
          border: 1,
          borderColor: routeReady
            ? alpha(approvalTone.teal, 0.35)
            : alpha(approvalTone.amber, 0.45),
          bgcolor: routeReady ? alpha(approvalTone.teal, 0.045) : alpha(approvalTone.amber, 0.055),
        }}
      >
        <Stack direction="row" gap={1.25} alignItems="flex-start">
          <ShieldCheck size={19} color={routeReady ? approvalTone.teal : approvalTone.amber} />
          <Box>
            <Typography variant="subtitle2">
              {t(
                routeReady
                  ? 'admin.formCatalog.assurance.ready'
                  : 'admin.formCatalog.assurance.blocked'
              )}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t(
                routeReady
                  ? 'admin.formCatalog.assurance.readyDetail'
                  : 'admin.formCatalog.assurance.blockedDetail'
              )}
            </Typography>
          </Box>
        </Stack>
      </Box>
    </Stack>
  );
}
