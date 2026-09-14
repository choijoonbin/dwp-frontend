import type { ApprovalFormCategory } from '@dwp-frontend/shared-utils';

export type ApprovalCategoryEntry = {
  category: ApprovalFormCategory;
  depth: number;
  count: number;
};

export function visibleApprovalCategories(
  entries: readonly ApprovalCategoryEntry[],
  collapsed: ReadonlySet<string>
): ApprovalCategoryEntry[] {
  let hiddenDepth: number | null = null;
  return entries.filter((entry) => {
    if (hiddenDepth !== null && entry.depth > hiddenDepth) return false;
    hiddenDepth = collapsed.has(entry.category.categoryId) ? entry.depth : null;
    return true;
  });
}

export function approvalCategoryHasChildren(
  entries: readonly ApprovalCategoryEntry[],
  id: string
): boolean {
  const index = entries.findIndex((entry) => entry.category.categoryId === id);
  return index >= 0 && (entries[index + 1]?.depth ?? -1) > entries[index].depth;
}

export function approvalCategoryParent(
  entries: readonly ApprovalCategoryEntry[],
  id: string
): string {
  const index = entries.findIndex((entry) => entry.category.categoryId === id);
  const depth = entries[index]?.depth ?? 0;
  for (let parent = index - 1; parent >= 0; parent -= 1) {
    if (entries[parent].depth < depth) return entries[parent].category.categoryId;
  }
  return 'ALL';
}
