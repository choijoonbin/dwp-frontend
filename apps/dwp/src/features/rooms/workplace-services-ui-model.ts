import type {
  WorkplaceServiceCatalogItem,
  WorkplaceServiceOrderEvent,
  WorkplaceServiceOrderState,
  WorkplaceServiceProviderState,
  WorkplaceServiceWorkState,
} from '@dwp-frontend/shared-utils';

export type WorkplaceServicesLocale = 'ko' | 'en';

export type CatalogOptionDefinition = Readonly<{
  key: string;
  labelKo: string;
  labelEn: string;
  type: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'SINGLE_SELECT' | 'MULTI_SELECT';
  required: boolean;
  values: readonly string[];
  minimum: number | null;
  maximum: number | null;
}>;

const optionTypes = new Set<CatalogOptionDefinition['type']>([
  'TEXT',
  'NUMBER',
  'BOOLEAN',
  'SINGLE_SELECT',
  'MULTI_SELECT',
]);

const referencePrefixes = {
  order: 'WSO',
  reservation: 'RSV',
  task: 'WST',
} as const;

const copy = {
  ko: {
    currency: '통화',
    sitesLoading: '사업장 범위를 확인하는 중입니다. 확인이 끝날 때까지 저장할 수 없습니다.',
    sitesError: '사업장 범위를 확인하지 못했습니다. 전역 범위로 추정하지 않고 저장을 차단합니다.',
    lifecycleActive: '활성',
    lifecycleInactive: '비활성',
    activateTitle: '서비스 품목을 활성화할까요?',
    deactivateTitle: '서비스 품목을 비활성화할까요?',
    activateDescription: '선택한 사업장 범위의 새 예약에서 이 품목을 주문할 수 있게 됩니다.',
    deactivateDescription:
      '새 예약에서는 이 품목을 주문할 수 없게 됩니다. 이미 접수된 주문은 별도로 계속 관리해야 합니다.',
    lifecycleReason: '변경 사유',
    assignmentUnavailable:
      '검증된 구성원 디렉터리 선택기가 없어 담당자 변경을 차단했습니다. 기존 담당자는 유지됩니다.',
    numberRequired: '숫자를 입력하세요.',
    numberRange: (minimum: number | null, maximum: number | null) =>
      minimum !== null && maximum !== null
        ? `${minimum} 이상 ${maximum} 이하의 값을 입력하세요.`
        : minimum !== null
          ? `${minimum} 이상의 값을 입력하세요.`
          : `${maximum ?? 0} 이하의 값을 입력하세요.`,
    unknownLimitation: '현재 조건에서는 이 서비스를 주문할 수 없습니다.',
  },
  en: {
    currency: 'Currency',
    sitesLoading: 'Site scope is being verified. Saving is blocked until verification finishes.',
    sitesError:
      'Site scope could not be verified. Saving is blocked instead of assuming global scope.',
    lifecycleActive: 'Active',
    lifecycleInactive: 'Inactive',
    activateTitle: 'Activate this service item?',
    deactivateTitle: 'Deactivate this service item?',
    activateDescription: 'This item will become orderable for new reservations in its site scope.',
    deactivateDescription:
      'This item will no longer be orderable for new reservations. Existing orders still require separate fulfillment.',
    lifecycleReason: 'Reason for change',
    assignmentUnavailable:
      'Assignee changes are blocked because no verified directory picker is available. The current assignee is retained.',
    numberRequired: 'Enter a number.',
    numberRange: (minimum: number | null, maximum: number | null) =>
      minimum !== null && maximum !== null
        ? `Enter a value from ${minimum} to ${maximum}.`
        : minimum !== null
          ? `Enter a value of at least ${minimum}.`
          : `Enter a value no greater than ${maximum ?? 0}.`,
    unknownLimitation: 'This service cannot be ordered under the current conditions.',
  },
} as const;

export function workplaceServicesCopy(locale: WorkplaceServicesLocale) {
  return copy[locale];
}

export function workplaceServiceReference(
  kind: keyof typeof referencePrefixes,
  value: string
): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const token = value ? (hash >>> 0).toString(36).toUpperCase().padStart(7, '0') : 'UNKNOWN';
  return `${referencePrefixes[kind]}-${token}`;
}

function finiteBoundary(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function catalogOptionDefinitions(
  item: WorkplaceServiceCatalogItem
): readonly CatalogOptionDefinition[] {
  return item.optionSchema.flatMap((candidate) => {
    const key = typeof candidate.key === 'string' ? candidate.key : '';
    const type = typeof candidate.type === 'string' ? candidate.type : '';
    if (!key || !optionTypes.has(type as CatalogOptionDefinition['type'])) return [];
    const values = Array.isArray(candidate.values)
      ? candidate.values.filter((value): value is string => typeof value === 'string')
      : [];
    return [
      {
        key,
        labelKo: typeof candidate.labelKo === 'string' ? candidate.labelKo : key,
        labelEn: typeof candidate.labelEn === 'string' ? candidate.labelEn : key,
        type: type as CatalogOptionDefinition['type'],
        required: candidate.required === true,
        values,
        minimum: finiteBoundary(candidate.minimum),
        maximum: finiteBoundary(candidate.maximum),
      },
    ];
  });
}

export function catalogOptionValueIsValid(
  option: CatalogOptionDefinition,
  value: unknown
): boolean {
  if (value === null || value === undefined || value === '') return !option.required;
  if (option.type === 'NUMBER') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return false;
    if (option.minimum !== null && value < option.minimum) return false;
    if (option.maximum !== null && value > option.maximum) return false;
    return option.minimum === null || option.maximum === null || option.minimum <= option.maximum;
  }
  if (option.type === 'TEXT') return typeof value === 'string' && value.trim().length > 0;
  if (option.type === 'BOOLEAN') return typeof value === 'boolean';
  if (option.type === 'SINGLE_SELECT') {
    return typeof value === 'string' && option.values.includes(value);
  }
  return (
    Array.isArray(value) &&
    (!option.required || value.length > 0) &&
    value.every((candidate) => typeof candidate === 'string' && option.values.includes(candidate))
  );
}

export function serviceSelectionIsValid(
  items: readonly WorkplaceServiceCatalogItem[],
  quantities: Readonly<Record<string, number>>,
  optionsByItem: Readonly<Record<string, Readonly<Record<string, unknown>>>>
): boolean {
  return items.every((item) => {
    const quantity = quantities[item.catalogItemId] ?? item.minimumQuantity;
    return (
      Number.isInteger(quantity) &&
      quantity >= item.minimumQuantity &&
      quantity <= item.maximumQuantity &&
      catalogOptionDefinitions(item).every((option) =>
        catalogOptionValueIsValid(option, optionsByItem[item.catalogItemId]?.[option.key])
      )
    );
  });
}

const limitationMessages: Readonly<
  Record<string, Readonly<Record<WorkplaceServicesLocale, string>>>
> = {
  RESOURCE_TYPE_UNSUPPORTED: {
    ko: '이 공간 유형에서 지원하지 않는 서비스입니다.',
    en: 'This service is not supported for the reserved space type.',
  },
  SITE_SCOPE_MISMATCH: {
    ko: '예약 사업장에서 제공하지 않는 서비스입니다.',
    en: 'This service is not available at the reservation site.',
  },
  QUANTITY_OUT_OF_RANGE: {
    ko: '수량이 허용 범위를 벗어났습니다.',
    en: 'The quantity is outside the allowed range.',
  },
  OPTIONS_INVALID: {
    ko: '서비스 옵션 형식이 올바르지 않습니다.',
    en: 'The service options are invalid.',
  },
  OPTION_SCHEMA_INVALID: {
    ko: '서비스 옵션 정의를 확인할 수 없습니다.',
    en: 'The service option definition is invalid.',
  },
  OPTION_REQUIRED: {
    ko: '필수 서비스 옵션을 입력하세요.',
    en: 'Complete the required service option.',
  },
  OPTION_INVALID: {
    ko: '서비스 옵션 값이 허용 범위를 벗어났습니다.',
    en: 'A service option value is outside its allowed range.',
  },
  OPTION_UNKNOWN: {
    ko: '지원하지 않는 서비스 옵션이 포함됐습니다.',
    en: 'An unsupported service option was included.',
  },
  ATTENDEE_COUNT_REQUIRED: { ko: '참석 인원을 입력하세요.', en: 'Enter the attendee count.' },
  COST_CENTER_REQUIRED: { ko: '비용센터를 입력하세요.', en: 'Enter a cost center.' },
  ORDER_CUTOFF_PASSED: {
    ko: '서비스 주문 마감이 지났습니다.',
    en: 'The service ordering cutoff has passed.',
  },
  MIXED_CURRENCY_UNSUPPORTED: {
    ko: '서로 다른 통화의 서비스는 한 주문에 담을 수 없습니다.',
    en: 'Services in different currencies cannot be placed in one order.',
  },
  PROVIDER_NOT_CONFIGURED: {
    ko: '서비스 제공자가 설정되지 않았습니다.',
    en: 'The service provider is not configured.',
  },
  PROVIDER_CONFIGURED_UNVERIFIED: {
    ko: '서비스 제공자 구성을 아직 검증하지 못했습니다.',
    en: 'The service provider configuration is not verified.',
  },
  PROVIDER_DEGRADED: {
    ko: '서비스 제공자 상태가 저하됐습니다.',
    en: 'The service provider is degraded.',
  },
  PROVIDER_STALE: {
    ko: '서비스 제공자 상태 정보가 오래됐습니다.',
    en: 'The service provider status is stale.',
  },
};

export function workplaceServiceLimitationMessage(
  limitation: string,
  locale: WorkplaceServicesLocale
): string {
  for (const segment of limitation.split(':')) {
    const message = limitationMessages[segment];
    if (message) return message[locale];
  }
  return copy[locale].unknownLimitation;
}

export function requireWorkplaceServiceWrite(allowed: boolean): void {
  if (!allowed)
    throw new Error('Workplace Services write is not authorized in the current UI state.');
}

export function providerAllowsFulfillmentWrite(state: WorkplaceServiceProviderState): boolean {
  return state === 'READY';
}

export type WorkplaceServiceResultUnknownAdjustment = Readonly<{
  lineAdjustmentId: string;
  serviceOrderLineId: string;
}>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function workplaceServiceResultUnknownAdjustments(
  events: readonly WorkplaceServiceOrderEvent[]
): readonly WorkplaceServiceResultUnknownAdjustment[] {
  const result = new Map<string, WorkplaceServiceResultUnknownAdjustment>();
  for (const event of events) {
    if (
      event.eventType !== 'LINE_CANCELLATION_RESULT_UNKNOWN' &&
      event.eventType !== 'LINE_CANCELLATION_REQUIRES_REVIEW'
    ) {
      continue;
    }
    const lineAdjustmentId = event.detail.lineAdjustmentId;
    const serviceOrderLineId = event.detail.serviceOrderLineId;
    if (
      typeof lineAdjustmentId !== 'string' ||
      !uuidPattern.test(lineAdjustmentId) ||
      typeof serviceOrderLineId !== 'string' ||
      !uuidPattern.test(serviceOrderLineId)
    ) {
      continue;
    }
    result.set(lineAdjustmentId, { lineAdjustmentId, serviceOrderLineId });
  }
  return Object.freeze([...result.values()]);
}

type FulfillmentTarget = Exclude<WorkplaceServiceWorkState, 'NOT_CONFIGURED' | 'CANCELLED'>;

const fulfillmentTransitions: Readonly<
  Partial<Record<WorkplaceServiceWorkState, readonly FulfillmentTarget[]>>
> = Object.freeze({
  SUBMITTED: ['SUBMITTED', 'ACCEPTED', 'BLOCKED', 'DELAYED', 'RESULT_UNKNOWN'],
  ACCEPTED: ['ACCEPTED', 'IN_PREPARATION', 'BLOCKED', 'DELAYED', 'RESULT_UNKNOWN'],
  IN_PREPARATION: [
    'IN_PREPARATION',
    'PARTIALLY_FULFILLED',
    'FULFILLED',
    'BLOCKED',
    'DELAYED',
    'RESULT_UNKNOWN',
  ],
  PARTIALLY_FULFILLED: ['PARTIALLY_FULFILLED', 'FULFILLED', 'BLOCKED', 'DELAYED', 'RESULT_UNKNOWN'],
  BLOCKED: ['BLOCKED', 'ACCEPTED', 'IN_PREPARATION', 'PARTIALLY_FULFILLED', 'RESULT_UNKNOWN'],
  DELAYED: [
    'DELAYED',
    'ACCEPTED',
    'IN_PREPARATION',
    'PARTIALLY_FULFILLED',
    'FULFILLED',
    'BLOCKED',
    'RESULT_UNKNOWN',
  ],
  RESULT_UNKNOWN: [
    'RESULT_UNKNOWN',
    'ACCEPTED',
    'IN_PREPARATION',
    'PARTIALLY_FULFILLED',
    'FULFILLED',
    'BLOCKED',
    'DELAYED',
  ],
});

export function workplaceServiceAllowedFulfillmentStates(
  current: WorkplaceServiceWorkState
): readonly FulfillmentTarget[] {
  return fulfillmentTransitions[current] ?? [];
}

export function workplaceServiceFulfillmentQuantityIsValid(
  currentFulfilled: number,
  cancelled: number,
  total: number,
  target: FulfillmentTarget,
  supplied: number | null
): boolean {
  const fulfillable = total - cancelled;
  if (
    !Number.isInteger(currentFulfilled) ||
    !Number.isInteger(cancelled) ||
    !Number.isInteger(total) ||
    currentFulfilled < 0 ||
    cancelled < 0 ||
    fulfillable < 0 ||
    currentFulfilled > fulfillable
  ) {
    return false;
  }
  if (target === 'FULFILLED') {
    return (
      supplied !== null &&
      Number.isInteger(supplied) &&
      fulfillable >= 1 &&
      supplied === fulfillable
    );
  }
  if (target === 'PARTIALLY_FULFILLED') {
    return (
      supplied !== null &&
      Number.isInteger(supplied) &&
      supplied >= Math.max(1, currentFulfilled) &&
      supplied < fulfillable
    );
  }
  return supplied === null || (Number.isInteger(supplied) && supplied === currentFulfilled);
}

const fulfillmentFilterStates = new Set<WorkplaceServiceOrderState>([
  'SUBMITTED',
  'ACCEPTED',
  'IN_PREPARATION',
  'PARTIALLY_FULFILLED',
  'FULFILLED',
  'BLOCKED',
  'DELAYED',
  'CANCELLED',
  'RESULT_UNKNOWN',
]);

export function parseWorkplaceServiceFulfillmentState(
  value: string | null
): WorkplaceServiceOrderState | '' {
  return value && fulfillmentFilterStates.has(value as WorkplaceServiceOrderState)
    ? (value as WorkplaceServiceOrderState)
    : '';
}

export type WorkplaceServiceFulfillmentSort =
  'sla' | 'reservation' | 'service' | 'provider' | 'assignee' | 'state';

export function parseWorkplaceServiceFulfillmentSort(
  value: string | null
): WorkplaceServiceFulfillmentSort {
  return ['sla', 'reservation', 'service', 'provider', 'assignee', 'state'].includes(value ?? '')
    ? (value as WorkplaceServiceFulfillmentSort)
    : 'sla';
}

export function parseWorkplaceServiceFulfillmentDirection(value: string | null): 'asc' | 'desc' {
  return value === 'desc' ? 'desc' : 'asc';
}

export function parseWorkplaceServiceFulfillmentQuery(value: string | null): string {
  return (value ?? '')
    .replace(/[\u0000-\u001f\u007f]/gu, '')
    .trim()
    .slice(0, 120);
}

export function updateWorkplaceServiceFulfillmentSearch(
  current: URLSearchParams,
  update: Readonly<{
    state?: WorkplaceServiceOrderState | '';
    orderId?: string | null;
    query?: string | null;
    sort?: WorkplaceServiceFulfillmentSort;
    direction?: 'asc' | 'desc';
  }>
): URLSearchParams {
  const next = new URLSearchParams(current);
  if (update.state !== undefined) {
    if (update.state) next.set('state', update.state);
    else next.delete('state');
    next.delete('order');
  }
  if (update.orderId !== undefined) {
    if (update.orderId) next.set('order', update.orderId);
    else next.delete('order');
  }
  if (update.query !== undefined) {
    const query = parseWorkplaceServiceFulfillmentQuery(update.query);
    if (query) next.set('q', query);
    else next.delete('q');
    next.delete('order');
  }
  if (update.sort !== undefined) {
    if (update.sort === 'sla') next.delete('sort');
    else next.set('sort', update.sort);
  }
  if (update.direction !== undefined) {
    if (update.direction === 'asc') next.delete('direction');
    else next.set('direction', update.direction);
  }
  return next;
}
