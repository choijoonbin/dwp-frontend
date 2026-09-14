import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileStack,
  Braces,
  FolderPlus,
  GitBranch,
  PencilLine,
  Plus,
  RefreshCcw,
  Rocket,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionIconButton,
  EmptyState,
  ErrorState,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  createApprovalFormCategory,
  createApprovalFormDraft,
  getApprovalForm,
  getApprovalFormCategories,
  getApprovalFormReferenceWorkflows,
  getApprovalForms,
  isApprovalTypedFormSchema,
  publishApprovalForm,
  updateApprovalFormCategory,
  updateApprovalFormDraft,
  useToast,
} from '@dwp-frontend/shared-utils';

import Stack from '@mui/material/Stack';
import { ProductSurfaceOperationCancelledError } from '../../components/product-surface-operation-coordinator';

import { ApprovalSurface } from './approval-ui';
import { ApprovalHighRiskCommandDialog } from './approval-high-risk-command-dialog';
import { approvalFormPublishCommand } from './approval-high-risk-command-model';
import {
  useApprovalManagementCommandScope,
  useApprovalManagementHighRiskCommand,
} from './approval-management-command-scope';
import {
  useApprovalManagementScopeReady,
  useApprovalManagementScopeReset,
} from './approval-management-scope';
import { CategoryEditorDialog } from './approval-form-catalog-dialogs';
import { ApprovalFormBuilderDialog } from './approval-form-builder-dialog';
import { useApprovalFormSchemaValidation } from './approval-form-schema-validation';
import {
  advancedApprovalFormDraft,
  approvalFormEditorDraft,
  approvalFormEditorUpdateInput,
  captureApprovalFormEditorDraft,
} from './approval-form-editor-draft';
import { approvalManagementDraftBindingMatches } from './approval-management-draft-binding';
import {
  ApprovalFormCatalogControls,
  ApprovalFormCatalogMetrics,
  ApprovalFormListItem,
} from './approval-form-catalog-panels';
import { queryApprovalFormCatalog } from './approval-form-catalog-query';
import { ApprovalFormCatalogWorkspace } from './approval-form-catalog-workspace';
import { ApprovalFormInspector } from './approval-form-inspector';
import { ApprovalFormWorkspacePanel } from './approval-form-version-history';
import { useApprovalFormWorkspaceController } from './approval-form-workspace-controller';
import {
  approvalFormWorkingDraftEditor,
  approvalFormWorkingDraftInput,
} from './approval-form-workspace-model';
import { ApprovalFormWorkspaceReadOnlyDraftDialog } from './approval-form-availability-dialog';
import { ApprovalFormCategoryTree } from './approval-form-category-tree';
import { approvalFormFieldIssues } from './approval-form-builder-model';
import {
  approvalManagementSourceState,
  retryApprovalManagementRead,
} from './approval-management-source-state';
import { emptyCategoryDraft, emptyFormDraft } from './approval-form-catalog-drafts';
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

import type { ApprovalFormCategory } from '@dwp-frontend/shared-utils';
import type { CategoryDraft, FormDraft } from './approval-form-catalog-drafts';
import type { ApprovalManagementScopedCommand } from './approval-management-command-scope';
import type { ApprovalFormCatalogSort } from './approval-form-catalog-query';
import type { ApprovalFormCatalogPanel } from './approval-form-catalog-workspace';
import type { ApprovalManagementDraftBinding } from './approval-management-draft-binding';

export function ApprovalFormStudio() {
  const { t, i18n } = useTranslation('approvals');
  const toast = useToast();
  const experience = useApprovalExperience();
  const requestScope = useApprovalManagementRequestScope();
  const scopeReady = useApprovalManagementScopeReady(requestScope);
  const commandScope = useApprovalManagementCommandScope(requestScope.cacheKey);
  const queryClient = useQueryClient();
  const korean = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language) === 'ko';
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [lifecycle, setLifecycle] = useState('ALL');
  const [sort, setSort] = useState<ApprovalFormCatalogSort>('updated');
  const [panel, setPanel] = useState<ApprovalFormCatalogPanel>('forms');
  const [formEditorOpen, setFormEditorOpen] = useState(false);
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const [creatingForm, setCreatingForm] = useState(false);
  const [draftBinding, setDraftBinding] = useState<ApprovalManagementDraftBinding | null>(null);
  const [editingCategory, setEditingCategory] = useState<ApprovalFormCategory | null>(null);
  const [formDraft, setFormDraft] = useState<FormDraft>(emptyFormDraft);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>(emptyCategoryDraft);
  const schemaValidation = useApprovalFormSchemaValidation(formDraft.typedSchema, formEditorOpen);

  const formsQueryKey = ['approvals', 'admin', 'forms', ...requestScope.cacheKey] as const;
  const categoriesQueryKey = [
    'approvals',
    'admin',
    'form-categories',
    ...requestScope.cacheKey,
  ] as const;
  const referenceWorkflowsQueryKey = [
    'approvals',
    'admin',
    'workflows',
    'view',
    'reference',
    ...requestScope.cacheKey,
  ] as const;

  const forms = useQuery({
    queryKey: formsQueryKey,
    queryFn: ({ signal }) => getApprovalForms(requestScope.contextScopeKey, signal),
    enabled: scopeReady,
    retry: retryApprovalManagementRead,
    staleTime: 30_000,
  });
  const categories = useQuery({
    queryKey: categoriesQueryKey,
    queryFn: ({ signal }) => getApprovalFormCategories(requestScope.contextScopeKey, signal),
    enabled: scopeReady,
    retry: retryApprovalManagementRead,
    staleTime: 30_000,
  });
  const workflows = useQuery({
    queryKey: referenceWorkflowsQueryKey,
    queryFn: ({ signal }) =>
      getApprovalFormReferenceWorkflows(requestScope.contextScopeKey, signal),
    enabled: scopeReady,
    retry: retryApprovalManagementRead,
    staleTime: 30_000,
  });
  const detail = useQuery({
    queryKey: ['approvals', 'admin', 'forms', selectedId, ...requestScope.cacheKey],
    queryFn: ({ signal }) => getApprovalForm(selectedId!, requestScope.contextScopeKey, signal),
    enabled: scopeReady && Boolean(selectedId),
    retry: retryApprovalManagementRead,
    staleTime: 30_000,
  });
  const storedSchema =
    detail.data && isApprovalTypedFormSchema(detail.data.schema) ? detail.data.schema : undefined;
  const storedValidation = useApprovalFormSchemaValidation(
    storedSchema,
    scopeReady && Boolean(selectedId)
  );
  const storedSchemaVerified =
    !storedSchema || storedValidation.compiled?.schemaSha256 === detail.data?.schemaHash;

  const formsState = approvalManagementSourceState(forms);
  const categoriesState = approvalManagementSourceState(categories);
  const workflowsState = approvalManagementSourceState(workflows);
  const detailState = approvalManagementSourceState(detail);
  const catalogWriteReady =
    scopeReady &&
    formsState === 'READY' &&
    categoriesState === 'READY' &&
    workflowsState === 'READY' &&
    !forms.isFetching &&
    !categories.isFetching &&
    !workflows.isFetching;
  const detailWriteReady =
    catalogWriteReady && detailState === 'READY' && !detail.isFetching && storedSchemaVerified;
  const draftBindingMatches = approvalManagementDraftBindingMatches(
    draftBinding,
    detail.data ? { objectId: detail.data.form.formId, ...detail.data.form } : undefined
  );
  const workspaceController = useApprovalFormWorkspaceController({
    formId: selectedId,
    requestScope,
    scopeReady,
    parentReady: detailWriteReady,
    parentQueryKeys: [
      formsQueryKey,
      categoriesQueryKey,
      referenceWorkflowsQueryKey,
      ['approvals', 'admin', 'forms', selectedId, ...requestScope.cacheKey],
    ],
    canEdit: experience.canEditDesign,
    canPublish: experience.canPublish,
    onChanged: async (formId) => {
      await queryClient.invalidateQueries({ queryKey: formsQueryKey, exact: true });
      await queryClient.invalidateQueries({
        queryKey: ['approvals', 'admin', 'forms', formId, ...requestScope.cacheKey],
        exact: true,
      });
    },
  });
  const workspaceEditing = !creatingForm && workspaceController.installed;
  const workspaceEditorReady =
    workspaceEditing &&
    workspaceController.editorCurrent &&
    workspaceController.ready &&
    !workspaceController.unknown;
  useEffect(() => {
    if (workspaceEditing && formEditorOpen && !workspaceController.editorOriginal)
      setFormEditorOpen(false);
  }, [workspaceEditing, formEditorOpen, workspaceController.editorOriginal]);

  const categoryTree = useMemo(
    () => buildApprovalFormCategoryTree(categories.data ?? [], forms.data ?? []),
    [categories.data, forms.data]
  );
  const categoryScope = useMemo(() => {
    if (categoryFilter === 'ALL') return null;
    return descendantCategoryIds(categories.data ?? [], categoryFilter);
  }, [categories.data, categoryFilter]);

  const visibleForms = useMemo(
    () =>
      queryApprovalFormCatalog(forms.data ?? [], {
        search,
        categoryIds: categoryScope,
        lifecycle,
        sort,
        locale: korean ? 'ko' : 'en',
      }),
    [categoryScope, forms.data, korean, lifecycle, search, sort]
  );

  useEffect(() => {
    if (!selectedId && visibleForms.length) setSelectedId(visibleForms[0].formId);
    if (selectedId && !visibleForms.some((form) => form.formId === selectedId)) {
      setSelectedId(visibleForms[0]?.formId ?? null);
    }
  }, [selectedId, visibleForms]);

  const refreshForms = async (
    binding: Parameters<typeof commandScope.isCurrent>[0],
    formId?: string
  ) => {
    if (!commandScope.isCurrent(binding)) return;
    await queryClient.invalidateQueries({ queryKey: formsQueryKey, exact: true });
    if (!commandScope.isCurrent(binding)) return;
    if (formId) {
      setSelectedId(formId);
      await queryClient.invalidateQueries({
        queryKey: ['approvals', 'admin', 'forms', formId, ...requestScope.cacheKey],
        exact: true,
      });
    }
  };
  const refreshCategories = async (binding: Parameters<typeof commandScope.isCurrent>[0]) => {
    if (!commandScope.isCurrent(binding)) return;
    await queryClient.invalidateQueries({ queryKey: categoriesQueryKey, exact: true });
  };
  const runCreateForm = useApprovalGovernedMutation('route.approvals.admin.form-create.action');
  const runUpdateForm = useApprovalGovernedMutation('route.approvals.admin.form-update.action');
  const runCreateCategory = useApprovalGovernedMutation(
    'route.approvals.admin.form-category-create.action'
  );
  const runUpdateCategory = useApprovalGovernedMutation(
    'route.approvals.admin.form-category-update.action'
  );
  const highRiskPublish = useApprovalManagementHighRiskCommand({
    cacheKey: requestScope.cacheKey,
    operation: 'FORM_PUBLISH',
    execute: (command, execution) => {
      if (
        !detailWriteReady ||
        !experience.canPublish ||
        detail.data?.form.lifecycleState !== 'DRAFT' ||
        detail.data.form.formId !== command.targetId ||
        detail.data.form.version !== command.expectedObjectVersion
      )
        throw new ProductSurfaceOperationCancelledError();
      return publishApprovalForm(command.targetId, command.expectedObjectVersion, execution);
    },
    onSuccess: async (result, _command, binding) => {
      await refreshForms(binding, result.form.formId);
      if (!commandScope.isCurrent(binding)) return;
      toast.success(t('admin.studio.formPublished'));
    },
    onConflict: async (command, binding) => {
      await refreshForms(binding, command.targetId);
    },
  });
  const { close: closeHighRiskPublish } = highRiskPublish.controller;
  const resetScopeState = useCallback(() => {
    setSelectedId(null);
    setCategoryFilter('ALL');
    setSearch('');
    setLifecycle('ALL');
    setSort('updated');
    setPanel('forms');
    setFormEditorOpen(false);
    setDraftBinding(null);
    setCategoryEditorOpen(false);
    setCreatingForm(false);
    setEditingCategory(null);
    setFormDraft(emptyFormDraft());
    setCategoryDraft(emptyCategoryDraft());
    closeHighRiskPublish();
  }, [closeHighRiskPublish]);
  useApprovalManagementScopeReset(requestScope.cacheKey, resetScopeState);

  const createForm = useMutation({
    mutationFn: (command: ApprovalManagementScopedCommand<FormDraft>) =>
      commandScope.run(command, (input) =>
        runCreateForm((execution) => createApprovalFormDraft(input, execution))
      ),
    onSuccess: async ({ command, value }) => {
      if (!commandScope.isCurrent(command)) return;
      await refreshForms(command, value.form.formId);
      if (!commandScope.isCurrent(command)) return;
      setFormEditorOpen(false);
      toast.success(t('admin.studio.formCreated'));
    },
    onError: (error, command) => {
      if (!commandScope.isCurrent(command)) return;
      if (!isProductSurfaceOperationCancelledError(error)) {
        toast.error(t('admin.studio.saveError'));
      }
    },
  });
  const updateForm = useMutation({
    mutationFn: (
      command: ApprovalManagementScopedCommand<{
        formId: string;
        draft: FormDraft;
        expectedVersion: number;
      }>
    ) =>
      commandScope.run(command, ({ formId, draft: input, expectedVersion }) =>
        runUpdateForm((execution) =>
          updateApprovalFormDraft(
            formId,
            {
              ...approvalFormEditorUpdateInput(input),
              expectedVersion,
            },
            execution
          )
        )
      ),
    onSuccess: async ({ command, value }) => {
      if (!commandScope.isCurrent(command)) return;
      await refreshForms(command, value.form.formId);
      if (!commandScope.isCurrent(command)) return;
      setFormEditorOpen(false);
      toast.success(t('admin.studio.formSaved'));
    },
    onError: (error, command) => {
      if (!commandScope.isCurrent(command)) return;
      if (!isProductSurfaceOperationCancelledError(error)) {
        toast.error(t('admin.studio.saveConflict'));
      }
    },
  });
  const saveCategory = useMutation({
    mutationFn: (
      command: ApprovalManagementScopedCommand<{
        draft: CategoryDraft;
        editing: ApprovalFormCategory | null;
      }>
    ) =>
      commandScope.run(command, ({ draft: inputDraft, editing }) => {
        const input = {
          parentCategoryId: inputDraft.parentCategoryId || null,
          nameKo: inputDraft.nameKo,
          nameEn: inputDraft.nameEn,
          descriptionKo: inputDraft.descriptionKo,
          descriptionEn: inputDraft.descriptionEn,
          iconKey: inputDraft.iconKey,
          sortOrder: inputDraft.sortOrder,
        };
        return editing
          ? runUpdateCategory((execution) =>
              updateApprovalFormCategory(
                editing.categoryId,
                {
                  ...input,
                  lifecycleState: inputDraft.lifecycleState,
                  expectedVersion: editing.version,
                },
                execution
              )
            )
          : runCreateCategory((execution) =>
              createApprovalFormCategory(
                { ...input, categoryKey: inputDraft.categoryKey },
                execution
              )
            );
      }),
    onSuccess: async ({ command }) => {
      if (!commandScope.isCurrent(command)) return;
      await refreshCategories(command);
      if (!commandScope.isCurrent(command)) return;
      setCategoryEditorOpen(false);
      toast.success(t('admin.studio.categorySaved'));
    },
    onError: (error, command) => {
      if (!commandScope.isCurrent(command)) return;
      if (!isProductSurfaceOperationCancelledError(error)) {
        toast.error(t('admin.studio.saveConflict'));
      }
    },
  });

  const openCreateForm = (advanced = false) => {
    if (!catalogWriteReady || !experience.canEditDesign) return;
    const draft = emptyFormDraft();
    draft.categoryId =
      categoryFilter === 'ALL'
        ? (categories.data?.find((category) => category.lifecycleState === 'ACTIVE')?.categoryId ??
          '')
        : categoryFilter;
    draft.defaultWorkflowId =
      workflows.data?.find((workflow) => workflow.lifecycleState === 'PUBLISHED')?.workflowId ?? '';
    setFormDraft(advanced ? advancedApprovalFormDraft(draft) : draft);
    setCreatingForm(true);
    setDraftBinding(null);
    setFormEditorOpen(true);
  };
  const openEditForm = () => {
    if (!detail.data || !detailWriteReady || !experience.canEditDesign) return;
    if (detail.data.form.lifecycleState !== 'DRAFT') return;
    setDraftBinding({ objectId: detail.data.form.formId, version: detail.data.form.version });
    setFormDraft(approvalFormEditorDraft(detail.data));
    setCreatingForm(false);
    setFormEditorOpen(true);
  };
  const openEditWorkingDraft = () => {
    if (!detail.data || !workspaceController.updateReady) return;
    const original = workspaceController.openEditor();
    if (!original) return;
    const draft = approvalFormWorkingDraftEditor(original.workspace, detail.data.form.formKey);
    if (!draft) return;
    setFormDraft(draft);
    setCreatingForm(false);
    setDraftBinding(null);
    setFormEditorOpen(true);
  };
  const openCreateCategory = () => {
    if (!catalogWriteReady || !experience.canEditDesign) return;
    setEditingCategory(null);
    setCategoryDraft(emptyCategoryDraft());
    setCategoryEditorOpen(true);
  };
  const openEditCategory = (category: ApprovalFormCategory) => {
    if (!catalogWriteReady || !experience.canEditDesign) return;
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
    catalogWriteReady &&
    (creatingForm ||
      (workspaceEditing ? workspaceEditorReady : detailWriteReady && draftBindingMatches)) &&
    formDraft.formKey.trim().length >= 3 &&
    formDraft.categoryId &&
    formDraft.nameKo.trim() &&
    formDraft.nameEn.trim() &&
    formDraft.descriptionKo.trim() &&
    formDraft.descriptionEn.trim() &&
    formDraft.ownerGroupRef.trim() &&
    formDraft.defaultWorkflowId &&
    categories.data?.some(
      (category) =>
        category.categoryId === formDraft.categoryId && category.lifecycleState === 'ACTIVE'
    ) &&
    workflows.data?.some(
      (workflow) =>
        workflow.workflowId === formDraft.defaultWorkflowId &&
        workflow.lifecycleState === 'PUBLISHED'
    ) &&
    (formDraft.typedSchema
      ? Boolean(schemaValidation.compiled)
      : formDraft.fields.length <= 50 &&
        approvalFormFieldIssues(formDraft.fields).length === 0 &&
        validApprovalFormFields(formDraft.fields));
  const categoryValid =
    catalogWriteReady &&
    categoryDraft.categoryKey.trim().length >= 2 &&
    categoryDraft.nameKo.trim() &&
    categoryDraft.nameEn.trim() &&
    categoryDraft.iconKey.trim();
  const saveFormDraft = () => {
    if (
      !formEditorOpen ||
      !formValid ||
      !experience.canEditDesign ||
      createForm.isPending ||
      updateForm.isPending
    )
      return;
    const snapshot = captureApprovalFormEditorDraft(formDraft, schemaValidation.compiled);
    if (!snapshot) return;
    if (creatingForm) {
      createForm.mutate(commandScope.capture(snapshot));
      return;
    }
    if (workspaceEditing) {
      if (!workspaceController.editorOriginal || !workspaceEditorReady || workspaceController.busy)
        return;
      workspaceController.save(
        approvalFormWorkingDraftInput(
          workspaceController.editorOriginal,
          snapshot,
          schemaValidation.compiled?.schemaSha256
        )
      );
      return;
    }
    if (!draftBinding || !draftBindingMatches || !detailWriteReady) return;
    updateForm.mutate(
      commandScope.capture({
        formId: draftBinding.objectId,
        draft: snapshot,
        expectedVersion: draftBinding.version,
      })
    );
  };
  const saveCategoryDraft = () => {
    if (!categoryValid || !experience.canEditDesign || saveCategory.isPending) return;
    saveCategory.mutate(
      commandScope.capture({
        draft: { ...categoryDraft },
        editing: editingCategory ? { ...editingCategory } : null,
      })
    );
  };

  if (
    !scopeReady ||
    [formsState, categoriesState, workflowsState, selectedId ? detailState : null].includes(
      'DENIED'
    )
  ) {
    return <ErrorState title={t('admin.loadError')} description={t('pages.forms.description')} />;
  }

  if (formsState === 'LOADING') {
    return (
      <LoadingState
        label={t('pages.forms.title')}
        description={t('pages.forms.description')}
        variant="skeleton"
        skeletonRows={5}
      />
    );
  }

  if (formsState === 'UNAVAILABLE') {
    return (
      <ErrorState
        title={t('admin.loadError')}
        retryLabel={t('actions.retry')}
        retrying={forms.isFetching || categories.isFetching || workflows.isFetching}
        onRetry={() => {
          void Promise.all([forms.refetch(), categories.refetch(), workflows.refetch()]);
        }}
      />
    );
  }

  const publishedCount = (forms.data ?? []).filter(
    (form) => form.lifecycleState === 'PUBLISHED'
  ).length;
  const draftCount = (forms.data ?? []).filter((form) => form.lifecycleState === 'DRAFT').length;
  const routeCoverage = (forms.data ?? []).filter((form) => form.routeCount > 0).length;

  return (
    <>
      {[formsState, categoriesState, workflowsState].some(
        (state) => state === 'STALE' || state === 'UNAVAILABLE'
      ) ? (
        <InlineFeedback
          severity="warning"
          action={
            <ActionIconButton
              label={t('actions.retry')}
              onClick={() => {
                void forms.refetch();
                void categories.refetch();
                void workflows.refetch();
              }}
            >
              <RefreshCcw size={16} />
            </ActionIconButton>
          }
        >
          {t('admin.loadError')}
        </InlineFeedback>
      ) : null}
      <ApprovalFormCatalogMetrics
        values={[
          [t('admin.formCatalog.metrics.total'), forms.data?.length ?? 0, FileStack],
          [t('admin.formCatalog.metrics.published'), publishedCount, Rocket],
          [t('admin.formCatalog.metrics.draft'), draftCount, PencilLine],
          [t('admin.formCatalog.metrics.routed'), routeCoverage, GitBranch],
        ]}
      />

      <ApprovalFormCatalogWorkspace
        panel={panel}
        onPanelChange={setPanel}
        categories={
          <ApprovalSurface
            title={t('admin.formCatalog.categories.title')}
            meta={t('admin.formCatalog.categories.meta')}
            action={
              experience.canEditDesign && catalogWriteReady ? (
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
            {categoriesState === 'LOADING' ? (
              <LoadingState label={t('admin.formCatalog.categories.title')} size="compact" />
            ) : categoriesState === 'UNAVAILABLE' || categoriesState === 'STALE' ? (
              <ErrorState
                title={t('admin.loadError')}
                retryLabel={t('actions.retry')}
                retrying={categories.isFetching}
                onRetry={() => void categories.refetch()}
                size="compact"
              />
            ) : (
              <ApprovalFormCategoryTree
                entries={categoryTree}
                total={forms.data?.length ?? 0}
                selectedId={categoryFilter}
                korean={korean}
                onSelect={(id) => {
                  setCategoryFilter(id);
                  setPanel('forms');
                }}
                onEdit={
                  experience.canEditDesign && catalogWriteReady ? openEditCategory : undefined
                }
              />
            )}
          </ApprovalSurface>
        }
        forms={
          <ApprovalSurface
            title={t('admin.formCatalog.forms.title')}
            meta={t('admin.formCatalog.forms.meta', { count: visibleForms.length })}
            action={
              experience.canEditDesign && catalogWriteReady ? (
                <Stack direction="row" gap={0.5}>
                  <ActionIconButton
                    label={t('admin.formCatalog.forms.create')}
                    size="small"
                    intent="primary"
                    onClick={() => openCreateForm()}
                  >
                    <Plus size={17} />
                  </ActionIconButton>
                  <ActionIconButton
                    label={t('admin.typedForm.create')}
                    size="small"
                    onClick={() => openCreateForm(true)}
                  >
                    <Braces size={17} />
                  </ActionIconButton>
                </Stack>
              ) : undefined
            }
          >
            <ApprovalFormCatalogControls
              search={search}
              onSearch={setSearch}
              lifecycle={lifecycle}
              onLifecycle={setLifecycle}
              sort={sort}
              onSort={setSort}
            />
            {visibleForms.length ? (
              <Stack
                component="ul"
                sx={{ m: 0, p: 0, listStyle: 'none', maxHeight: 600, overflowY: 'auto' }}
              >
                {visibleForms.map((form) => (
                  <ApprovalFormListItem
                    key={form.formId}
                    form={form}
                    selected={form.formId === selectedId}
                    locale={i18n.resolvedLanguage}
                    onSelect={() => {
                      setSelectedId(form.formId);
                      setPanel('inspector');
                    }}
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
        }
        inspector={
          !selectedId ? (
            <EmptyState
              title={t('admin.studio.noForm')}
              description={t('admin.studio.noFormDescription')}
              icon={<FileStack size={24} />}
            />
          ) : workspaceController.state === 'DENIED' ? (
            <ErrorState title={t('admin.formWorkspace.sourceUnavailable')} size="compact" />
          ) : detailState === 'UNAVAILABLE' || detailState === 'STALE' ? (
            <ErrorState
              title={t('admin.loadError')}
              retryLabel={t('actions.retry')}
              retrying={detail.isFetching}
              onRetry={() => void detail.refetch()}
              size="compact"
            />
          ) : detail.data && storedSchema && !storedValidation.compiled ? (
            storedValidation.pending ? (
              <LoadingState label={t('admin.typedForm.validating')} size="compact" />
            ) : (
              <InlineFeedback severity="warning">
                {t('admin.typedForm.schemaMismatch')}
              </InlineFeedback>
            )
          ) : detail.data ? (
            <>
              <ApprovalFormWorkspacePanel
                controller={workspaceController}
                canEdit={experience.canEditDesign}
                canPublish={experience.canPublish}
                onEdit={openEditWorkingDraft}
              />
              {storedSchema && !storedSchemaVerified && !storedValidation.pending ? (
                <InlineFeedback severity="warning">
                  {t('admin.typedForm.schemaMismatch')}
                </InlineFeedback>
              ) : null}
              <ApprovalFormInspector
                detail={detail.data}
                locale={i18n.resolvedLanguage}
                canEdit={
                  !workspaceController.installed && experience.canEditDesign && detailWriteReady
                }
                canPublish={
                  !workspaceController.installed && experience.canPublish && detailWriteReady
                }
                publishing={highRiskPublish.controller.busy}
                previewCompiled={storedValidation.compiled ?? undefined}
                previewSourceReady={
                  scopeReady &&
                  experience.canDesign &&
                  detailState === 'READY' &&
                  !detail.isFetching &&
                  storedSchemaVerified
                }
                previewSourceCacheKey={requestScope.cacheKey}
                onEdit={openEditForm}
                onPublish={() => {
                  if (
                    !detailWriteReady ||
                    !experience.canPublish ||
                    highRiskPublish.controller.busy
                  )
                    return;
                  void highRiskPublish.begin(
                    approvalFormPublishCommand(detail.data.form.formId, detail.data.form.version)
                  );
                }}
              />
            </>
          ) : (
            <LoadingState
              label={t('pages.forms.title')}
              description={t('pages.forms.description')}
              variant="skeleton"
              skeletonRows={4}
              size="compact"
            />
          )
        }
      />

      <ApprovalFormBuilderDialog
        open={
          formEditorOpen && (!workspaceEditing || workspaceEditorReady || workspaceController.busy)
        }
        creating={creatingForm}
        draft={formDraft}
        categories={categories.data ?? []}
        workflows={workflows.data ?? []}
        valid={Boolean(formValid)}
        compiled={schemaValidation.compiled}
        validating={schemaValidation.pending}
        invalid={schemaValidation.invalid}
        errorPath={schemaValidation.errorPath}
        busy={createForm.isPending || updateForm.isPending || workspaceController.busy}
        sourceConflict={
          !creatingForm && (workspaceEditing ? !workspaceEditorReady : !draftBindingMatches)
        }
        schemaMismatch={!creatingForm && !storedSchemaVerified && !storedValidation.pending}
        readRetrying={
          forms.isFetching || categories.isFetching || workflows.isFetching || detail.isFetching
        }
        onRefresh={() => {
          void forms.refetch();
          void categories.refetch();
          void workflows.refetch();
          if (!creatingForm && selectedId) void detail.refetch();
          if (workspaceEditing) void workspaceController.reload();
        }}
        onChange={setFormDraft}
        onClose={() => setFormEditorOpen(false)}
        onSave={saveFormDraft}
      />
      <ApprovalFormWorkspaceReadOnlyDraftDialog
        open={
          formEditorOpen &&
          workspaceEditing &&
          !workspaceEditorReady &&
          !workspaceController.busy &&
          workspaceController.state !== 'DENIED'
        }
        draft={formDraft}
        unknown={workspaceController.unknown}
        onClose={() => setFormEditorOpen(false)}
        onReload={() => {
          void forms.refetch();
          void categories.refetch();
          void workflows.refetch();
          void detail.refetch();
          void workspaceController.reload();
        }}
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
        onSave={saveCategoryDraft}
      />
      <ApprovalHighRiskCommandDialog controller={highRiskPublish.controller} />
    </>
  );
}
