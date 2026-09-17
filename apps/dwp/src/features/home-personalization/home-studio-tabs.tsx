import { useTranslation } from 'react-i18next';

import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';

import type { homeStudioNavigation } from './home-studio-navigation';
import type { ActiveHomeStudioSection } from './home-personalization-studio-contracts';

export function HomeStudioTabs({
  advancedMode,
  fullScreen,
  items,
  onChange,
  presentation,
  value,
}: {
  advancedMode: boolean;
  fullScreen: boolean;
  items: ReturnType<typeof homeStudioNavigation>;
  onChange: (section: ActiveHomeStudioSection) => void;
  presentation: 'dialog' | 'page';
  value: ActiveHomeStudioSection;
}) {
  const { t } = useTranslation('homeStudio');
  const horizontal = fullScreen || advancedMode || presentation === 'page';

  return (
    <Tabs
      orientation={horizontal ? 'horizontal' : 'vertical'}
      variant="scrollable"
      allowScrollButtonsMobile
      value={value}
      onChange={(_, section: ActiveHomeStudioSection) => onChange(section)}
      aria-label={t('title')}
      sx={{
        borderRight: { md: horizontal ? 0 : 1 },
        borderBottom: { xs: 1, md: horizontal ? 1 : 0 },
        borderColor: 'divider',
        bgcolor: 'background.default',
        '& .MuiTab-root': {
          minHeight: 48,
          justifyContent: { md: horizontal ? 'center' : 'flex-start' },
          alignItems: 'center',
          textTransform: 'none',
          px: 2,
          gap: 1.25,
        },
      }}
    >
      {items.map(({ key, icon: Icon }) => (
        <Tab
          key={key}
          value={key}
          icon={<Icon size={17} aria-hidden="true" />}
          iconPosition="start"
          label={t(`sections.${key}`)}
        />
      ))}
    </Tabs>
  );
}
