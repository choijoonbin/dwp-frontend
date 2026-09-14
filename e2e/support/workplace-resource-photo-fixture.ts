import { createHash } from 'node:crypto';
import type { Route } from '@playwright/test';
import { fulfillSuccess } from './shell-session';

const photo = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=',
  'base64'
);
const sha256 = createHash('sha256').update(photo).digest('hex');

/** Metadata and registered bytes use the same actual digest as the production photo contract. */
export async function fulfillWorkplaceResourcePhotoFixture(route: Route) {
  const path = new URL(route.request().url()).pathname;
  const resourceId = path.split('/resources/')[1]?.split('/')[0];
  if (path.endsWith('/photo/metadata'))
    return fulfillSuccess(route, {
      resourceId,
      url: path.replace('/metadata', ''),
      altText: 'Registered workspace photo',
      contentType: 'image/png',
      sizeBytes: photo.byteLength,
      sha256,
      version: 1,
    });
  if (path.endsWith('/photo'))
    return route.fulfill({
      contentType: 'image/png',
      headers: { ETag: `"${sha256}"` },
      body: photo,
    });
  return route.fallback();
}
