import { useCallback, useMemo } from 'react';
import { HttpError } from '@dwp-frontend/shared-utils';

import {
  productSurfaceHighRiskCommand,
  type ProductSurfaceHighRiskCommandController,
  type ProductSurfaceHighRiskCommandDescriptor,
  type ProductSurfaceHighRiskOperation,
} from '../../../../components/product-surface-high-risk-command';
import { useProductSurfaceHighRiskCommandExecutor } from '../../../../components/use-product-surface-high-risk-command-executor';
import {
  EMPLOYMENT_EVENT_BASE_PATH,
  publishEmploymentEvent,
} from '../../employment/assignment-proposal-model';

import type { EmploymentEventPublish } from '../components/employment-event-workspace';

export const EMPLOYMENT_EVENT_PUBLISH_OPERATION =
  'HCM_EMPLOYMENT_EVENT_PUBLISH' as const satisfies ProductSurfaceHighRiskOperation;

export type EmploymentEventPublishBinding = Parameters<EmploymentEventPublish>[0];

/**
 * The exact operation and target literals are registered by the control-owned shared catalog.
 * This adapter does not infer or substitute an adjacent high-risk route.
 */
export function employmentEventPublishCommand(
  binding: EmploymentEventPublishBinding
): ProductSurfaceHighRiskCommandDescriptor {
  if (binding.expectedVersion !== 3) {
    throw new Error('Only an approved employment event at version 3 can be published.');
  }
  return productSurfaceHighRiskCommand({
    operation: EMPLOYMENT_EVENT_PUBLISH_OPERATION,
    commandMethod: 'POST',
    commandPath: `${EMPLOYMENT_EVENT_BASE_PATH}/${encodeURIComponent(binding.eventPublicId)}/publish`,
    targetType: 'EMPLOYMENT_EVENT',
    targetId: binding.eventPublicId,
    expectedObjectVersion: binding.expectedVersion,
    payload: {
      eventPublicId: binding.eventPublicId,
      expectedVersion: binding.expectedVersion,
      correlationId: binding.correlationId,
    },
    idempotencyKey: binding.idempotencyKey,
  });
}

export function employmentEventPublishExecutionCommand(
  binding: EmploymentEventPublishBinding,
  descriptor?: ProductSurfaceHighRiskCommandDescriptor
): EmploymentEventPublishBinding {
  const payload = descriptor?.payload;
  const eventPublicId = descriptor?.targetId ?? binding.eventPublicId;
  const expectedVersion = descriptor?.expectedObjectVersion ?? binding.expectedVersion;
  const idempotencyKey = descriptor?.idempotencyKey ?? binding.idempotencyKey;
  const correlationId =
    typeof payload?.correlationId === 'string' ? payload.correlationId : binding.correlationId;
  if (
    eventPublicId !== binding.eventPublicId ||
    expectedVersion !== 3 ||
    correlationId !== binding.correlationId ||
    !idempotencyKey
  ) {
    throw new Error('Employment event publication binding changed before dispatch.');
  }
  return { eventPublicId, expectedVersion: 3, idempotencyKey, correlationId };
}

export type EmploymentEventPublishRuntime = Readonly<{
  publishEvent: EmploymentEventPublish;
  controller: ProductSurfaceHighRiskCommandController;
}>;

export function useEmploymentEventPublish(): EmploymentEventPublishRuntime {
  const publish = useProductSurfaceHighRiskCommandExecutor({
    operation: EMPLOYMENT_EVENT_PUBLISH_OPERATION,
    buildCommand: employmentEventPublishCommand,
  });
  const publishEvent = useCallback<EmploymentEventPublish>(
    (binding) =>
      publish.execute((authority, descriptor) => {
        if (authority.mode !== 'SECURE' || !authority.stepUp) {
          throw new HttpError('Step-up authority is required to publish an employment event.', 403);
        }
        return publishEmploymentEvent(
          employmentEventPublishExecutionCommand(binding, descriptor),
          authority
        );
      }, binding),
    [publish.execute]
  );
  return useMemo(
    () => ({ publishEvent, controller: publish.controller }),
    [publish.controller, publishEvent]
  );
}
