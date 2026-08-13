import type { HomeAppDefinition } from '../home/app-launchpad-model';
import type {
  WorkspacePriority,
  WorkspaceWorkStatus,
  WorkspaceWorkType,
} from '@dwp-frontend/shared-utils';

export type SearchableWorkItem = {
  id: string;
  title: string;
  type: WorkspaceWorkType;
  priority: WorkspacePriority;
  status: WorkspaceWorkStatus;
  due: string;
  sourceSystem: string;
  owner: string;
};

export type SearchablePerson = {
  personId: string;
  displayName: string;
  workEmail?: string | null;
  businessTitle?: string | null;
  organizationName?: string | null;
  jobProfileName?: string | null;
};

export type SearchableOrganization = {
  organizationId: string;
  organizationKey: string;
  name: string;
  organizationTypeName: string;
  totalHeadcount: number;
};

export type SearchableAuditEvent = {
  id: string;
  title: string;
  description: string;
  route: string;
  keywords: readonly string[];
  source: string;
};

export type SearchableTenant = {
  tenantId: string;
  title: string;
  description: string;
  route: string;
  keywords: readonly string[];
  source: string;
};

export type SearchableCatalogAsset = {
  id: string;
  title: string;
  description: string;
  route: string;
  keywords: readonly string[];
  source: string;
};

export type GlobalSearchKind =
  | 'app'
  | 'work'
  | 'person'
  | 'organization'
  | 'audit'
  | 'tenant'
  | 'catalog'
  | 'ask';

export type GlobalSearchItem = {
  id: string;
  kind: GlobalSearchKind;
  title: string;
  description: string;
  route: string;
  keywords: readonly string[];
  source: string;
  recommended?: boolean;
};

export type GlobalSearchTranslate = (
  key: string,
  options?: Record<string, string | number>
) => string;

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
  work: readonly SearchableWorkItem[],
  translate?: GlobalSearchTranslate,
  entities: {
    people?: readonly SearchablePerson[];
    organizations?: readonly SearchableOrganization[];
    audits?: readonly SearchableAuditEvent[];
    tenants?: readonly SearchableTenant[];
    catalogAssets?: readonly SearchableCatalogAsset[];
  } = {}
): GlobalSearchItem[] {
  const appItems = apps.map<GlobalSearchItem>((app) => ({
    id: `app-${app.id}`,
    kind: 'app',
    title: app.name,
    description: app.description,
    route: app.route,
    keywords: [app.groupId, app.resourceKey],
    source: translated(translate, 'search.sources.apps', 'Apps'),
    recommended: ['dwp-work', 'dwp-ask', 'dwp-activity'].includes(app.id),
  }));
  const workItems = work.map<GlobalSearchItem>((item) => ({
    id: `work-${item.id}`,
    kind: 'work',
    title: item.title,
    description: `${translated(translate, `search.workTypes.${item.type}`, item.type)} / ${item.due} / ${item.sourceSystem}`,
    route: `/work?item=${encodeURIComponent(item.id)}`,
    keywords: [item.id, item.type, item.priority, item.status, item.sourceSystem, item.owner],
    source: translated(translate, 'search.sources.work', 'Work'),
  }));
  const peopleItems = (entities.people ?? []).map<GlobalSearchItem>((person) => ({
    id: `person-${person.personId}`,
    kind: 'person',
    title: person.displayName,
    description:
      [person.businessTitle || person.jobProfileName, person.organizationName]
        .filter(Boolean)
        .join(' / ') ||
      person.workEmail ||
      translated(translate, 'search.people.descriptionFallback', 'People directory'),
    route: `/people/directory?person=${encodeURIComponent(person.personId)}`,
    keywords: [
      person.personId,
      person.workEmail ?? '',
      person.businessTitle ?? '',
      person.jobProfileName ?? '',
      person.organizationName ?? '',
    ],
    source: translated(translate, 'search.sources.people', 'People'),
  }));
  const organizationItems = (entities.organizations ?? []).map<GlobalSearchItem>(
    (organization) => ({
      id: `organization-${organization.organizationId}`,
      kind: 'organization',
      title: organization.name,
      description: translated(
        translate,
        'search.organizations.description',
        `${organization.organizationTypeName} / ${organization.totalHeadcount} people`,
        {
          type: organization.organizationTypeName,
          count: organization.totalHeadcount,
        }
      ),
      route: `/people/organization?mode=organizations&organization=${encodeURIComponent(
        organization.organizationId
      )}`,
      keywords: [organization.organizationId, organization.organizationKey],
      source: translated(translate, 'search.sources.organizations', 'Organizations'),
    })
  );
  const auditItems = (entities.audits ?? []).map<GlobalSearchItem>((event) => ({
    id: `audit-${event.id}`,
    kind: 'audit',
    title: event.title,
    description: event.description,
    route: event.route,
    keywords: event.keywords,
    source: event.source,
  }));
  const tenantItems = (entities.tenants ?? []).map<GlobalSearchItem>((tenant) => ({
    id: `tenant-${tenant.tenantId}`,
    kind: 'tenant',
    title: tenant.title,
    description: tenant.description,
    route: tenant.route,
    keywords: tenant.keywords,
    source: tenant.source,
  }));
  const catalogItems = (entities.catalogAssets ?? []).map<GlobalSearchItem>((asset) => ({
    id: `catalog-${asset.id}`,
    kind: 'catalog',
    title: asset.title,
    description: asset.description,
    route: asset.route,
    keywords: asset.keywords,
    source: asset.source,
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
    source: translated(translate, 'search.sources.apps', 'Apps'),
    recommended: true,
  };
  return [
    ...appItems,
    browseApps,
    ...workItems,
    ...peopleItems,
    ...organizationItems,
    ...tenantItems,
    ...auditItems,
    ...catalogItems,
  ];
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
      'Prepare a traceable read-only request plan'
    ),
    route: askRoute(value),
    keywords: [],
    source: translated(translate, 'search.sources.ask', 'Ask DWP'),
  };
}
