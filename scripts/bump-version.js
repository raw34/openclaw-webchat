#!/usr/bin/env node

/**
 * Bump version across all packages
 * Usage: node scripts/bump-version.js <version>
 * Example: node scripts/bump-version.js 0.3.0
 */

const fs = require('fs');
const path = require('path');

const version = process.argv[2];

if (!version) {
  console.error('Usage: node scripts/bump-version.js <version>');
  console.error('Example: node scripts/bump-version.js 0.3.0');
  process.exit(1);
}

// Validate semver format
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error(`Invalid version format: ${version}`);
  console.error('Expected format: X.Y.Z or X.Y.Z-tag');
  process.exit(1);
}

const packages = ['packages/core', 'packages/react', 'packages/vue'];

packages.forEach((pkg) => {
  const pkgPath = path.join(__dirname, '..', pkg, 'package.json');
  const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const oldVersion = pkgJson.version;
  pkgJson.version = version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 2) + '\n');
  console.log(`${pkgJson.name}: ${oldVersion} → ${version}`);
});

console.log(`\n✓ All packages updated to ${version}`);
console.log('\nNext steps:');
console.log(`  git add -A && git commit -m "chore(release): v${version}"`);
console.log(`  git tag v${version}`);
console.log(`  git push origin main --tags`);
