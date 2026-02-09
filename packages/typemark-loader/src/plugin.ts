import { plugin } from "bun";
import { parse, compileToString } from "typemark";

plugin({
  name: "typemark",
  setup(build) {
    build.onLoad({ filter: /\.mdt$/ }, async (args) => {
      const source = await Bun.file(args.path).text();
      const parsed = parse(source);
      const contents = compileToString(parsed);

      return {
        contents,
        loader: "js",
      };
    });
  },
});
