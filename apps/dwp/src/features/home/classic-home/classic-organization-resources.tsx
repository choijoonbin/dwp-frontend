import { useTranslation } from 'react-i18next';
import { BookOpenText, Building2, Headphones, Laptop2 } from 'lucide-react';
import { foundationTokens } from '@dwp-frontend/design-system/foundation';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { HomeContentState } from '../runtime/home-content-state';

import type { HomeContentStateKind } from '../runtime/home-content-state';

const resourceCards = [
  { key: 'handbook', icon: BookOpenText, href: '/apps?app=ref-app-knowledge' },
  { key: 'onboarding', icon: Building2, href: '/hr' },
  { key: 'workplace', icon: Laptop2, href: '/workplace/home' },
  { key: 'it', icon: Headphones, href: '/services' },
] as const;

const classicResourceTypography = {
  caption: foundationTokens.home.typography.captionSize,
  supporting: foundationTokens.home.typography.supportingSize,
  card: foundationTokens.home.typography.cardSize,
  sectionMobile: foundationTokens.home.typography.mobileHeroSize - 4,
  sectionDesktop: foundationTokens.home.typography.mobileHeroSize,
} as const;

const classicResourceFocusOutline = `2px solid ${foundationTokens.color.product.primary}`;

export type ClassicOrganizationResourceState = Readonly<{
  kind:
    | 'ready'
    | Extract<
        HomeContentStateKind,
        'initial-loading' | 'background-refresh' | 'empty' | 'partial' | 'forbidden' | 'stale'
      >;
  lastSuccessfulAt?: string;
  targetKey?: (typeof resourceCards)[number]['key'];
  source?: string;
  onRetry?: () => void;
  busy?: boolean;
}>;

function ResourceCard({
  resourceKey,
  href,
  icon: Icon,
}: {
  resourceKey: (typeof resourceCards)[number]['key'];
  href: string;
  icon: (typeof resourceCards)[number]['icon'];
}) {
  const { t } = useTranslation('home');
  return (
    <Box
      component="a"
      href={href}
      data-classic-resource-card={resourceKey}
      sx={{
        minWidth: 0,
        minHeight: { xs: 88, md: 112 },
        p: { xs: 1.25, md: 2 },
        display: 'grid',
        gridTemplateColumns: { xs: '32px minmax(0, 1fr)', md: '36px minmax(0, 1fr)' },
        gridTemplateRows: 'auto auto auto',
        alignItems: 'center',
        columnGap: 1,
        textDecoration: 'none',
        color: 'text.primary',
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.home.radius.control,
        '&:hover': { borderColor: 'primary.light', bgcolor: 'action.hover' },
        '&:focus-visible': {
          outline: classicResourceFocusOutline,
          outlineOffset: 2,
        },
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: { xs: 30, md: 36 },
          height: { xs: 30, md: 36 },
          display: 'grid',
          gridRow: '1 / span 3',
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
        sx={{
          gridColumn: 2,
          gridRow: 1,
          fontSize: {
            xs: classicResourceTypography.supporting,
            md: classicResourceTypography.card,
          },
        }}
      >
        {t(`classic.resources.cards.${resourceKey}.title`)}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          gridColumn: 2,
          gridRow: 2,
          mt: 0.25,
          fontSize: classicResourceTypography.caption,
          display: { xs: 'none', md: 'block' },
        }}
      >
        {t(`classic.resources.cards.${resourceKey}.description`)}
      </Typography>
      <Typography
        component="span"
        color="primary.main"
        sx={{
          gridColumn: 2,
          gridRow: 3,
          alignSelf: 'start',
          fontSize: classicResourceTypography.caption,
          fontWeight: foundationTokens.home.typography.weightBold,
        }}
      >
        {t(`classic.resources.cards.${resourceKey}.action`)}
      </Typography>
    </Box>
  );
}

export function ClassicOrganizationResources({
  resourceState = { kind: 'ready' },
}: {
  resourceState?: ClassicOrganizationResourceState;
}) {
  const { t } = useTranslation('home');
  const targetKey = resourceState.targetKey ?? 'handbook';
  const source = resourceState.source ?? 'DWP_KNOWLEDGE';
  return (
    <Box
      component="section"
      aria-labelledby="classic-organization-resources-title"
      data-classic-organization-resources
      sx={{ mt: { xs: 2, md: 4 } }}
    >
      <Typography
        id="classic-organization-resources-title"
        component="h2"
        variant="h6"
        fontWeight={foundationTokens.home.typography.weightEmphasis}
      >
        {t('classic.resources.knowledgeTitle')}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          mt: 0.25,
          mb: 1,
          fontSize: {
            xs: classicResourceTypography.caption,
            md: classicResourceTypography.card,
          },
        }}
      >
        {t('classic.resources.knowledgeDescription')}
      </Typography>
      <Box
        data-classic-resource-grid
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(4, minmax(0, 1fr))',
          },
          gap: { xs: 1, md: 1.5 },
        }}
      >
        {resourceCards.map(({ key, icon, href }) => {
          const resourceCard = <ResourceCard resourceKey={key} icon={icon} href={href} />;
          if (key !== targetKey || resourceState.kind === 'ready') {
            return <Box key={key}>{resourceCard}</Box>;
          }
          const preservesContent = ['background-refresh', 'partial', 'stale'].includes(
            resourceState.kind
          );
          return (
            <Box
              key={key}
              data-classic-resource-state-region={targetKey}
              data-classic-resource-source={source}
              sx={{ minWidth: 0, gridColumn: '1 / -1' }}
            >
              <HomeContentState
                kind={resourceState.kind}
                title={t(`classic.resources.states.${resourceState.kind}.title`)}
                description={t(`classic.resources.states.${resourceState.kind}.description`)}
                affectedSources={[source]}
                lastSuccessfulAt={resourceState.lastSuccessfulAt}
                onAction={
                  ['empty', 'partial', 'stale'].includes(resourceState.kind)
                    ? resourceState.onRetry
                    : undefined
                }
                busy={resourceState.busy}
                preservedContent={preservesContent ? resourceCard : undefined}
                size="standard"
              />
            </Box>
          );
        })}
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
    <Stack sx={{ mb: { xs: 1, md: 1.5 } }}>
      <Typography
        id={id}
        component="h2"
        variant="h6"
        fontWeight={foundationTokens.home.typography.weightEmphasis}
        sx={{
          fontSize: {
            xs: classicResourceTypography.sectionMobile,
            md: classicResourceTypography.sectionDesktop,
          },
        }}
      >
        {title}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          fontSize: {
            xs: classicResourceTypography.caption,
            md: classicResourceTypography.card,
          },
        }}
      >
        {description}
      </Typography>
    </Stack>
  );
}
