import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Compass, Search } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { ActionButton } from '@dwp-frontend/design-system/components/actions';
import { FormField } from '@dwp-frontend/design-system/components/forms';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';
import { resolveSupportedLocale, type SupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';

import {
  HRIS_NAVIGATION_SCOPE_PARAM,
  projectHrisWorkbenchTaskNavigation,
  useHrisRuntimeNavigationPolicy,
} from './hris-navigation-policy-runtime';
import { selectHrisLegalEntitySelector } from './hris-legal-entity-selector';
import { useProductAreaAuthorizedNavigationPaths } from '../../../../components/product-area-authorized-navigation-context';
import { useWorkExplorerShortcutAccess } from '../../explorer/work-explorer-access';
import {
  canonicalHrisWorkbench,
  hrisWorkbenchIdForView,
} from './seven-workbench-navigation-policy';

import type { ProductAreaNavigationItemChildrenContext } from '../../../../layouts/product-area-layout';
import type { HrisTaskNavigationGroup } from './seven-workbench-navigation-policy';

function normalizedSearchText(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase();
}

export function filterHrisTaskNavigationGroups(
  groups: readonly HrisTaskNavigationGroup[],
  query: string,
  locale: SupportedLocale
): readonly HrisTaskNavigationGroup[] {
  const normalizedQuery = normalizedSearchText(query);
  if (!normalizedQuery) return groups;

  return groups.flatMap((group) => {
    const groupMatches = normalizedSearchText(group.label[locale]).includes(normalizedQuery);
    const nodes = groupMatches
      ? group.nodes
      : group.nodes.filter((node) =>
          normalizedSearchText(node.label[locale]).includes(normalizedQuery)
        );
    return nodes.length ? [{ ...group, nodes }] : [];
  });
}

export function resolveActiveHrisTaskNodeId(
  groups: readonly HrisTaskNavigationGroup[],
  pathname: string
): string | undefined {
  const currentPath = normalizePath(pathname);
  const matches = groups
    .flatMap((group) => group.nodes)
    .filter((node) =>
      node.routeAliases.some((candidate) => currentPath === normalizePath(candidate))
    );
  return matches.length === 1 ? matches[0]!.nodeId : undefined;
}

export function resolveHrisTaskNavigationColumnCount(
  groups: readonly HrisTaskNavigationGroup[]
): 1 | 2 {
  const taskCount = groups.reduce((count, group) => count + group.nodes.length, 0);
  return groups.length >= 4 && taskCount >= 8 ? 2 : 1;
}

export function HrisTaskNavigation({
  item,
  selected,
  compact,
  onNavigate,
  onNavigateToTarget,
  resolveNavigationLocation,
}: ProductAreaNavigationItemChildrenContext) {
  const { t, i18n } = useTranslation('hcm');
  const location = useLocation();
  const policy = useHrisRuntimeNavigationPolicy();
  const productAreaAuthorizedPaths = useProductAreaAuthorizedNavigationPaths();
  const workExplorerShortcut = useWorkExplorerShortcutAccess();
  const [query, setQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const restoreSearchFocusRef = useRef(false);
  const titleId = useId();
  useEffect(() => {
    if (!restoreSearchFocusRef.current || query) return;
    restoreSearchFocusRef.current = false;
    searchInputRef.current?.focus({ preventScroll: true });
  }, [query]);
  if (!selected) return null;

  const authorizedPaths =
    productAreaAuthorizedPaths ?? new Set([item.path, ...(item.activePathPrefixes ?? [])]);
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const workbenchId = hrisWorkbenchIdForView(item.view);
  const workbench = workbenchId ? canonicalHrisWorkbench(workbenchId) : undefined;
  if (!workbench) return null;
  const workbenchPresentationLabel = t(`navigation.items.hcm.${item.view}.label`);
  const policyUnavailable = policy.mode === 'FAIL_CLOSED';
  const groups = policyUnavailable
    ? []
    : projectHrisWorkbenchTaskNavigation(policy, item.view, authorizedPaths);
  const hasAuthorizedTasks = groups.length > 0;
  const authorizedTaskCount = groups.reduce((count, group) => count + group.nodes.length, 0);
  const showSearch = authorizedTaskCount >= 7;
  const sparseNavigation = !showSearch;
  const effectiveQuery = showSearch ? query : '';
  const filteredGroups = filterHrisTaskNavigationGroups(groups, effectiveQuery, locale);
  const filteredTaskCount = filteredGroups.reduce((count, group) => count + group.nodes.length, 0);
  const activeNodeId = resolveActiveHrisTaskNodeId(groups, location.pathname);
  const searching = normalizedSearchText(effectiveQuery).length > 0;
  const columnCount = resolveHrisTaskNavigationColumnCount(filteredGroups);
  const WorkbenchIcon = item.icon;
  const taskCountBadge = (
    <Box
      component="span"
      aria-label={t('navigation.taskPanel.allowedCount', {
        count: authorizedTaskCount,
      })}
      sx={{
        flexShrink: 0,
        px: 0.8,
        py: 0.2,
        border: 1,
        borderColor: 'var(--dwp-product-accent-border)',
        borderRadius: 99,
        bgcolor: 'background.paper',
        color: 'var(--dwp-product-accent)',
        fontSize: '0.6875rem',
        fontWeight: 760,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.45,
      }}
    >
      {t('navigation.taskPanel.taskCount', { count: authorizedTaskCount })}
    </Box>
  );

  const handOffNavigation = (targetLocation: string) => {
    if (onNavigateToTarget) {
      onNavigateToTarget(resolveHrisTaskNavigationFocusTarget, targetLocation);
    } else {
      onNavigate?.();
    }
  };

  return (
    <Box
      component="section"
      data-testid={`hris-task-navigation-${item.view}`}
      data-policy-revision={policy.revisionPin}
      data-authorized-task-count={authorizedTaskCount}
      data-filtered-task-count={filteredTaskCount}
      data-navigation-density={showSearch ? 'dense' : 'sparse'}
      aria-labelledby={titleId}
      sx={{ minWidth: 0, containerType: 'inline-size' }}
    >
      <Box
        component="header"
        sx={{
          position: compact ? 'static' : 'sticky',
          top: compact ? undefined : 0,
          zIndex: compact ? undefined : 2,
          px: compact ? 1.5 : { xs: 2, sm: 2.5 },
          pr: compact ? { xs: 2, sm: 2.5 } : { xs: 6.5, sm: 7 },
          pt: compact ? 1.25 : 2,
          pb: compact ? 1.25 : 1.75,
          bgcolor: 'var(--dwp-product-selection)',
          borderBottom: 1,
          borderColor: 'var(--dwp-product-accent-border)',
        }}
      >
        {compact ? (
          <>
            <Box component="span" id={titleId} sx={visuallyHidden}>
              {workbenchPresentationLabel}
            </Box>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 0 }}>
                {t('navigation.taskPanel.description')}
              </Typography>
              {taskCountBadge}
            </Stack>
          </>
        ) : (
          <>
            <Stack direction="row" alignItems="center" gap={1.25}>
              <Box
                data-testid="hris-task-navigation-workbench-icon"
                aria-hidden="true"
                sx={{
                  display: 'grid',
                  flex: '0 0 auto',
                  width: 40,
                  height: 40,
                  placeItems: 'center',
                  border: 1,
                  borderColor: 'var(--dwp-product-accent-border)',
                  borderRadius: `${foundationTokens.radius.surface}px`,
                  bgcolor: 'background.paper',
                  color: 'var(--dwp-product-accent)',
                }}
              >
                <WorkbenchIcon size={20} strokeWidth={1.8} />
              </Box>
              <Stack direction="row" alignItems="center" gap={1} minWidth={0} flex={1}>
                <Typography
                  id={titleId}
                  component="h2"
                  variant="h5"
                  fontWeight={820}
                  sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
                >
                  {workbenchPresentationLabel}
                </Typography>
                {taskCountBadge}
              </Stack>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t('navigation.taskPanel.description')}
            </Typography>
          </>
        )}
        {showSearch ? (
          <FormField
            value={query}
            inputRef={searchInputRef}
            size="small"
            autoComplete="off"
            placeholder={t('navigation.taskPanel.searchPlaceholder')}
            onChange={(event) => setQuery(event.target.value.slice(0, 120))}
            slotProps={{
              htmlInput: {
                maxLength: 120,
                'aria-label': t('navigation.taskPanel.searchLabel', {
                  workbench: workbenchPresentationLabel,
                }),
              },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={17} strokeWidth={1.8} aria-hidden="true" />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              mt: compact ? 1.25 : 1.5,
              '& .MuiOutlinedInput-root': {
                minHeight: 42,
                borderRadius: `${foundationTokens.radius.control}px`,
                bgcolor: 'background.paper',
                '& fieldset': { borderColor: 'var(--dwp-product-accent-border)' },
                '&:hover fieldset': { borderColor: 'var(--dwp-product-accent)' },
                '&.Mui-focused fieldset': {
                  borderColor: 'var(--dwp-product-accent)',
                  borderWidth: 2,
                },
              },
            }}
          />
        ) : null}
      </Box>

      {hasAuthorizedTasks ? (
        <Box
          role="status"
          aria-live="polite"
          aria-atomic="true"
          sx={
            searching
              ? {
                  px: { xs: 2, sm: 2.5 },
                  py: 0.85,
                  borderBottom: 1,
                  borderColor: 'divider',
                  bgcolor: 'background.default',
                }
              : visuallyHidden
          }
        >
          <Typography variant="caption" color="text.secondary" fontWeight={650}>
            {t('navigation.taskPanel.filteredCount', { count: filteredTaskCount })}
          </Typography>
        </Box>
      ) : null}

      {policyUnavailable ? (
        <TaskPanelEmptyState
          title={t('navigation.taskPanel.unavailableTitle')}
          description={t('navigation.taskPanel.unavailableDescription')}
        />
      ) : !hasAuthorizedTasks ? (
        <TaskPanelEmptyState
          title={t('navigation.taskPanel.noAccessTitle')}
          description={t('navigation.taskPanel.noAccessDescription')}
        />
      ) : filteredGroups.length ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: sparseNavigation ? 0.5 : 1.25,
            px: { xs: 2, sm: 2.5 },
            py: sparseNavigation ? 1.25 : 2,
            ...(columnCount === 2
              ? {
                  '@container (min-width: 470px)': {
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  },
                }
              : undefined),
          }}
        >
          {filteredGroups.map((group) => (
            <Box
              component="section"
              key={group.groupId}
              data-navigation-group-treatment={sparseNavigation ? 'flat' : 'card'}
              minWidth={0}
              aria-labelledby={`${titleId}-${group.groupId}`}
              sx={
                sparseNavigation
                  ? {
                      alignSelf: 'start',
                      py: 0.5,
                      '&:not(:last-of-type)': {
                        borderBottom: 1,
                        borderColor: 'divider',
                      },
                    }
                  : {
                      alignSelf: 'start',
                      p: 0.75,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: `${foundationTokens.radius.surface}px`,
                      bgcolor: 'action.hover',
                    }
              }
            >
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={1}
                sx={sparseNavigation ? { px: 1, pt: 0.25, pb: 0.15 } : { px: 0.5, pt: 0.2 }}
              >
                <Typography
                  id={`${titleId}-${group.groupId}`}
                  component="h3"
                  variant="subtitle2"
                  fontWeight={760}
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {group.label[locale]}
                </Typography>
                {sparseNavigation ? null : (
                  <Typography
                    component="span"
                    variant="caption"
                    color="text.secondary"
                    data-testid={`hris-task-group-count-${group.groupId}`}
                    aria-label={t('navigation.taskPanel.groupCount', {
                      count: group.nodes.length,
                    })}
                    sx={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {group.nodes.length}
                  </Typography>
                )}
              </Stack>
              <Stack
                component="ul"
                gap={sparseNavigation ? 0 : 0.25}
                sx={{ p: 0, mt: sparseNavigation ? 0.15 : 0.55, mb: 0, listStyle: 'none' }}
              >
                {group.nodes.map((node) => {
                  const route = node.routeAliases[0]!;
                  const unresolvedTarget = resolveTaskLocation(route, location.search);
                  const targetLocation = resolveTaskLocationHref(
                    resolveNavigationLocation?.(unresolvedTarget) ?? unresolvedTarget
                  );
                  const active = activeNodeId === node.nodeId;
                  return (
                    <Box component="li" key={node.nodeId} minWidth={0}>
                      <ActionButton
                        component={Link}
                        to={targetLocation}
                        data-testid={`hris-task-node-${node.nodeId}`}
                        data-active={active ? 'true' : 'false'}
                        aria-current={active ? 'page' : undefined}
                        intent="quiet"
                        fullWidth
                        size="small"
                        endIcon={<ArrowRight size={15} strokeWidth={1.8} aria-hidden="true" />}
                        onClick={(event) =>
                          deferNavigationHandoff(event, () => handOffNavigation(targetLocation))
                        }
                        sx={{
                          position: 'relative',
                          justifyContent: 'flex-start',
                          minHeight: 44,
                          minWidth: 0,
                          px: 1.25,
                          pl: 1.5,
                          borderRadius: foundationTokens.radius.control + 'px',
                          color: active ? 'var(--dwp-product-accent)' : 'text.primary',
                          bgcolor: active ? 'var(--dwp-product-selection)' : 'transparent',
                          fontWeight: active ? 720 : 560,
                          overflowWrap: 'anywhere',
                          textAlign: 'start',
                          lineHeight: 1.35,
                          transition: 'background-color 140ms ease, color 140ms ease',
                          '&::before': {
                            position: 'absolute',
                            left: 4,
                            width: 3,
                            height: active ? 18 : 0,
                            borderRadius: 99,
                            bgcolor: 'var(--dwp-product-accent)',
                            content: '""',
                            transition: 'height 140ms ease',
                          },
                          '& .MuiButton-endIcon': {
                            ml: 'auto',
                            opacity: active ? 0.88 : 0.38,
                            transition: 'opacity 140ms ease, transform 140ms ease',
                          },
                          '&:hover': {
                            bgcolor: active
                              ? 'var(--dwp-product-selection)'
                              : sparseNavigation
                                ? 'action.hover'
                                : 'background.paper',
                            '&::before': { height: 18 },
                            '& .MuiButton-endIcon': { opacity: 0.9, transform: 'translateX(2px)' },
                          },
                          '&:focus-visible': {
                            outline: '3px solid',
                            outlineColor: 'var(--dwp-product-accent)',
                            outlineOffset: 1,
                          },
                          '@media (forced-colors: active)': active
                            ? {
                                color: 'HighlightText',
                                bgcolor: 'Highlight',
                                outline: '2px solid Highlight',
                                outlineOffset: -2,
                              }
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
        </Box>
      ) : (
        <TaskPanelEmptyState
          title={t('navigation.taskPanel.emptyTitle')}
          description={t('navigation.taskPanel.emptyDescription')}
          action={
            <ActionButton
              intent="quiet"
              size="small"
              onClick={() => {
                restoreSearchFocusRef.current = true;
                setQuery('');
              }}
            >
              {t('navigation.taskPanel.clearSearch')}
            </ActionButton>
          }
        />
      )}

      {!policyUnavailable && workExplorerShortcut.disclosed ? (
        <Box
          sx={{
            position: compact ? 'static' : 'sticky',
            bottom: compact ? undefined : 0,
            zIndex: compact ? undefined : 2,
            px: { xs: 2, sm: 2.5 },
            py: 1.5,
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            boxShadow: compact ? 'none' : 2,
          }}
        >
          <ActionButton
            component={Link}
            to={workExplorerShortcut.href}
            intent="quiet"
            fullWidth
            startIcon={<Compass size={17} strokeWidth={1.8} aria-hidden="true" />}
            endIcon={<ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />}
            onClick={(event) =>
              deferNavigationHandoff(event, () => handOffNavigation(workExplorerShortcut.href))
            }
            sx={{
              minHeight: 44,
              justifyContent: 'flex-start',
              px: 1,
              borderRadius: foundationTokens.radius.control + 'px',
              textAlign: 'start',
              '& .MuiButton-endIcon': { ml: 'auto' },
            }}
          >
            <Box component="span" sx={{ minWidth: 0 }}>
              <Typography component="span" variant="body2" fontWeight={760} display="block">
                {t('navigation.taskPanel.explorerLabel')}
              </Typography>
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                display="block"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {t('navigation.taskPanel.explorerDescription')}
              </Typography>
            </Box>
          </ActionButton>
        </Box>
      ) : null}
    </Box>
  );
}

export function deferNavigationHandoff(event: MouseEvent<HTMLElement>, handoff: () => void) {
  const target = event.currentTarget.getAttribute('target');
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    (target && target !== '_self')
  ) {
    return;
  }
  globalThis.setTimeout(handoff, 0);
}

function TaskPanelEmptyState({
  action,
  description,
  title,
}: Readonly<{ action?: ReactNode; description: string; title: string }>) {
  return (
    <Stack
      role="status"
      alignItems="center"
      justifyContent="center"
      gap={0.75}
      sx={{ minHeight: 180, px: { xs: 2, sm: 2.5 }, py: 4, textAlign: 'center' }}
    >
      <Typography component="h3" variant="subtitle1" fontWeight={760}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
        {description}
      </Typography>
      {action ? <Box sx={{ mt: 0.25 }}>{action}</Box> : null}
    </Stack>
  );
}

export function renderHrisTaskNavigation(context: ProductAreaNavigationItemChildrenContext) {
  return context.selected && context.item.view.startsWith('workbench-') ? (
    <HrisTaskNavigation key={context.item.view} {...context} />
  ) : null;
}

export const HRIS_TASK_NAVIGATION_LAYOUT_PROPS = Object.freeze({
  renderNavigationItemChildren: renderHrisTaskNavigation,
  navigationChildrenPresentation: 'panel' as const,
});

export function resolveHrisTaskNavigationFocusTarget(): HTMLElement | null {
  const main = document.getElementById('dwp-main-content');
  const target = main?.querySelector<HTMLElement>('h1') ?? main;
  if (target && !target.matches('a, button, input, select, textarea, [tabindex]')) {
    target.tabIndex = -1;
  }
  return target;
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
    targetSearch.set(HRIS_NAVIGATION_SCOPE_PARAM, 'LEGAL_ENTITY');
    targetSearch.set('legalEntityPublicId', legalEntity.legalEntityPublicId);
  }
  return {
    pathname: target.pathname,
    search: targetSearch.size ? `?${targetSearch.toString()}` : '',
    hash: target.hash,
  };
}

function resolveTaskLocationHref(target: { pathname: string; search: string; hash: string }) {
  return `${target.pathname}${target.search}${target.hash}`;
}
