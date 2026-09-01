import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const expectedManager = 'yarn@4.17.1';
const minimumNodeVersion = [24, 18, 0];
const forbiddenArtifacts = [
  'package-lock.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'bun.lock',
  'bun.lockb',
];
const forbiddenInstallArtifacts = ['node_modules/.pnpm'];

const issues = [];
const currentNodeVersion = process.versions.node.split('.').map(Number);

const nodeVersionSupported =
  currentNodeVersion[0] === minimumNodeVersion[0] &&
  (currentNodeVersion[1] > minimumNodeVersion[1] ||
    (currentNodeVersion[1] === minimumNodeVersion[1] &&
      currentNodeVersion[2] >= minimumNodeVersion[2]));

if (!nodeVersionSupported) {
  issues.push(
    `Node.js ${minimumNodeVersion.join('.')} 이상, 25 미만이 필요합니다. 현재 버전: ${process.versions.node}`
  );
}

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

for (const artifact of forbiddenInstallArtifacts) {
  if (fs.existsSync(artifact)) {
    issues.push(
      `${artifact} indicates a mixed package-manager install. Remove node_modules and reinstall with Yarn 4.`
    );
  }
}

if (issues.length > 0) {
  console.error('Package-manager policy failed:');
  issues.forEach((issue) => console.error(`- ${issue}`));
  process.exit(1);
}

console.log(`Package-manager policy passed (${expectedManager}, immutable yarn.lock).`);
