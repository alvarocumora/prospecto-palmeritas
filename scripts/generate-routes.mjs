import { Generator, getConfig } from "@tanstack/router-generator";

const root = process.cwd();
const generator = new Generator({ config: getConfig({}, root), root });
await generator.run();
