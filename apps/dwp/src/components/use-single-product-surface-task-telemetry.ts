import { useCallback, useEffect, useRef } from 'react';

import {
  classifyProductSurfaceTaskFailure,
  ProductSurfaceMutationAuthorityError,
} from './use-product-surface-governed-mutation';
import {
  useProductSurfaceTelemetry,
  type ProductSurfaceTimedAttempt,
} from '../observability/product-surface-telemetry-context';

import type { ProductSurfaceTaskKind } from '@dwp-frontend/shared-utils/api/observability-api';

/** One long-lived task journey, used by multi-step commands such as step-up protected publishing. */
export function useSingleProductSurfaceTaskTelemetry(binding: {
  productKey: string;
  surfaceKey: string;
  taskKind: ProductSurfaceTaskKind;
}) {
  const telemetry = useProductSurfaceTelemetry();
  const taskRef = useRef<ProductSurfaceTimedAttempt | null>(null);
  const { productKey, surfaceKey, taskKind } = binding;

  const begin = useCallback(() => {
    if (taskRef.current) return taskRef.current;
    const task = telemetry.beginTask(productKey, surfaceKey, taskKind);
    taskRef.current = task;
    return task;
  }, [productKey, surfaceKey, taskKind, telemetry]);

  const complete = useCallback(() => {
    const task = taskRef.current;
    if (!task) return;
    taskRef.current = null;
    telemetry.completeTask(productKey, surfaceKey, taskKind, task.attemptId, task.startedAtMs);
  }, [productKey, surfaceKey, taskKind, telemetry]);

  const fail = useCallback(
    (caught: unknown) => {
      const task = taskRef.current;
      if (!task) return;
      taskRef.current = null;
      const failure = classifyProductSurfaceTaskFailure(caught);
      if (failure.kind === 'abandoned') {
        telemetry.abandonTask(productKey, surfaceKey, taskKind, task.attemptId, task.startedAtMs);
      } else {
        telemetry.failTask(productKey, surfaceKey, taskKind, task.attemptId, failure.reasonCode);
      }
    },
    [productKey, surfaceKey, taskKind, telemetry]
  );

  const abandon = useCallback(() => {
    const task = taskRef.current;
    if (!task) return;
    taskRef.current = null;
    telemetry.abandonTask(productKey, surfaceKey, taskKind, task.attemptId, task.startedAtMs);
  }, [productKey, surfaceKey, taskKind, telemetry]);

  const failAuthority = useCallback(() => {
    fail(new ProductSurfaceMutationAuthorityError());
  }, [fail]);

  useEffect(() => abandon, [abandon]);

  return { begin, complete, fail, failAuthority, abandon } as const;
}
