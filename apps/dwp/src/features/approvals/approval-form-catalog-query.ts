import type { ApprovalForm } from '@dwp-frontend/shared-utils';

export type ApprovalFormCatalogSort = 'updated' | 'name';

export function queryApprovalFormCatalog(
  forms: readonly ApprovalForm[],
  options: {
    search: string;
    categoryIds: ReadonlySet<string> | null;
    lifecycle: string;
    sort: ApprovalFormCatalogSort;
    locale: 'ko' | 'en';
  }
): ApprovalForm[] {
  const needle = options.search.trim().toLocaleLowerCase(options.locale);
  return forms
    .filter((form) => {
      if (options.categoryIds && !options.categoryIds.has(form.categoryId)) return false;
      if (options.lifecycle !== 'ALL' && form.lifecycleState !== options.lifecycle) return false;
      return (
        !needle ||
        [
          form.formKey,
          form.nameKo,
          form.nameEn,
          form.ownerGroupRef,
          form.descriptionKo,
          form.descriptionEn,
        ]
          .join(' ')
          .toLocaleLowerCase(options.locale)
          .includes(needle)
      );
    })
    .sort((left, right) => {
      if (options.sort === 'updated') {
        const leftTime = Date.parse(left.updatedAt);
        const rightTime = Date.parse(right.updatedAt);
        const difference =
          (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
        if (difference) return difference;
      } else {
        const leftName = options.locale === 'ko' ? left.nameKo : left.nameEn;
        const rightName = options.locale === 'ko' ? right.nameKo : right.nameEn;
        const difference = leftName.localeCompare(rightName, options.locale);
        if (difference) return difference;
      }
      return left.formKey.localeCompare(right.formKey) || left.formId.localeCompare(right.formId);
    });
}
