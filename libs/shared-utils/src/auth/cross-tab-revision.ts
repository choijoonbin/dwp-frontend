export type CrossTabRevisionChannel = Pick<
  BroadcastChannel,
  'postMessage' | 'addEventListener' | 'removeEventListener' | 'close'
>;

export type CrossTabRevisionChannelFactory = (name: string) => CrossTabRevisionChannel | null;

type CrossTabRevisionMessage = {
  kind: 'dwp-cache-revision';
  revision: string;
};

function defaultChannelFactory(name: string): CrossTabRevisionChannel | null {
  return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(name);
}

function revisionToken(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isRevisionMessage(value: unknown): value is CrossTabRevisionMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  const message = value as Partial<CrossTabRevisionMessage>;
  return (
    keys.length === 2 &&
    keys.includes('kind') &&
    keys.includes('revision') &&
    message.kind === 'dwp-cache-revision' &&
    typeof message.revision === 'string' &&
    message.revision.length > 0
  );
}

/** Publishes only an opaque revision token. Authority or tenant data never crosses tabs. */
export function publishCrossTabRevision(
  channelName: string,
  channelFactory: CrossTabRevisionChannelFactory = defaultChannelFactory
): void {
  const channel = channelFactory(channelName);
  if (!channel) return;
  channel.postMessage({ kind: 'dwp-cache-revision', revision: revisionToken() });
  channel.close();
}

export function subscribeCrossTabRevision(
  channelName: string,
  listener: () => void,
  channelFactory: CrossTabRevisionChannelFactory = defaultChannelFactory
): () => void {
  const channel = channelFactory(channelName);
  if (!channel) return () => undefined;
  const receive = (event: MessageEvent<unknown>) => {
    if (isRevisionMessage(event.data)) listener();
  };
  channel.addEventListener('message', receive);
  return () => {
    channel.removeEventListener('message', receive);
    channel.close();
  };
}
