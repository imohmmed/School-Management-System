# Dependency security remediation

## Patched resolutions

The workspace retains its package firewall and minimum release age. Compatible
security overrides cover `proxy-addr` (2.0.8), `source-map-js` (1.2.2),
`brace-expansion` (5.0.12), and `fast-uri` (3.1.8).
The latest `@tailwindcss/typography` still pins the vulnerable selector parser;
its parser is overridden to 7.1.6, which preserves the parsing API.

`braces` 3.0.3 has no patched npm release. Both paths bringing it into the
workspace are removed: the Clerk transport uses `httpxy`, and component
discovery uses `glob`, instead of `http-proxy-middleware` and `fast-glob`.
The proxy regression tests exercise prefix stripping, query strings, POST
bodies, authentication headers, cookies, gzip, fixed-length binary assets,
HEAD/204/304 responses, and upstream errors without using real credentials.

## SheetJS advisory database limitation

The npm `xlsx` package ends at vulnerable version 0.18.5. This project instead
pins the official upstream SheetJS CE 0.20.3 archive:
https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz

The lockfile records its integrity. This retains XLSX, legacy XLS, CSV, date
parsing, Arabic data, RTL exports, and formula-safe CSV exports.

The dependency scanner still matches these two advisories by the npm package
name, because their machine-readable npm ranges have `introduced: 0` with no
fixed version. Their descriptions explicitly state the upstream fixes:

- GHSA-4r6h-8v6p-xvw6 / CVE-2023-30533: fixed in upstream 0.19.3.
  https://cdn.sheetjs.com/advisories/CVE-2023-30533
- GHSA-5pgg-2g8v-p4x9 / CVE-2024-22363: fixed in upstream 0.20.2.
  https://git.sheetjs.com/sheetjs/sheetjs/src/tag/v0.20.2

Version 0.20.3 is newer than both fixes. Do not suppress the findings globally
or rename the package to hide alerts: reassess them if the distribution changes.

## Regression commands

```sh
pnpm run typecheck
pnpm --filter @workspace/api-server run test:proxy
pnpm --filter @workspace/school-management run test:spreadsheets
pnpm --filter @workspace/api-server run test:integration
```

The integration test uses the development database and removes only its own
synthetic records. Never run it on production.
