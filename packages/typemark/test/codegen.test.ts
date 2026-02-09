import { describe, expect, test } from "bun:test";
import { generateDts, generateDtsForFile } from "../src/codegen.ts";
import { parse } from "../src/parser.ts";

describe("generateDts", () => {
  test("generates declaration with no imports", () => {
    const parsed = parse(`---
interface Props {
    name: string;
    age: number;
}
---
Hello, \${name}!`);

    const dts = generateDts(parsed);

    // Should NOT have any import statements
    expect(dts).not.toContain("import type");

    // Should have the template declaration
    expect(dts).toContain('import("typemark").Template<{');
    expect(dts).toContain("name: string;");
    expect(dts).toContain("age: number;");
    expect(dts).toContain("}>;");
    expect(dts).toContain("export default template;");
  });

  test("generates declaration with imports", () => {
    const parsed = parse(`---
import type { User } from "@prisma/client";

interface Props {
    user: User
}
---
Hello, \${user.firstName}!`);

    const dts = generateDts(parsed);

    // Import should appear at the top
    expect(dts).toContain('import type { User } from "@prisma/client";');

    // Import should come before the template declaration
    const importIndex = dts.indexOf("import type { User }");
    const templateIndex = dts.indexOf("declare const template");
    expect(importIndex).toBeLessThan(templateIndex);

    // A blank line should separate imports from declaration
    const lines = dts.split("\n");
    const importLineIdx = lines.findIndex((l) => l.includes("import type { User }"));
    expect(lines[importLineIdx + 1]).toBe("");
  });

  test("preserves nested type formatting in props body", () => {
    const parsed = parse(`---
interface Props {
    user: {
        firstName: string;
        age: number;
    }
}
---
\${user.firstName}`);

    const dts = generateDts(parsed);

    // The nested type structure should be preserved within the declaration
    expect(dts).toContain("user: {");
    expect(dts).toContain("firstName: string;");
    expect(dts).toContain("age: number;");
  });

  test("output contains Template<{...}> generic type", () => {
    const parsed = parse(`---
interface Props {
    title: string;
}
---
\${title}`);

    const dts = generateDts(parsed);
    expect(dts).toContain('import("typemark").Template<{');
  });

  test("output contains export default template", () => {
    const parsed = parse(`---
interface Props {
    x: string;
}
---
\${x}`);

    const dts = generateDts(parsed);
    expect(dts).toContain("export default template;");
  });

  test("output declares template as const", () => {
    const parsed = parse(`---
interface Props {
    x: string;
}
---
\${x}`);

    const dts = generateDts(parsed);
    expect(dts).toContain("declare const template:");
  });
});

describe("generateDtsForFile", () => {
  test("works with actual .mdt file (examples/basic.mdt)", async () => {
    const dts = await generateDtsForFile("/Users/jack/dev/typemark/examples/basic.mdt");

    // Should contain the template declaration
    expect(dts).toContain('import("typemark").Template<{');
    expect(dts).toContain("export default template;");

    // Should contain the nested user type from basic.mdt
    expect(dts).toContain("user:");
    expect(dts).toContain("firstName: string;");
    expect(dts).toContain("age: number;");
  });

  test("works with import.mdt file that has type imports", async () => {
    const dts = await generateDtsForFile("/Users/jack/dev/typemark/examples/import.mdt");

    // Should include the import statement
    expect(dts).toContain('import type { User } from "@prisma/client";');

    // Should have the User type reference in the props
    expect(dts).toContain("user: User");
    expect(dts).toContain("export default template;");
  });
});
