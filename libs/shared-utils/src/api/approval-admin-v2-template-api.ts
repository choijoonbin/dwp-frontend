import { axiosInstance } from '../axios-instance';
import {
  adminV2Array,
  adminV2Boolean,
  adminV2Identifier,
  adminV2Number,
  adminV2Record,
  adminV2Text,
  adminV2Version,
} from './approval-admin-v2-contract-core';
import { APPROVAL_ADMIN_V2_ENDPOINTS } from './approval-admin-v2-endpoints';

import type { components as GatewayComponents } from '@dwp-frontend/api-contracts';
import type { ApiResponse } from '../types';

type Schemas = GatewayComponents['schemas'];
type ReadOptions = Readonly<{ contextScopeKey?: string; signal?: AbortSignal }>;

export type ApprovalTemplatePreviewField = Readonly<{
  id: string;
  labelKo: string;
  labelEn: string;
  type: string;
  required: boolean;
}>;

export type ApprovalTemplateWorkspaceDetail = Readonly<{
  templateId: string;
  templateVersionId: string;
  templateKey: string;
  currentVersion: number;
  expectedTemplateVersion: number;
  nameKo: string;
  nameEn: string;
  descriptionKo: string;
  descriptionEn: string;
  ownerGroupRef: string;
  categoryKey: string;
  defaultWorkflowKey: string;
  schemaSha256: string;
  schema: Readonly<Record<string, unknown>>;
  fields: readonly ApprovalTemplatePreviewField[];
  packageJson: string;
}>;

export type ApprovalTemplateCloneDraft = Readonly<{
  templateKey: string;
  nameKo: string;
  nameEn: string;
  descriptionKo: string;
  descriptionEn: string;
  ownerGroupRef: string;
  categoryKey: string;
  defaultWorkflowKey: string;
}>;

function requestOptions(input: ReadOptions) {
  return {
    ...(input.contextScopeKey ? { contextScopeKey: input.contextScopeKey } : {}),
    ...(input.signal ? { signal: input.signal } : {}),
    timeoutMs: 12_000,
  };
}

function localized(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  return {
    ko: adminV2Text(record.ko, `${path}.ko`, { max: 300 }),
    en: adminV2Text(record.en, `${path}.en`, { max: 300 }),
  };
}

function previewFields(schema: Record<string, unknown>): readonly ApprovalTemplatePreviewField[] {
  const fields: ApprovalTemplatePreviewField[] = [];
  const visit = (values: unknown, path: string, parentId?: string) => {
    adminV2Array(values, path, (value, fieldPath) => {
      const field = adminV2Record(value, fieldPath);
      const key = adminV2Text(field.key, `${fieldPath}.key`, { max: 160 });
      const id = parentId ? `${parentId}.${key}` : key;
      const label = localized(field.label, `${fieldPath}.label`);
      fields.push({
        id,
        labelKo: label.ko,
        labelEn: label.en,
        type: adminV2Text(field.type, `${fieldPath}.type`, { max: 80 }),
        required: adminV2Boolean(field.required, `${fieldPath}.required`),
      });
      if (field.columns != null) visit(field.columns, `${fieldPath}.columns`, id);
      return true;
    });
  };

  adminV2Array(schema.pages, 'template.schema.pages', (pageValue, pagePath) => {
    const page = adminV2Record(pageValue, pagePath);
    adminV2Array(page.sections, `${pagePath}.sections`, (sectionValue, sectionPath) => {
      const section = adminV2Record(sectionValue, sectionPath);
      visit(section.fields, `${sectionPath}.fields`);
      return true;
    });
    return true;
  });
  return fields;
}

export async function getApprovalTemplateWorkspaceDetail(
  templateId: string,
  input: ReadOptions
): Promise<ApprovalTemplateWorkspaceDetail> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    APPROVAL_ADMIN_V2_ENDPOINTS.templates.detail(templateId),
    requestOptions(input)
  );
  const template = adminV2Record(response.data.data, 'templateDetail');
  const current = adminV2Record(template.current, 'templateDetail.current');
  const schema = adminV2Record(current.schema, 'templateDetail.current.schema');
  const detail = {
    templateId: adminV2Identifier(template.templateId, 'templateDetail.templateId'),
    templateVersionId: adminV2Identifier(
      current.templateVersionId,
      'templateDetail.current.templateVersionId'
    ),
    templateKey: adminV2Text(template.templateKey, 'templateDetail.templateKey', { max: 100 }),
    currentVersion: adminV2Number(template.currentVersion, 'templateDetail.currentVersion', {
      min: 1,
      integer: true,
    }),
    expectedTemplateVersion: adminV2Version(template.version, 'templateDetail.version'),
    nameKo: adminV2Text(current.nameKo, 'templateDetail.current.nameKo', { max: 200 }),
    nameEn: adminV2Text(current.nameEn, 'templateDetail.current.nameEn', { max: 200 }),
    descriptionKo: adminV2Text(current.descriptionKo, 'templateDetail.current.descriptionKo', {
      max: 1000,
    }),
    descriptionEn: adminV2Text(current.descriptionEn, 'templateDetail.current.descriptionEn', {
      max: 1000,
    }),
    ownerGroupRef: adminV2Text(template.ownerGroupRef, 'templateDetail.ownerGroupRef', {
      max: 160,
    }),
    categoryKey: adminV2Text(template.categoryKey, 'templateDetail.categoryKey', { max: 100 }),
    defaultWorkflowKey: adminV2Text(
      template.defaultWorkflowKey,
      'templateDetail.defaultWorkflowKey',
      { max: 100 }
    ),
    schemaSha256: adminV2Text(current.schemaSha256, 'templateDetail.current.schemaSha256', {
      max: 64,
    }),
    schema: structuredClone(schema) as Readonly<Record<string, unknown>>,
    fields: previewFields(schema),
  };
  const packageJson = JSON.stringify(
    {
      contract: 'DWP_APPROVAL_TEMPLATE_PACKAGE_V1',
      templateId: detail.templateId,
      templateVersionId: detail.templateVersionId,
      templateKey: detail.templateKey,
      currentVersion: detail.currentVersion,
      aggregateVersion: detail.expectedTemplateVersion,
      schemaSha256: detail.schemaSha256,
      metadata: {
        nameKo: detail.nameKo,
        nameEn: detail.nameEn,
        descriptionKo: detail.descriptionKo,
        descriptionEn: detail.descriptionEn,
        ownerGroupRef: detail.ownerGroupRef,
        categoryKey: detail.categoryKey,
        defaultWorkflowKey: detail.defaultWorkflowKey,
      },
      schema: detail.schema,
    },
    null,
    2
  );
  return { ...detail, packageJson };
}

export function approvalTemplateCloneDraft(
  detail: ApprovalTemplateWorkspaceDetail
): ApprovalTemplateCloneDraft {
  return {
    templateKey: `${detail.templateKey}_COPY`,
    nameKo: `${detail.nameKo} 복사본`,
    nameEn: `${detail.nameEn} copy`,
    descriptionKo: detail.descriptionKo,
    descriptionEn: detail.descriptionEn,
    ownerGroupRef: detail.ownerGroupRef,
    categoryKey: detail.categoryKey,
    defaultWorkflowKey: detail.defaultWorkflowKey,
  };
}

export function approvalTemplateCloneCommand(
  detail: ApprovalTemplateWorkspaceDetail,
  draft: ApprovalTemplateCloneDraft
): Schemas['approval_CloneDraftRequest'] {
  return {
    templateKey: adminV2Text(draft.templateKey.trim().toUpperCase(), 'clone.templateKey', {
      max: 100,
    }),
    nameKo: adminV2Text(draft.nameKo, 'clone.nameKo', { max: 200 }),
    nameEn: adminV2Text(draft.nameEn, 'clone.nameEn', { max: 200 }),
    descriptionKo: adminV2Text(draft.descriptionKo, 'clone.descriptionKo', { max: 1000 }),
    descriptionEn: adminV2Text(draft.descriptionEn, 'clone.descriptionEn', { max: 1000 }),
    ownerGroupRef: adminV2Text(draft.ownerGroupRef, 'clone.ownerGroupRef', { max: 160 }),
    categoryKey: adminV2Text(draft.categoryKey.trim().toUpperCase(), 'clone.categoryKey', {
      max: 100,
    }),
    defaultWorkflowKey: adminV2Text(
      draft.defaultWorkflowKey.trim().toUpperCase(),
      'clone.defaultWorkflowKey',
      { max: 100 }
    ),
    expectedTemplateVersion: detail.expectedTemplateVersion,
  };
}
