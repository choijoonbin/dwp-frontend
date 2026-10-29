import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const defaultRoot = path.resolve(import.meta.dirname, '../apps/dwp/src/features/notifications');

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

async function productionScreens(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolute = path.join(root, entry.name);
      if (entry.isDirectory()) return productionScreens(absolute);
      if (
        !entry.isFile() ||
        !entry.name.endsWith('.tsx') ||
        entry.name.endsWith('.test.tsx') ||
        entry.name.endsWith('.spec.tsx')
      ) {
        return [];
      }
      return [absolute];
    })
  );
  return nested.flat();
}

function sourceLineCount(source) {
  const lines = source.split(/\r?\n/u);
  if (lines.at(-1) === '') lines.pop();
  return lines.length;
}

export async function notificationSourceSizeReport(root = defaultRoot, limit = 899) {
  const files = await productionScreens(root);
  const measured = await Promise.all(
    files.map(async (file) => ({
      file: path.relative(root, file),
      lines: sourceLineCount(await readFile(file, 'utf8')),
    }))
  );
  measured.sort((left, right) => right.lines - left.lines || left.file.localeCompare(right.file));
  return {
    limit,
    measured,
    violations: measured.filter(({ lines }) => lines > limit),
  };
}

async function main() {
  const root = path.resolve(argument('--root', defaultRoot));
  const limit = Number(argument('--limit', '899'));
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Source line limit must be positive.');
  const report = await notificationSourceSizeReport(root, limit);
  for (const { file, lines } of report.measured) {
    console.log(`${String(lines).padStart(4)}  ${file}`);
  }
  if (report.violations.length > 0) {
    const detail = report.violations
      .map(({ file, lines }) => `${file}: ${lines} lines exceeds ${limit}`)
      .join('\n');
    throw new Error(
      `Notification production screen source-size violations (${report.violations.length}):\n${detail}`
    );
  }
  console.log(
    `PASS  ${report.measured.length} Notification production screens are at most ${limit} lines.`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
