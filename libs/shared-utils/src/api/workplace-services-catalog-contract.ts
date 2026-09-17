import {
  WORKPLACE_SERVICE_CATEGORIES,
  WORKPLACE_SERVICE_PROVIDER_STATES,
} from './workplace-services-types';
import {
  bool,
  enumeration,
  instant,
  integer,
  invalid,
  list,
  nullableInteger,
  nullableText,
  number,
  object,
  record,
  stringList,
  text,
  uuid,
} from './workplace-services-contract-helpers';

import type {
  WorkplaceServiceCapacityMode,
  WorkplaceServiceCatalog,
  WorkplaceServiceCatalogAdminItem,
  WorkplaceServiceCatalogAdminItems,
  WorkplaceServiceCatalogCommandResult,
  WorkplaceServiceCatalogItem,
  WorkplaceServiceCategory,
  WorkplaceServiceCommandState,
  WorkplaceServiceInspectionMode,
  WorkplaceServiceOrderPreview,
  WorkplaceServicePreviewLine,
  WorkplaceServiceProviderState,
  WorkplaceServiceReservationAuthority,
} from './workplace-services-types';

const categories = new Set<WorkplaceServiceCategory>(WORKPLACE_SERVICE_CATEGORIES);
const providerStates = new Set<WorkplaceServiceProviderState>(WORKPLACE_SERVICE_PROVIDER_STATES);
const authorities = new Set<WorkplaceServiceReservationAuthority>(['WORKPLACE', 'CALENDAR']);
const commandStates = new Set<WorkplaceServiceCommandState>([
  'ACCEPTED',
  'SUCCEEDED',
  'FAILED',
  'RESULT_UNKNOWN',
]);
const capacityModes = new Set<WorkplaceServiceCapacityMode>(['UNBOUNDED', 'BUCKETED']);
const inspectionModes = new Set<WorkplaceServiceInspectionMode>(['NONE', 'OPERATOR', 'REQUESTER']);

function parseCatalogItem(value: unknown, path: string): WorkplaceServiceCatalogItem {
  const data = record(value, path);
  return Object.freeze({
    catalogItemId: uuid(data.catalogItemId, `${path}.catalogItemId`),
    serviceCode: text(data.serviceCode, `${path}.serviceCode`, 80),
    category: enumeration(data.category, categories, `${path}.category`),
    nameKo: text(data.nameKo, `${path}.nameKo`, 160),
    nameEn: text(data.nameEn, `${path}.nameEn`, 160),
    descriptionKo: nullableText(data.descriptionKo, `${path}.descriptionKo`, 1000),
    descriptionEn: nullableText(data.descriptionEn, `${path}.descriptionEn`, 1000),
    providerState: enumeration(data.providerState, providerStates, `${path}.providerState`),
    providerCode: text(data.providerCode, `${path}.providerCode`, 80),
    optionSchema: list(data.optionSchema, `${path}.optionSchema`, object),
    supportedResourceTypes: stringList(
      data.supportedResourceTypes,
      `${path}.supportedResourceTypes`
    ),
    unitPrice: number(data.unitPrice, `${path}.unitPrice`),
    currency: text(data.currency, `${path}.currency`, 3),
    minimumQuantity: integer(data.minimumQuantity, `${path}.minimumQuantity`),
    maximumQuantity: integer(data.maximumQuantity, `${path}.maximumQuantity`),
    orderCutoffMinutes: integer(data.orderCutoffMinutes, `${path}.orderCutoffMinutes`),
    cancellationCutoffMinutes: integer(
      data.cancellationCutoffMinutes,
      `${path}.cancellationCutoffMinutes`
    ),
    slaResponseMinutes: integer(data.slaResponseMinutes, `${path}.slaResponseMinutes`),
    slaFulfillmentLeadMinutes: integer(
      data.slaFulfillmentLeadMinutes,
      `${path}.slaFulfillmentLeadMinutes`
    ),
    cancellationPolicyKo: text(data.cancellationPolicyKo, `${path}.cancellationPolicyKo`, 1000),
    cancellationPolicyEn: text(data.cancellationPolicyEn, `${path}.cancellationPolicyEn`, 1000),
    capacityMode: enumeration(data.capacityMode, capacityModes, `${path}.capacityMode`),
    capacityFreshnessSeconds: integer(
      data.capacityFreshnessSeconds,
      `${path}.capacityFreshnessSeconds`
    ),
    inspectionMode: enumeration(data.inspectionMode, inspectionModes, `${path}.inspectionMode`),
    inspectionChecklistSchema: list(
      data.inspectionChecklistSchema,
      `${path}.inspectionChecklistSchema`,
      object
    ),
    requiresAttendeeCount: bool(data.requiresAttendeeCount, `${path}.requiresAttendeeCount`),
    requiresCostCenter: bool(data.requiresCostCenter, `${path}.requiresCostCenter`),
    version: integer(data.version, `${path}.version`),
  });
}

export function parseWorkplaceServiceCatalog(value: unknown): WorkplaceServiceCatalog {
  const data = record(value, 'catalog');
  return Object.freeze({
    reservationAuthority: enumeration(data.reservationAuthority, authorities, 'catalog.authority'),
    reservationId: uuid(data.reservationId, 'catalog.reservationId'),
    reservationVersion: integer(data.reservationVersion, 'catalog.reservationVersion'),
    reservationStartsAt: instant(data.reservationStartsAt, 'catalog.reservationStartsAt'),
    reservationEndsAt: instant(data.reservationEndsAt, 'catalog.reservationEndsAt'),
    siteReference: nullableText(data.siteReference, 'catalog.siteReference', 160),
    resourceReference: nullableText(data.resourceReference, 'catalog.resourceReference', 160),
    resourceType: text(data.resourceType, 'catalog.resourceType', 40),
    items: list(data.items, 'catalog.items', parseCatalogItem),
    generatedAt: instant(data.generatedAt, 'catalog.generatedAt'),
  });
}

function parseAdminCatalogItem(value: unknown, path: string): WorkplaceServiceCatalogAdminItem {
  const data = record(value, path);
  return Object.freeze({
    item: parseCatalogItem(data.item, `${path}.item`),
    siteScope: list(data.siteScope, `${path}.siteScope`, uuid),
    lifecycleState: enumeration(
      data.lifecycleState,
      new Set<'ACTIVE' | 'INACTIVE'>(['ACTIVE', 'INACTIVE']),
      `${path}.lifecycleState`
    ),
    updatedAt: instant(data.updatedAt, `${path}.updatedAt`),
  });
}

export function parseWorkplaceServiceAdminCatalog(
  value: unknown
): WorkplaceServiceCatalogAdminItems {
  const data = record(value, 'adminCatalog');
  return Object.freeze({
    items: list(data.items, 'adminCatalog.items', parseAdminCatalogItem),
    generatedAt: instant(data.generatedAt, 'adminCatalog.generatedAt'),
  });
}

export function parseWorkplaceServiceCatalogCommandResult(
  value: unknown
): WorkplaceServiceCatalogCommandResult {
  const data = record(value, 'catalogCommand');
  const item = parseAdminCatalogItem(data.item, 'catalogCommand.item');
  const receipt = record(data.receipt, 'catalogCommand.receipt');
  const catalogItemId = uuid(receipt.catalogItemId, 'catalogCommand.receipt.catalogItemId');
  if (catalogItemId !== item.item.catalogItemId) return invalid('catalogCommand.receipt');
  return Object.freeze({
    item,
    receipt: Object.freeze({
      commandId: uuid(receipt.commandId, 'catalogCommand.receipt.commandId'),
      catalogItemId,
      state: enumeration(receipt.state, commandStates, 'catalogCommand.receipt.state'),
      statusHref: text(receipt.statusHref, 'catalogCommand.receipt.statusHref', 500),
      replayed: bool(receipt.replayed, 'catalogCommand.receipt.replayed'),
      correlationId: text(receipt.correlationId, 'catalogCommand.receipt.correlationId', 160),
      acceptedAt: instant(receipt.acceptedAt, 'catalogCommand.receipt.acceptedAt'),
    }),
  });
}

function parsePreviewLine(value: unknown, path: string): WorkplaceServicePreviewLine {
  const data = record(value, path);
  return Object.freeze({
    catalogItemId: uuid(data.catalogItemId, `${path}.catalogItemId`),
    catalogVersion: nullableInteger(data.catalogVersion, `${path}.catalogVersion`),
    serviceCode: text(data.serviceCode, `${path}.serviceCode`, 80),
    category: enumeration(data.category, categories, `${path}.category`),
    nameKo: text(data.nameKo, `${path}.nameKo`, 160),
    nameEn: text(data.nameEn, `${path}.nameEn`, 160),
    providerState: enumeration(data.providerState, providerStates, `${path}.providerState`),
    providerCode: text(data.providerCode, `${path}.providerCode`, 80),
    providerConfigurationVersion: nullableInteger(
      data.providerConfigurationVersion,
      `${path}.providerConfigurationVersion`
    ),
    siteScope: list(data.siteScope, `${path}.siteScope`, uuid),
    supportedResourceTypes: stringList(
      data.supportedResourceTypes,
      `${path}.supportedResourceTypes`
    ),
    optionSchema: list(data.optionSchema, `${path}.optionSchema`, object),
    minimumQuantity: nullableInteger(data.minimumQuantity, `${path}.minimumQuantity`),
    maximumQuantity: nullableInteger(data.maximumQuantity, `${path}.maximumQuantity`),
    orderCutoffMinutes: nullableInteger(data.orderCutoffMinutes, `${path}.orderCutoffMinutes`),
    cancellationCutoffMinutes: nullableInteger(
      data.cancellationCutoffMinutes,
      `${path}.cancellationCutoffMinutes`
    ),
    slaResponseMinutes: nullableInteger(data.slaResponseMinutes, `${path}.slaResponseMinutes`),
    slaFulfillmentLeadMinutes: nullableInteger(
      data.slaFulfillmentLeadMinutes,
      `${path}.slaFulfillmentLeadMinutes`
    ),
    cancellationPolicyKo: nullableText(
      data.cancellationPolicyKo,
      `${path}.cancellationPolicyKo`,
      1000
    ),
    cancellationPolicyEn: nullableText(
      data.cancellationPolicyEn,
      `${path}.cancellationPolicyEn`,
      1000
    ),
    capacityMode:
      data.capacityMode === null
        ? null
        : enumeration(data.capacityMode, capacityModes, `${path}.capacityMode`),
    capacityFreshnessSeconds: nullableInteger(
      data.capacityFreshnessSeconds,
      `${path}.capacityFreshnessSeconds`
    ),
    inspectionMode:
      data.inspectionMode === null
        ? null
        : enumeration(data.inspectionMode, inspectionModes, `${path}.inspectionMode`),
    inspectionChecklistSchema: list(
      data.inspectionChecklistSchema,
      `${path}.inspectionChecklistSchema`,
      object
    ),
    quantity: integer(data.quantity, `${path}.quantity`),
    options: object(data.options, `${path}.options`),
    unitPrice: number(data.unitPrice, `${path}.unitPrice`),
    currency: text(data.currency, `${path}.currency`, 3),
    estimatedCost: number(data.estimatedCost, `${path}.estimatedCost`),
    capacityReservation:
      data.capacityReservation === null
        ? null
        : (() => {
            const capacity = record(data.capacityReservation, `${path}.capacityReservation`);
            return Object.freeze({
              holdIds: list(capacity.holdIds, `${path}.capacityReservation.holdIds`, uuid),
              expiresAt: instant(capacity.expiresAt, `${path}.capacityReservation.expiresAt`),
              capacityFreshUntil: instant(
                capacity.capacityFreshUntil,
                `${path}.capacityReservation.capacityFreshUntil`
              ),
            });
          })(),
    limitations: stringList(data.limitations, `${path}.limitations`),
  });
}

export function parseWorkplaceServicePreview(value: unknown): WorkplaceServiceOrderPreview {
  const data = record(value, 'preview');
  return Object.freeze({
    previewId: uuid(data.previewId, 'preview.previewId'),
    reservationAuthority: enumeration(data.reservationAuthority, authorities, 'preview.authority'),
    reservationId: uuid(data.reservationId, 'preview.reservationId'),
    reservationVersion: integer(data.reservationVersion, 'preview.reservationVersion'),
    reservationStartsAt: instant(data.reservationStartsAt, 'preview.reservationStartsAt'),
    reservationEndsAt: instant(data.reservationEndsAt, 'preview.reservationEndsAt'),
    siteReference: nullableText(data.siteReference, 'preview.siteReference', 160),
    resourceReference: nullableText(data.resourceReference, 'preview.resourceReference', 160),
    attendeeCount: integer(data.attendeeCount, 'preview.attendeeCount'),
    costCenter: nullableText(data.costCenter, 'preview.costCenter', 80),
    specialRequest: nullableText(data.specialRequest, 'preview.specialRequest'),
    estimatedCost: number(data.estimatedCost, 'preview.estimatedCost'),
    currency: text(data.currency, 'preview.currency', 3),
    eligible: bool(data.eligible, 'preview.eligible'),
    limitations: stringList(data.limitations, 'preview.limitations'),
    lines: list(data.lines, 'preview.lines', parsePreviewLine),
    expiresAt: instant(data.expiresAt, 'preview.expiresAt'),
    createdAt: instant(data.createdAt, 'preview.createdAt'),
  });
}
