import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, FileStack, FolderTree, PanelRight } from 'lucide-react';
import { ActionIconButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

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
  const formsRef = useRef<HTMLDivElement>(null);
  const previousPanel = useRef(panel);

  useEffect(() => {
    if (panel === 'forms' && previousPanel.current === 'inspector') {
      formsRef.current?.querySelector<HTMLElement>('[aria-current="true"]')?.focus();
    }
    previousPanel.current = panel;
  }, [panel]);

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
