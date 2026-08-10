import type { HomeAppDefinition } from '../home/app-launchpad-model';
import type { ReferenceWorkItem } from '../work-hub/reference-data';

export type GlobalSearchKind = 'app' | 'work' | 'knowledge' | 'ask';

export type GlobalSearchItem = {
  id: string;
  kind: GlobalSearchKind;
  title: string;
  description: string;
  route: string;
  keywords: readonly string[];
  recommended?: boolean;
};

export type GlobalSearchTranslate = (
  key: string,
  options?: Record<string, string | number>
) => string;

const ASK_PROMPTS = [
  {
    id: 'ask-attention',
    translationKey: 'search.prompts.attention',
    kind: 'ask' as const,
    title: 'What needs my attention?',
    description: 'Review priorities across your permitted work',
    keywords: ['priority', 'today', 'attention', 'approval', 'task'],
  },
  {
    id: 'knowledge-remote-policy',
    translationKey: 'search.prompts.remotePolicy',
    kind: 'knowledge' as const,
    title: 'Find the remote work policy',
    description: 'Search governed workplace knowledge',
    keywords: ['remote', 'work', 'policy', 'knowledge', 'guide'],
  },
] as const;

function askRoute(query: string): string {
  return '/ask?q=' + encodeURIComponent(query);
}

function normalize(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase();
}

function translated(
  translate: GlobalSearchTranslate | undefined,
  key: string,
  fallback: string,
  options?: Record<string, string | number>
): string {
  return translate?.(key, { defaultValue: fallback, ...options }) ?? fallback;
}

function translatedKeywords(
  translate: GlobalSearchTranslate | undefined,
  key: string,
  fallback: readonly string[]
): string[] {
  return translated(translate, key, fallback.join(' ')).split(/\s+/).filter(Boolean);
}

export function createGlobalSearchItems(
  apps: readonly HomeAppDefinition[],
  work: readonly ReferenceWorkItem[],
  includeAsk: boolean,
  translate?: GlobalSearchTranslate
): GlobalSearchItem[] {
  const appItems = apps.map<GlobalSearchItem>((app) => ({
    id: `app-${app.id}`,
    kind: 'app',
    title: app.name,
    description: app.description,
    route: app.route,
    keywords: [app.groupId, app.resourceKey],
    recommended: ['dwp-work', 'dwp-ask', 'dwp-activity'].includes(app.id),
  }));
  const workItems = work.map<GlobalSearchItem>((item) => ({
    id: `work-${item.id}`,
    kind: 'work',
    title: item.title,
    description: `${translated(translate, `search.workTypes.${item.type}`, item.type)} / ${item.due} / ${item.sourceSystem}`,
    route: `/work?item=${encodeURIComponent(item.id)}`,
    keywords: [item.id, item.type, item.priority, item.status, item.sourceSystem, item.owner],
  }));
  const browseApps: GlobalSearchItem = {
    id: 'app-catalog',
    kind: 'app',
    title: translated(translate, 'search.browseApps.title', 'Browse all apps'),
    description: translated(
      translate,
      'search.browseApps.description',
      'Open the assigned application catalog'
    ),
    route: '/apps',
    keywords: translatedKeywords(translate, 'search.browseApps.keywords', [
      'application',
      'catalog',
      'service',
      'system',
    ]),
    recommended: true,
  };
  const prompts = includeAsk
    ? ASK_PROMPTS.map<GlobalSearchItem>((prompt) => {
        const title = translated(translate, `${prompt.translationKey}.title`, prompt.title);
        return {
          id: prompt.id,
          kind: prompt.kind,
          title,
          description: translated(
            translate,
            `${prompt.translationKey}.description`,
            prompt.description
          ),
          keywords: translatedKeywords(
            translate,
            `${prompt.translationKey}.keywords`,
            prompt.keywords
          ),
          route: askRoute(title),
          recommended: true,
        };
      })
    : [];

  return [...appItems, browseApps, ...workItems, ...prompts];
}

export function filterGlobalSearchItems(
  items: readonly GlobalSearchItem[],
  query: string,
  limit = 7
): GlobalSearchItem[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return items.filter((item) => item.recommended).slice(0, limit);

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  return items
    .map((item, index) => {
      const title = normalize(item.title);
      const description = normalize(item.description);
      const keywords = normalize(item.keywords.join(' '));
      let score = 0;

      for (const token of tokens) {
        if (title.startsWith(token)) score += 0;
        else if (title.includes(token)) score += 2;
        else if (keywords.includes(token)) score += 4;
        else if (description.includes(token)) score += 6;
        else return null;
      }

      return { item, score, index };
    })
    .filter((value): value is { item: GlobalSearchItem; score: number; index: number } =>
      Boolean(value)
    )
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .slice(0, limit)
    .map(({ item }) => item);
}

export function createAskSearchItem(
  query: string,
  translate?: GlobalSearchTranslate
): GlobalSearchItem {
  const value = query.trim();
  return {
    id: 'ask-current-query',
    kind: 'ask',
    title: translated(translate, 'search.askQuery.title', `Ask DWP: ${value}`, { query: value }),
    description: translated(
      translate,
      'search.askQuery.description',
      'Use permitted work and knowledge sources'
    ),
    route: askRoute(value),
    keywords: [],
  };
}
