// @vitest-environment jsdom
import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { BriefcaseBusiness } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { ProductAreaAuthorizedNavigationPathsProvider } from '../../../../components/product-area-authorized-navigation-context';
import { resolveProductAreaParentAriaCurrent } from '../../../../layouts/product-area-layout';
import {
  deferNavigationHandoff,
  filterHrisTaskNavigationGroups,
  HrisTaskNavigation,
  HRIS_TASK_NAVIGATION_LAYOUT_PROPS,
  renderHrisTaskNavigation,
  resolveActiveHrisTaskNodeId,
  resolveHrisTaskNavigationFocusTarget,
  resolveHrisTaskNavigationColumnCount,
  resolveTaskLocation,
} from './hris-task-navigation';
import {
  canonicalHrisWorkbench,
  type HrisTaskNavigationGroup,
} from './seven-workbench-navigation-policy';

const runtime = vi.hoisted(() => ({
  policy: {} as Record<string, unknown>,
  workExplorer: { disclosed: true, href: '/hr/explore' },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, variables?: Readonly<Record<string, string | number>>) => {
      const messages: Readonly<Record<string, string>> = {
        'navigation.taskPanel.eyebrow': '업무 메뉴',
        'navigation.taskPanel.description': '현재 권한으로 열 수 있는 업무만 표시합니다.',
        'navigation.taskPanel.allowedCount': '허용 업무 {{count}}개',
        'navigation.taskPanel.taskCount': '{{count}}개 업무',
        'navigation.taskPanel.filteredCount': '{{count}}개 업무 표시',
        'navigation.taskPanel.groupCount': '{{count}}개 업무',
        'navigation.taskPanel.searchLabel': '{{workbench}} 업무 검색',
        'navigation.taskPanel.searchPlaceholder': '업무 또는 메뉴 이름 검색',
        'navigation.taskPanel.emptyTitle': '검색 결과가 없습니다',
        'navigation.taskPanel.emptyDescription': '다른 업무 이름이나 그룹을 검색해 보세요.',
        'navigation.taskPanel.clearSearch': '검색 지우기',
        'navigation.taskPanel.noAccessTitle': '현재 열 수 있는 업무가 없습니다',
        'navigation.taskPanel.noAccessDescription':
          '이 영역의 업무가 필요하면 회사의 HRIS 관리자에게 역할 또는 메뉴 정책을 확인해 주세요.',
        'navigation.taskPanel.unavailableTitle': '업무 메뉴를 확인할 수 없습니다',
        'navigation.taskPanel.unavailableDescription':
          '권한 정보를 안전하게 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        'navigation.taskPanel.explorerLabel': '전체 HR 업무 찾기',
        'navigation.taskPanel.explorerDescription':
          '즐겨찾기, 최근 업무와 진행 중 업무를 함께 확인합니다.',
      };
      return Object.entries(variables ?? {}).reduce(
        (message, [name, value]) => message.replace(`{{${name}}}`, String(value)),
        messages[key] ?? key
      );
    },
    i18n: { resolvedLanguage: 'ko' },
  }),
}));

vi.mock('./hris-navigation-policy-runtime', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useHrisRuntimeNavigationPolicy: () => runtime.policy,
}));

vi.mock('../../explorer/work-explorer-access', () => ({
  useWorkExplorerShortcutAccess: () => runtime.workExplorer,
}));

describe('HRIS progressive task navigation', () => {
  it('defers ordinary link handoff without intercepting modified navigation', async () => {
    const handoff = vi.fn();
    const event = (overrides: Readonly<Record<string, unknown>> = {}) =>
      ({
        altKey: false,
        button: 0,
        ctrlKey: false,
        currentTarget: { getAttribute: () => null },
        metaKey: false,
        shiftKey: false,
        ...overrides,
      }) as unknown as Parameters<typeof deferNavigationHandoff>[0];

    deferNavigationHandoff(event({ ctrlKey: true }), handoff);
    deferNavigationHandoff(event({ button: 1 }), handoff);
    deferNavigationHandoff(event({ currentTarget: { getAttribute: () => '_blank' } }), handoff);
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
    expect(handoff).not.toHaveBeenCalled();

    deferNavigationHandoff(event(), handoff);
    expect(handoff).not.toHaveBeenCalled();
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
    expect(handoff).toHaveBeenCalledOnce();
  });

  it('filters projected task groups by localized group and node labels', () => {
    const groups = canonicalHrisWorkbench('HRIS-WB-MY-HR')!.groups;
    const group = groups[0]!;
    const node = groups[1]!.nodes[0]!;

    expect(filterHrisTaskNavigationGroups(groups, `  ${group.label.ko}  `, 'ko')).toEqual([group]);
    expect(
      filterHrisTaskNavigationGroups(groups, node.label.en.toLocaleUpperCase(), 'en').flatMap(
        (candidate) => candidate.nodes
      )
    ).toEqual([node]);
    expect(filterHrisTaskNavigationGroups(groups, '존재하지 않는 업무', 'ko')).toEqual([]);
  });

  it('resolves exactly one active task and fails closed for an ambiguous alias', () => {
    const groups = canonicalHrisWorkbench('HRIS-WB-MY-HR')!.groups;
    const node = groups[0]!.nodes[0]!;
    const sharedRoute = node.routeAliases[0]!;
    const ambiguousGroups: readonly HrisTaskNavigationGroup[] = [
      groups[0]!,
      {
        ...groups[1]!,
        nodes: [{ ...groups[1]!.nodes[0]!, routeAliases: [sharedRoute] }],
      },
    ];

    expect(resolveActiveHrisTaskNodeId(groups, `${sharedRoute}/?tab=summary`)).toBe(node.nodeId);
    expect(resolveActiveHrisTaskNodeId(ambiguousGroups, sharedRoute)).toBeUndefined();
    expect(resolveActiveHrisTaskNodeId(groups, '/hr/unmapped')).toBeUndefined();
  });

  it('uses two columns only when both the group and task volume justify it', () => {
    const groups = canonicalHrisWorkbench('HRIS-WB-MY-HR')!.groups;

    expect(resolveHrisTaskNavigationColumnCount(groups)).toBe(2);
    expect(resolveHrisTaskNavigationColumnCount(groups.slice(0, 2))).toBe(1);
    expect(
      resolveHrisTaskNavigationColumnCount(
        groups.slice(0, 4).map((group) => ({ ...group, nodes: group.nodes.slice(0, 1) }))
      )
    ).toBe(1);
  });

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
          resolveNavigationLocation: (target) => {
            const search = new URLSearchParams(target.search);
            search.set('scope', 'scope:hcm/people');
            return { ...target, search: `?${search.toString()}` };
          },
        })
      )
    );

    expect(html).toContain('data-policy-revision="nav-v2-' + 'a'.repeat(64) + '"');
    expect(html).toContain(group.label.ko);
    expect(html).toContain(node.label.ko);
    expect(html).toContain('허용 업무 1개');
    expect(html).toContain('1개 업무');
    expect(html).not.toContain('업무 또는 메뉴 이름 검색');
    expect(html).not.toContain('>업무 메뉴<');
    expect(html).toContain('data-testid="hris-task-navigation-workbench-icon"');
    expect(html).toContain('전체 HR 업무 찾기');
    expect(html).toContain('href="/hr/explore"');
    expect(html).toContain('scope=scope%3Ahcm%2Fpeople');
    expect(html).toContain('navigationScope=LEGAL_ENTITY');
    expect(html).toContain('legalEntityPublicId=6d07e952-2f5f-4dc1-8be7-6d7e210d23af');
    expect(html).not.toContain('privateFilter');
  });

  it('keeps the compact mobile content header descriptive without repeating its parent title', () => {
    const canonical = canonicalHrisWorkbench('HRIS-WB-HR-OPERATIONS')!;
    const group = canonical.groups[0]!;
    const node = group.nodes[0]!;
    runtime.policy = {
      mode: 'ENFORCED',
      revisionPin: `nav-v2-${'c'.repeat(64)}`,
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
      <MemoryRouter>
        <HrisTaskNavigation
          item={{
            path: node.routeAliases[0]!,
            view: 'workbench-hr-operations',
            icon: BriefcaseBusiness,
            activePathPrefixes: node.routeAliases,
          }}
          selected
          compact
        />
      </MemoryRouter>
    );
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const section = parsed.querySelector(
      '[data-testid="hris-task-navigation-workbench-hr-operations"]'
    );
    const labelledBy = section?.getAttribute('aria-labelledby');

    expect(html).not.toContain('data-testid="hris-task-navigation-workbench-icon"');
    expect(html).not.toContain('<h2');
    expect(html).toContain('현재 권한으로 열 수 있는 업무만 표시합니다.');
    expect(html).toContain('허용 업무 1개');
    expect(labelledBy).toBeTruthy();
    expect(parsed.getElementById(labelledBy!)).not.toBeNull();
  });

  it('discloses task search only when at least seven tasks are authorized', () => {
    runtime.policy = {
      mode: 'STATIC',
      schemaVersion: null,
      revisionPin: 'static',
      authorityFreshUntil: null,
      workbenches: [],
      orderedNodeIds: [],
      denialReason: null,
    };
    const nodes = canonicalHrisWorkbench('HRIS-WB-MY-HR')!.groups.flatMap((group) => group.nodes);
    const renderWithTaskCount = (count: number) => {
      const paths = nodes.slice(0, count).map((node) => node.routeAliases[0]!);
      return renderToStaticMarkup(
        <MemoryRouter initialEntries={['/hr/me']}>
          <ProductAreaAuthorizedNavigationPathsProvider paths={new Set(paths)}>
            <HrisTaskNavigation
              item={{
                path: '/hr/me',
                view: 'workbench-my-hr',
                icon: BriefcaseBusiness,
                activePathPrefixes: paths,
              }}
              selected
              compact={false}
            />
          </ProductAreaAuthorizedNavigationPathsProvider>
        </MemoryRouter>
      );
    };

    const sixTaskHtml = renderWithTaskCount(6);
    const sevenTaskHtml = renderWithTaskCount(7);
    expect(sixTaskHtml).toContain('data-authorized-task-count="6"');
    expect(sixTaskHtml).toContain('data-navigation-density="sparse"');
    expect(sixTaskHtml).toContain('data-navigation-group-treatment="flat"');
    expect(sixTaskHtml).not.toContain('data-testid="hris-task-group-count-');
    expect(sixTaskHtml).not.toContain('업무 또는 메뉴 이름 검색');
    expect(sevenTaskHtml).toContain('data-authorized-task-count="7"');
    expect(sevenTaskHtml).toContain('data-navigation-density="dense"');
    expect(sevenTaskHtml).toContain('data-navigation-group-treatment="card"');
    expect(sevenTaskHtml).toContain('data-testid="hris-task-group-count-');
    expect(sevenTaskHtml).toContain('업무 또는 메뉴 이름 검색');
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
        '?product=HCM&namespace=worker&navigationScope=LEGAL_ENTITY&legalEntityPublicId=6d07e952-2f5f-4dc1-8be7-6d7e210d23af',
      hash: '#summary',
    });
  });

  it('does not disclose the work explorer footer without exact shortcut authority', () => {
    const canonical = canonicalHrisWorkbench('HRIS-WB-HR-OPERATIONS')!;
    const group = canonical.groups[0]!;
    const node = group.nodes[0]!;
    runtime.policy = {
      mode: 'ENFORCED',
      revisionPin: `nav-v2-${'e'.repeat(64)}`,
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
    runtime.workExplorer = { disclosed: false, href: '/hr/explore' };

    try {
      const html = renderToStaticMarkup(
        createElement(
          MemoryRouter,
          null,
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

      expect(html).not.toContain('전체 HR 업무 찾기');
      expect(html).not.toContain('href="/hr/explore"');
    } finally {
      runtime.workExplorer = { disclosed: true, href: '/hr/explore' };
    }
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

  it('falls back to the exact legacy shell paths when static compatibility authority is absent', () => {
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
        <HrisTaskNavigation
          item={{
            path: '/hr/me',
            view: 'workbench-my-hr',
            icon: BriefcaseBusiness,
            activePathPrefixes: ['/hr/me', '/hr/me/requests'],
          }}
          selected
          compact={false}
        />
      )
    );

    expect(html).toContain('내 프로필');
    expect(html).toContain('HR 요청');
    expect(html).not.toContain('내 근태');
    expect(html).not.toContain('급여 및 세무');
  });

  it('does not widen an explicit empty compatibility authority and explains the zero state', () => {
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
        <ProductAreaAuthorizedNavigationPathsProvider paths={new Set()}>
          <HrisTaskNavigation
            item={{
              path: '/hr/me',
              view: 'workbench-my-hr',
              icon: BriefcaseBusiness,
              activePathPrefixes: ['/hr/me', '/hr/me/requests'],
            }}
            selected
            compact={false}
          />
        </ProductAreaAuthorizedNavigationPathsProvider>
      )
    );

    expect(html).toContain('허용 업무 0개');
    expect(html).toContain('현재 열 수 있는 업무가 없습니다');
    expect(html).not.toContain('data-testid="hris-task-node-');
    expect(html).not.toContain('업무 또는 메뉴 이름 검색');
  });

  it('keeps fail-closed task details hidden and renders a safe unavailable state', () => {
    runtime.policy = {
      mode: 'FAIL_CLOSED',
      schemaVersion: null,
      revisionPin: 'authority-unavailable',
      authorityFreshUntil: null,
      workbenches: [],
      orderedNodeIds: [],
      denialReason: 'NAVIGATION_PROJECTION_UNAVAILABLE',
    };
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/hr/me'] },
        <HrisTaskNavigation
          item={{
            path: '/hr/me',
            view: 'workbench-my-hr',
            icon: BriefcaseBusiness,
            activePathPrefixes: ['/hr/me', '/hr/me/requests'],
          }}
          selected
          compact={false}
        />
      )
    );

    expect(html).toContain('업무 메뉴를 확인할 수 없습니다');
    expect(html).not.toContain('data-testid="hris-task-node-');
    expect(html).not.toContain('전체 HR 업무 찾기');
  });

  it('leaves exactly one aria-current on the active panel child', () => {
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
    expect(parentLandingHtml.match(/aria-current="page"/gu)).toHaveLength(1);
    expect(parentLandingHtml).toContain('data-testid="hris-task-node-BASE:my-hr-profile"');
    expect(
      resolveProductAreaParentAriaCurrent({
        selected: true,
        pathname: '/hr/me/unmapped-detail',
        item,
        hasInlineChildren: true,
      })
    ).toBe('page');
  });

  it('shows an empty search state and restores the authorized projection when cleared', async () => {
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
    const searchPaths = canonicalHrisWorkbench('HRIS-WB-MY-HR')!
      .groups.flatMap((group) => group.nodes)
      .slice(0, 7)
      .map((node) => node.routeAliases[0]!);

    try {
      await act(async () => {
        root.render(
          createElement(
            MemoryRouter,
            { initialEntries: ['/hr/me'] },
            <ProductAreaAuthorizedNavigationPathsProvider paths={new Set(searchPaths)}>
              <HrisTaskNavigation
                item={{
                  path: '/hr/me',
                  view: 'workbench-my-hr',
                  icon: BriefcaseBusiness,
                  activePathPrefixes: searchPaths,
                }}
                selected
                compact={false}
              />
            </ProductAreaAuthorizedNavigationPathsProvider>
          )
        );
      });

      const input = mount.querySelector<HTMLInputElement>('input');
      const setInputValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;
      expect(input).not.toBeNull();
      expect(setInputValue).toBeTypeOf('function');
      await act(async () => {
        setInputValue!.call(input, '존재하지 않는 업무');
        input!.dispatchEvent(new Event('input', { bubbles: true }));
      });

      expect(mount.textContent).toContain('검색 결과가 없습니다');
      expect(
        mount
          .querySelector('[data-testid="hris-task-navigation-workbench-my-hr"]')
          ?.getAttribute('data-authorized-task-count')
      ).toBe('7');
      expect(
        mount
          .querySelector('[data-testid="hris-task-navigation-workbench-my-hr"]')
          ?.getAttribute('data-filtered-task-count')
      ).toBe('0');
      expect(mount.textContent).toContain('전체 HR 업무 찾기');

      const clearButton = Array.from(mount.querySelectorAll('button')).find(
        (button) => button.textContent === '검색 지우기'
      );
      expect(clearButton).toBeDefined();
      await act(async () => clearButton!.click());

      expect(mount.textContent).not.toContain('검색 결과가 없습니다');
      expect(document.activeElement).toBe(input);
      expect(
        mount.querySelector('[data-testid="hris-task-node-BASE:my-hr-profile"]')
      ).not.toBeNull();
    } finally {
      await act(async () => root.unmount());
      mount.remove();
    }
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
      expect(onNavigateToTarget.mock.calls[0]![1]).toBe('/hr/me');
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

  it('commits task navigation even when the handoff closes and unmounts the panel', async () => {
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

    function NavigationHarness() {
      const [open, setOpen] = useState(true);
      const current = useLocation();
      return (
        <>
          <output data-testid="location-probe">{`${current.pathname}${current.search}`}</output>
          {open ? (
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
                onNavigateToTarget={() => setOpen(false)}
              />
            </ProductAreaAuthorizedNavigationPathsProvider>
          ) : null}
        </>
      );
    }

    try {
      await act(async () => {
        root.render(
          <MemoryRouter initialEntries={['/hr/home']}>
            <NavigationHarness />
          </MemoryRouter>
        );
      });
      const task = mount.querySelector<HTMLAnchorElement>(
        '[data-testid="hris-task-node-BASE:my-hr-profile"]'
      );
      expect(task).not.toBeNull();

      await act(async () => task!.click());

      expect(
        mount.querySelector('[data-testid="hris-task-navigation-workbench-my-hr"]')
      ).toBeNull();
      expect(mount.querySelector('[data-testid="location-probe"]')?.textContent).toBe('/hr/me');
    } finally {
      await act(async () => root.unmount());
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

  it('seals panel task navigation as the shared shell presentation', () => {
    expect(HRIS_TASK_NAVIGATION_LAYOUT_PROPS).toEqual({
      renderNavigationItemChildren: renderHrisTaskNavigation,
      navigationChildrenPresentation: 'panel',
    });
  });
});
