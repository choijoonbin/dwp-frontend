import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  compareApprovalTemplateVersion,
  getApprovalFormStudioDraftInput,
  getApprovalRoutingGroupDraftInput,
  getApprovalRoutingResolution,
  getApprovalRoutingRetirementInput,
  getApprovalTemplateInstallInput,
  reviewApprovalFormStudioV3,
  validateApprovalFormStudioV3,
} from '@dwp-frontend/shared-utils/api/approval-admin-v2-action-api';
import {
  approvalRoutingPublishCommand,
  approvalRoutingRetireCommand,
} from '@dwp-frontend/shared-utils/api/approval-admin-v2-command-api';
import {
  cloneApprovalTemplateDraft,
  reviewApprovalAutomationDelegation,
} from '@dwp-frontend/shared-utils/api/approval-admin-v2-canonical-mutation-api';
import {
  approvalDelegationReviewCommand,
  getApprovalDelegationGovernanceEvidence,
} from '@dwp-frontend/shared-utils/api/approval-admin-v2-delegation-api';
import {
  installApprovalTemplateDraft,
  saveApprovalFormStudioDraft,
  saveApprovalRoutingGroup,
} from '@dwp-frontend/shared-utils/api/approval-admin-v2-governed-api';
import {
  approvalTemplateCloneCommand,
  approvalTemplateCloneDraft,
  getApprovalTemplateWorkspaceDetail,
} from '@dwp-frontend/shared-utils/api/approval-admin-v2-template-api';

import Stack from '@mui/material/Stack';

import { AdminV2ViewTabs } from './admin-v2-foundation';
import { ApprovalWorkflowStudio } from '../approval-workflow-studio';
import { approvalAdminV2Copy } from './approval-admin-v2-copy';
import { DelegationGovernanceWorkspace } from './delegation-governance-workspace';
import {
  ApprovalAdminV2RuntimeLayer,
  useApprovalAdminV2RuntimeFeedback,
} from './approval-admin-v2-runtime-feedback';
import { ApprovalAdminV2RoutingEditor } from './approval-admin-v2-routing-editor';
import { ApproverRoutingWorkspace } from './approver-routing-workspace';
import { FormStudioV3FieldDialog } from './form-studio-v3-field-dialog';
import {
  addFormStudioV3Field,
  cloneFormStudioV3Field,
  createFormStudioV3FieldDraft,
  moveFormStudioV3Field,
  readFormStudioV3EditorFields,
  removeFormStudioV3Field,
  updateFormStudioV3Field,
} from './form-studio-v3-editor-model';
import { FormStudioV3Workspace } from './form-studio-v3-workspace';
import { TemplateLibraryWorkspace } from './template-library-workspace';
import { TemplateLibraryCloneDialog } from './template-library-clone-dialog';
import { useApprovalAdminV2Command } from './use-approval-admin-v2-command';
import { useApprovalAdminV2GovernedAction } from './use-approval-admin-v2-governed-action';
import { useApprovalAdminV2Source } from './use-approval-admin-v2-source';

import type { ApprovalAdminV2RoutingGroupDraft } from '@dwp-frontend/shared-utils/api/approval-admin-v2-governed-api';
import type {
  ApprovalDelegationGovernanceDetail,
  ApprovalDelegationGovernanceReview,
  ApprovalDelegationReviewDisposition,
} from '@dwp-frontend/shared-utils/api/approval-admin-v2-delegation-api';
import type {
  ApprovalTemplateCloneDraft,
  ApprovalTemplateWorkspaceDetail,
} from '@dwp-frontend/shared-utils/api/approval-admin-v2-template-api';
import type { ReactNode } from 'react';
import type { FormStudioV3FieldDraft } from './form-studio-v3-editor-model';
import type { AdminV2Status } from './admin-v2-types';
import type { ApproverRoutingView } from './approver-routing-workspace';
import type { FormStudioV3View } from './form-studio-v3-workspace';

const EMPTY_STATUS: AdminV2Status = { label: 'UNAVAILABLE', tone: 'neutral' };

function selectedId<T extends { id: string }>(items: readonly T[], selected: string | null) {
  return items.some((item) => item.id === selected) ? selected : (items[0]?.id ?? null);
}

function retry(source: { refetch: () => unknown }) {
  return () => void source.refetch();
}

function requestOptions(source: { requestScope: { contextScopeKey?: string } }) {
  return source.requestScope.contextScopeKey
    ? { contextScopeKey: source.requestScope.contextScopeKey }
    : {};
}

function AdminWorkspaceTabs<T extends string>({
  label,
  value,
  options,
  onChange,
  children,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  children: React.ReactNode;
}) {
  return (
    <Stack gap={2.5}>
      <AdminV2ViewTabs label={label} value={value} options={options} onChange={onChange} />
      {children}
    </Stack>
  );
}

function TemplateLibraryRuntime() {
  const { t, i18n } = useTranslation('approvals');
  const copy = {
    ...approvalAdminV2Copy(t).templates,
    previewTitle: t('admin.studio.preview'),
    previewDescription: t('adminV2.form.canvasDescription'),
    requiredLabel: t('admin.studio.required'),
    optionalLabel: t('admin.studio.optional'),
    downloadPackageLabel: t('requests.documents.download'),
    cloneLabel: t('admin.formCatalog.forms.create'),
    comparisonCompatibleLabel: t('admin.typedForm.valid'),
    comparisonBlockedLabel: t('admin.typedForm.invalid'),
  };
  const source = useApprovalAdminV2Source('templates', (data) => data.templates.length === 0);
  const feedback = useApprovalAdminV2RuntimeFeedback();
  const mutation = useApprovalAdminV2GovernedAction(
    source,
    'route.approvals.admin.template-draft.action'
  );
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [selection, setSelection] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApprovalTemplateWorkspaceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [comparison, setComparison] = useState<{
    installedVersion: number;
    availableVersion: number;
    updateAvailable: boolean;
    compatible: boolean;
  } | null>(null);
  const [cloneDraft, setCloneDraft] = useState<ApprovalTemplateCloneDraft | null>(null);
  const templates = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return (source.data?.templates ?? []).filter(
      (item) =>
        (categoryId === 'all' || item.categoryId === categoryId) &&
        (!query || `${item.name} ${item.summary}`.toLocaleLowerCase().includes(query))
    );
  }, [categoryId, search, source.data?.templates]);
  const selectedTemplateId = selectedId(templates, selection);
  const selectedTemplate = templates.find((item) => item.id === selectedTemplateId);

  useEffect(() => {
    if (!selectedTemplateId || source.state !== 'ready') {
      setDetail(null);
      return undefined;
    }
    const abort = new AbortController();
    let current = true;
    setDetailLoading(true);
    setComparison(null);
    void getApprovalTemplateWorkspaceDetail(selectedTemplateId, {
      ...requestOptions(source),
      signal: abort.signal,
    })
      .then((value) => {
        if (current) setDetail(value);
      })
      .catch(() => {
        if (current && !abort.signal.aborted) setDetail(null);
      })
      .finally(() => {
        if (current) setDetailLoading(false);
      });
    return () => {
      current = false;
      abort.abort();
    };
  }, [selectedTemplateId, source.requestScope.contextScopeKey, source.state]);

  const compare = async (templateId: string) => {
    if (!detail || detail.templateId !== templateId || detail.currentVersion <= 1) return;
    try {
      const result = await compareApprovalTemplateVersion(
        detail.templateId,
        detail.currentVersion - 1,
        requestOptions(source)
      );
      setComparison(result);
      feedback.success(
        t('adminV2.feedback.successTitle'),
        t('adminV2.feedback.templateCompared', {
          installedVersion: result.installedVersion,
          availableVersion: result.availableVersion,
        })
      );
    } catch {
      feedback.error(t('adminV2.feedback.errorTitle'), t('adminV2.feedback.templateCompareFailed'));
    }
  };

  const clone = async () => {
    if (!detail || !cloneDraft) return;
    try {
      const body = approvalTemplateCloneCommand(detail, cloneDraft);
      const receipt = await mutation.run((execution) =>
        cloneApprovalTemplateDraft(
          detail.templateId,
          body,
          detail.expectedTemplateVersion,
          execution
        )
      );
      if (receipt) {
        setCloneDraft(null);
        feedback.success(t('adminV2.feedback.successTitle'), t('admin.studio.formCreated'));
      }
    } catch {
      // The governed mutation preserves the authored clone draft on rejected outcomes.
    }
  };

  const downloadPackage = () => {
    if (!detail) return;
    const objectUrl = URL.createObjectURL(
      new Blob([detail.packageJson], { type: 'application/json;charset=utf-8' })
    );
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `${detail.templateKey.toLowerCase()}-v${detail.currentVersion}.json`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  };

  const install = async (templateId: string) => {
    try {
      const input = await getApprovalTemplateInstallInput(templateId, requestOptions(source));
      const receipt = await mutation.run((execution, options) =>
        installApprovalTemplateDraft(
          {
            ...input.metadata,
            templateVersionId: input.templateVersionId,
            expectedTemplateVersion: input.expectedTemplateVersion,
          },
          execution,
          options
        )
      );
      if (receipt) {
        feedback.success(
          t('adminV2.feedback.successTitle'),
          t('adminV2.feedback.templateInstalled')
        );
      }
    } catch {
      // The governed mutation owns the fail-closed state and keeps the selection intact.
    }
  };

  return (
    <ApprovalAdminV2RuntimeLayer
      feedback={feedback.feedback}
      dismissLabel={t('adminV2.feedback.dismiss')}
      onDismiss={feedback.clearFeedback}
    >
      <TemplateLibraryWorkspace
        state={mutation.failureState ?? source.state}
        copy={copy}
        metrics={source.data?.metrics ?? []}
        categories={source.data?.categories ?? []}
        activeCategoryId={categoryId}
        search={search}
        templates={templates}
        selectedTemplateId={selectedTemplateId}
        packagePreview={
          detail
            ? {
                schemaSha256: detail.schemaSha256,
                fields: detail.fields.map((field) => ({
                  id: field.id,
                  label:
                    i18n.resolvedLanguage?.toLowerCase().startsWith('ko') === true
                      ? field.labelKo
                      : field.labelEn,
                  type: field.type,
                  required: field.required,
                })),
              }
            : null
        }
        packageLoading={detailLoading}
        comparison={comparison}
        importReady={false}
        importDisabledReason={t('adminV2.feedback.templateImportUnavailable')}
        compareReady={Boolean(detail && detail.currentVersion > 1)}
        installReady={Boolean(selectedTemplate?.command.commandReady) && !mutation.busy}
        installDisabledReason={t('adminV2.feedback.templateInstallUnavailable')}
        downloadReady={Boolean(detail)}
        cloneReady={Boolean(detail && selectedTemplate?.command.commandReady) && !mutation.busy}
        cloneDisabledReason={t('adminV2.feedback.templateInstallUnavailable')}
        onSearchChange={setSearch}
        onCategoryChange={setCategoryId}
        onSelectTemplate={setSelection}
        onImport={() => undefined}
        onCompare={(templateId) => void compare(templateId)}
        onDownloadPackage={() => downloadPackage()}
        onClone={() => {
          if (detail) setCloneDraft(approvalTemplateCloneDraft(detail));
        }}
        onInstall={(templateId) => void install(templateId)}
        onRetry={retry(source)}
        onResolveConflict={() => {
          mutation.clearFailure();
          void source.refetch();
        }}
      />
      <TemplateLibraryCloneDialog
        draft={cloneDraft}
        busy={mutation.busy}
        title={t('admin.formCatalog.forms.create')}
        description={copy.detailDescription}
        templateKeyLabel={t('admin.formCatalog.editor.formKey')}
        nameKoLabel={t('admin.studio.nameKo')}
        nameEnLabel={t('admin.studio.nameEn')}
        descriptionKoLabel={t('admin.studio.descriptionKo')}
        descriptionEnLabel={t('admin.studio.descriptionEn')}
        ownerLabel={t('admin.formCatalog.editor.owner')}
        categoryLabel={t('admin.formCatalog.editor.category')}
        workflowLabel={t('admin.formCatalog.editor.defaultRoute')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('admin.formCatalog.forms.create')}
        onChange={setCloneDraft}
        onClose={() => setCloneDraft(null)}
        onSubmit={() => void clone()}
      />
    </ApprovalAdminV2RuntimeLayer>
  );
}

function FormStudioRuntime() {
  const { t, i18n } = useTranslation('approvals');
  const baseCopy = approvalAdminV2Copy(t).form;
  const copy = {
    ...baseCopy,
    previewTab: t('admin.studio.preview'),
    editFieldLabel: t('admin.studio.editForm'),
    duplicateFieldLabel: t('admin.typedForm.duplicateField'),
    moveFieldUpLabel: t('admin.studio.moveUp'),
    moveFieldDownLabel: t('admin.studio.moveDown'),
    removeFieldLabel: t('admin.studio.removeField'),
  };
  const source = useApprovalAdminV2Source('formStudio', (data) => data.fields.length === 0);
  const command = useApprovalAdminV2Command(source);
  const feedback = useApprovalAdminV2RuntimeFeedback();
  const mutation = useApprovalAdminV2GovernedAction(
    source,
    'route.approvals.admin.form-studio-draft.action'
  );
  const [view, setView] = useState<FormStudioV3View>('builder');
  const [selection, setSelection] = useState<string | null>(null);
  const [editor, setEditor] = useState<{
    formId: string;
    expectedWorkspaceVersion: number;
    schema: Readonly<Record<string, unknown>>;
    baseline: string;
  } | null>(null);
  const [editorLoadFailed, setEditorLoadFailed] = useState(false);
  const [fieldDialog, setFieldDialog] = useState<{
    mode: 'add' | 'edit';
    fieldId: string | null;
    draft: FormStudioV3FieldDraft;
  } | null>(null);
  const [fieldDialogError, setFieldDialogError] = useState<string | null>(null);
  const [validationEvidence, setValidationEvidence] = useState<
    readonly {
      id: string;
      title: string;
      detail: string;
      location: string;
      status: AdminV2Status;
    }[]
  >([]);
  const data = source.data;
  const formIdentity = data?.formId ? `${data.formId}:${data.command.expectedVersion}` : null;

  useEffect(() => {
    if (!data?.formId || source.state !== 'ready') return undefined;
    const abort = new AbortController();
    let current = true;
    setEditorLoadFailed(false);
    void getApprovalFormStudioDraftInput(data.formId, {
      ...requestOptions(source),
      signal: abort.signal,
    })
      .then((input) => {
        if (!current) return;
        setEditor({
          formId: input.formId,
          expectedWorkspaceVersion: input.expectedWorkspaceVersion,
          schema: input.schema,
          baseline: JSON.stringify(input.schema),
        });
        setValidationEvidence([]);
      })
      .catch(() => {
        if (!abort.signal.aborted && current) {
          setEditor(null);
          setEditorLoadFailed(true);
        }
      });
    return () => {
      current = false;
      abort.abort();
    };
  }, [formIdentity, source.requestScope.contextScopeKey, source.state]);

  const editorFields = useMemo(
    () => (editor ? readFormStudioV3EditorFields(editor.schema) : []),
    [editor]
  );
  const locale = i18n.resolvedLanguage?.toLowerCase().startsWith('ko') ? 'ko' : 'en';
  const fields = useMemo(() => {
    const serverFields = new Map((data?.fields ?? []).map((field) => [field.id, field]));
    return editorFields.map((field) => {
      const serverField = serverFields.get(field.id);
      return {
        id: field.id,
        key: field.key,
        label: locale === 'ko' ? field.labelKo : field.labelEn,
        typeLabel: `${field.sourceType} · ${field.control}`,
        editorType: field.sourceType,
        helpText: locale === 'ko' ? field.helpKo : field.helpEn,
        required: field.required,
        spanLabel: `${field.desktopSpan}/${field.tabletSpan}/${field.mobileSpan}`,
        classificationLabel: field.classification,
        status: serverField?.status ?? data?.formStatus ?? EMPTY_STATUS,
        facts: serverField?.facts ?? [],
      };
    });
  }, [data?.fields, data?.formStatus, editorFields, locale]);
  const selectedFieldId = selectedId(fields, selection);
  const schemaDirty = Boolean(editor && JSON.stringify(editor.schema) !== editor.baseline);
  const editorReady = Boolean(editor && data?.command.commandReady && !editorLoadFailed);

  const updateEditorSchema = (schema: Readonly<Record<string, unknown>>) => {
    setEditor((current) => (current ? { ...current, schema } : current));
    setValidationEvidence([]);
  };

  const openAddField = () => {
    if (!editor) return;
    setFieldDialog({
      mode: 'add',
      fieldId: null,
      draft: createFormStudioV3FieldDraft(editor.schema),
    });
    setFieldDialogError(null);
  };

  const openEditField = (fieldId: string) => {
    const field = editorFields.find((item) => item.id === fieldId);
    if (!field) return;
    setFieldDialog({
      mode: 'edit',
      fieldId,
      draft: {
        key: field.key,
        type: field.sourceType,
        labelKo: field.labelKo,
        labelEn: field.labelEn,
        helpKo: field.helpKo,
        helpEn: field.helpEn,
        required: field.required,
        desktopSpan: field.desktopSpan,
        tabletSpan: field.tabletSpan,
        mobileSpan: field.mobileSpan,
      },
    });
    setFieldDialogError(null);
  };

  const applyFieldDialog = () => {
    if (!editor || !fieldDialog) return;
    try {
      const schema =
        fieldDialog.mode === 'add'
          ? addFormStudioV3Field(editor.schema, fieldDialog.draft)
          : updateFormStudioV3Field(editor.schema, fieldDialog.fieldId ?? '', fieldDialog.draft);
      updateEditorSchema(schema);
      setSelection(fieldDialog.draft.key);
      setFieldDialog(null);
      setFieldDialogError(null);
    } catch {
      setFieldDialogError(t('admin.studio.saveError'));
    }
  };

  const mutateField = (
    action: (schema: Readonly<Record<string, unknown>>) => Readonly<Record<string, unknown>>
  ) => {
    if (!editor) return;
    try {
      updateEditorSchema(action(editor.schema));
    } catch {
      feedback.error(t('adminV2.feedback.errorTitle'), t('admin.studio.saveError'));
    }
  };

  const saveDraft = async () => {
    if (!editor) return;
    try {
      const receipt = await mutation.run((execution, options) =>
        saveApprovalFormStudioDraft(
          {
            formId: editor.formId,
            expectedWorkspaceVersion: editor.expectedWorkspaceVersion,
            schema: editor.schema,
          },
          execution,
          options
        )
      );
      if (receipt) {
        const serialized = JSON.stringify(editor.schema);
        setEditor((current) =>
          current
            ? {
                ...current,
                expectedWorkspaceVersion: receipt.version,
                baseline: serialized,
              }
            : current
        );
        feedback.success(t('adminV2.feedback.successTitle'), t('adminV2.feedback.formSaved'));
      }
    } catch {
      // Keep the current editor selection while explicit conflict recovery is shown.
    }
  };

  const validate = async () => {
    if (!editor) return;
    try {
      const schemaSha = await validateApprovalFormStudioV3(
        editor.formId,
        requestOptions(source),
        editor.schema
      );
      setValidationEvidence([
        {
          id: schemaSha,
          title: copy.validationTitle,
          detail: schemaSha,
          location: copy.schemaTitle,
          status: { label: t('admin.typedForm.valid'), tone: 'success' },
        },
      ]);
      feedback.success(t('adminV2.feedback.successTitle'), t('adminV2.feedback.formValidated'));
    } catch (caught) {
      command.reject(caught);
    }
  };

  const review = async () => {
    if (!data?.formId || schemaDirty) return;
    try {
      await reviewApprovalFormStudioV3(data.formId, requestOptions(source));
      feedback.success(t('adminV2.feedback.successTitle'), t('adminV2.feedback.formReviewed'));
      void source.refetch();
    } catch (caught) {
      command.reject(caught);
    }
  };

  return (
    <ApprovalAdminV2RuntimeLayer
      feedback={feedback.feedback}
      dismissLabel={t('adminV2.feedback.dismiss')}
      onDismiss={feedback.clearFeedback}
    >
      <FormStudioV3Workspace
        state={mutation.failureState ?? command.failureState ?? source.state}
        copy={copy}
        metrics={data?.metrics ?? []}
        view={view}
        formName={data?.formName ?? copy.header.title}
        versionLabel={data?.versionLabel ?? ''}
        formStatus={data?.formStatus ?? EMPTY_STATUS}
        dirtyLabel={schemaDirty ? t('admin.studio.draftEditing') : undefined}
        schemaFacts={data?.schemaFacts ?? []}
        fields={fields}
        selectedFieldId={selectedFieldId}
        rules={data?.rules ?? []}
        validation={validationEvidence.length > 0 ? validationEvidence : (data?.validation ?? [])}
        reviewChanges={data?.reviewChanges ?? []}
        validationScore={validationEvidence.length > 0 ? 100 : (data?.validationScore ?? 0)}
        validationScoreLabel={
          validationEvidence.length > 0
            ? t('admin.typedForm.valid')
            : (data?.validationScoreLabel ?? '')
        }
        addFieldReady={editorReady}
        addFieldDisabledReason={t('adminV2.feedback.formSaveUnavailable')}
        editFieldReady={editorReady}
        editFieldDisabledReason={t('adminV2.feedback.formSaveUnavailable')}
        saveDraftReady={editorReady && !mutation.busy}
        saveDraftDisabledReason={t('adminV2.feedback.formSaveUnavailable')}
        submitReviewReady={editorReady && !schemaDirty}
        submitReviewDisabledReason={t('adminV2.feedback.formSaveUnavailable')}
        onViewChange={setView}
        onSelectField={setSelection}
        onAddField={openAddField}
        onEditField={openEditField}
        onCloneField={(fieldId) => {
          if (!editor) return;
          try {
            const result = cloneFormStudioV3Field(editor.schema, fieldId);
            updateEditorSchema(result.schema);
            setSelection(result.fieldId);
          } catch {
            feedback.error(t('adminV2.feedback.errorTitle'), t('admin.studio.saveError'));
          }
        }}
        onMoveField={(fieldId, direction) =>
          mutateField((schema) => moveFormStudioV3Field(schema, fieldId, direction))
        }
        onDeleteField={(fieldId) => {
          mutateField((schema) => removeFormStudioV3Field(schema, fieldId));
          setSelection(null);
        }}
        onSaveDraft={() => void saveDraft()}
        onRunValidation={() => void validate()}
        onSubmitReview={() => void review()}
        onRetry={retry(source)}
        onResolveConflict={() => {
          command.clearFailure();
          mutation.clearFailure();
          setEditor(null);
          void source.refetch();
        }}
      />
      <FormStudioV3FieldDialog
        mode={fieldDialog?.mode ?? null}
        draft={fieldDialog?.draft ?? null}
        error={fieldDialogError}
        copy={{
          addTitle: t('adminV2.form.addFieldLabel'),
          editTitle: t('admin.studio.editForm'),
          description: t('adminV2.form.inspectorDescription'),
          fieldKey: t('admin.studio.fieldKey'),
          fieldType: t('admin.studio.fieldType'),
          labelKo: t('admin.studio.labelKo'),
          labelEn: t('admin.studio.labelEn'),
          helpKo: t('admin.studio.helpKo'),
          helpEn: t('admin.studio.helpEn'),
          required: t('admin.studio.required'),
          cancel: t('actions.cancel'),
          save: t('actions.save'),
        }}
        onChange={(draft) =>
          setFieldDialog((current) => (current ? { ...current, draft } : current))
        }
        onClose={() => {
          setFieldDialog(null);
          setFieldDialogError(null);
        }}
        onSubmit={applyFieldDialog}
      />
    </ApprovalAdminV2RuntimeLayer>
  );
}

export function ApprovalAdminFormsRuntime({ matureWorkspace }: { matureWorkspace: ReactNode }) {
  const { t } = useTranslation('approvals');
  const tabs = approvalAdminV2Copy(t).tabs;
  const [view, setView] = useState<'mature' | 'templates' | 'studio'>('mature');
  return (
    <AdminWorkspaceTabs
      label={tabs.label}
      value={view}
      onChange={setView}
      options={[
        { value: 'mature', label: tabs.mature },
        { value: 'templates', label: tabs.templates },
        { value: 'studio', label: tabs.studio },
      ]}
    >
      {view === 'mature' ? (
        matureWorkspace
      ) : view === 'templates' ? (
        <TemplateLibraryRuntime />
      ) : (
        <FormStudioRuntime />
      )}
    </AdminWorkspaceTabs>
  );
}

function ApproverDirectoryRuntime() {
  const { t } = useTranslation('approvals');
  const copy = approvalAdminV2Copy(t).routing;
  const source = useApprovalAdminV2Source('routing', (data) => data.groups.length === 0);
  const command = useApprovalAdminV2Command(source);
  const feedback = useApprovalAdminV2RuntimeFeedback();
  const mutation = useApprovalAdminV2GovernedAction(
    source,
    'route.approvals.admin.routing-directory-update.action'
  );
  const [view, setView] = useState<ApproverRoutingView>('directory');
  const [selection, setSelection] = useState<string | null>(null);
  const [draft, setDraft] = useState<ApprovalAdminV2RoutingGroupDraft | null>(null);
  const data = source.data;
  const selectedGroupId = selectedId(data?.groups ?? [], selection);
  const selectedGroup = data?.groups.find((item) => item.id === selectedGroupId);

  const resolve = async () => {
    if (!selectedGroupId) return;
    try {
      await getApprovalRoutingResolution(selectedGroupId, requestOptions(source));
      feedback.success(t('adminV2.feedback.successTitle'), t('adminV2.feedback.routingResolved'));
      void source.refetch();
    } catch (caught) {
      command.reject(caught);
    }
  };

  const retire = async (groupId: string) => {
    try {
      const input = await getApprovalRoutingRetirementInput(groupId, requestOptions(source));
      await command.begin(
        approvalRoutingRetireCommand(input.groupId, input.expectedVersion, input.acknowledgedImpact)
      );
    } catch (caught) {
      command.reject(caught);
    }
  };

  const edit = async (groupId: string) => {
    try {
      setDraft(await getApprovalRoutingGroupDraftInput(groupId, requestOptions(source)));
    } catch {
      feedback.error(t('adminV2.feedback.errorTitle'), t('adminV2.feedback.routingLoadFailed'));
    }
  };

  const save = async () => {
    if (!draft) return;
    try {
      const receipt = await mutation.run((execution, options) =>
        saveApprovalRoutingGroup(draft, execution, options)
      );
      if (receipt) {
        setDraft(null);
        feedback.success(t('adminV2.feedback.successTitle'), t('adminV2.feedback.routingSaved'));
      }
    } catch {
      // Preserve the exact user draft for explicit 409 recovery.
    }
  };

  const publish = async (groupId: string) => {
    try {
      const input = await getApprovalRoutingGroupDraftInput(groupId, requestOptions(source));
      await command.begin(approvalRoutingPublishCommand(input.groupId, input.expectedVersion));
    } catch (caught) {
      command.reject(caught);
    }
  };

  return (
    <ApprovalAdminV2RuntimeLayer
      feedback={feedback.feedback}
      dismissLabel={t('adminV2.feedback.dismiss')}
      onDismiss={feedback.clearFeedback}
      controller={command.controller}
    >
      <ApproverRoutingWorkspace
        state={mutation.failureState ?? command.failureState ?? source.state}
        copy={copy}
        metrics={data?.metrics ?? []}
        view={view}
        groups={data?.groups ?? []}
        selectedGroupId={selectedGroupId}
        simulation={data?.simulation ?? null}
        exceptions={data?.exceptions ?? []}
        editGroupReady={Boolean(selectedGroup?.command.commandReady) && !mutation.busy}
        editGroupDisabledReason={t('adminV2.feedback.routingEditUnavailable')}
        publishGroupReady={
          Boolean(selectedGroup?.command.commandReady) && selectedGroup?.status.label === 'DRAFT'
        }
        publishGroupDisabledReason={t('adminV2.feedback.routingPublishUnavailable')}
        simulationReady={Boolean(selectedGroupId)}
        simulationDisabledReason={t('adminV2.feedback.routingSimulationUnavailable')}
        remediationReady={false}
        remediationDisabledReason={t('adminV2.feedback.routingRemediation')}
        onViewChange={setView}
        onSelectGroup={setSelection}
        onRefreshDirectory={retry(source)}
        onRunSimulation={() => void resolve()}
        onEditGroup={(groupId) => void edit(groupId)}
        onPublishGroup={(groupId) => void publish(groupId)}
        onRetireGroup={(groupId) => void retire(groupId)}
        onRequestRemediation={() => undefined}
        onRetry={retry(source)}
        onResolveConflict={() => {
          command.clearFailure();
          mutation.clearFailure();
          void source.refetch();
        }}
      />
      <ApprovalAdminV2RoutingEditor
        draft={draft}
        busy={mutation.busy}
        title={t('adminV2.routingEditor.title')}
        description={t('adminV2.routingEditor.description')}
        displayNameLabel={t('adminV2.routingEditor.displayName')}
        descriptionLabel={t('adminV2.routingEditor.groupDescription')}
        preservedLabel={t('adminV2.routingEditor.preserved')}
        cancelLabel={t('actions.cancel')}
        saveLabel={t('adminV2.routingEditor.save')}
        savingLabel={t('adminV2.routingEditor.saving')}
        onChange={setDraft}
        onClose={() => setDraft(null)}
        onSubmit={() => void save()}
      />
    </ApprovalAdminV2RuntimeLayer>
  );
}

function DelegationGovernanceRuntime() {
  const { t } = useTranslation('approvals');
  const policyCopy = approvalAdminV2Copy(t).policy;
  const source = useApprovalAdminV2Source('policies', (data) => data.delegations.length === 0);
  const feedback = useApprovalAdminV2RuntimeFeedback();
  const mutation = useApprovalAdminV2GovernedAction(
    source,
    'route.approvals.admin.policy-automation-update.action'
  );
  const [selection, setSelection] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApprovalDelegationGovernanceDetail | null>(null);
  const [reviews, setReviews] = useState<readonly ApprovalDelegationGovernanceReview[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailFailed, setDetailFailed] = useState(false);
  const [evidenceRevision, setEvidenceRevision] = useState(0);
  const delegations = source.data?.delegations ?? [];
  const selectedDelegationId = selectedId(delegations, selection);
  const selectedDelegation = delegations.find((item) => item.id === selectedDelegationId);

  useEffect(() => {
    if (!selectedDelegationId || source.state !== 'ready') {
      setDetail(null);
      setReviews([]);
      return undefined;
    }
    const abort = new AbortController();
    let current = true;
    setDetailLoading(true);
    setDetailFailed(false);
    void getApprovalDelegationGovernanceEvidence(selectedDelegationId, {
      ...requestOptions(source),
      signal: abort.signal,
    })
      .then((evidence) => {
        if (!current) return;
        setDetail(evidence.detail);
        setReviews(evidence.reviews);
      })
      .catch(() => {
        if (!current || abort.signal.aborted) return;
        setDetail(null);
        setReviews([]);
        setDetailFailed(true);
      })
      .finally(() => {
        if (current) setDetailLoading(false);
      });
    return () => {
      current = false;
      abort.abort();
    };
  }, [evidenceRevision, selectedDelegationId, source.requestScope.contextScopeKey, source.state]);

  const review = async (
    disposition: ApprovalDelegationReviewDisposition,
    evidenceSha256: string
  ) => {
    if (!detail) return false;
    try {
      const body = approvalDelegationReviewCommand(
        detail,
        disposition,
        evidenceSha256,
        globalThis.crypto.randomUUID()
      );
      const receipt = await mutation.run((execution) =>
        reviewApprovalAutomationDelegation(detail.delegationId, body, detail.version, execution)
      );
      if (!receipt) return false;
      setEvidenceRevision((value) => value + 1);
      feedback.success(t('adminV2.feedback.successTitle'), t('admin.typedForm.valid'));
      return true;
    } catch {
      return false;
    }
  };

  return (
    <ApprovalAdminV2RuntimeLayer
      feedback={feedback.feedback}
      dismissLabel={t('adminV2.feedback.dismiss')}
      onDismiss={feedback.clearFeedback}
    >
      <DelegationGovernanceWorkspace
        state={
          mutation.failureState ??
          (detailFailed && selectedDelegationId ? 'unavailable' : source.state)
        }
        copy={{
          header: {
            ...policyCopy.header,
            title: policyCopy.delegationTitle,
            description: policyCopy.delegationDescription,
          },
          state: policyCopy.state,
          listTitle: policyCopy.delegationTitle,
          listDescription: policyCopy.delegationDescription,
          detailTitle: t('delegations.workspace.details'),
          detailDescription: t('delegations.workspace.evidenceDetail'),
          auditTitle: t('pages.audit.title'),
          auditDescription: t('completed.evidence.meta'),
          noSelection: policyCopy.delegationDescription,
          createLabel: t('delegations.add'),
          editLabel: t('delegations.update.action'),
          revokeLabel: t('delegations.revoke.confirm'),
          cancelLabel: `${t('actions.cancel')} · ${t('delegations.title')}`,
          killSwitchLabel: `${policyCopy.highRiskTitle} · ${t('actions.cancel')}`,
          unsupportedTitle: t('adminV2.feedback.unsupportedTitle'),
          unsupportedReason: t('adminV2.feedback.policyMutation'),
          reviewLabel: policyCopy.reviewDelegationLabel,
          reviewDescription: t('adminV2.feedback.delegationReviewUnavailable'),
          dispositionLabel: policyCopy.reviewDelegationLabel,
          evidenceLabel: t('admin.signatureDiagnostics.labels.evidenceSha'),
          submitLabel: t('actions.submit'),
          submittingLabel: t('actions.submit'),
          closeLabel: t('actions.cancel'),
          findingsTitle: policyCopy.highRiskTitle,
          truthTitle: t('admin.assurance.title'),
          effectivePeriodLabel: t('delegations.workspace.period'),
          rolesLabel: t('admin.studio.owner'),
          truthLabels: {
            scopeBinding: t('delegations.workspace.scopeTitle'),
            timeWindow: t('delegations.workspace.period'),
            noSubDelegation: t('admin.assurance.segregation.title'),
            identitySeparation: t('admin.assurance.identity.title'),
            roleSnapshot: t('delegations.workspace.evidenceTitle'),
            roleSeparationOfDuties: t('admin.assurance.segregation.title'),
          },
        }}
        metrics={source.data?.metrics ?? []}
        delegations={delegations}
        selectedDelegationId={selectedDelegationId}
        detail={detail}
        reviews={reviews}
        detailLoading={detailLoading}
        reviewReady={Boolean(selectedDelegation?.command.commandReady && detail) && !mutation.busy}
        reviewBusy={mutation.busy}
        reviewDisabledReason={t('adminV2.feedback.delegationReviewUnavailable')}
        onSelectDelegation={setSelection}
        onReview={review}
        onRetry={retry(source)}
        onResolveConflict={() => {
          mutation.clearFailure();
          setEvidenceRevision((value) => value + 1);
          void source.refetch();
        }}
      />
    </ApprovalAdminV2RuntimeLayer>
  );
}

export function ApprovalAdminRoutingRuntime() {
  const { t } = useTranslation('approvals');
  const [workspace, setWorkspace] = useState<'workflow' | 'directory' | 'delegation'>('directory');
  return (
    <AdminWorkspaceTabs
      label={t('adminV2.routing.navigationLabel')}
      value={workspace}
      onChange={setWorkspace}
      options={[
        { value: 'workflow', label: t('admin.workflows.title') },
        { value: 'directory', label: t('adminV2.routing.title') },
        { value: 'delegation', label: t('adminV2.policy.delegationTitle') },
      ]}
    >
      {workspace === 'workflow' ? (
        <ApprovalWorkflowStudio />
      ) : workspace === 'directory' ? (
        <ApproverDirectoryRuntime />
      ) : (
        <DelegationGovernanceRuntime />
      )}
    </AdminWorkspaceTabs>
  );
}
