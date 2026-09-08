import type {
  ServiceInformationResponseInput,
  ServiceRequestDetail,
  ServiceRequestField,
} from '@dwp-frontend/shared-utils/api/service-center-api';

export function serviceResponseFieldValid(field: ServiceRequestField, value: unknown) {
  const empty = value == null || value === '' || (typeof value === 'string' && !value.trim());
  if (empty) return !field.required;
  if (field.type === 'CHECKBOX') return typeof value === 'boolean' && (!field.required || value);
  if (field.type === 'NUMBER') return typeof value === 'number' && Number.isFinite(value);
  if (field.type === 'SELECT')
    return typeof value === 'string' && Boolean(field.options?.includes(value));
  if (field.type === 'DATE')
    return (
      typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
      Number.isFinite(Date.parse(value))
    );
  return typeof value === 'string';
}

export function prepareServiceInformationResponse(
  detail: ServiceRequestDetail,
  message: string,
  values: Record<string, unknown>,
  idempotencyKey: string
): ServiceInformationResponseInput | null {
  const text = message.trim();
  if (
    detail.request.status !== 'AWAITING_REQUESTER' ||
    text.length < 10 ||
    text.length > 2000 ||
    !detail.requestSchema.fields.every((field) =>
      serviceResponseFieldValid(field, values[field.key])
    )
  )
    return null;
  return {
    message: text,
    values: structuredClone(values),
    version: detail.request.version,
    idempotencyKey,
  };
}

/** A timeout retry replays the frozen command; it must never become a new submission. */
export function serviceResponseCanDispatch(
  current: ServiceRequestDetail,
  requestId: string,
  command: ServiceInformationResponseInput,
  replay: boolean
) {
  return (
    current.request.requestId === requestId &&
    (replay ||
      (current.request.version === command.version &&
        current.request.status === 'AWAITING_REQUESTER'))
  );
}
