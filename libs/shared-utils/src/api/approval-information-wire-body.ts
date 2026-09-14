export type ApprovalInformationWireBodyCapture = (originalBodyBase64: string) => void;

export function approvalInformationWireBody(
  input: Readonly<Record<string, unknown>>,
  capture: ApprovalInformationWireBodyCapture
): Blob {
  const bytes = new TextEncoder().encode(JSON.stringify(input));
  if (bytes.byteLength > 262144) throw new Error('Approval information body is too large');
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
  }
  // The immutable Blob carries the same bytes as the private receipt descriptor.
  const body = new Blob([bytes], { type: 'application/json' });
  if (capture(btoa(chunks.join(''))) !== undefined) {
    throw new Error('Approval information body capture must be synchronous');
  }
  return body;
}
