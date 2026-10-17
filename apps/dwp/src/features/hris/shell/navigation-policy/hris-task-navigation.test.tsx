// @vitest-environment jsdom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { BriefcaseBusiness } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import {
  HrisTaskNavigation,
  renderHrisTaskNavigation,
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
});
