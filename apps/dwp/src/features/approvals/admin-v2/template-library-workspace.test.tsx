// @vitest-environment jsdom
import { act } from 'react';
import { fireEvent, getByRole, getByText } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TemplateLibraryWorkspace } from './template-library-workspace';
import { attention, facts, healthy, metrics, templateCopy } from './admin-v2-test-fixtures';
import { createAdminV2TestHarness, type AdminV2TestHarness } from './admin-v2-test-harness';

const templates = [
  {
    id: 'template-1',
    name: 'Privileged access request',
    summary: 'Governed request package for privileged access.',
    categoryId: 'security',
    categoryLabel: 'Security',
    ownerLabel: 'Security Governance',
    versionLabel: 'v3.2',
    usageLabel: '18 workflows',
    updatedLabel: 'Verified today',
    status: healthy,
    featured: true,
    installed: false,
    facts,
    dependencies: [
      {
        id: 'dependency-1',
        name: 'Directory resolver',
        title: 'Directory resolver',
        detail: 'Current authority revision is available.',
        status: healthy,
      },
    ],
    releaseNotes: ['Adds explicit classification and retention controls.'],
  },
  {
    id: 'template-2',
    name: 'Vendor onboarding',
    summary: 'Cross-functional vendor intake.',
    categoryId: 'finance',
    categoryLabel: 'Finance',
    ownerLabel: 'Procurement',
    versionLabel: 'v1.4',
    usageLabel: '9 workflows',
    updatedLabel: 'Verified yesterday',
    status: attention,
    facts,
    dependencies: [],
    releaseNotes: ['Refreshes localized help content.'],
  },
] as const;

describe('APR-17 template library workspace', () => {
  let harness: AdminV2TestHarness;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    harness = createAdminV2TestHarness();
  });

  afterEach(async () => {
    await harness.destroy();
    vi.unstubAllGlobals();
  });

  function props(state: 'ready' | 'stale' = 'ready') {
    return {
      state,
      copy: {
        ...templateCopy,
        previewTitle: 'Template preview',
        previewDescription: 'Exact server schema preview.',
        requiredLabel: 'Required',
        optionalLabel: 'Optional',
        downloadPackageLabel: 'Download package',
        cloneLabel: 'Clone draft',
        comparisonCompatibleLabel: 'Compatible',
        comparisonBlockedLabel: 'Blocked',
      },
      metrics,
      categories: [
        { id: 'security', label: 'Security', count: 1 },
        { id: 'finance', label: 'Finance', count: 1 },
      ],
      activeCategoryId: 'ALL',
      search: '',
      templates,
      selectedTemplateId: 'template-1',
      packagePreview: {
        schemaSha256: 'a'.repeat(64),
        fields: [
          { id: 'summary', label: 'Summary', type: 'TEXTAREA', required: true },
        ],
      },
      packageLoading: false,
      comparison: null,
      importReady: false,
      importDisabledReason: 'A signed package manifest is required.',
      compareReady: true,
      installReady: true,
      downloadReady: true,
      cloneReady: true,
      onSearchChange: vi.fn(),
      onCategoryChange: vi.fn(),
      onSelectTemplate: vi.fn(),
      onImport: vi.fn(),
      onCompare: vi.fn(),
      onDownloadPackage: vi.fn(),
      onClone: vi.fn(),
      onInstall: vi.fn(),
      onRetry: vi.fn(),
      onResolveConflict: vi.fn(),
    };
  }

  it('connects comparison and governed installation while package import starts disabled', async () => {
    const current = props();
    await harness.render(<TemplateLibraryWorkspace {...current} />);

    await act(async () => {
      fireEvent.change(getByRole(harness.node, 'textbox', { name: templateCopy.searchLabel }), {
        target: { value: 'privileged' },
      });
      fireEvent.click(getByRole(harness.node, 'button', { name: /Vendor onboarding/u }));
      fireEvent.click(getByRole(harness.node, 'button', { name: templateCopy.importLabel }));
      fireEvent.click(getByRole(harness.node, 'button', { name: templateCopy.compareLabel }));
      fireEvent.click(getByRole(harness.node, 'button', { name: templateCopy.installLabel }));
    });

    expect(current.onSearchChange).toHaveBeenCalledWith('privileged');
    expect(current.onSelectTemplate).toHaveBeenCalledWith('template-2');
    expect(current.onImport).not.toHaveBeenCalled();
    expect(harness.node.textContent).toContain(current.importDisabledReason);
    expect(current.onCompare).toHaveBeenCalledWith('template-1');
    expect(current.onInstall).toHaveBeenCalledWith('template-1');
    expect(getByText(harness.node, templates[0].releaseNotes[0])).toBeDefined();
  });

  it('keeps the catalog readable but closes install when authority is stale', async () => {
    const current = props('stale');
    await harness.render(<TemplateLibraryWorkspace {...current} />);
    expect(harness.node.textContent).toContain(templates[0].name);
    const install = getByRole<HTMLButtonElement>(harness.node, 'button', {
      name: templateCopy.installLabel,
    });
    expect(install.disabled).toBe(true);
    await act(async () => fireEvent.click(install));
    expect(current.onInstall).not.toHaveBeenCalled();
  });
});
