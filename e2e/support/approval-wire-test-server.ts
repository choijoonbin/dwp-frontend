import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';

type Wire = Readonly<{
  method: string;
  url: URL;
  headers: IncomingHttpHeaders;
  bytes: Buffer;
}>;
type Reply = Readonly<{ status: number; data: unknown }>;
const servers = new Set<Server>();

// A real HTTP byte receiver for Blob bodies omitted by WebKit's routing inspector.
// This is a client transport fixture, not Auth/Approval service evidence.
export async function startApprovalWireTestServer(origin: string, respond: (wire: Wire) => Reply) {
  const server = createServer(async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', request.headers.origin ?? origin);
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader(
      'Access-Control-Allow-Headers',
      request.headers['access-control-request-headers'] ??
        'content-type, idempotency-key, authorization, x-xsrf-token, x-dwp-expected-object-version, x-dwp-expected-decision-revision, x-tenant-id'
    );
    response.setHeader('Access-Control-Allow-Methods', 'POST, PUT, OPTIONS');
    if (request.method === 'OPTIONS') {
      response.writeHead(204).end();
      return;
    }
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const reply = respond({
        method: request.method!,
        url: new URL(request.url!, origin),
        headers: request.headers,
        bytes: Buffer.concat(chunks),
      });
      response.writeHead(reply.status, { 'Content-Type': 'application/json' });
      response.end(
        JSON.stringify({ status: reply.status === 200 ? 'SUCCESS' : 'ERROR', data: reply.data })
      );
    } catch {
      response.writeHead(500, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ status: 'ERROR', data: null }));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.add(server);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No wire test port.');
  return `http://127.0.0.1:${address.port}`;
}

export async function closeApprovalWireTestServers() {
  for (const server of servers) {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
    servers.delete(server);
  }
}
