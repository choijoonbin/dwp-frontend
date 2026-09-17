import { HttpError } from './http-error';

const ETAG_PATTERN = /^(?:W\/)?"[\x21\x23-\x7e]*"$/u;
const ETAG_MAX_LENGTH = 256;

export type ConditionalHttpSnapshot<T> = Readonly<{
  data: T;
  etag: string | null;
}>;

export type ConditionalHttpResult<T> = Readonly<{
  headers: Headers | undefined;
  snapshot: ConditionalHttpSnapshot<T>;
  status: 200 | 304;
  notModified: boolean;
}>;

export type ConditionalHttpResponse<T> = Readonly<{
  data: T | undefined;
  headers?: Headers;
  status: number;
}>;

function parseEtag(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (value.length > ETAG_MAX_LENGTH || !ETAG_PATTERN.test(value)) {
    throw new HttpError('Conditional response contains an invalid ETag.', 502);
  }
  return value;
}

export function conditionalRequestHeaders<T>(
  snapshot: ConditionalHttpSnapshot<T> | undefined
): Readonly<Record<string, string>> {
  const etag = parseEtag(snapshot?.etag);
  return etag ? { 'If-None-Match': etag } : {};
}

export function resolveConditionalHttpResponse<T>(
  response: ConditionalHttpResponse<T>,
  previous: ConditionalHttpSnapshot<T> | undefined
): ConditionalHttpResult<T> {
  const responseEtag = parseEtag(response.headers?.get('ETag'));
  if (response.status === 304) {
    const previousEtag = parseEtag(previous?.etag);
    if (!previous || !previousEtag) {
      throw new HttpError('A 304 response requires a matching local snapshot.', 502);
    }
    if (responseEtag && responseEtag !== previousEtag) {
      throw new HttpError('A 304 response changed the cached entity tag.', 502);
    }
    return {
      headers: response.headers,
      snapshot: previous,
      status: 304,
      notModified: true,
    };
  }

  if (response.status !== 200 || response.data === undefined) {
    throw new HttpError('Conditional GET response is invalid.', 502);
  }
  return {
    headers: response.headers,
    snapshot: { data: response.data, etag: responseEtag },
    status: 200,
    notModified: false,
  };
}
