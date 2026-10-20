// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { BriefcaseBusiness } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { ProductAreaAuthorizedNavigationPathsProvider } from '../../../../components/product-area-authorized-navigation-context';
import { resolveProductAreaParentAriaCurrent } from '../../../../layouts/product-area-layout';
import {
  HrisTaskNavigation,
  HRIS_TASK_NAVIGATION_LAYOUT_PROPS,
  renderHrisTaskNavigation,
  resolveHrisTaskNavigationFocusTarget,
  resolveTaskLocation,
} from './hris-task-navigation';
import { canonicalHrisWorkbench } from './seven-workbench-navigation-policy';

const runtime = vi.hoisted(() => ({ policy: {} as Record<string, unknown> }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { resolvedLanguage: 'ko' } }),
}));

vi.mock('./hris-navigation-policy-runtime', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useHrisRuntimeNavigationPolicy: () => runtime.policy,
}));

describe('HRIS progressive task navigation', () => {
  it('renders only the selected effective workbench and carries the aggregate pin', () => {
    const canonical = canonicalHrisWorkbench('HRIS-WB-HR-OPERATIONS')!;
    const group = canonical.groups[0]!;
    const node = group.nodes[0]!;
    runtime.policy = {
      mode: 'ENFORCED',
      revisionPin: `nav-v2-${'a'.repeat(64)}`,
      denialReason: null,
      orderedNodeIds: [node.nodeId],
      workbenches: [
        {
          ...canonical,
          landingNodeId: node.nodeId,
          groups: [{ ...group, defaultNodeId: node.nodeId, nodes: [node] }],
        },
      ],
    };

    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        {
          initialEntries: [
            '/hr/operations/people?legalEntityPublicId=6d07e952-2f5f-4dc1-8be7-6d7e210d23af&privateFilter=discard',
          ],
        },
        createElement(HrisTaskNavigation, {
          item: {
            path: node.routeAliases[0]!,
            view: 'workbench-hr-operations',
            icon: BriefcaseBusiness,
            activePathPrefixes: node.routeAliases,
          },
          selected: true,
          compact: false,
        })
      )
    );

    expect(html).toContain('data-policy-revision="nav-v2-' + 'a'.repeat(64) + '"');
    expect(html).toContain(group.label.ko);
    expect(html).toContain(node.label.ko);
    expect(html).toContain('legalEntityPublicId=6d07e952-2f5f-4dc1-8be7-6d7e210d23af');
    expect(html).not.toContain('privateFilter');
  });

  it('preserves sealed target query and hash while copying only a valid legal selector', () => {
    expect(
      resolveTaskLocation(
        '/hr/operations/people?product=HCM&namespace=worker#summary',
        '?legalEntityPublicId=6d07e952-2f5f-4dc1-8be7-6d7e210d23af&privateFilter=discard'
      )
    ).toEqual({
      pathname: '/hr/operations/people',
      search:
        '?product=HCM&namespace=worker&legalEntityPublicId=6d07e952-2f5f-4dc1-8be7-6d7e210d23af',
      hash: '#summary',
    });
  });

  it('does not reveal children for an unselected workbench', () => {
    runtime.policy = {
      mode: 'ENFORCED',
      revisionPin: `nav-v2-${'b'.repeat(64)}`,
      workbenches: [],
    };
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(HrisTaskNavigation, {
          item: {
            path: '/hr/operations',
            view: 'workbench-hr-operations',
            icon: BriefcaseBusiness,
          },
          selected: false,
          compact: false,
        })
      )
    );

    expect(html).toBe('');
    expect(
      renderHrisTaskNavigation({
        item: {
          path: '/hr/operations',
          view: 'workbench-hr-operations',
          icon: BriefcaseBusiness,
        },
        selected: false,
        compact: false,
      })
    ).toBeNull();
  });

  it('shows authorized current descendants when tenant navigation policy is not enrolled', () => {
    runtime.policy = {
      mode: 'STATIC',
      schemaVersion: null,
      revisionPin: 'static',
      authorityFreshUntil: null,
      workbenches: [],
      orderedNodeIds: [],
      denialReason: null,
    };
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/hr/me'] },
        <ProductAreaAuthorizedNavigationPathsProvider
          paths={new Set(['/hr/me', '/hr/time', '/hr/pay', '/hr/me/requests'])}
        >
          <HrisTaskNavigation
            item={{
              path: '/hr/me',
              view: 'workbench-my-hr',
              icon: BriefcaseBusiness,
              activePathPrefixes: ['/hr/me'],
            }}
            selected
            compact={false}
          />
        </ProductAreaAuthorizedNavigationPathsProvider>
      )
    );

    expect(html).toContain('내 정보');
    expect(html).toContain('내 프로필');
    expect(html).toContain('근태·휴가');
    expect(html).toContain('내 근태');
    expect(html).toContain('급여·복리후생');
    expect(html).toContain('급여 및 세무');
    expect(html).toContain('신청·서비스·도움');
    expect(html).toContain('HR 요청');
  });

  it('leaves aria-current on the active inline child instead of its workbench parent', () => {
    runtime.policy = {
      mode: 'STATIC',
      schemaVersion: null,
      revisionPin: 'static',
      authorityFreshUntil: null,
      workbenches: [],
      orderedNodeIds: [],
      denialReason: null,
    };
    const item = {
      path: '/hr/me',
      view: 'workbench-my-hr',
      icon: BriefcaseBusiness,
      activePathPrefixes: ['/hr/me', '/hr/me/requests'],
    } as const;
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/hr/me/requests'] },
        <ProductAreaAuthorizedNavigationPathsProvider paths={new Set(item.activePathPrefixes)}>
          <HrisTaskNavigation item={item} selected compact={false} />
        </ProductAreaAuthorizedNavigationPathsProvider>
      )
    );

    expect(html.match(/aria-current="page"/gu)).toHaveLength(1);
    expect(html).toContain('data-testid="hris-task-node-BASE:my-hr-requests"');
    expect(
      resolveProductAreaParentAriaCurrent({
        selected: true,
        pathname: '/hr/me/requests',
        item,
        hasInlineChildren: true,
      })
    ).toBeUndefined();
    expect(
      resolveProductAreaParentAriaCurrent({
        selected: true,
        pathname: '/hr/me',
        item,
        hasInlineChildren: true,
      })
    ).toBe('page');
    expect(
      resolveProductAreaParentAriaCurrent({
        selected: true,
        pathname: '/hr/me/requests',
        item,
        hasInlineChildren: false,
      })
    ).toBe('page');
    expect(
      resolveProductAreaParentAriaCurrent({
        selected: false,
        pathname: '/hr/me/requests',
        item,
        hasInlineChildren: true,
      })
    ).toBeUndefined();

    const parentLandingHtml = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/hr/me'] },
        <ProductAreaAuthorizedNavigationPathsProvider paths={new Set(item.activePathPrefixes)}>
          <HrisTaskNavigation item={item} selected compact={false} />
        </ProductAreaAuthorizedNavigationPathsProvider>
      )
    );
    expect(parentLandingHtml).not.toContain('aria-current="page"');
    expect(
      resolveProductAreaParentAriaCurrent({
        selected: true,
        pathname: '/hr/me/unmapped-detail',
        item,
        hasInlineChildren: true,
      })
    ).toBe('page');
  });

  it('hands mobile child navigation to the deferred main-heading focus contract', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    runtime.policy = {
      mode: 'STATIC',
      schemaVersion: null,
      revisionPin: 'static',
      authorityFreshUntil: null,
      workbenches: [],
      orderedNodeIds: [],
      denialReason: null,
    };
    const main = document.createElement('main');
    main.id = 'dwp-main-content';
    main.tabIndex = -1;
    const previousHeading = document.createElement('h1');
    previousHeading.textContent = '이전 화면';
    main.appendChild(previousHeading);
    const mount = document.createElement('div');
    document.body.append(main, mount);
    const root = createRoot(mount);
    const onNavigate = vi.fn();
    const onNavigateToTarget = vi.fn();

    try {
      await act(async () => {
        root.render(
          createElement(
            MemoryRouter,
            { initialEntries: ['/hr/me'] },
            <ProductAreaAuthorizedNavigationPathsProvider paths={new Set(['/hr/me'])}>
              <HrisTaskNavigation
                item={{
                  path: '/hr/me',
                  view: 'workbench-my-hr',
                  icon: BriefcaseBusiness,
                  activePathPrefixes: ['/hr/me'],
                }}
                selected
                compact={false}
                onNavigate={onNavigate}
                onNavigateToTarget={onNavigateToTarget}
              />
            </ProductAreaAuthorizedNavigationPathsProvider>
          )
        );
      });

      const task = mount.querySelector<HTMLAnchorElement>(
        '[data-testid="hris-task-node-BASE:my-hr-profile"]'
      );
      expect(task).not.toBeNull();
      await act(async () => task!.click());

      expect(onNavigateToTarget).toHaveBeenCalledOnce();
      expect(onNavigate).not.toHaveBeenCalled();
      const resolveTarget = onNavigateToTarget.mock.calls[0]![0] as () => HTMLElement | null;
      expect(resolveTarget).toBe(resolveHrisTaskNavigationFocusTarget);
      const nextHeading = document.createElement('h1');
      nextHeading.textContent = '새 화면';
      previousHeading.replaceWith(nextHeading);
      expect(resolveTarget()).toBe(nextHeading);
      expect(nextHeading.tabIndex).toBe(-1);
      nextHeading.remove();
      expect(resolveTarget()).toBe(main);
    } finally {
      await act(async () => root.unmount());
      main.remove();
      mount.remove();
    }
  });

  it('falls back to the ordinary drawer navigation callback without a focus target contract', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    runtime.policy = {
      mode: 'STATIC',
      schemaVersion: null,
      revisionPin: 'static',
      authorityFreshUntil: null,
      workbenches: [],
      orderedNodeIds: [],
      denialReason: null,
    };
    const mount = document.createElement('div');
    document.body.append(mount);
    const root = createRoot(mount);
    const onNavigate = vi.fn();

    try {
      await act(async () => {
        root.render(
          createElement(
            MemoryRouter,
            { initialEntries: ['/hr/me'] },
            <ProductAreaAuthorizedNavigationPathsProvider paths={new Set(['/hr/me'])}>
              <HrisTaskNavigation
                item={{
                  path: '/hr/me',
                  view: 'workbench-my-hr',
                  icon: BriefcaseBusiness,
                  activePathPrefixes: ['/hr/me'],
                }}
                selected
                compact={false}
                onNavigate={onNavigate}
              />
            </ProductAreaAuthorizedNavigationPathsProvider>
          )
        );
      });

      const task = mount.querySelector<HTMLAnchorElement>(
        '[data-testid="hris-task-node-BASE:my-hr-profile"]'
      );
      expect(task).not.toBeNull();
      await act(async () => task!.click());
      expect(onNavigate).toHaveBeenCalledOnce();
    } finally {
      await act(async () => root.unmount());
      mount.remove();
    }
  });

  it('seals inline task navigation as the shared shell presentation', () => {
    expect(HRIS_TASK_NAVIGATION_LAYOUT_PROPS).toEqual({
      renderNavigationItemChildren: renderHrisTaskNavigation,
      navigationChildrenPresentation: 'inline',
    });
  });
});
