import { describe, expect, it } from 'vitest';

import { HOME_APPS } from '../home/app-launchpad-model';
import { workItems } from '../work-hub/reference-data';
import {
  createAskSearchItem,
  createGlobalSearchItems,
  filterGlobalSearchItems,
} from './global-search-model';

describe('global search model', () => {
  const items = createGlobalSearchItems(HOME_APPS, workItems, true);

  it('combines applications, governed work, and knowledge prompts', () => {
    expect(filterGlobalSearchItems(items, 'finance purchasing')[0]?.title).toBe('Business ERP');
    expect(filterGlobalSearchItems(items, 'WK-1042')[0]?.title).toBe(
      'Approve software access request'
    );
    expect(filterGlobalSearchItems(items, 'remote policy')[0]?.kind).toBe('knowledge');
  });

  it('returns recommended destinations before a query is entered', () => {
    expect(filterGlobalSearchItems(items, '').map((item) => item.title)).toEqual([
      'Work',
      'Ask DWP',
      'Activity',
      'Browse all apps',
      'What needs my attention?',
      'Find the remote work policy',
    ]);
  });

  it('builds an encoded Ask route for unmatched natural language', () => {
    expect(createAskSearchItem('summarize my next meeting').route).toBe(
      '/ask?q=summarize%20my%20next%20meeting'
    );
  });
});
