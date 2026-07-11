#!/usr/bin/env node
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const PLATFORM = process.platform;
const ARCH = process.arch;

function log(msg) {
  console.log(`[build-binaries] ${msg}`);
}

function run(cmd) {
  log(`Running: ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

function getTargetName() {
  const map = {
    "linux:x64": "linux-x64",
    "linux:arm64": "linux-arm64",
    "darwin:x64": "macos-x64",
    "darwin:arm64": "macos-arm64",
    "win32:x64": "win-x64",
  };
  return map[`${PLATFORM}:${ARCH}`] || `${PLATFORM}-${ARCH}`;
}

async function buildBinary() {
  log(`Building standalone binary for ${PLATFORM}/${ARCH} (${getTargetName()})`);

  // Step 1: Bundle CLI with esbuild
  log("Bundling CLI with esbuild...");
  run(`npx esbuild dist/cli.js --bundle --platform=node --target=node24 --format=cjs --outfile=dist/bundle.cjs`);

  // Step 2: Create sea-config.json
  log("Creating SEA config...");
  writeFileSync(
    join(ROOT, "sea-config.json"),
    JSON.stringify({ main: "dist/bundle.cjs", output: "dist/sea.blob" }, null, 2),
  );

  // Step 3: Generate SEA blob
  log("Generating SEA blob...");
  run(`node --experimental-sea-config sea-config.json`);

  // Step 4: Copy Node.js binary
  const nodeBin = process.execPath;
  const targetName = getTargetName();
  const binaryPath = join(ROOT, "dist", `gatelane-${targetName}`);
  log(`Copying Node.js binary to ${binaryPath}...`);
  copyFileSync(nodeBin, binaryPath);

  // Step 5: Inject blob
  log("Injecting SEA blob...");
  run(`npx postject "${binaryPath}" NODE_SEA_BLOB dist/sea.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --overwrite`);

  // Rename for Windows
  if (PLATFORM === "win32") {
    const winPath = join(ROOT, "dist", `gatelane-${targetName}.exe`);
    copyFileSync(binaryPath, winPath);
    log(`Windows binary: ${winPath}`);
  }

  log(`Binary built: ${binaryPath}`);
  log(`Size: ${(existsSync(binaryPath) ? statSync(binaryPath).size / 1024 / 1024 : 0).toFixed(1)}MB`);
}

buildBinary().catch((err) => {
  console.error("Binary build failed:", err.message);
  process.exit(1);
});
