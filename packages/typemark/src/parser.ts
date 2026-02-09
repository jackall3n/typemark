import type { ParsedTemplate } from "./types.ts";

const FRONTMATTER_DELIMITER = "---";

/**
 * Parse a .mdt template source into its constituent parts.
 *
 * Expects the format:
 * ```
 * ---
 * import type { Foo } from "bar";
 *
 * interface Props {
 *   foo: Foo
 * }
 * ---
 *
 * Hello, ${foo.name}!
 * ```
 */
export function parse(source: string): ParsedTemplate {
  const { frontmatter, body } = splitFrontmatter(source);
  const imports = extractImports(frontmatter);
  const preamble = extractPreamble(frontmatter);
  const propsBody = extractPropsBody(frontmatter);
  const propKeys = extractPropKeys(propsBody);

  return { imports, preamble, propsBody, body, propKeys };
}

/**
 * Split the source into frontmatter content and template body.
 * The body has its first leading newline stripped.
 */
function splitFrontmatter(source: string): {
  frontmatter: string;
  body: string;
} {
  const firstIndex = source.indexOf(FRONTMATTER_DELIMITER);
  if (firstIndex === -1) {
    throw new Error("Missing frontmatter: no opening `---` found");
  }

  const afterFirst = firstIndex + FRONTMATTER_DELIMITER.length;
  const secondIndex = source.indexOf(FRONTMATTER_DELIMITER, afterFirst);
  if (secondIndex === -1) {
    throw new Error("Missing frontmatter: no closing `---` found");
  }

  const frontmatter = source.slice(afterFirst, secondIndex).trim();
  const body = source.slice(secondIndex + FRONTMATTER_DELIMITER.length).trim();

  return { frontmatter, body };
}

/**
 * Extract all `import type` statements from the frontmatter.
 */
function extractImports(frontmatter: string): string[] {
  return frontmatter
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("import type"));
}

/**
 * Extract non-Props type declarations (interfaces and type aliases) from the
 * frontmatter. Each declaration is captured as a complete string.
 */
function extractPreamble(frontmatter: string): string[] {
  const declarations: string[] = [];
  const pattern = /(?:interface|type)\s+(?!Props\b)(\w+)/g;

  for (const match of frontmatter.matchAll(pattern)) {
    const start = match.index ?? 0;
    // For interfaces, find the matching closing brace
    if (frontmatter.slice(start).startsWith("interface")) {
      const openBrace = frontmatter.indexOf("{", start);
      if (openBrace === -1) continue;
      let depth = 1;
      let i = openBrace + 1;
      while (i < frontmatter.length && depth > 0) {
        if (frontmatter[i] === "{") depth++;
        else if (frontmatter[i] === "}") depth--;
        i++;
      }
      declarations.push(frontmatter.slice(start, i).trim());
    } else {
      // For type aliases, find the end of the statement (next semicolon or newline)
      const end = frontmatter.indexOf("\n", start);
      declarations.push(frontmatter.slice(start, end === -1 ? undefined : end).trim());
    }
  }

  return declarations;
}

/**
 * Extract the raw body of `interface Props { ... }` from the frontmatter.
 * Handles nested braces correctly.
 */
function extractPropsBody(frontmatter: string): string {
  const marker = "interface Props";
  const markerIndex = frontmatter.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error("Missing `interface Props { ... }` in frontmatter");
  }

  const openBrace = frontmatter.indexOf("{", markerIndex + marker.length);
  if (openBrace === -1) {
    throw new Error("Missing opening `{` for Props interface");
  }

  // Walk forward, tracking brace depth to find the matching close
  let depth = 1;
  let i = openBrace + 1;
  while (i < frontmatter.length && depth > 0) {
    if (frontmatter[i] === "{") depth++;
    else if (frontmatter[i] === "}") depth--;
    i++;
  }

  if (depth !== 0) {
    throw new Error("Unmatched `{` in Props interface");
  }

  // Content between the outer braces (excluding the braces themselves)
  return frontmatter.slice(openBrace + 1, i - 1).trim();
}

/**
 * Extract top-level property names from the Props body.
 *
 * Only picks up names at brace depth 0 -- properties inside nested
 * object types (e.g. `address: { street: string }`) are ignored.
 */
function extractPropKeys(propsBody: string): string[] {
  const keys: string[] = [];
  let depth = 0;

  for (const line of propsBody.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Only process lines at the top level
    if (depth === 0) {
      const match = trimmed.match(/^(\w+)\s*[?]?\s*:/);
      if (match?.[1]) {
        keys.push(match[1]);
      }
    }

    // Track brace depth across lines
    for (const ch of trimmed) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
  }

  return keys;
}
