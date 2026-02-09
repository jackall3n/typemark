import { describe, expect, test } from "bun:test";
import { compile, compileToString, generateDts, parse } from "../src/index.ts";

describe("end-to-end", () => {
  describe("parse -> compile -> render with basic.mdt content", () => {
    const source = `---
interface Props {
    user: {
        firstName: string;
        age: number;
    }
}
---

Hello, \${user.firstName}. You are \${user.age}!`;

    test("full pipeline produces correct rendered output", () => {
      const parsed = parse(source);
      const template = compile(parsed);
      const result = template.render({
        user: { firstName: "Alice", age: 42 },
      });

      expect(result).toBe("Hello, Alice. You are 42!");
    });

    test("raw property matches the template body", () => {
      const parsed = parse(source);
      const template = compile(parsed);

      expect(template.raw).toBe("Hello, ${user.firstName}. You are ${user.age}!");
    });
  });

  describe("parse -> compileToString -> eval -> render roundtrip", () => {
    test("compiled string module renders correctly when evaluated", () => {
      const source = `---
interface Props {
    greeting: string;
    name: string;
}
---
\${greeting}, \${name}!`;

      const parsed = parse(source);
      const moduleString = compileToString(parsed);

      // Evaluate the module string to get a template object
      const evalCode = moduleString.replace("export default", "var __module__ =");
      const fn = new Function(`${evalCode}\nreturn __module__;`);
      const template = fn();

      expect(template.render({ greeting: "Hey", name: "World" })).toBe("Hey, World!");
      expect(typeof template.raw).toBe("string");
      expect(template.raw).toContain("${greeting}");
    });

    test("roundtrip preserves raw with escaped interpolations", () => {
      const source = `---
interface Props {
    x: string;
}
---
Value: \${x}`;

      const parsed = parse(source);
      const moduleString = compileToString(parsed);

      const evalCode = moduleString.replace("export default", "var __module__ =");
      const fn = new Function(`${evalCode}\nreturn __module__;`);
      const template = fn();

      // raw should contain the literal "${x}" as text, not an interpolated value
      expect(template.raw).toBe("Value: ${x}");
    });
  });

  describe("parse -> generateDts includes correct type shape", () => {
    test("dts output reflects the Props interface structure", () => {
      const source = `---
import type { Address } from "./types";

interface Props {
    name: string;
    address: Address;
    age?: number;
}
---
\${name} lives at \${address.street}`;

      const parsed = parse(source);
      const dts = generateDts(parsed);

      // Should have the import
      expect(dts).toContain('import type { Address } from "./types";');

      // Should wrap props in Template generic
      expect(dts).toContain('import("typemark").Template<{');

      // Should contain all prop fields
      expect(dts).toContain("name: string;");
      expect(dts).toContain("address: Address;");
      expect(dts).toContain("age?: number;");

      // Should have the export
      expect(dts).toContain("export default template;");
    });
  });

  describe("template with helper interfaces (preamble)", () => {
    const source = `---
interface Hobby {
    name: string;
    description: string;
}

interface Props {
    user: {
        firstName: string;
        age: number;
        hobbies: Hobby[];
    }
}
---

Hello, \${user.firstName}. You are \${user.age}!

I've heard you really like:
\${user.hobbies.map(hobby => \` * \${hobby.name}: \${hobby.description}\`).join("\\n")}`;

    test("parses preamble interfaces", () => {
      const parsed = parse(source);
      expect(parsed.preamble).toHaveLength(1);
      expect(parsed.preamble[0]).toContain("interface Hobby");
      expect(parsed.preamble[0]).toContain("name: string;");
    });

    test("renders with complex expressions", () => {
      const parsed = parse(source);
      const template = compile(parsed);
      const result = template.render({
        user: {
          firstName: "Jack",
          age: 30,
          hobbies: [
            { name: "Coding", description: "Building cool stuff" },
            { name: "Music", description: "Playing guitar" },
          ],
        },
      });
      expect(result).toContain("Hello, Jack. You are 30!");
      expect(result).toContain(" * Coding: Building cool stuff");
      expect(result).toContain(" * Music: Playing guitar");
    });

    test("generates .d.ts with helper interfaces", () => {
      const parsed = parse(source);
      const dts = generateDts(parsed);
      expect(dts).toContain("interface Hobby {");
      expect(dts).toContain("hobbies: Hobby[];");
      expect(dts).toContain("export default template;");
    });
  });

  describe("template with expressions", () => {
    test("renders ternary expressions", () => {
      const source = `---
interface Props {
    isAdmin: boolean;
    name: string;
}
---
\${isAdmin ? "Admin" : "User"}: \${name}`;

      const parsed = parse(source);
      const template = compile(parsed);

      expect(template.render({ isAdmin: true, name: "Alice" })).toBe("Admin: Alice");
      expect(template.render({ isAdmin: false, name: "Bob" })).toBe("User: Bob");
    });

    test("renders method calls on props", () => {
      const source = `---
interface Props {
    name: string;
}
---
Hello, \${name.toUpperCase()}!`;

      const parsed = parse(source);
      const template = compile(parsed);

      expect(template.render({ name: "alice" })).toBe("Hello, ALICE!");
    });

    test("renders arithmetic expressions", () => {
      const source = `---
interface Props {
    price: number;
    quantity: number;
}
---
Total: \${price * quantity}`;

      const parsed = parse(source);
      const template = compile(parsed);

      expect(template.render({ price: 10, quantity: 3 })).toBe("Total: 30");
    });

    test("renders template with array method", () => {
      const source = `---
interface Props {
    items: string[];
}
---
Items: \${items.join(", ")}`;

      const parsed = parse(source);
      const template = compile(parsed);

      expect(template.render({ items: ["apple", "banana", "cherry"] })).toBe("Items: apple, banana, cherry");
    });
  });
});
