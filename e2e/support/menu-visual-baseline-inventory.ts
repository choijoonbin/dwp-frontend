export type MenuVisualProject = 'chromium' | 'mobile';

export type MenuVisualBaselineEntry = {
  routeId: string;
  project: MenuVisualProject;
  fileName: string;
};

export const MENU_VISUAL_BASELINE_INVENTORY: readonly MenuVisualBaselineEntry[] = [
  {
    routeId: 'account.accessibility',
    project: 'chromium',
    fileName: 'account-accessibility-chromium-darwin.png',
  },
  {
    routeId: 'account.accessibility',
    project: 'mobile',
    fileName: 'account-accessibility-mobile-darwin.png',
  },
  {
    routeId: 'account.appearance',
    project: 'chromium',
    fileName: 'account-appearance-chromium-darwin.png',
  },
  {
    routeId: 'account.appearance',
    project: 'mobile',
    fileName: 'account-appearance-mobile-darwin.png',
  },
  {
    routeId: 'account.home',
    project: 'chromium',
    fileName: 'account-home-chromium-darwin.png',
  },
  {
    routeId: 'account.home',
    project: 'mobile',
    fileName: 'account-home-mobile-darwin.png',
  },
  {
    routeId: 'account.language',
    project: 'chromium',
    fileName: 'account-language-chromium-darwin.png',
  },
  {
    routeId: 'account.language',
    project: 'mobile',
    fileName: 'account-language-mobile-darwin.png',
  },
  {
    routeId: 'account.managed',
    project: 'chromium',
    fileName: 'account-managed-chromium-darwin.png',
  },
  {
    routeId: 'account.managed',
    project: 'mobile',
    fileName: 'account-managed-mobile-darwin.png',
  },
  {
    routeId: 'account.profile',
    project: 'chromium',
    fileName: 'account-profile-chromium-darwin.png',
  },
  {
    routeId: 'account.profile',
    project: 'mobile',
    fileName: 'account-profile-mobile-darwin.png',
  },
  {
    routeId: 'account.security',
    project: 'chromium',
    fileName: 'account-security-chromium-darwin.png',
  },
  {
    routeId: 'account.security',
    project: 'mobile',
    fileName: 'account-security-mobile-darwin.png',
  },
  {
    routeId: 'admin.access',
    project: 'chromium',
    fileName: 'admin-access-chromium-darwin.png',
  },
  {
    routeId: 'admin.access',
    project: 'mobile',
    fileName: 'admin-access-mobile-darwin.png',
  },
  {
    routeId: 'admin.access-reviews',
    project: 'chromium',
    fileName: 'admin-access-reviews-chromium-darwin.png',
  },
  {
    routeId: 'admin.access-reviews',
    project: 'mobile',
    fileName: 'admin-access-reviews-mobile-darwin.png',
  },
  {
    routeId: 'admin.api-monitoring',
    project: 'chromium',
    fileName: 'admin-api-monitoring-chromium-darwin.png',
  },
  {
    routeId: 'admin.api-monitoring',
    project: 'mobile',
    fileName: 'admin-api-monitoring-mobile-darwin.png',
  },
  {
    routeId: 'admin.app-access-requests',
    project: 'chromium',
    fileName: 'admin-app-access-requests-chromium-darwin.png',
  },
  {
    routeId: 'admin.app-access-requests',
    project: 'mobile',
    fileName: 'admin-app-access-requests-mobile-darwin.png',
  },
  {
    routeId: 'admin.app-governance',
    project: 'chromium',
    fileName: 'admin-app-governance-chromium-darwin.png',
  },
  {
    routeId: 'admin.app-governance',
    project: 'mobile',
    fileName: 'admin-app-governance-mobile-darwin.png',
  },
  {
    routeId: 'admin.audit-events',
    project: 'chromium',
    fileName: 'admin-audit-events-chromium-darwin.png',
  },
  {
    routeId: 'admin.audit-events',
    project: 'mobile',
    fileName: 'admin-audit-events-mobile-darwin.png',
  },
  {
    routeId: 'admin.audit-governance',
    project: 'chromium',
    fileName: 'admin-audit-governance-chromium-darwin.png',
  },
  {
    routeId: 'admin.audit-governance',
    project: 'mobile',
    fileName: 'admin-audit-governance-mobile-darwin.png',
  },
  {
    routeId: 'admin.audit-investigations',
    project: 'chromium',
    fileName: 'admin-audit-investigations-chromium-darwin.png',
  },
  {
    routeId: 'admin.audit-investigations',
    project: 'mobile',
    fileName: 'admin-audit-investigations-mobile-darwin.png',
  },
  {
    routeId: 'admin.audit-overview',
    project: 'chromium',
    fileName: 'admin-audit-overview-chromium-darwin.png',
  },
  {
    routeId: 'admin.audit-overview',
    project: 'mobile',
    fileName: 'admin-audit-overview-mobile-darwin.png',
  },
  {
    routeId: 'admin.branding',
    project: 'chromium',
    fileName: 'admin-branding-chromium-darwin.png',
  },
  {
    routeId: 'admin.branding',
    project: 'mobile',
    fileName: 'admin-branding-mobile-darwin.png',
  },
  {
    routeId: 'admin.catalog',
    project: 'chromium',
    fileName: 'admin-catalog-chromium-darwin.png',
  },
  {
    routeId: 'admin.catalog',
    project: 'mobile',
    fileName: 'admin-catalog-mobile-darwin.png',
  },
  {
    routeId: 'admin.home-apps',
    project: 'chromium',
    fileName: 'admin-home-apps-chromium-darwin.png',
  },
  {
    routeId: 'admin.home-apps',
    project: 'mobile',
    fileName: 'admin-home-apps-mobile-darwin.png',
  },
  {
    routeId: 'admin.home-experience',
    project: 'chromium',
    fileName: 'admin-home-experience-chromium-darwin.png',
  },
  {
    routeId: 'admin.home-experience',
    project: 'mobile',
    fileName: 'admin-home-experience-mobile-darwin.png',
  },
  {
    routeId: 'admin.localization',
    project: 'chromium',
    fileName: 'admin-localization-chromium-darwin.png',
  },
  {
    routeId: 'admin.localization',
    project: 'mobile',
    fileName: 'admin-localization-mobile-darwin.png',
  },
  {
    routeId: 'admin.navigation',
    project: 'chromium',
    fileName: 'admin-navigation-chromium-darwin.png',
  },
  {
    routeId: 'admin.navigation',
    project: 'mobile',
    fileName: 'admin-navigation-mobile-darwin.png',
  },
  {
    routeId: 'admin.preference-exceptions',
    project: 'chromium',
    fileName: 'admin-preference-exceptions-chromium-darwin.png',
  },
  {
    routeId: 'admin.preference-exceptions',
    project: 'mobile',
    fileName: 'admin-preference-exceptions-mobile-darwin.png',
  },
  {
    routeId: 'admin.productivity',
    project: 'chromium',
    fileName: 'admin-productivity-chromium-darwin.png',
  },
  {
    routeId: 'admin.productivity',
    project: 'mobile',
    fileName: 'admin-productivity-mobile-darwin.png',
  },
  {
    routeId: 'admin.provisioning',
    project: 'chromium',
    fileName: 'admin-provisioning-chromium-darwin.png',
  },
  {
    routeId: 'admin.provisioning',
    project: 'mobile',
    fileName: 'admin-provisioning-mobile-darwin.png',
  },
  {
    routeId: 'admin.reference-data',
    project: 'chromium',
    fileName: 'admin-reference-data-chromium-darwin.png',
  },
  {
    routeId: 'admin.reference-data',
    project: 'mobile',
    fileName: 'admin-reference-data-mobile-darwin.png',
  },
  {
    routeId: 'admin.registry',
    project: 'chromium',
    fileName: 'admin-registry-chromium-darwin.png',
  },
  {
    routeId: 'admin.registry',
    project: 'mobile',
    fileName: 'admin-registry-mobile-darwin.png',
  },
  {
    routeId: 'admin.roles',
    project: 'chromium',
    fileName: 'admin-roles-chromium-darwin.png',
  },
  {
    routeId: 'admin.roles',
    project: 'mobile',
    fileName: 'admin-roles-mobile-darwin.png',
  },
  {
    routeId: 'admin.saved-view-custody',
    project: 'chromium',
    fileName: 'admin-saved-view-custody-chromium-darwin.png',
  },
  {
    routeId: 'admin.saved-view-custody',
    project: 'mobile',
    fileName: 'admin-saved-view-custody-mobile-darwin.png',
  },
  {
    routeId: 'admin.workforce-access',
    project: 'chromium',
    fileName: 'admin-workforce-access-chromium-darwin.png',
  },
  {
    routeId: 'admin.workforce-access',
    project: 'mobile',
    fileName: 'admin-workforce-access-mobile-darwin.png',
  },
  {
    routeId: 'approvals.admin-overview',
    project: 'chromium',
    fileName: 'approvals-admin-overview-chromium-darwin.png',
  },
  {
    routeId: 'approvals.admin-overview',
    project: 'mobile',
    fileName: 'approvals-admin-overview-mobile-darwin.png',
  },
  {
    routeId: 'approvals.archive',
    project: 'chromium',
    fileName: 'approvals-archive-chromium-darwin.png',
  },
  {
    routeId: 'approvals.archive',
    project: 'mobile',
    fileName: 'approvals-archive-mobile-darwin.png',
  },
  {
    routeId: 'approvals.delegations',
    project: 'chromium',
    fileName: 'approvals-delegations-chromium-darwin.png',
  },
  {
    routeId: 'approvals.delegations',
    project: 'mobile',
    fileName: 'approvals-delegations-mobile-darwin.png',
  },
  {
    routeId: 'approvals.drafts',
    project: 'chromium',
    fileName: 'approvals-drafts-chromium-darwin.png',
  },
  {
    routeId: 'approvals.drafts',
    project: 'mobile',
    fileName: 'approvals-drafts-mobile-darwin.png',
  },
  {
    routeId: 'approvals.forms',
    project: 'chromium',
    fileName: 'approvals-forms-chromium-darwin.png',
  },
  {
    routeId: 'approvals.forms',
    project: 'mobile',
    fileName: 'approvals-forms-mobile-darwin.png',
  },
  {
    routeId: 'approvals.home',
    project: 'chromium',
    fileName: 'approvals-home-chromium-darwin.png',
  },
  {
    routeId: 'approvals.home',
    project: 'mobile',
    fileName: 'approvals-home-mobile-darwin.png',
  },
  {
    routeId: 'approvals.inbox',
    project: 'chromium',
    fileName: 'approvals-inbox-chromium-darwin.png',
  },
  {
    routeId: 'approvals.inbox',
    project: 'mobile',
    fileName: 'approvals-inbox-mobile-darwin.png',
  },
  {
    routeId: 'approvals.needs-info',
    project: 'chromium',
    fileName: 'approvals-needs-info-chromium-darwin.png',
  },
  {
    routeId: 'approvals.needs-info',
    project: 'mobile',
    fileName: 'approvals-needs-info-mobile-darwin.png',
  },
  {
    routeId: 'approvals.new',
    project: 'chromium',
    fileName: 'approvals-new-chromium-darwin.png',
  },
  {
    routeId: 'approvals.new',
    project: 'mobile',
    fileName: 'approvals-new-mobile-darwin.png',
  },
  {
    routeId: 'approvals.operations',
    project: 'chromium',
    fileName: 'approvals-operations-chromium-darwin.png',
  },
  {
    routeId: 'approvals.operations',
    project: 'mobile',
    fileName: 'approvals-operations-mobile-darwin.png',
  },
  {
    routeId: 'approvals.policies',
    project: 'chromium',
    fileName: 'approvals-policies-chromium-darwin.png',
  },
  {
    routeId: 'approvals.policies',
    project: 'mobile',
    fileName: 'approvals-policies-mobile-darwin.png',
  },
  {
    routeId: 'approvals.signatures',
    project: 'chromium',
    fileName: 'approvals-signatures-chromium-darwin.png',
  },
  {
    routeId: 'approvals.signatures',
    project: 'mobile',
    fileName: 'approvals-signatures-mobile-darwin.png',
  },
  {
    routeId: 'approvals.submitted',
    project: 'chromium',
    fileName: 'approvals-submitted-chromium-darwin.png',
  },
  {
    routeId: 'approvals.submitted',
    project: 'mobile',
    fileName: 'approvals-submitted-mobile-darwin.png',
  },
  {
    routeId: 'approvals.workflows',
    project: 'chromium',
    fileName: 'approvals-workflows-chromium-darwin.png',
  },
  {
    routeId: 'approvals.workflows',
    project: 'mobile',
    fileName: 'approvals-workflows-mobile-darwin.png',
  },
  {
    routeId: 'calendar.admin-company-calendars',
    project: 'chromium',
    fileName: 'calendar-admin-company-calendars-chromium-darwin.png',
  },
  {
    routeId: 'calendar.admin-overview',
    project: 'chromium',
    fileName: 'calendar-admin-overview-chromium-darwin.png',
  },
  {
    routeId: 'calendar.admin-overview',
    project: 'mobile',
    fileName: 'calendar-admin-overview-mobile-darwin.png',
  },
  {
    routeId: 'calendar.admin-policies',
    project: 'chromium',
    fileName: 'calendar-admin-policies-chromium-darwin.png',
  },
  {
    routeId: 'calendar.admin-policies',
    project: 'mobile',
    fileName: 'calendar-admin-policies-mobile-darwin.png',
  },
  {
    routeId: 'calendar.availability',
    project: 'chromium',
    fileName: 'calendar-availability-chromium-darwin.png',
  },
  {
    routeId: 'calendar.availability',
    project: 'mobile',
    fileName: 'calendar-availability-mobile-darwin.png',
  },
  {
    routeId: 'calendar.home',
    project: 'chromium',
    fileName: 'calendar-home-chromium-darwin.png',
  },
  {
    routeId: 'calendar.home',
    project: 'mobile',
    fileName: 'calendar-home-mobile-darwin.png',
  },
  {
    routeId: 'calendar.insights',
    project: 'chromium',
    fileName: 'calendar-insights-chromium-darwin.png',
  },
  {
    routeId: 'calendar.insights',
    project: 'mobile',
    fileName: 'calendar-insights-mobile-darwin.png',
  },
  {
    routeId: 'calendar.schedule',
    project: 'chromium',
    fileName: 'calendar-schedule-chromium-darwin.png',
  },
  {
    routeId: 'calendar.schedule',
    project: 'mobile',
    fileName: 'calendar-schedule-mobile-darwin.png',
  },
  {
    routeId: 'hcm.absence',
    project: 'chromium',
    fileName: 'hcm-absence-chromium-darwin.png',
  },
  {
    routeId: 'hcm.absence',
    project: 'mobile',
    fileName: 'hcm-absence-mobile-darwin.png',
  },
  {
    routeId: 'hcm.absence-operations',
    project: 'chromium',
    fileName: 'hcm-absence-operations-chromium-darwin.png',
  },
  {
    routeId: 'hcm.absence-operations',
    project: 'mobile',
    fileName: 'hcm-absence-operations-mobile-darwin.png',
  },
  {
    routeId: 'hcm.assignments',
    project: 'chromium',
    fileName: 'hcm-assignments-chromium-darwin.png',
  },
  {
    routeId: 'hcm.assignments',
    project: 'mobile',
    fileName: 'hcm-assignments-mobile-darwin.png',
  },
  {
    routeId: 'hcm.benefits',
    project: 'chromium',
    fileName: 'hcm-benefits-chromium-darwin.png',
  },
  {
    routeId: 'hcm.benefits',
    project: 'mobile',
    fileName: 'hcm-benefits-mobile-darwin.png',
  },
  {
    routeId: 'hcm.benefits-operations',
    project: 'chromium',
    fileName: 'hcm-benefits-operations-chromium-darwin.png',
  },
  {
    routeId: 'hcm.benefits-operations',
    project: 'mobile',
    fileName: 'hcm-benefits-operations-mobile-darwin.png',
  },
  {
    routeId: 'hcm.data-operations',
    project: 'chromium',
    fileName: 'hcm-data-operations-chromium-darwin.png',
  },
  {
    routeId: 'hcm.data-operations',
    project: 'mobile',
    fileName: 'hcm-data-operations-mobile-darwin.png',
  },
  {
    routeId: 'hcm.directory',
    project: 'chromium',
    fileName: 'hcm-directory-chromium-darwin.png',
  },
  {
    routeId: 'hcm.directory',
    project: 'mobile',
    fileName: 'hcm-directory-mobile-darwin.png',
  },
  {
    routeId: 'hcm.exports',
    project: 'chromium',
    fileName: 'hcm-exports-chromium-darwin.png',
  },
  {
    routeId: 'hcm.exports',
    project: 'mobile',
    fileName: 'hcm-exports-mobile-darwin.png',
  },
  {
    routeId: 'hcm.home',
    project: 'chromium',
    fileName: 'hcm-home-chromium-darwin.png',
  },
  {
    routeId: 'hcm.home',
    project: 'mobile',
    fileName: 'hcm-home-mobile-darwin.png',
  },
  {
    routeId: 'hcm.me',
    project: 'chromium',
    fileName: 'hcm-me-chromium-darwin.png',
  },
  {
    routeId: 'hcm.me',
    project: 'mobile',
    fileName: 'hcm-me-mobile-darwin.png',
  },
  {
    routeId: 'hcm.operations',
    project: 'chromium',
    fileName: 'hcm-operations-chromium-darwin.png',
  },
  {
    routeId: 'hcm.operations',
    project: 'mobile',
    fileName: 'hcm-operations-mobile-darwin.png',
  },
  {
    routeId: 'hcm.organization',
    project: 'chromium',
    fileName: 'hcm-organization-chromium-darwin.png',
  },
  {
    routeId: 'hcm.organization-design',
    project: 'chromium',
    fileName: 'hcm-organization-design-chromium-darwin.png',
  },
  {
    routeId: 'hcm.organization-design',
    project: 'mobile',
    fileName: 'hcm-organization-design-mobile-darwin.png',
  },
  {
    routeId: 'hcm.organization',
    project: 'mobile',
    fileName: 'hcm-organization-mobile-darwin.png',
  },
  {
    routeId: 'hcm.pay',
    project: 'chromium',
    fileName: 'hcm-pay-chromium-darwin.png',
  },
  {
    routeId: 'hcm.pay',
    project: 'mobile',
    fileName: 'hcm-pay-mobile-darwin.png',
  },
  {
    routeId: 'hcm.pay-operations',
    project: 'chromium',
    fileName: 'hcm-pay-operations-chromium-darwin.png',
  },
  {
    routeId: 'hcm.pay-operations',
    project: 'mobile',
    fileName: 'hcm-pay-operations-mobile-darwin.png',
  },
  {
    routeId: 'hcm.people',
    project: 'chromium',
    fileName: 'hcm-people-chromium-darwin.png',
  },
  {
    routeId: 'hcm.people',
    project: 'mobile',
    fileName: 'hcm-people-mobile-darwin.png',
  },
  {
    routeId: 'hcm.reference-data',
    project: 'chromium',
    fileName: 'hcm-reference-data-chromium-darwin.png',
  },
  {
    routeId: 'hcm.reference-data',
    project: 'mobile',
    fileName: 'hcm-reference-data-mobile-darwin.png',
  },
  {
    routeId: 'hcm.services',
    project: 'chromium',
    fileName: 'hcm-services-chromium-darwin.png',
  },
  {
    routeId: 'hcm.services',
    project: 'mobile',
    fileName: 'hcm-services-mobile-darwin.png',
  },
  {
    routeId: 'hcm.talent',
    project: 'chromium',
    fileName: 'hcm-talent-chromium-darwin.png',
  },
  {
    routeId: 'hcm.talent',
    project: 'mobile',
    fileName: 'hcm-talent-mobile-darwin.png',
  },
  {
    routeId: 'hcm.talent-operations',
    project: 'chromium',
    fileName: 'hcm-talent-operations-chromium-darwin.png',
  },
  {
    routeId: 'hcm.talent-operations',
    project: 'mobile',
    fileName: 'hcm-talent-operations-mobile-darwin.png',
  },
  {
    routeId: 'hcm.team-absence',
    project: 'chromium',
    fileName: 'hcm-team-absence-chromium-darwin.png',
  },
  {
    routeId: 'hcm.team-absence',
    project: 'mobile',
    fileName: 'hcm-team-absence-mobile-darwin.png',
  },
  {
    routeId: 'hcm.team',
    project: 'chromium',
    fileName: 'hcm-team-chromium-darwin.png',
  },
  {
    routeId: 'hcm.team',
    project: 'mobile',
    fileName: 'hcm-team-mobile-darwin.png',
  },
  {
    routeId: 'hcm.team-time',
    project: 'chromium',
    fileName: 'hcm-team-time-chromium-darwin.png',
  },
  {
    routeId: 'hcm.team-time',
    project: 'mobile',
    fileName: 'hcm-team-time-mobile-darwin.png',
  },
  {
    routeId: 'hcm.time',
    project: 'chromium',
    fileName: 'hcm-time-chromium-darwin.png',
  },
  {
    routeId: 'hcm.time',
    project: 'mobile',
    fileName: 'hcm-time-mobile-darwin.png',
  },
  {
    routeId: 'hcm.time-operations',
    project: 'chromium',
    fileName: 'hcm-time-operations-chromium-darwin.png',
  },
  {
    routeId: 'hcm.time-operations',
    project: 'mobile',
    fileName: 'hcm-time-operations-mobile-darwin.png',
  },
  {
    routeId: 'provider.audit',
    project: 'chromium',
    fileName: 'provider-audit-chromium-darwin.png',
  },
  {
    routeId: 'provider.audit',
    project: 'mobile',
    fileName: 'provider-audit-mobile-darwin.png',
  },
  {
    routeId: 'provider.codeContracts',
    project: 'chromium',
    fileName: 'provider-codeContracts-chromium-darwin.png',
  },
  {
    routeId: 'provider.codeContracts',
    project: 'mobile',
    fileName: 'provider-codeContracts-mobile-darwin.png',
  },
  {
    routeId: 'provider.commercial',
    project: 'chromium',
    fileName: 'provider-commercial-chromium-darwin.png',
  },
  {
    routeId: 'provider.commercial',
    project: 'mobile',
    fileName: 'provider-commercial-mobile-darwin.png',
  },
  {
    routeId: 'provider.dataGovernance',
    project: 'chromium',
    fileName: 'provider-dataGovernance-chromium-darwin.png',
  },
  {
    routeId: 'provider.dataGovernance',
    project: 'mobile',
    fileName: 'provider-dataGovernance-mobile-darwin.png',
  },
  {
    routeId: 'provider.featureRollouts',
    project: 'chromium',
    fileName: 'provider-featureRollouts-chromium-darwin.png',
  },
  {
    routeId: 'provider.featureRollouts',
    project: 'mobile',
    fileName: 'provider-featureRollouts-mobile-darwin.png',
  },
  {
    routeId: 'provider.health',
    project: 'chromium',
    fileName: 'provider-health-chromium-darwin.png',
  },
  {
    routeId: 'provider.health',
    project: 'mobile',
    fileName: 'provider-health-mobile-darwin.png',
  },
  {
    routeId: 'provider.operations',
    project: 'chromium',
    fileName: 'provider-operations-chromium-darwin.png',
  },
  {
    routeId: 'provider.operations',
    project: 'mobile',
    fileName: 'provider-operations-mobile-darwin.png',
  },
  {
    routeId: 'provider.overview',
    project: 'chromium',
    fileName: 'provider-overview-chromium-darwin.png',
  },
  {
    routeId: 'provider.overview',
    project: 'mobile',
    fileName: 'provider-overview-mobile-darwin.png',
  },
  {
    routeId: 'provider.support',
    project: 'chromium',
    fileName: 'provider-support-chromium-darwin.png',
  },
  {
    routeId: 'provider.support',
    project: 'mobile',
    fileName: 'provider-support-mobile-darwin.png',
  },
  {
    routeId: 'provider.tenants',
    project: 'chromium',
    fileName: 'provider-tenants-chromium-darwin.png',
  },
  {
    routeId: 'provider.tenants',
    project: 'mobile',
    fileName: 'provider-tenants-mobile-darwin.png',
  },
];
