// stemmory-cli/packages/cli/src/lib/skill.test.js
import { DOC_STATUS_VALUES } from "@stemmory/schema";
import { describe, expect, it } from "vitest";

import { buildSkillMarkdown, SKILL_NAME } from "./skill.js";
import { frontmatterFieldTable } from "./skill-fields.js";

describe("buildSkillMarkdown", () => {
  it("names itself in valid-looking skill frontmatter", () => {
    const md = buildSkillMarkdown({ docsDir: "docs/features", hasApiKey: false });
    expect(md.startsWith("---\n")).toBe(true);
    expect(md).toContain(`name: ${SKILL_NAME}`);
    expect(md).toContain("description:");
  });

  it("covers the five always-present required sections (§2.2)", () => {
    const md = buildSkillMarkdown({ docsDir: "docs/features", hasApiKey: false });
    expect(md).toMatch(/Feature doc procedure/i);
    expect(md).toMatch(/Decision record format/i);
    expect(md).toMatch(/Status transitions/i);
    expect(md).toMatch(/Linear rule/i);
    expect(md).toMatch(/Session-end ritual/i);
  });

  it("omits the Tier 2 extension when no api key is configured", () => {
    const md = buildSkillMarkdown({ docsDir: "docs/features", hasApiKey: false });
    expect(md).not.toMatch(/Tier 2/i);
  });

  it("includes the Tier 2 extension only when an api key is configured", () => {
    const md = buildSkillMarkdown({ docsDir: "docs/features", hasApiKey: true });
    expect(md).toMatch(/Tier 2/i);
    expect(md).toMatch(/MCP/i);
  });

  it("documents every status value straight from @stemmory/schema", () => {
    const md = buildSkillMarkdown({ docsDir: "docs/features", hasApiKey: false });
    for (const status of DOC_STATUS_VALUES) {
      expect(md).toContain(`\`${status}\``);
    }
  });

  it("embeds the schema-derived frontmatter field table verbatim", () => {
    const md = buildSkillMarkdown({ docsDir: "docs/features", hasApiKey: false });
    expect(md).toContain(frontmatterFieldTable());
  });

  it("templates the configured docs dir into its own description", () => {
    const md = buildSkillMarkdown({ docsDir: "documentation/features", hasApiKey: false });
    expect(md).toContain("documentation/features/");
  });
});
