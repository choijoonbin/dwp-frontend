import type { ApprovalFormDraftInput } from '@dwp-frontend/shared-utils';

export type FormDraft = ApprovalFormDraftInput & { formKey: string };
export type CategoryDraft = {
  categoryKey: string;
  parentCategoryId: string;
  nameKo: string;
  nameEn: string;
  descriptionKo: string;
  descriptionEn: string;
  iconKey: string;
  sortOrder: number;
  lifecycleState: 'ACTIVE' | 'INACTIVE';
};

export const emptyFormDraft = (): FormDraft => ({
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

export const emptyCategoryDraft = (): CategoryDraft => ({
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
