import type { TFunction } from 'i18next';
import type {
  OrganizationChartOrganization,
  OrganizationDesignPolicy,
} from '@dwp-frontend/shared-utils';

export type OrganizationLens =
  | 'structure'
  | 'health'
  | 'headcount'
  | 'span'
  | 'vacancy'
  | 'changes';

export const ORGANIZATION_LENSES: readonly OrganizationLens[] = [
  'structure',
  'health',
  'headcount',
  'span',
  'vacancy',
  'changes',
];

export function toggleSetValue(current: ReadonlySet<string>, value: string): Set<string> {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function matchesOrganization(
  organization: {
    name: string;
    shortName?: string | null;
    organizationKey: string;
    costCenterKey?: string | null;
  },
  search: string
): boolean {
  if (!search) return false;
  return [
    organization.name,
    organization.shortName,
    organization.organizationKey,
    organization.costCenterKey,
  ].some((value) => value?.toLocaleLowerCase().includes(search));
}

export function matchesPerson(
  person: {
    displayName: string;
    workEmail?: string | null;
    businessTitle?: string | null;
    jobProfileName?: string | null;
  },
  search: string
): boolean {
  if (!search) return false;
  return [person.displayName, person.workEmail, person.businessTitle, person.jobProfileName].some(
    (value) => value?.toLocaleLowerCase().includes(search)
  );
}

export function matchesPosition(
  position: {
    positionKey: string;
    title: string;
    jobProfileName?: string | null;
    locationName?: string | null;
  },
  search: string
): boolean {
  if (!search) return false;
  return [
    position.positionKey,
    position.title,
    position.jobProfileName,
    position.locationName,
  ].some((value) => value?.toLocaleLowerCase().includes(search));
}

export function organizationVisual(
  organization: OrganizationChartOrganization,
  lens: OrganizationLens,
  changed: boolean,
  policy: OrganizationDesignPolicy
): { accentColor: string; surfaceColor: string; changed: boolean } {
  if (lens === 'health') {
    if (organization.healthStatus === 'CRITICAL') {
      return { accentColor: '#C2412D', surfaceColor: '#FFF7F5', changed };
    }
    if (organization.healthStatus === 'ATTENTION') {
      return { accentColor: '#A16207', surfaceColor: '#FFFBEB', changed };
    }
    return { accentColor: '#16815F', surfaceColor: '#F4FBF8', changed };
  }
  if (lens === 'headcount') {
    if (organization.totalHeadcount >= 20) {
      return { accentColor: '#1D4ED8', surfaceColor: '#EFF6FF', changed };
    }
    if (organization.totalHeadcount >= 10) {
      return { accentColor: '#0F766E', surfaceColor: '#F0FDFA', changed };
    }
    return { accentColor: '#64748B', surfaceColor: '#F8FAFC', changed };
  }
  if (lens === 'span') {
    if (organization.averageManagerSpan > policy.maximumManagerSpan) {
      return { accentColor: '#C2412D', surfaceColor: '#FFF7F5', changed };
    }
    if (
      organization.managerCount > 0 &&
      organization.averageManagerSpan < policy.minimumManagerSpan
    ) {
      return { accentColor: '#A16207', surfaceColor: '#FFFBEB', changed };
    }
    return { accentColor: '#16815F', surfaceColor: '#F4FBF8', changed };
  }
  if (lens === 'vacancy') {
    return organization.openPositionCount > 0
      ? { accentColor: '#A16207', surfaceColor: '#FFFBEB', changed }
      : { accentColor: '#16815F', surfaceColor: '#F4FBF8', changed };
  }
  if (lens === 'changes') {
    return changed
      ? { accentColor: '#7C3AED', surfaceColor: '#F5F3FF', changed }
      : { accentColor: '#64748B', surfaceColor: '#F8FAFC', changed };
  }
  return { accentColor: '', surfaceColor: '', changed };
}

export function organizationLensLabel(
  organization: OrganizationChartOrganization,
  lens: OrganizationLens,
  changed: boolean,
  t: TFunction<'admin'>
): string | undefined {
  if (lens === 'health') {
    return t(`orgChart.health.${organization.healthStatus}`, {
      defaultValue: organization.healthStatus,
    });
  }
  if (lens === 'headcount') {
    return t('orgChart.lensValues.headcount', { count: organization.totalHeadcount });
  }
  if (lens === 'span') {
    return t('orgChart.lensValues.span', { value: organization.averageManagerSpan.toFixed(1) });
  }
  if (lens === 'vacancy') {
    return t('orgChart.lensValues.vacancy', { count: organization.openPositionCount });
  }
  if (lens === 'changes') {
    return t(changed ? 'orgChart.lensValues.changed' : 'orgChart.lensValues.unchanged');
  }
  return undefined;
}
