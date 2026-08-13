import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const expectedManager = 'yarn@4.17.1';
const forbiddenArtifacts = [
  'package-lock.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'bun.lock',
  'bun.lockb',
];

const issues = [];

if (manifest.packageManager !== expectedManager) {
  issues.push(`package.json packageManager must remain ${expectedManager}.`);
}

if (!fs.existsSync('yarn.lock')) {
  issues.push('yarn.lock is required for immutable installs.');
}

for (const artifact of forbiddenArtifacts) {
  if (fs.existsSync(artifact)) {
    issues.push(`${artifact} conflicts with the Yarn 4 workspace policy.`);
  }
}

if (issues.length > 0) {
  console.error('Package-manager policy failed:');
  issues.forEach((issue) => console.error(`- ${issue}`));
  process.exit(1);
}

console.log(`Package-manager policy passed (${expectedManager}, immutable yarn.lock).`);
