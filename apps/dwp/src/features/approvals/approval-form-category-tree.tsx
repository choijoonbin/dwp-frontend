import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Folder, PencilLine } from 'lucide-react';
import { ActionIconButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';

import {
  approvalCategoryHasChildren,
  approvalCategoryParent,
  visibleApprovalCategories,
} from './approval-form-category-navigation';

import type { ApprovalCategoryEntry } from './approval-form-category-navigation';
import type { ApprovalFormCategory } from '@dwp-frontend/shared-utils';

export function ApprovalFormCategoryTree({
  entries,
  total,
  selectedId,
  korean,
  onSelect,
  onEdit,
}: {
  entries: readonly ApprovalCategoryEntry[];
  total: number;
  selectedId: string;
  korean: boolean;
  onSelect: (id: string) => void;
  onEdit?: (category: ApprovalFormCategory) => void;
}) {
  const { t } = useTranslation('approvals');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [focusedId, setFocusedId] = useState(selectedId);
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const visible = useMemo(
    () => visibleApprovalCategories(entries, collapsed),
    [entries, collapsed]
  );
  const ids = ['ALL', ...visible.map((entry) => entry.category.categoryId)];
  const activeId = ids.includes(focusedId) ? focusedId : 'ALL';

  useEffect(() => {
    setFocusedId(selectedId);
  }, [selectedId]);

  const focus = (id: string) => {
    setFocusedId(id);
    refs.current.get(id)?.focus();
  };
  const toggle = (id: string, collapse: boolean) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (collapse) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const rows = [
    { id: 'ALL', label: t('admin.formCatalog.categories.all'), depth: 0, count: total },
    ...visible.map(({ category, depth, count }) => ({
      id: category.categoryId,
      label: korean ? category.nameKo : category.nameEn,
      depth,
      count,
      category,
    })),
  ];

  return (
    <Box
      component="ul"
      role="tree"
      aria-label={t('admin.formCatalog.categories.title')}
      sx={{ m: 0, p: 0, listStyle: 'none' }}
    >
      {rows.map((row, index) => {
        const category = 'category' in row ? row.category : undefined;
        const hasChildren = approvalCategoryHasChildren(entries, row.id);
        const expanded = hasChildren && !collapsed.has(row.id);
        const selected = selectedId === row.id;
        return (
          <Box
            component="li"
            role="none"
            key={row.id}
            sx={{ display: 'flex', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}
          >
            <Box
              sx={{
                pl: 0.5 + Math.min(row.depth, 4),
                width: 44 + Math.min(row.depth, 4) * 8,
                flexShrink: 0,
              }}
            >
              {hasChildren ? (
                <ActionIconButton
                  size="small"
                  label={t(
                    expanded
                      ? 'admin.formCatalog.categories.collapse'
                      : 'admin.formCatalog.categories.expand',
                    { name: row.label }
                  )}
                  tabIndex={-1}
                  onClick={() => {
                    toggle(row.id, expanded);
                    focus(row.id);
                  }}
                >
                  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </ActionIconButton>
              ) : (
                <Folder size={16} />
              )}
            </Box>
            <ButtonBase
              role="treeitem"
              aria-level={row.depth + 1}
              aria-expanded={hasChildren ? expanded : undefined}
              aria-selected={selected}
              aria-label={row.label}
              tabIndex={row.id === activeId ? 0 : -1}
              ref={(element: HTMLButtonElement | null) => {
                if (element) refs.current.set(row.id, element);
                else refs.current.delete(row.id);
              }}
              onFocus={() => setFocusedId(row.id)}
              onClick={() => onSelect(row.id)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  focus(
                    rows[
                      Math.max(
                        0,
                        Math.min(rows.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))
                      )
                    ].id
                  );
                } else if (event.key === 'Home' || event.key === 'End') {
                  event.preventDefault();
                  focus(rows[event.key === 'Home' ? 0 : rows.length - 1].id);
                } else if (event.key === 'ArrowRight' && hasChildren) {
                  event.preventDefault();
                  if (!expanded) toggle(row.id, false);
                  else focus(rows[index + 1]?.id ?? row.id);
                } else if (event.key === 'ArrowLeft') {
                  event.preventDefault();
                  if (expanded) toggle(row.id, true);
                  else focus(approvalCategoryParent(entries, row.id));
                }
              }}
              sx={{
                flex: 1,
                minWidth: 0,
                minHeight: 52,
                px: 1,
                gap: 1,
                textAlign: 'left',
                justifyContent: 'flex-start',
                bgcolor: selected ? 'action.selected' : 'transparent',
              }}
            >
              <Box
                sx={{
                  flex: 1,
                  minWidth: 0,
                  typography: 'body2',
                  overflowWrap: 'anywhere',
                  fontWeight: selected ? 'fontWeightBold' : 'fontWeightMedium',
                }}
              >
                {row.label}
              </Box>
              {category?.lifecycleState === 'INACTIVE' ? (
                <Chip
                  size="small"
                  variant="outlined"
                  label={t('admin.formCatalog.categoryEditor.inactive')}
                />
              ) : null}
              <Chip size="small" label={row.count} />
            </ButtonBase>
            {category && selected && onEdit ? (
              <ActionIconButton
                size="small"
                label={t('admin.formCatalog.categories.edit', { name: row.label })}
                onClick={() => onEdit(category)}
              >
                <PencilLine size={15} />
              </ActionIconButton>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
}
