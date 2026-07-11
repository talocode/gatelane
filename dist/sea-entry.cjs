const { join } = require("path");
const { readFileSync } = require("fs");
let version = "0.3.0";
try {
  const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf-8"));
  version = pkg.version || "0.3.0";
} catch {}
require("./bundle.cjs");
