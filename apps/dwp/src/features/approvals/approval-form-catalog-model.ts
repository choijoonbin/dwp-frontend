import type {
  ApprovalForm,
  ApprovalFormCategory,
  ApprovalFormField,
} from '@dwp-frontend/shared-utils';

export function validApprovalFormFields(fields: ApprovalFormField[]) {
  return (
    fields.length > 0 &&
    fields.every(
      (field) =>
        field.key.trim() &&
        field.labelKo?.trim() &&
        field.labelEn?.trim() &&
        (field.type !== 'SELECT' || new Set(field.options ?? []).size >= 2)
    ) &&
    new Set(fields.map((field) => field.key)).size === fields.length
  );
}

export function descendantCategoryIds(categories: ApprovalFormCategory[], rootId: string) {
  const children = new Map<string, string[]>();
  categories.forEach((category) => {
    if (!category.parentCategoryId) return;
    const siblings = children.get(category.parentCategoryId) ?? [];
    siblings.push(category.categoryId);
    children.set(category.parentCategoryId, siblings);
  });
  const result = new Set<string>();
  const pending = [rootId];
  while (pending.length) {
    const categoryId = pending.pop()!;
    if (result.has(categoryId)) continue;
    result.add(categoryId);
    pending.push(...(children.get(categoryId) ?? []));
  }
  return result;
}

export function buildApprovalFormCategoryTree(
  categories: ApprovalFormCategory[],
  forms: ApprovalForm[]
) {
  const byParent = new Map<string, ApprovalFormCategory[]>();
  categories.forEach((category) => {
    const parent = category.parentCategoryId ?? 'ROOT';
    const siblings = byParent.get(parent) ?? [];
    siblings.push(category);
    byParent.set(parent, siblings);
  });
  byParent.forEach((siblings) =>
    siblings.sort(
      (left, right) => left.sortOrder - right.sortOrder || left.nameKo.localeCompare(right.nameKo)
    )
  );

  const result: Array<{ category: ApprovalFormCategory; depth: number; count: number }> = [];
  const visited = new Set<string>();
  const visit = (category: ApprovalFormCategory, depth: number) => {
    if (visited.has(category.categoryId)) return;
    visited.add(category.categoryId);
    const scope = descendantCategoryIds(categories, category.categoryId);
    result.push({
      category,
      depth,
      count: forms.filter((form) => scope.has(form.categoryId)).length,
    });
    (byParent.get(category.categoryId) ?? []).forEach((child) => visit(child, depth + 1));
  };
  (byParent.get('ROOT') ?? []).forEach((category) => visit(category, 0));
  categories.forEach((category) => visit(category, 0));
  return result;
}
