import { describe, expect, it } from 'vitest';

import {
  approvalCategoryHasChildren,
  approvalCategoryParent,
  visibleApprovalCategories,
} from './approval-form-category-navigation';

import type { ApprovalCategoryEntry } from './approval-form-category-navigation';
import type { ApprovalFormCategory } from '@dwp-frontend/shared-utils';

const entry = (id: string, depth: number): ApprovalCategoryEntry => ({
  category: { categoryId: id } as ApprovalFormCategory,
  depth,
  count: 1,
});
const entries = [
  entry('parent', 0),
  entry('child', 1),
  entry('grandchild', 2),
  entry('sibling', 1),
  entry('other', 0),
];

describe('approval category disclosure', () => {
  it('hides only descendants and preserves other branches', () => {
    expect(
      visibleApprovalCategories(entries, new Set(['parent'])).map(
        (item) => item.category.categoryId
      )
    ).toEqual(['parent', 'other']);
    expect(
      visibleApprovalCategories(entries, new Set(['child'])).map((item) => item.category.categoryId)
    ).toEqual(['parent', 'child', 'sibling', 'other']);
    expect(visibleApprovalCategories(entries, new Set())).toEqual(entries);
  });
  it('resolves disclosure and keyboard parent by the rendered hierarchy', () => {
    expect(approvalCategoryHasChildren(entries, 'child')).toBe(true);
    expect(approvalCategoryHasChildren(entries, 'sibling')).toBe(false);
    expect(approvalCategoryParent(entries, 'grandchild')).toBe('child');
    expect(approvalCategoryParent(entries, 'sibling')).toBe('parent');
    expect(approvalCategoryParent(entries, 'parent')).toBe('ALL');
  });
});
