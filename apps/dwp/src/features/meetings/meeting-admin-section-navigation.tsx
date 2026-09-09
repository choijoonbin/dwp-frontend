import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { ConfirmDialog } from '@dwp-frontend/design-system';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

export function MeetingAdminSectionNavigation({
  dirty = false,
  disabled = false,
}: {
  dirty?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation('meetings');
  const [params, setParams] = useSearchParams();
  const [requested, setRequested] = useState<string | null>(null);
  const section = params.get('section') === 'templates' ? 'templates' : 'policy';
  const changeSection = (value: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value === 'templates') next.set('section', value);
      else next.delete('section');
      return next;
    });
  return (
    <>
      <Tabs
        value={section}
        aria-label={t('admin.templates.navigation')}
        sx={{
          mb: 2,
          '&& .MuiTab-root.MuiTab-textColorPrimary': { color: 'text.primary' },
          '&& .MuiTab-root.MuiTab-textColorPrimary.Mui-selected': { color: 'primary.main' },
        }}
        variant="fullWidth"
        onChange={(_, value: string) => (dirty ? setRequested(value) : changeSection(value))}
      >
        <Tab
          value="policy"
          label={t('admin.templates.policyTab')}
          disabled={disabled}
          sx={{ minHeight: 44, minWidth: 0 }}
        />
        <Tab
          value="templates"
          label={t('admin.templates.title')}
          disabled={disabled}
          sx={{ minHeight: 44, minWidth: 0 }}
        />
      </Tabs>
      <ConfirmDialog
        open={requested !== null}
        title={t('admin.templates.discardPolicyTitle')}
        description={t('admin.templates.discardPolicyHint')}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('admin.templates.discard')}
        intent="danger"
        onClose={() => setRequested(null)}
        onConfirm={() => {
          if (requested) changeSection(requested);
          setRequested(null);
        }}
      />
    </>
  );
}
