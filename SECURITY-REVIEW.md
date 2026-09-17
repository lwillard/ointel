# Dependency security checks

The offline release pipeline runs `npm run security:audit` on the Apple Silicon build machine before packaging. It checks runtime, development, optional, and peer dependencies using npm's advisory service and independently queries OSV for every distinct name/version in the lockfile. Either a finding or an incomplete scan stops publication.

The release also runs `npm audit signatures` with a current npm client to verify registry signatures and available provenance attestations. `npm ci` installs the locked dependencies with integrity verification. Model files have pinned SHA-256 checks and are verified again immediately before packaging. GitHub Actions are pinned to commit hashes.

Reports are attached to the GitHub release: `npm-audit.json`, `osv-audit.json`, `npm-signatures.json`, and `dependencies.cdx.json`. The advisory reports include their scan time and lockfile hash.

Initial checks on September 17, 2026 UTC found zero npm advisories across 700 dependency entries and zero OSV findings across 676 distinct package versions. On the Windows development installation, 619 packages had valid registry signatures and 153 had verified attestations. Platform-specific installed-package counts may differ; use the release's reports for the Mac build.

Deprecated packages such as `inflight`, `glob` 7, and `boolean` remain indirect dependencies of the packaging tools. Deprecation is a maintenance concern even when the current advisory databases report no matching vulnerability. These are build-time dependencies; they are not required to be downloaded by someone installing the packaged app.

This is a known-advisory and package-authenticity check, not a manual source audit of every dependency, malware certification, or proof that all vulnerabilities have been discovered. Native libraries, Electron, and models need ongoing maintenance as new advisories appear. The installer is ad-hoc signed and is not Apple Developer notarized.
