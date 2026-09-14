import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

export async function workplaceSourceSnapshot() {
  const collect = async (directory: string): Promise<string[]> => {
    const entries = await readdir(directory, { withFileTypes: true });
    const groups = await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? collect(path.join(directory, entry.name))
          : Promise.resolve(
              /\.tsx?$/u.test(entry.name) && !/\.(?:test|spec|stories)\.tsx?$/u.test(entry.name)
                ? [path.join(directory, entry.name)]
                : []
            )
      )
    );
    return groups.flat();
  };
  const files = [
    ...(await collect('apps/dwp/src/features/rooms')),
    'apps/dwp/src/pages/rooms.tsx',
    'apps/dwp/src/layouts/rooms-layout.tsx',
    'apps/dwp/src/layouts/product-area-layout.tsx',
    ...[
      'workplace-api',
      'workplace-governance-api',
      'workplace-collaboration-api',
      'workplace-experience-report-api',
      'workplace-experience-facilities-api',
    ].map((name) => `libs/shared-utils/src/api/${name}.ts`),
    'libs/design-system/src/foundation/tokens.ts',
    'libs/design-system/src/components/dialogs/confirm-dialog.tsx',
    'libs/shared-i18n/src/locales/ko/rooms.json',
    'libs/shared-i18n/src/locales/en/rooms.json',
  ].sort();
  return Object.fromEntries(
    await Promise.all(
      files.map(async (file) => [
        path.resolve(file),
        createHash('sha256')
          .update(await readFile(file))
          .digest('hex'),
      ])
    )
  );
}
