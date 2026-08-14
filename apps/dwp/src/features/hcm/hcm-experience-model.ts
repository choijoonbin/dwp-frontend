import type { PersonSummary, WorkspaceWorkItem } from '@dwp-frontend/shared-utils';

const HR_SOURCE_PATTERN = /(^|\s)(hr|hris|people|workforce|benefit|human)(\s|$)/iu;

function normalized(value?: string | null): string {
  return value?.trim().toLocaleLowerCase() ?? '';
}

export function selectCurrentPerson(
  people: readonly PersonSummary[],
  identity: { email?: string | null; displayName?: string | null }
): PersonSummary | undefined {
  const email = normalized(identity.email);
  if (email) {
    const exactEmail = people.find((person) => normalized(person.workEmail) === email);
    if (exactEmail) return exactEmail;
  }
  const displayName = normalized(identity.displayName);
  return displayName
    ? people.find((person) => normalized(person.displayName) === displayName)
    : undefined;
}

export function isHrWorkItem(
  item: Pick<WorkspaceWorkItem, 'sourceRoute' | 'sourceSystem'>
): boolean {
  const route = item.sourceRoute ?? '';
  return (
    route === '/hr' ||
    route.startsWith('/hr/') ||
    route === '/people' ||
    route.startsWith('/people/') ||
    route === '/workforce' ||
    route.startsWith('/workforce/') ||
    HR_SOURCE_PATTERN.test(item.sourceSystem)
  );
}
