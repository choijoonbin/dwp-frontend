import type { ApprovalFormCategory, ApprovalWorkflow } from '@dwp-frontend/shared-utils';
import type { FormDraft } from './approval-form-catalog-drafts';
import type { CompiledApprovalTypedForm } from './approval-form-typed-model';

export type ApprovalFormBuilderProps = {
  open: boolean;
  creating: boolean;
  draft: FormDraft;
  categories: ApprovalFormCategory[];
  workflows: ApprovalWorkflow[];
  valid: boolean;
  busy: boolean;
  sourceConflict: boolean;
  schemaMismatch?: boolean;
  readRetrying: boolean;
  compiled?: CompiledApprovalTypedForm | null;
  validating?: boolean;
  invalid?: boolean;
  errorPath?: string;
  onRefresh: () => void;
  onChange: (draft: FormDraft) => void;
  onClose: () => void;
  onSave: () => void;
};
