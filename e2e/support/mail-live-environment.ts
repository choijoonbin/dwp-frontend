const REQUIRED_ACKNOWLEDGEMENT = 'I_UNDERSTAND_THIS_WRITES_SANDBOX_MAIL';

export type MailLiveEnvironment = Readonly<{
  gatewayURL: string;
  tenantId: string;
  runId: string;
  scopeKey?: string;
  recipientEmail: string;
  sender: Readonly<{ email: string; password: string }>;
  deniedSender: Readonly<{ email: string; password: string }>;
}>;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the opt-in Mail live vertical gate.`);
  return value;
}

function validGatewayURL(value: string): string {
  const url = new URL(value);
  const localHttp =
    url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
  if (!localHttp && url.protocol !== 'https:') {
    throw new Error('MAIL_LIVE_GATEWAY_URL must use HTTPS or loopback HTTP.');
  }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('MAIL_LIVE_GATEWAY_URL must be an origin without credentials or path data.');
  }
  return url.origin;
}

export function loadMailLiveEnvironment(): MailLiveEnvironment {
  if (required('MAIL_LIVE_ACK') !== REQUIRED_ACKNOWLEDGEMENT) {
    throw new Error(
      `MAIL_LIVE_ACK must equal ${REQUIRED_ACKNOWLEDGEMENT}; this gate writes durable sandbox mail.`
    );
  }
  const sender = {
    email: required('MAIL_LIVE_EMAIL'),
    password: required('MAIL_LIVE_PASSWORD'),
  };
  const deniedSender = {
    email: required('MAIL_LIVE_DENIED_EMAIL'),
    password: required('MAIL_LIVE_DENIED_PASSWORD'),
  };
  if (sender.email.toLowerCase() === deniedSender.email.toLowerCase()) {
    throw new Error('MAIL_LIVE_DENIED_EMAIL must be a distinct user with APP.MAIL:SEND denied.');
  }
  return Object.freeze({
    gatewayURL: validGatewayURL(required('MAIL_LIVE_GATEWAY_URL')),
    tenantId: required('MAIL_LIVE_TENANT_ID'),
    runId: process.env.MAIL_LIVE_RUN_ID?.trim() || crypto.randomUUID(),
    ...(process.env.MAIL_LIVE_SCOPE_KEY?.trim()
      ? { scopeKey: process.env.MAIL_LIVE_SCOPE_KEY.trim() }
      : {}),
    recipientEmail: required('MAIL_LIVE_RECIPIENT_EMAIL'),
    sender: Object.freeze(sender),
    deniedSender: Object.freeze(deniedSender),
  });
}
