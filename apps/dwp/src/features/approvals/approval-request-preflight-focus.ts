export function approvalRequestIssueTarget(
  path: string,
  root: ParentNode = document
): HTMLElement | undefined {
  const fixedId =
    path === '$title'
      ? 'approval-request-title'
      : path === '$summary'
        ? 'approval-request-summary'
        : path === '$business-fields'
          ? 'approval-request-business-fields'
          : `approval-request-${path}`;
  const direct = Array.from(root.querySelectorAll<HTMLElement>('[id]')).find(
    (candidate) => candidate.id === fixedId
  );
  if (direct) return direct;
  const field = Array.from(root.querySelectorAll<HTMLElement>('[data-approval-field-path]')).find(
    (candidate) => candidate.dataset.approvalFieldPath === path
  );
  return (
    field?.querySelector<HTMLElement>(
      'input:not(:disabled), textarea:not(:disabled), button:not(:disabled), [tabindex]:not([tabindex="-1"])'
    ) ?? field
  );
}

export function focusApprovalRequestIssue(path: string, root: ParentNode = document): boolean {
  const target = approvalRequestIssueTarget(path, root);
  if (!target) return false;
  target.focus();
  target.scrollIntoView?.({ block: 'center', inline: 'nearest' });
  return document.activeElement === target;
}
