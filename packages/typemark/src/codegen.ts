import { parse } from "./parser.ts";
import type { ParsedTemplate } from "./types.ts";

/**
 * Generate a `.d.ts` declaration file from a parsed .mdt template.
 *
 * If the template has imports, they are emitted at the top of the file.
 * The Props body is inlined into a `Template<{ ... }>` type parameter.
 */
export function generateDts(parsed: ParsedTemplate): string {
  const lines: string[] = [];

  // Emit any `import type` statements from the frontmatter
  for (const imp of parsed.imports) {
    lines.push(imp);
  }

  if (parsed.imports.length > 0) {
    lines.push("");
  }

  // Emit helper type declarations (non-Props interfaces/types)
  for (const decl of parsed.preamble) {
    lines.push(decl);
  }

  if (parsed.preamble.length > 0) {
    lines.push("");
  }

  lines.push(`declare const template: import("typemark").Template<{`);

  // Indent the props body to sit inside the generic parameter.
  // The first line needs 4 spaces of indentation added; subsequent lines
  // already carry their original indentation from the frontmatter.
  const propsLines = parsed.propsBody.split("\n");
  for (const [i, line] of propsLines.entries()) {
    if (i === 0) {
      lines.push(`    ${line}`);
    } else {
      lines.push(line);
    }
  }

  lines.push("}>;");
  lines.push("export default template;");
  lines.push("");

  return lines.join("\n");
}

/**
 * Read a `.mdt` file, parse it, and return the generated `.d.ts` content.
 */
export async function generateDtsForFile(filePath: string): Promise<string> {
  const source = await Bun.file(filePath).text();
  const parsed = parse(source);
  return generateDts(parsed);
}
