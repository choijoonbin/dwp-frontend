import { HttpError } from '@dwp-frontend/shared-utils';

export function approvalRequestCommandResultUnknown(error: unknown): boolean {
  return !(error instanceof HttpError) || error.status === 408 || error.status >= 500;
}
