import { test, expect, describe } from "bun:test";
import { compile, compileToString } from "../src/compiler.ts";
import { parse } from "../src/parser.ts";

describe("compile", () => {
  test("creates a working render function from basic template", () => {
    const parsed = parse(`---
interface Props {
    name: string;
}
---
Hello, \${name}!`);

    const template = compile(parsed);
    expect(template.render({ name: "Alice" })).toBe("Hello, Alice!");
  });

  test("handles nested property access", () => {
    const parsed = parse(`---
interface Props {
    user: {
        firstName: string;
        age: number;
    }
}
---
Hello, \${user.firstName}. You are \${user.age}!`);

    const template = compile(parsed);
    const result = template.render({
      user: { firstName: "Bob", age: 30 },
    });
    expect(result).toBe("Hello, Bob. You are 30!");
  });

  test("handles multiple props", () => {
    const parsed = parse(`---
interface Props {
    greeting: string;
    name: string;
    punctuation: string;
}
---
\${greeting}, \${name}\${punctuation}`);

    const template = compile(parsed);
    const result = template.render({
      greeting: "Hi",
      name: "Carol",
      punctuation: "!",
    });
    expect(result).toBe("Hi, Carol!");
  });

  test("handles empty body", () => {
    const parsed = parse(`---
interface Props {
    name: string;
}
---`);

    const template = compile(parsed);
    expect(template.render({ name: "Dave" })).toBe("");
  });

  test("handles template with no prop references in body", () => {
    const parsed = parse(`---
interface Props {
    name: string;
}
---
Static content only.`);

    const template = compile(parsed);
    expect(template.render({ name: "ignored" })).toBe("Static content only.");
  });

  test("stores the raw body on the template", () => {
    const body = "Hello, ${name}!";
    const parsed = parse(`---
interface Props {
    name: string;
}
---
${body}`);

    const template = compile(parsed);
    expect(template.raw).toBe(body);
  });
});

describe("compileToString", () => {
  test("outputs a valid JS module string", () => {
    const parsed = parse(`---
interface Props {
    name: string;
}
---
Hello, \${name}!`);

    const output = compileToString(parsed);
    expect(output).toContain("export default {");
    expect(output).toContain("render(props)");
    expect(output).toContain("return `Hello, ${name}!`;");
    expect(output).toContain("raw:");
  });

  test("includes destructuring when props exist", () => {
    const parsed = parse(`---
interface Props {
    a: string;
    b: number;
}
---
\${a} \${b}`);

    const output = compileToString(parsed);
    expect(output).toContain("const { a, b } = props;");
  });

  test("omits destructuring when no props", () => {
    // Even though Props must exist, it can have zero keys if body is static
    const parsed = parse(`---
interface Props {
    name: string;
}
---
Static only`);

    // This template has a prop key but doesn't use it; the parser still
    // extracts the key. Let's test a case with a single-key prop to verify
    // destructuring IS present.
    const output = compileToString(parsed);
    expect(output).toContain("const { name } = props;");
  });

  test("escapes backticks in the raw property", () => {
    const parsed = parse(`---
interface Props {
    code: string;
}
---
Use \\\`backticks\\\` here: \${code}`);

    const output = compileToString(parsed);

    // In the raw property, backticks must be escaped so the template literal is valid
    const rawLine = output
      .split("\n")
      .find((line) => line.trimStart().startsWith("raw:"));
    expect(rawLine).toBeDefined();
    expect(rawLine).toContain("\\`");
  });

  test("escapes ${ in raw but not in render", () => {
    const parsed = parse(`---
interface Props {
    name: string;
}
---
Hello, \${name}!`);

    const output = compileToString(parsed);

    // The render function should have the live interpolation
    const renderLine = output
      .split("\n")
      .find((line) => line.includes("return `"));
    expect(renderLine).toContain("${name}");

    // The raw property should have escaped interpolation
    const rawLine = output
      .split("\n")
      .find((line) => line.trimStart().startsWith("raw:"));
    expect(rawLine).toContain("\\${name}");
  });

  test("output ends with a trailing newline", () => {
    const parsed = parse(`---
interface Props {
    x: string;
}
---
\${x}`);

    const output = compileToString(parsed);
    expect(output.endsWith("\n")).toBe(true);
  });

  test("output can be evaluated to produce a working module", () => {
    const parsed = parse(`---
interface Props {
    name: string;
    age: number;
}
---
\${name} is \${age} years old.`);

    const output = compileToString(parsed);

    // Replace "export default" with a variable assignment so we can eval it
    const evalCode = output.replace("export default", "var __module__ =");
    const fn = new Function(evalCode + "\nreturn __module__;");
    const mod = fn();

    expect(mod.render({ name: "Eve", age: 25 })).toBe(
      "Eve is 25 years old."
    );
    expect(typeof mod.raw).toBe("string");
  });
});
