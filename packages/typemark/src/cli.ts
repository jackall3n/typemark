#!/usr/bin/env bun

import { watch } from "node:fs";
import { resolve } from "node:path";
import { generateDtsForFile } from "./codegen.ts";

const [command, globArg] = Bun.argv.slice(2);
const pattern = globArg ?? "**/*.mdt";

async function generate(): Promise<number> {
  const glob = new Bun.Glob(pattern);
  let count = 0;

  for await (const path of glob.scan({ absolute: true })) {
    const dtsContent = await generateDtsForFile(path);
    await Bun.write(`${path}.d.ts`, dtsContent);
    count++;
  }

  console.log(`typemark: generated ${count} .d.ts file${count === 1 ? "" : "s"}`);
  return count;
}

async function main() {
  switch (command) {
    case "generate": {
      await generate();
      break;
    }

    case "watch": {
      await generate();
      console.log(`typemark: watching for changes (${pattern})`);

      // Resolve the base directory for watching
      const dir = resolve(".");
      watch(dir, { recursive: true }, async (_event, filename) => {
        if (!filename || !filename.endsWith(".mdt")) return;

        const fullPath = resolve(dir, filename);
        try {
          const dtsContent = await generateDtsForFile(fullPath);
          await Bun.write(`${fullPath}.d.ts`, dtsContent);
          console.log(`typemark: updated ${filename}.d.ts`);
        } catch (err) {
          console.error(`typemark: error processing ${filename}:`, err);
        }
      });
      break;
    }

    default: {
      console.log(`Usage:
  typemark generate [glob]    Generate .d.ts files for .mdt files
  typemark watch [glob]       Watch .mdt files and regenerate .d.ts on change

Default glob: **/*.mdt`);
      process.exit(command ? 1 : 0);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
