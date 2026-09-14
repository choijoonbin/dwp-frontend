import { useCallback, useEffect, useRef, useState } from 'react';
import { HttpError } from '@dwp-frontend/shared-utils';

import { approvalRequestFieldValue } from './approval-request-schema-model';

import type { ApprovalTypedFormEvaluation } from '@dwp-frontend/shared-utils';
import type { CompiledApprovalTypedForm } from './approval-form-typed-model';
import type {
  ApprovalRequestUserContext,
  ApprovalRequestUserSourceState,
} from './approval-request-user-picker';

export function useApprovalRequestUserSource({
  identity,
  binding,
  compiled,
  evaluation,
  values,
}: {
  identity: string;
  binding?: ApprovalRequestUserContext;
  compiled?: CompiledApprovalTypedForm;
  evaluation?: ApprovalTypedFormEvaluation;
  values: Readonly<Record<string, unknown>>;
}) {
  const generation = JSON.stringify([identity, binding, compiled?.schemaSha256]);
  const paths: string[] = [];
  const visible = new Set(evaluation?.visibleFields);
  for (const field of compiled?.definition.fields ?? []) {
    if (evaluation && !visible.has(field.key)) continue;
    if (field.type === 'USER') paths.push(field.key);
    if (field.type === 'REPEATING_GROUP') {
      const rows = values[field.key];
      if (!Array.isArray(rows)) continue;
      rows.forEach((_, index) =>
        field.fields.forEach((child) => {
          const path = `${field.key}[${index}].${child.key}`;
          if (child.type === 'USER' && (!evaluation || visible.has(path))) paths.push(path);
        })
      );
    }
  }
  const [reports, setReported] = useState({
    generation,
    entries: new Map<string, ApprovalRequestUserSourceState>(),
  });
  const reported =
    reports.generation === generation
      ? reports.entries
      : new Map<string, ApprovalRequestUserSourceState>();
  const current = useRef({ generation, paths, values, reported, binding });
  current.current = { generation, paths, values, reported, binding };
  useEffect(() => {
    setReported((previous) =>
      previous.generation === generation ? previous : { generation, entries: new Map() }
    );
  }, [generation]);
  const isReady = useCallback(() => {
    const latest = current.current;
    return latest.paths.every((path) => {
      const value = approvalRequestFieldValue(latest.values, path) ?? '';
      const state = latest.reported.get(JSON.stringify([latest.generation, path, value]));
      return Boolean(
        state?.ready &&
        (!state.isCurrent || state.isCurrent()) &&
        (!value || (state.validUntil && Date.parse(state.validUntil) > Date.now()))
      );
    });
  }, []);
  const report = useCallback(
    (path: string, value: unknown, state: ApprovalRequestUserSourceState) => {
      if (current.current.generation !== generation) return;
      const entryKey = JSON.stringify([generation, path, value]);
      setReported((previous) => {
        const entries =
          previous.generation === generation
            ? previous.entries
            : new Map<string, ApprovalRequestUserSourceState>();
        const existing = entries.get(entryKey);
        if (existing?.ready === state.ready && existing?.validUntil === state.validUntil)
          return previous;
        return { generation, entries: new Map(entries).set(entryKey, state) };
      });
    },
    [generation]
  );
  const waitForOwner = async (requestId: string, version: number, isCurrent: () => boolean) => {
    if (current.current.paths.length === 0) return;
    const deadline = Date.now() + 5000;
    while (isCurrent() && Date.now() < deadline) {
      const latest = current.current;
      if (
        latest.binding?.requestId === requestId &&
        latest.binding.requestVersion === version &&
        isReady()
      )
        return;
      await new Promise((resolve) => window.setTimeout(resolve, 25));
    }
    throw new HttpError(
      'Current user source could not be verified for the saved request version.',
      503
    );
  };
  return { binding, ready: isReady(), isReady, report, waitForOwner };
}
