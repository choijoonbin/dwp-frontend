import type { ComponentType } from 'react';
import type { ProductSurfaceRequestScope } from './use-product-surface-request-scope';

export type AssignmentProposalAuthorityInput = Readonly<{
  accessMode: string;
  governed: boolean;
  capabilityGranted: boolean;
  roles: readonly string[];
}>;

export type AssignmentProposalWorkspacePortProps = Readonly<{
  proposalReference: string | null;
  requestScope: ProductSurfaceRequestScope;
  onProposalReferenceChange: (proposalReference: string) => void;
  onClose: () => void;
}>;

export type AssignmentProposalPort = Readonly<{
  Workspace: ComponentType<AssignmentProposalWorkspacePortProps>;
  actionAvailable: (input: AssignmentProposalAuthorityInput) => boolean;
  createReference: (assignmentId: string) => string;
}>;
