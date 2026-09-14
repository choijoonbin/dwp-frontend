import { useCallback, useRef, useState } from 'react';
import { readApprovalRetentionRules } from '@dwp-frontend/shared-utils/api/approval-retention-contract';
import type {
  ApprovalRetentionPolicy,
  ApprovalRetentionRules,
} from '@dwp-frontend/shared-utils/api/approval-retention-contract';
import type { ApprovalRetentionPolicyEditor } from './approval-retention-policy-panel';

export function useApprovalRetentionPolicyDraft() {
  const [editor, displayEditor] = useState<ApprovalRetentionPolicyEditor | null>(null);
  const preserved = useRef<ApprovalRetentionPolicyEditor | null>(null);
  const setEditor = useCallback((next: ApprovalRetentionPolicyEditor | null) => {
    if (next == null) {
      if (!preserved.current?.attempt) preserved.current = null;
      displayEditor(null);
      return;
    }
    // A closed uncertain attempt stays private; reopening cannot replace its body or key.
    const value = preserved.current?.attempt ? preserved.current : next;
    preserved.current = value;
    displayEditor(value);
  }, []);
  const prepare = useCallback(
    (original: Readonly<ApprovalRetentionPolicy>, rules: Readonly<ApprovalRetentionRules>) => {
      const current = preserved.current;
      if (!current || current.original !== original) throw new Error('Retention draft changed');
      if (current.attempt) return current.attempt;
      const attempt = Object.freeze({
        idempotencyKey: crypto.randomUUID(),
        rules: readApprovalRetentionRules(rules),
      });
      const value = { ...current, rules: attempt.rules, attempt };
      preserved.current = value;
      displayEditor(value);
      return attempt;
    },
    []
  );
  const complete = useCallback((key: string) => {
    if (preserved.current?.attempt?.idempotencyKey !== key) return;
    preserved.current = null;
    displayEditor(null);
  }, []);
  const reset = useCallback(() => {
    preserved.current = null;
    displayEditor(null);
  }, []);
  return { editor, setEditor, prepare, complete, reset };
}
