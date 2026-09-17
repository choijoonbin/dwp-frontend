export type WorkplaceDeviceBootstrap = Readonly<{
  schemaVersion: 1;
  deviceId: string;
  credential: string;
}>;

declare global {
  interface Window {
    __DWP_WORKPLACE_DEVICE_BOOTSTRAP__?: unknown;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function validCredential(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 8 &&
    value.length <= 4096 &&
    !Array.from(value).some((character) => /\p{Cc}/u.test(character))
  );
}

/**
 * Consumes the native shell's in-memory, one-shot device assertion. The credential is never read
 * from the URL or browser storage and is deleted before any validation result is returned.
 */
export function consumeWorkplaceDeviceBootstrap(
  expectedDeviceId: string,
  browser: Pick<Window, '__DWP_WORKPLACE_DEVICE_BOOTSTRAP__'> = window
): WorkplaceDeviceBootstrap | null {
  let candidate: unknown;
  try {
    candidate = browser.__DWP_WORKPLACE_DEVICE_BOOTSTRAP__;
    if (!Reflect.deleteProperty(browser, '__DWP_WORKPLACE_DEVICE_BOOTSTRAP__')) return null;
  } catch {
    return null;
  }
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
  const value = candidate as Record<string, unknown>;
  if (
    value.schemaVersion !== 1 ||
    typeof value.deviceId !== 'string' ||
    !UUID.test(value.deviceId) ||
    value.deviceId.toLowerCase() !== expectedDeviceId.toLowerCase() ||
    !validCredential(value.credential)
  ) {
    return null;
  }
  return { schemaVersion: 1, deviceId: value.deviceId, credential: value.credential };
}
