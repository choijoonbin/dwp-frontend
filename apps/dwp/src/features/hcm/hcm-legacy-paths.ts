export const HCM_DEFAULT_PATH = '/hr/home';

export function mapLegacyHrPath(pathname: string): string {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/u, '') : pathname;
  const explicitRoutes: Record<string, string> = {
    '/people': HCM_DEFAULT_PATH,
    '/people/directory': '/hr/directory',
    '/people/organization': '/hr/organization',
    '/workforce': '/hr/operations',
    '/workforce/overview': '/hr/operations',
    '/workforce/people': '/hr/operations/people',
    '/workforce/assignments': '/hr/operations/assignments',
    '/workforce/organization': '/hr/design/organization',
    '/workforce/reference-data': '/hr/data/reference',
    '/workforce/data-operations': '/hr/data/integrations',
    '/workforce/exports': '/hr/data/exports',
  };
  return explicitRoutes[normalized] ?? normalized;
}
