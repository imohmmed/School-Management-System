---
name: Dependency safety
description: Interpreting upstream SheetJS fixes and avoiding installer-driven weakening of workspace protections.
---

Do not assume every advisory matched by the npm package name applies to an
official upstream SheetJS distribution. Compare the advisory's prose and
upstream fixed version with the installed distribution, and disclose any
remaining scanner alerts rather than suppressing or renaming the dependency.

**Why:** SheetJS stopped publishing npm releases, and the two older advisories
use open-ended npm affected ranges. The scanner therefore reports even the
official upstream release containing both fixes.

**How to apply:** When changing spreadsheet dependencies, consult upstream
security notices, verify the installed version and archive integrity, and test
legacy XLS as well as XLSX/CSV before replacing the library.

Keep pnpm's workspace-root checks, minimum release age, and registry firewall
intact when package tooling fails. Do not relax those protections to make an
installer callback work.

**Why:** The package installer callback attempted a root pnpm add without the
required workspace flag, but rejected flags passed as package tokens. This
was a tooling limitation, not a reason to change project protections.

**How to apply:** Edit the relevant package manifests first; if the managed
installer cannot synchronize the workspace, use pnpm's normal workspace
installation without changing the safety settings.
