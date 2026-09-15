import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, FileStack, FolderTree, PanelRight } from 'lucide-react';
import { ActionIconButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import {
  focusApprovalLabeledControl,
  focusApprovalRegion,
  focusApprovalSelector,
} from './approval-focus-navigation';

import type { ReactNode } from 'react';

export type ApprovalFormCatalogPanel = 'categories' | 'forms' | 'inspector';

export function ApprovalFormCatalogWorkspace({
  panel,
  onPanelChange,
  categories,
  forms,
  inspector,
}: {
  panel: ApprovalFormCatalogPanel;
  onPanelChange: (panel: ApprovalFormCatalogPanel) => void;
  categories: ReactNode;
  forms: ReactNode;
  inspector: ReactNode;
}) {
  const { t } = useTranslation('approvals');
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('lg'));
  const categoriesRef = useRef<HTMLDivElement>(null);
  const formsRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);
  const previousPanel = useRef(panel);

  useEffect(() => {
    const previous = previousPanel.current;
    previousPanel.current = panel;
    if (!compact || previous === panel) return;
    const frame = window.requestAnimationFrame(() => {
      if (panel === 'categories') {
        focusApprovalSelector(
          categoriesRef.current,
          '[role="treeitem"][aria-selected="true"], [role="treeitem"][tabindex="0"]'
        );
        return;
      }
      if (panel === 'forms') {
        if (focusApprovalSelector(formsRef.current, '[aria-current="true"]')) return;
        if (focusApprovalSelector(formsRef.current, 'ul button')) return;
        focusApprovalLabeledControl(formsRef.current, null);
        return;
      }
      focusApprovalRegion(inspectorRef.current, 'start');
    });
    return () => window.cancelAnimationFrame(frame);
  }, [compact, panel]);

  return (
    <Box>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ display: { xs: 'flex', lg: 'none' }, mb: 1.5 }}
      >
        <Stack
          direction="row"
          gap={0.5}
          role="group"
          aria-label={t('admin.formCatalog.mobile.navigation')}
        >
          {(
            [
              ['categories', 'admin.formCatalog.categories.title', FolderTree],
              ['forms', 'admin.formCatalog.forms.title', FileStack],
              ['inspector', 'admin.formCatalog.mobile.inspector', PanelRight],
            ] as const
          ).map(([value, label, Icon]) => (
            <ActionIconButton
              key={value}
              label={t(label)}
              aria-pressed={panel === value}
              intent={panel === value ? 'primary' : 'default'}
              onClick={() => onPanelChange(value)}
            >
              <Icon size={18} />
            </ActionIconButton>
          ))}
        </Stack>
        {panel === 'inspector' ? (
          <ActionIconButton
            label={t('admin.formCatalog.mobile.backToForms')}
            onClick={() => onPanelChange('forms')}
          >
            <ArrowLeft size={18} />
          </ActionIconButton>
        ) : null}
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0,1fr)',
            lg: 'minmax(190px,.6fr) minmax(280px,1fr) minmax(0,1.5fr)',
          },
          gap: 1.5,
          alignItems: 'start',
        }}
      >
        <Box
          ref={categoriesRef}
          sx={{
            minWidth: 0,
            display: { xs: panel === 'categories' ? 'block' : 'none', lg: 'block' },
          }}
        >
          {categories}
        </Box>
        <Box
          ref={formsRef}
          sx={{ minWidth: 0, display: { xs: panel === 'forms' ? 'block' : 'none', lg: 'block' } }}
        >
          {forms}
        </Box>
        <Box
          ref={inspectorRef}
          role="region"
          aria-label={t('admin.formCatalog.mobile.inspector')}
          tabIndex={-1}
          sx={{
            minWidth: 0,
            display: { xs: panel === 'inspector' ? 'block' : 'none', lg: 'block' },
          }}
        >
          {inspector}
        </Box>
      </Box>
    </Box>
  );
}
