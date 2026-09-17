function enabled(element: HTMLElement | null): element is HTMLElement {
  return Boolean(
    element &&
    !element.hasAttribute('disabled') &&
    element.getAttribute('aria-disabled') !== 'true' &&
    !element.closest('[hidden]')
  );
}

function focus(element: HTMLElement | null, block: ScrollLogicalPosition): boolean {
  if (!enabled(element)) return false;
  element.focus({ preventScroll: true });
  element.scrollIntoView?.({ behavior: 'auto', block });
  return true;
}

export function focusApprovalSelector(
  root: HTMLElement | null,
  selector: string,
  block: ScrollLogicalPosition = 'nearest'
): boolean {
  return Boolean(root && focus(root.querySelector<HTMLElement>(selector), block));
}

export function focusApprovalRegion(
  root: HTMLElement | null,
  block: ScrollLogicalPosition = 'nearest'
): boolean {
  return focus(root, block);
}

export function focusApprovalLabeledControl(
  root: HTMLElement | null,
  label: string | null,
  block: ScrollLogicalPosition = 'nearest',
  occurrence = 0
): boolean {
  if (!root) return false;
  if (label) {
    const normalized = label.trim();
    const matchingLabel = Array.from(root.querySelectorAll('label')).filter(
      (candidate) => candidate.textContent?.replace(/\s*\*\s*$/u, '').trim() === normalized
    )[occurrence];
    const control =
      matchingLabel instanceof HTMLLabelElement
        ? (matchingLabel.control ??
          (matchingLabel.htmlFor ? document.getElementById(matchingLabel.htmlFor) : null))
        : null;
    if (control instanceof HTMLElement && root.contains(control) && focus(control, block))
      return true;
  }
  const fallback = root.querySelector<HTMLElement>(
    'input:not(:disabled), textarea:not(:disabled), button:not(:disabled), [role="combobox"]:not([aria-disabled="true"]), [tabindex="0"]'
  );
  return focus(fallback, block) || focus(root, block);
}
