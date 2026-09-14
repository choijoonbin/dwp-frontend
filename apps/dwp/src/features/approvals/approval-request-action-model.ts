import type { ApprovalRequest } from '@dwp-frontend/shared-utils';
import type { ApprovalManagementScopedCommand } from './approval-management-command-scope';
import type { ApprovalRequestInformationSnapshot } from './approval-request-information-snapshot';

export type RequestAction = Readonly<{
  kind: 'respond' | 'withdraw';
  request: ApprovalRequest;
}>;

export type RequestActionInput = Readonly<{
  action: RequestAction;
  responseMessage: string;
  responsePayload: Readonly<Record<string, unknown>>;
  schemaHash?: string;
  idempotencyKey?: string;
  informationSnapshot?: ApprovalRequestInformationSnapshot;
}>;

export type RequestActionCommand = ApprovalManagementScopedCommand<RequestActionInput>;
export type RequestActionResult = Readonly<{
  result: ApprovalRequest;
  command: RequestActionCommand;
}>;
