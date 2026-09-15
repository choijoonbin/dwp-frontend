import { useTranslation } from 'react-i18next';
import { BookOpenText, Building2, Headphones, Laptop2 } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import { foundationTokens } from '@dwp-frontend/design-system/foundation';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

const resourceCards = [
  { key: 'handbook', icon: BookOpenText, href: '/apps?app=ref-app-knowledge' },
  { key: 'onboarding', icon: Building2, href: '/hr' },
  { key: 'workplace', icon: Laptop2, href: '/workplace/home' },
  { key: 'it', icon: Headphones, href: '/services' },
] as const;

export function ClassicOrganizationResources() {
  const { t } = useTranslation('home');
  return (
    <Box
      component="section"
      aria-labelledby="classic-organization-resources-title"
      data-classic-organization-resources
      sx={{ mt: { xs: 3, md: 4 } }}
    >
      <Typography
        id="classic-organization-resources-title"
        component="h2"
        variant="h6"
        fontWeight={foundationTokens.home.typography.weightEmphasis}
      >
        {t('classic.resources.knowledgeTitle')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
        {t('classic.resources.knowledgeDescription')}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(4, minmax(0, 1fr))',
          },
          gap: 1.5,
        }}
      >
        {resourceCards.map(({ key, icon: Icon, href }) => (
          <Box
            component="article"
            key={key}
            data-classic-resource-card={key}
            sx={{
              minWidth: 0,
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: foundationTokens.home.radius.control,
            }}
          >
            <Box
              aria-hidden="true"
              sx={{
                width: 36,
                height: 36,
                display: 'grid',
                placeItems: 'center',
                color: 'primary.main',
                bgcolor: 'action.hover',
                borderRadius: foundationTokens.home.radius.control,
              }}
            >
              <Icon size={19} />
            </Box>
            <Typography
              component="h3"
              variant="subtitle2"
              fontWeight={foundationTokens.home.typography.weightBold}
              sx={{ mt: 1.25 }}
            >
              {t(`classic.resources.cards.${key}.title`)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t(`classic.resources.cards.${key}.description`)}
            </Typography>
            <ActionButton
              component="a"
              href={href}
              intent="quiet"
              size="small"
              sx={{ minHeight: 44, mt: 'auto', ml: -1 }}
            >
              {t(`classic.resources.cards.${key}.action`)}
            </ActionButton>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function ClassicSectionHeading({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  return (
    <Stack sx={{ mb: 1.5 }}>
      <Typography
        id={id}
        component="h2"
        variant="h6"
        fontWeight={foundationTokens.home.typography.weightEmphasis}
      >
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
    </Stack>
  );
}
