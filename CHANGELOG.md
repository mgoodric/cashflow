# Changelog

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
