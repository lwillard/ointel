const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
if (!process.env.npm_execpath) throw new Error('Run this check using npm run security:audit.');
const directory = path.resolve('security-reports');
fs.mkdirSync(directory, { recursive: true });
function npm(args) { return spawnSync(process.execPath, [process.env.npm_execpath, ...args], { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 }); }
const result = npm(['audit', '--json', '--include=dev', '--include=optional', '--include=peer']);
if (result.error) throw result.error;
let audit;
try { audit = JSON.parse(result.stdout); } catch { throw new Error(`Dependency audit did not return a report: ${result.stderr}`); }
const lockfileSha256 = crypto.createHash('sha256').update(fs.readFileSync('package-lock.json')).digest('hex');
fs.writeFileSync(path.join(directory, 'npm-audit.json'), JSON.stringify({ scannedAt: new Date().toISOString(), platform: process.platform, arch: process.arch, lockfileSha256, ...audit }, null, 2) + '\n');
if (audit.error || !audit.metadata?.vulnerabilities) throw new Error('Dependency advisory scan failed. See security-reports/npm-audit.json.');
console.log(JSON.stringify(audit.metadata, null, 2));
const sbom = npm(['sbom', '--sbom-format=cyclonedx', '--package-lock-only', '--include=dev', '--include=optional', '--include=peer']);
if (sbom.status !== 0) throw new Error(`Could not generate dependency inventory: ${sbom.stderr}`);
fs.writeFileSync(path.join(directory, 'dependencies.cdx.json'), sbom.stdout);
if (result.status !== 0 || audit.metadata.vulnerabilities.total !== 0) throw new Error('Known dependency vulnerabilities found. Resolve them before publishing.');
console.log('No known vulnerabilities reported by npm. Saved audit and complete lockfile dependency inventory. This is an advisory scan, not a guarantee against undiscovered flaws.');
