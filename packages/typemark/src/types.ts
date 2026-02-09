/** A parsed .mdt file */
export interface ParsedTemplate {
  /** Type imports from the frontmatter (e.g. `import type { User } from "@prisma/client"`) */
  imports: string[];
  /** Helper type declarations from frontmatter (non-Props interfaces/types) */
  preamble: string[];
  /** The raw Props interface body (everything inside `interface Props { ... }`) */
  propsBody: string;
  /** The template body (everything after the closing `---`) */
  body: string;
  /** Top-level property names extracted from the Props interface */
  propKeys: string[];
}

/** A compiled template ready to render */
export interface Template<T extends Record<string, unknown> = Record<string, unknown>> {
  /** Render the template with the given props */
  render(props: T): string;
  /** The raw template body before compilation */
  raw: string;
}
