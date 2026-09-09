// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkHubFilterControls } from './work-hub-filter-controls';
import type { WorkHubFilters } from './work-hub-model';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      key === 'workHub.assignment.filters.label' ? '배정 관계에 따른 업무 목록 필터' : key,
  }),
}));

const filters: WorkHubFilters = {
  scope: 'ALL',
  query: '',
  sourceSystem: null,
  urgency: null,
  assignmentRole: null,
};

let host: HTMLDivElement;
let root: Root;

async function render(showAssignmentRoleFilter: boolean, sourceSystems: readonly string[]) {
  await act(async () => {
    root.render(
      <WorkHubFilterControls
        filters={filters}
        sourceSystems={sourceSystems}
        showAssignmentRoleFilter={showAssignmentRoleFilter}
        resultCount={0}
        onChange={vi.fn()}
      />
    );
  });
}

describe('WorkHubFilterControls assignment role visibility', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    document.documentElement.lang = 'ko';
    host = document.createElement('div');
    host.style.width = '320px';
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('shows an accessible long Korean role control for an active source with zero rows', async () => {
    await render(true, []);

    const label = [...host.querySelectorAll('label')].find(
      (candidate) => candidate.textContent === '배정 관계에 따른 업무 목록 필터'
    );
    expect(label).toBeDefined();
    const control = document.getElementById(label!.htmlFor);
    expect(control?.getAttribute('role')).toBe('combobox');
    expect(host.textContent).toContain('workHub.filters.results');
  });

  it('uses the explicit activation flag instead of inferring availability from current rows', async () => {
    await render(false, ['WORK_ASSIGNMENT']);

    expect(host.textContent).not.toContain('배정 관계에 따른 업무 목록 필터');
  });
});
