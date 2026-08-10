---
slug: alpha/no-kit-fields
title: No Kit Fields At All
---

None of `schema`/`owner`/`updated`/`linear_team`/`links` are present — this
matches every doc in this repo's `docs/features/` today. All four kit fields
are optional, and since this doc hasn't declared `schema:` (hasn't opted into
the kit), the missing `updated` produces no warning either — ingestion
proceeds silently, exactly as it does for the shipped parser today.
