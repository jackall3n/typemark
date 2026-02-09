import type { ParsedTemplate, Template } from "./types.ts";

/**
 * Compile a parsed template into a Template object with a render function.
 * Uses `new Function()` to create a function that evaluates the template body
 * as a JavaScript template literal.
 */
export function compile(parsed: ParsedTemplate): Template {
  const { propKeys, body } = parsed;

  const destructure =
    propKeys.length > 0 ? `const { ${propKeys.join(", ")} } = props; ` : "";

  const fnBody = `${destructure}return \`${body}\`;`;
  const renderFn = new Function("props", fnBody) as (
    props: Record<string, unknown>,
  ) => string;

  return {
    render: renderFn,
    raw: body,
  };
}

/**
 * Compile a parsed template into a JavaScript module string.
 * Used by the Bun loader and codegen to emit importable modules.
 */
export function compileToString(parsed: ParsedTemplate): string {
  const { propKeys, body } = parsed;

  const destructure =
    propKeys.length > 0 ? `const { ${propKeys.join(", ")} } = props;` : "";

  const escapedRaw = body
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");

  const lines = ["export default {"];
  lines.push("  render(props) {");
  if (destructure) {
    lines.push(`    ${destructure}`);
  }
  lines.push(`    return \`${body}\`;`);
  lines.push("  },");
  lines.push(`  raw: \`${escapedRaw}\``);
  lines.push("};");

  return lines.join("\n") + "\n";
}
