const EVENT_OPERATIONS = new Set(['CREATE', 'REPLACE', 'PATCH', 'DELETE', 'READ', 'SEARCH']);
const EVENT_RESOURCES = new Set(['USER', 'GROUP', 'CONFIG']);
const CONNECTOR_OPERATIONS = new Set(['USERS', 'GROUPS']);

function closedLabelKey(prefix: string, values: ReadonlySet<string>, value: string): string {
  return `${prefix}.${values.has(value) ? value : 'UNKNOWN'}`;
}

export function scimEventOperationLabelKey(value: string): string {
  return closedLabelKey('provisioning.scim.eventOperations', EVENT_OPERATIONS, value);
}

export function scimEventResourceLabelKey(value: string): string {
  return closedLabelKey('provisioning.scim.eventResources', EVENT_RESOURCES, value);
}

export function scimConnectorOperationLabelKey(value: string): string {
  return closedLabelKey('provisioning.scim.connectorOperations', CONNECTOR_OPERATIONS, value);
}
