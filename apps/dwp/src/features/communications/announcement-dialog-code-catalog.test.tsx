import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const catalog = vi.hoisted(() => ({
  contentTypes: {
    options: ['ANNOUNCEMENT'],
    isPending: false,
    isError: false,
    error: null,
    usingFallback: false,
  },
  categories: {
    options: ['COMPANY'],
    isPending: false,
    isError: false,
    error: null,
    usingFallback: false,
  },
}));

vi.mock('../../components/use-system-code-options', () => ({
  useSystemCodeOptionsState: (key: string) =>
    key === 'PLATFORM.COMMUNICATION.CONTENT_TYPE' ? catalog.contentTypes : catalog.categories,
}));
vi.mock('@dwp-frontend/design-system', () => ({
  DateTimePickerField: () => null,
  FormDialog: ({ open, children }: { open: boolean; children?: ReactNode }) =>
    open ? createElement('div', null, children) : null,
  FormField: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { AnnouncementDialog } from './announcement-dialog';

import type { ProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';

const requestScope: ProductSurfaceRequestScope = {
  governed: true,
  ready: true,
  contextScopeKey: 'scope-1',
  cacheKey: ['tenant-1', 'actor-1', 'FULL', 'COMMUNICATIONS.ADMIN', 'scope-1', 'revision-1'],
  queryMeta: {
    accessSensitive: true,
    tenantId: 'tenant-1',
    actorId: 'actor-1',
    accessMode: 'FULL',
    productId: 'COMMUNICATIONS',
    surfaceId: 'ADMIN',
    contextScopeKey: 'scope-1',
    decisionRevision: 'revision-1',
  },
};

function renderDialog() {
  return renderToStaticMarkup(
    <AnnouncementDialog
      open
      announcement={null}
      busy={false}
      requestScope={requestScope}
      onClose={() => undefined}
      onSubmit={() => undefined}
    />
  );
}

describe('announcement code catalog fallback disclosure', () => {
  beforeEach(() => {
    Object.assign(catalog.contentTypes, {
      isPending: false,
      isError: false,
      error: null,
      usingFallback: false,
    });
    Object.assign(catalog.categories, {
      isPending: false,
      isError: false,
      error: null,
      usingFallback: false,
    });
  });

  it('warns when a successful catalog response was incompatible and fallback values are used', () => {
    catalog.contentTypes.usingFallback = true;

    expect(renderDialog()).toContain('announcements.dialog.codeCatalogFallback');
  });

  it('does not report a catalog failure while fallback values only cover the pending state', () => {
    Object.assign(catalog.contentTypes, { isPending: true, usingFallback: true });
    Object.assign(catalog.categories, { isPending: true, usingFallback: true });

    expect(renderDialog()).not.toContain('announcements.dialog.codeCatalogFallback');
  });
});
