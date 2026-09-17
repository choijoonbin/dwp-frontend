import type { ProductSurfaceTaskKind } from '@dwp-frontend/shared-utils/api/observability-api';

export type ProductSurfaceTaskBinding = Readonly<{
  productKey: string;
  surfaceKey: string;
  routeContractKey: string;
}>;

const WORKPLACE_OPERATIONS_ACTIONS = new Set([
  'route.workplace.management.access-zones-by-zone-id-put.action',
  'route.workplace.management.access-zones-post.action',
  'route.workplace.management.assistant-governance-put.action',
  'route.workplace.management.bookings-by-booking-id-force-cancel-put.action',
  'route.workplace.management.bookings-by-booking-id-legal-hold-put.action',
  'route.workplace.management.connector-replay-preview.action',
  'route.workplace.management.connector-replay-start.action',
  'route.workplace.management.device-providers-by-capability-put.action',
  'route.workplace.management.devices-by-device-id-approve-post.action',
  'route.workplace.management.devices-by-device-id-bind-post.action',
  'route.workplace.management.devices-by-device-id-commands-post.action',
  'route.workplace.management.devices-by-device-id-commands-preview-post.action',
  'route.workplace.management.exception-export-preview.action',
  'route.workplace.management.exception-export.action',
  'route.workplace.management.exception-recovery-preview.action',
  'route.workplace.management.exception-recovery.action',
  'route.workplace.management.experience-collaboration-booking-policy-changes-post.action',
  'route.workplace.management.experience-collaboration-booking-policy-review-post.action',
  'route.workplace.management.experience-collaboration-connectors-by-kind-put.action',
  'route.workplace.management.experience-collaboration-delegations-by-delegation-id-changes-post.action',
  'route.workplace.management.experience-collaboration-delegations-by-delegation-id-review-post.action',
  'route.workplace.management.experience-collaboration-delegations-changes-post.action',
  'route.workplace.management.experience-collaboration-delegations-review-post.action',
  'route.workplace.management.experience-collaboration-policy-overrides-by-override-id-changes-post.action',
  'route.workplace.management.experience-collaboration-policy-overrides-by-override-id-review-post.action',
  'route.workplace.management.experience-collaboration-policy-overrides-changes-post.action',
  'route.workplace.management.experience-collaboration-policy-overrides-review-post.action',
  'route.workplace.management.experience-collaboration-policy-put.action',
  'route.workplace.management.experience-collaboration-resources-by-resource-id-photo-delete.action',
  'route.workplace.management.experience-collaboration-resources-by-resource-id-photo-post.action',
  'route.workplace.management.experience-collaboration-sites-by-site-id-access-rules-by-rule-id-changes-post.action',
  'route.workplace.management.experience-collaboration-sites-by-site-id-access-rules-by-rule-id-review-post.action',
  'route.workplace.management.experience-collaboration-sites-by-site-id-access-rules-changes-post.action',
  'route.workplace.management.experience-collaboration-sites-by-site-id-access-rules-review-post.action',
  'route.workplace.management.experience-facilities-closures-by-closure-id-cancel-put.action',
  'route.workplace.management.experience-facilities-requests-by-request-id-status-put.action',
  'route.workplace.management.experience-facilities-resources-by-resource-id-closures-post.action',
  'route.workplace.management.facility-closure-impact-execute.action',
  'route.workplace.management.facility-closure-notifications-reconcile.action',
  'route.workplace.management.facility-closure-notifications-retry.action',
  'route.workplace.management.floors-by-floor-id-background-post.action',
  'route.workplace.management.floors-by-floor-id-layout-put.action',
  'route.workplace.management.floors-by-floor-id-resources-by-resource-id-put.action',
  'route.workplace.management.floors-by-floor-id-resources-post.action',
  'route.workplace.management.governance-campuses-by-campus-id-put.action',
  'route.workplace.management.governance-campuses-post.action',
  'route.workplace.management.governance-delegated-admin-scopes-by-delegation-id-put.action',
  'route.workplace.management.governance-delegated-admin-scopes-post.action',
  'route.workplace.management.governance-floor-plan-revisions-by-revision-id-background-post.action',
  'route.workplace.management.governance-floor-plan-revisions-by-revision-id-publish-post.action',
  'route.workplace.management.governance-floor-plan-revisions-by-revision-id-put.action',
  'route.workplace.management.governance-floor-plan-revisions-by-revision-id-restore-post.action',
  'route.workplace.management.governance-floor-plan-revisions-by-revision-id-review-post.action',
  'route.workplace.management.governance-floors-by-floor-id-floor-plan-revisions-post.action',
  'route.workplace.management.governance-floors-by-floor-id-zones-by-zone-id-put.action',
  'route.workplace.management.governance-floors-by-floor-id-zones-post.action',
  'route.workplace.management.governance-policy-overrides-by-override-id-put.action',
  'route.workplace.management.governance-policy-overrides-post.action',
  'route.workplace.management.governance-sites-by-site-id-access-rules-by-rule-id-put.action',
  'route.workplace.management.governance-sites-by-site-id-access-rules-post.action',
  'route.workplace.management.governance-sites-by-site-id-campus-put.action',
  'route.workplace.management.governance-zones-by-zone-id-sections-by-section-id-put.action',
  'route.workplace.management.governance-zones-by-zone-id-sections-post.action',
  'route.workplace.management.kiosk-devices-by-device-id-put.action',
  'route.workplace.management.kiosk-devices-post.action',
  'route.workplace.management.navigation-graphs-by-graph-id-archive-post.action',
  'route.workplace.management.navigation-graphs-by-graph-id-publish-post.action',
  'route.workplace.management.navigation-graphs-by-graph-id-review-post.action',
  'route.workplace.management.navigation-graphs-post.action',
  'route.workplace.management.policy-put.action',
  'route.workplace.management.provider-bindings-by-binding-id-put.action',
  'route.workplace.management.provider-bindings-by-binding-id-test-post.action',
  'route.workplace.management.provider-bindings-post.action',
  'route.workplace.management.room-booking-decision-post.action',
  'route.workplace.management.room-policy-put.action',
  'route.workplace.management.room-resource-by-resource-id-put.action',
  'route.workplace.management.room-resources-post.action',
  'route.workplace.management.safety-connectors-by-kind-put.action',
  'route.workplace.management.safety-emergency-contacts-by-contact-id-put.action',
  'route.workplace.management.safety-incidents-by-incident-id-assembly-confirmations-post.action',
  'route.workplace.management.safety-incidents-by-incident-id-closure-requests-by-closure-id-approve-post.action',
  'route.workplace.management.safety-incidents-by-incident-id-closure-requests-post.action',
  'route.workplace.management.safety-incidents-by-incident-id-closures-preview-post.action',
  'route.workplace.management.safety-incidents-by-incident-id-dispatches-resend-post.action',
  'route.workplace.management.safety-incidents-by-incident-id-emergency-handoffs-by-command-id-reconcile-post.action',
  'route.workplace.management.safety-incidents-by-incident-id-emergency-handoffs-post.action',
  'route.workplace.management.safety-incidents-by-incident-id-emergency-handoffs-preview-post.action',
  'route.workplace.management.safety-incidents-by-incident-id-exports-post.action',
  'route.workplace.management.safety-incidents-by-incident-id-messages-post.action',
  'route.workplace.management.safety-incidents-by-incident-id-scope-revisions-post.action',
  'route.workplace.management.safety-incidents-by-incident-id-scope-revisions-preview-post.action',
  'route.workplace.management.safety-incidents-post.action',
  'route.workplace.management.safety-incidents-preview-post.action',
  'route.workplace.management.service-catalog-by-catalog-item-id-capacity-put.action',
  'route.workplace.management.service-catalog-create.action',
  'route.workplace.management.service-catalog-state.action',
  'route.workplace.management.service-catalog-update.action',
  'route.workplace.management.service-fulfillment-attachment-scan-result.action',
  'route.workplace.management.service-fulfillment-attachment-upload.action',
  'route.workplace.management.service-fulfillment-line-adjustment-reconcile.action',
  'route.workplace.management.service-fulfillment-message.action',
  'route.workplace.management.service-fulfillment-task-update.action',
  'route.workplace.management.service-orders-by-order-id-lines-by-line-id-inspection-attempts-post.action',
  'route.workplace.management.service-orders-by-order-id-tasks-by-task-id-assign-post.action',
  'route.workplace.management.service-providers-by-provider-id-put.action',
  'route.workplace.management.service-providers-by-provider-id-state-post.action',
  'route.workplace.management.service-providers-by-provider-id-verify-post.action',
  'route.workplace.management.service-providers-post.action',
  'route.workplace.management.sites-by-site-id-floors-by-floor-id-put.action',
  'route.workplace.management.sites-by-site-id-floors-post.action',
  'route.workplace.management.sites-by-site-id-put.action',
  'route.workplace.management.sites-post.action',
  'route.workplace.management.space-planning-scenarios-by-scenario-id-approve-post.action',
  'route.workplace.management.space-planning-scenarios-by-scenario-id-booking-impact-preview-post.action',
  'route.workplace.management.space-planning-scenarios-by-scenario-id-preview-post.action',
  'route.workplace.management.space-planning-scenarios-by-scenario-id-publish-post.action',
  'route.workplace.management.space-planning-scenarios-by-scenario-id-put.action',
  'route.workplace.management.space-planning-scenarios-by-scenario-id-submit-post.action',
  'route.workplace.management.space-planning-scenarios-post.action',
  'route.workplace.management.space-planning-report-execute.action',
  'route.workplace.management.visit-policies-by-policy-id-impact-preview-post.action',
  'route.workplace.management.visit-policies-by-policy-id-put.action',
  'route.workplace.management.visit-policies-post.action',
  'route.workplace.management.visits-by-visit-id-approve-post.action',
  'route.workplace.management.visits-by-visit-id-confirm-checkout-post.action',
  'route.workplace.management.visits-by-visit-id-notify-host-post.action',
  'route.workplace.management.visits-by-visit-id-retry-access-post.action',
]);

const MAIL_OPERATIONS_ACTIONS = new Set([
  'route.admin.mail.connection-diagnostics.action',
  'route.admin.mail.connection-sync.action',
  'route.admin.mail.connection-test-send.action',
  'route.admin.mail.delivery-export-approve.action',
  'route.admin.mail.delivery-export-create.action',
  'route.admin.mail.delivery.cancel.action',
  'route.admin.mail.delivery.reconcile.action',
  'route.admin.mail.delivery.retry.action',
]);

const MAIL_ADMINISTRATION_ACTIONS = new Set([
  'route.admin.mail.connection-update.action',
  'route.admin.mail.policy-update.action',
  'route.admin.mail.retention.evidence-export-approve.action',
  'route.admin.mail.retention.evidence-export.action',
  'route.admin.mail.retention.hold-create.action',
  'route.admin.mail.retention.hold-release-approve.action',
  'route.admin.mail.retention.hold-release-execute.action',
  'route.admin.mail.retention.hold-release-preview-create.action',
  'route.admin.mail.retention.hold-update.action',
  'route.admin.mail.retention.purge-authorize.action',
  'route.admin.mail.retention.purge-execute.action',
  'route.admin.mail.retention.purge-preview.action',
  'route.admin.mail.shared-inbox-update.action',
  'route.admin.mail.shared-member-create.action',
  'route.admin.mail.shared-member-revoke-preview.action',
  'route.admin.mail.shared-member-revoke.action',
  'route.admin.mail.shared-member-update.action',
  'route.admin.mail.writing-asset-approve.action',
  'route.admin.mail.writing-asset-create.action',
  'route.admin.mail.writing-asset-edit.action',
  'route.admin.mail.writing-asset-publish.action',
  'route.admin.mail.writing-asset-retire.action',
  'route.admin.mail.writing-asset-submit.action',
]);

/**
 * Closed telemetry classification for governed mutations. Authority registries stay the source of
 * truth for access; this projection only selects a privacy-safe KPI dimension and fails closed when
 * a new ACTION has not been deliberately classified.
 */
export function resolveProductSurfaceTaskKind(
  binding: ProductSurfaceTaskBinding
): ProductSurfaceTaskKind {
  const { productKey, surfaceKey, routeContractKey } = binding;
  const productRoutePrefix = `route.${productKey}.`;
  const adminProductRoutePrefix = `route.admin.${productKey}.`;
  if (
    (!routeContractKey.startsWith(productRoutePrefix) &&
      !routeContractKey.startsWith(adminProductRoutePrefix)) ||
    !routeContractKey.endsWith('.action')
  ) {
    throw new Error(`Invalid governed mutation telemetry binding: ${routeContractKey}`);
  }

  if (productKey === 'approvals') {
    if (surfaceKey === 'approvals.work') return 'WORK';
    if (surfaceKey === 'approvals.admin') {
      return routeContractKey.includes('.operations.') ? 'OPERATIONS' : 'ADMINISTRATION';
    }
  }

  if (productKey === 'dwaion') {
    if (surfaceKey === 'dwaion.work') return 'WORK';
    if (surfaceKey === 'dwaion.management') return 'ADMINISTRATION';
  }

  if (
    (productKey === 'calendar' && surfaceKey === 'calendar.work') ||
    (productKey === 'mail' && surfaceKey === 'mail.work') ||
    (productKey === 'meetings' && surfaceKey === 'meetings.work') ||
    (productKey === 'messaging' && surfaceKey === 'messaging.work') ||
    (productKey === 'notifications' && surfaceKey === 'notifications.work') ||
    (productKey === 'spaces' && surfaceKey === 'spaces.work') ||
    (productKey === 'workplace' && surfaceKey === 'workplace.work')
  ) {
    return 'WORK';
  }

  if (productKey === 'mail' && surfaceKey === 'mail.management') {
    if (MAIL_OPERATIONS_ACTIONS.has(routeContractKey)) return 'OPERATIONS';
    if (MAIL_ADMINISTRATION_ACTIONS.has(routeContractKey)) return 'ADMINISTRATION';
  }

  if (
    productKey === 'workplace' &&
    surfaceKey === 'workplace.management' &&
    WORKPLACE_OPERATIONS_ACTIONS.has(routeContractKey)
  ) {
    return 'OPERATIONS';
  }

  if (productKey === 'communications') {
    if (surfaceKey === 'communications.work') return 'WORK';
    if (surfaceKey === 'communications.management') return 'OPERATIONS';
  }

  if (productKey === 'services') {
    if (surfaceKey === 'services.work') return 'WORK';
    if (surfaceKey === 'services.management') {
      return routeContractKey.includes('.request-transition.') ? 'OPERATIONS' : 'ADMINISTRATION';
    }
  }

  if (productKey === 'hcm') {
    if (surfaceKey === 'hcm.personal') return 'WORK';
    if (surfaceKey === 'hcm.team') return 'REVIEW';
    if (surfaceKey === 'hcm.operations') return 'OPERATIONS';
    if (surfaceKey === 'hcm.management') {
      if (routeContractKey.includes('.controlled-export-')) return 'REPORTING';
      if (routeContractKey.includes('.integration-')) return 'INTEGRATION';
      if (routeContractKey.includes('.org-')) return 'DESIGN';
      if (routeContractKey.includes('.reference-')) return 'CONFIGURATION';
    }
  }

  throw new Error(`Unclassified governed mutation telemetry binding: ${routeContractKey}`);
}
