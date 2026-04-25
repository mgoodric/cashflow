# Changelog

## [2.4.0](https://github.com/mgoodric/cashflow/compare/v2.3.0...v2.4.0) (2026-04-25)


### Features

* add Excel-style editable transaction spreadsheet page ([#52](https://github.com/mgoodric/cashflow/issues/52)) ([a72484b](https://github.com/mgoodric/cashflow/commit/a72484b6803de5259d878273bf9cca1b4596a296))

## [2.3.0](https://github.com/mgoodric/cashflow/compare/v2.2.0...v2.3.0) (2026-04-25)


### Features

* complete all milestones P2-P6 plus dynamic loan payments ([#50](https://github.com/mgoodric/cashflow/issues/50)) ([fe5a6ed](https://github.com/mgoodric/cashflow/commit/fe5a6ed50f0df9b6d4cf5b331b05e7f5f65bb440))

## [2.1.0](https://github.com/mgoodric/cashflow/compare/v2.0.2...v2.1.0) (2026-03-27)


### Features

* add test suite with Vitest and CI pipeline gate ([751f3a0](https://github.com/mgoodric/cashflow/commit/751f3a06b707868638e447e99c71b6a283af44b8))
* add test suite with Vitest and CI pipeline gate ([cfc599c](https://github.com/mgoodric/cashflow/commit/cfc599ca7967588a992fb2bb2fcd9a45d3015893))


### Bug Fixes

* logout from Docker Hub before trivy build to avoid 401 ([d913ba0](https://github.com/mgoodric/cashflow/commit/d913ba077fbeb0da997ad43f5dd1df466a8a6477))

## [2.0.2](https://github.com/mgoodric/cashflow/compare/v2.0.1...v2.0.2) (2026-03-24)


### Bug Fixes

* read X-User/X-Email headers from nginx oauth2-proxy config ([a212f01](https://github.com/mgoodric/cashflow/commit/a212f01383b296be9ef38831c38f3c4aacef9449))

## [2.0.1](https://github.com/mgoodric/cashflow/compare/v2.0.0...v2.0.1) (2026-03-24)


### Bug Fixes

* **ci:** add actions:read permission to security workflow ([293d451](https://github.com/mgoodric/cashflow/commit/293d45170583478551c9fb6949f7f4df8d6c3c73))
* **ci:** output security scan results to log instead of SARIF upload ([a7997c9](https://github.com/mgoodric/cashflow/commit/a7997c9737294d247e739f49510e1bdb04f151be))
* **ci:** replace CodeQL with ESLint security checks ([e9ae22e](https://github.com/mgoodric/cashflow/commit/e9ae22ece6c629c3463f682251a5a610fe9d0bcc))

## [2.0.0](https://github.com/mgoodric/cashflow/compare/v1.0.0...v2.0.0) (2026-03-24)


### ⚠ BREAKING CHANGES

* Requires DATABASE_URL env var instead of Supabase credentials. Authentication handled by oauth2-proxy instead of Supabase Auth.

### Features

* replace Supabase with Drizzle ORM + oauth2-proxy auth, add Sankey chart ([1be5330](https://github.com/mgoodric/cashflow/commit/1be5330b2c44f8ada371490f13d89417cf8b2863))

## 1.0.0 (2026-03-23)


### Features

* initial commit ([cbddf29](https://github.com/mgoodric/cashflow/commit/cbddf29a4ac817db10b168524c3686b2e869d581))
