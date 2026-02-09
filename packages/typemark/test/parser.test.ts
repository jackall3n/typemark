import { test, expect, describe } from "bun:test";
import { parse } from "../src/parser.ts";

describe("parse", () => {
  describe("basic template with inline Props", () => {
    // Mirrors examples/basic.mdt
    const source = `---
interface Props {
    user: {
        firstName: string;
        age: number;
    }
}
---

Hello, \${user.firstName}. You are \${user.age}!`;

    test("extracts empty imports array when no imports exist", () => {
      const result = parse(source);
      expect(result.imports).toEqual([]);
    });

    test("extracts the propsBody without the surrounding braces", () => {
      const result = parse(source);
      expect(result.propsBody).toContain("user:");
      expect(result.propsBody).toContain("firstName: string;");
      expect(result.propsBody).toContain("age: number;");
    });

    test("extracts the template body after the closing ---", () => {
      const result = parse(source);
      expect(result.body).toBe(
        "Hello, ${user.firstName}. You are ${user.age}!"
      );
    });

    test("extracts only top-level propKeys", () => {
      const result = parse(source);
      expect(result.propKeys).toEqual(["user"]);
    });
  });

  describe("template with import types", () => {
    // Mirrors examples/import.mdt
    const source = `---
import type { User } from "@prisma/client";

interface Props {
    user: User
}
---

Hello, \${user.firstName}. You are \${user.age}!`;

    test("extracts import type statements", () => {
      const result = parse(source);
      expect(result.imports).toEqual([
        'import type { User } from "@prisma/client";',
      ]);
    });

    test("extracts the propsBody correctly alongside imports", () => {
      const result = parse(source);
      expect(result.propsBody).toBe("user: User");
    });

    test("extracts propKeys from imported type props", () => {
      const result = parse(source);
      expect(result.propKeys).toEqual(["user"]);
    });
  });

  describe("propKeys extraction", () => {
    test("extracts multiple top-level keys", () => {
      const source = `---
interface Props {
    name: string;
    age: number;
    email: string;
}
---
\${name} \${age} \${email}`;

      const result = parse(source);
      expect(result.propKeys).toEqual(["name", "age", "email"]);
    });

    test("does not extract nested keys from object types", () => {
      const source = `---
interface Props {
    user: {
        firstName: string;
        lastName: string;
    }
    count: number;
}
---
\${user.firstName}`;

      const result = parse(source);
      // Only top-level: "user" and "count", not "firstName" or "lastName"
      expect(result.propKeys).toEqual(["user", "count"]);
    });

    test("handles optional properties with ?", () => {
      const source = `---
interface Props {
    name?: string;
    age?: number;
}
---
\${name}`;

      const result = parse(source);
      expect(result.propKeys).toEqual(["name", "age"]);
    });
  });

  describe("error handling", () => {
    test("throws when missing opening ---", () => {
      const source = `interface Props { name: string }
---
Hello`;
      // The source above has no "---" before "interface Props" line,
      // but actually "---" appears on line 2 -- let's use a source with no --- at all
      const badSource = `no frontmatter at all`;
      expect(() => parse(badSource)).toThrow("no opening `---` found");
    });

    test("throws when missing closing ---", () => {
      const source = `---
interface Props {
    name: string;
}
Hello`;

      expect(() => parse(source)).toThrow("no closing `---` found");
    });

    test("throws when missing Props interface", () => {
      const source = `---
type Foo = string;
---
Hello`;

      expect(() => parse(source)).toThrow("Missing `interface Props { ... }`");
    });
  });

  describe("multi-line nested type in Props", () => {
    test("handles deeply nested braces correctly", () => {
      const source = `---
interface Props {
    config: {
        database: {
            host: string;
            port: number;
        }
        cache: {
            ttl: number;
        }
    }
    name: string;
}
---
\${name}`;

      const result = parse(source);
      expect(result.propKeys).toEqual(["config", "name"]);
      expect(result.propsBody).toContain("database:");
      expect(result.propsBody).toContain("host: string;");
      expect(result.propsBody).toContain("cache:");
    });
  });

  describe("body trimming", () => {
    test("trims leading and trailing whitespace from body", () => {
      const source = "---\ninterface Props {\n    name: string;\n}\n---\nHello, ${name}!";

      const result = parse(source);
      expect(result.body).toBe("Hello, ${name}!");
    });

    test("trims blank lines before body content", () => {
      const source = "---\ninterface Props {\n    name: string;\n}\n---\n\nHello, ${name}!";

      const result = parse(source);
      expect(result.body).toBe("Hello, ${name}!");
    });
  });

  describe("empty body", () => {
    test("handles template with empty body after ---", () => {
      const source = `---
interface Props {
    name: string;
}
---`;

      const result = parse(source);
      expect(result.body).toBe("");
    });

    test("handles template with only a newline as body", () => {
      const source = `---
interface Props {
    name: string;
}
---
`;

      const result = parse(source);
      // The single newline after --- is stripped
      expect(result.body).toBe("");
    });
  });
});
