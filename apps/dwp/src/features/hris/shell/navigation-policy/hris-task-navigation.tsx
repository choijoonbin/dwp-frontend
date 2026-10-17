import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { ActionButton } from '@dwp-frontend/design-system/components/actions';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  projectHrisWorkbenchTaskNavigation,
  useHrisRuntimeNavigationPolicy,
} from './hris-navigation-policy-runtime';
import { selectHrisLegalEntitySelector } from './hris-legal-entity-selector';

import type { ProductAreaNavigationItemChildrenContext } from '../../../../layouts/product-area-layout';

export function HrisTaskNavigation({
  item,
  selected,
  onNavigate,
}: ProductAreaNavigationItemChildrenContext) {
  const { i18n } = useTranslation('hcm');
  const location = useLocation();
  const policy = useHrisRuntimeNavigationPolicy();
  if (!selected || policy.mode !== 'ENFORCED') return null;

  const authorizedPaths = new Set([item.path, ...(item.activePathPrefixes ?? [])]);
  const groups = projectHrisWorkbenchTaskNavigation(policy, item.view, authorizedPaths);
  if (!groups.length) return null;
  const locale = i18n.resolvedLanguage?.startsWith('ko') ? 'ko' : 'en';
  const currentPath = normalizePath(location.pathname);

  return (
    <Box
      data-testid={`hris-task-navigation-${item.view}`}
      data-policy-revision={policy.revisionPin}
      sx={{ ml: 2.5, pl: 1, mt: 0.5, mb: 1, borderLeft: 1, borderColor: 'divider' }}
    >
      <Stack component="ul" gap={1} sx={{ p: 0, m: 0, listStyle: 'none' }}>
        {groups.map((group) => (
          <Box component="li" key={group.groupId} minWidth={0}>
            <Typography
              component="h3"
              variant="caption"
              color="text.secondary"
              fontWeight={700}
              sx={{ px: 1, pb: 0.25, overflowWrap: 'anywhere' }}
            >
              {group.label[locale]}
            </Typography>
            <Stack component="ul" gap={0.25} sx={{ p: 0, m: 0, listStyle: 'none' }}>
              {group.nodes.map((node) => {
                const route = node.routeAliases[0]!;
                const active = currentPath === normalizePath(route);
                return (
                  <Box component="li" key={node.nodeId} minWidth={0}>
                    <ActionButton
                      component={NavLink}
                      to={resolveTaskLocationHref(route, location.search)}
                      data-testid={`hris-task-node-${node.nodeId}`}
                      aria-current={active ? 'page' : undefined}
                      intent="quiet"
                      fullWidth
                      size="small"
                      onClick={onNavigate}
                      sx={{
                        justifyContent: 'flex-start',
                        minHeight: 40,
                        px: 1,
                        borderRadius: foundationTokens.radius.control + 'px',
                        color: active ? 'var(--dwp-product-accent)' : 'text.secondary',
                        bgcolor: active ? 'var(--dwp-product-selection)' : 'transparent',
                        overflowWrap: 'anywhere',
                        textAlign: 'start',
                        '&:hover': { bgcolor: 'action.hover' },
                        '@media (forced-colors: active)': active
                          ? { outline: '2px solid Highlight', outlineOffset: -2 }
                          : undefined,
                        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                      }}
                    >
                      {node.label[locale]}
                    </ActionButton>
                  </Box>
                );
              })}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

export function renderHrisTaskNavigation(context: ProductAreaNavigationItemChildrenContext) {
  return context.selected && context.item.view.startsWith('workbench-') ? (
    <HrisTaskNavigation {...context} />
  ) : null;
}

function normalizePath(value: string) {
  const path = value.split(/[?#]/u, 1)[0] || '/';
  return path.length > 1 ? path.replace(/\/+$/u, '') : path;
}

export function resolveTaskLocation(route: string, currentSearch: string) {
  const target = new URL(route, 'https://dwp.invalid');
  const targetSearch = new URLSearchParams(target.search);
  const legalEntity = selectHrisLegalEntitySelector(new URLSearchParams(currentSearch));
  if (legalEntity.state === 'LEGAL_ENTITY' && legalEntity.legalEntityPublicId) {
    targetSearch.set('legalEntityPublicId', legalEntity.legalEntityPublicId);
  }
  return {
    pathname: target.pathname,
    search: targetSearch.size ? `?${targetSearch.toString()}` : '',
    hash: target.hash,
  };
}

function resolveTaskLocationHref(route: string, currentSearch: string) {
  const target = resolveTaskLocation(route, currentSearch);
  return `${target.pathname}${target.search}${target.hash}`;
}
