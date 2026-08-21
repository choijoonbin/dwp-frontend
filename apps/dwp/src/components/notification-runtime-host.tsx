import { NotificationArrivalHost } from './notification-arrival-host';
import { NotificationLiveBridge } from './notification-live-bridge';

export function NotificationRuntimeHost() {
  return (
    <>
      <NotificationArrivalHost />
      <NotificationLiveBridge />
    </>
  );
}
