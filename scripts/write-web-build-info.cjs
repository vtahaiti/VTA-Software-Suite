const { execFileSync } = require("node:child_process");
const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

function firstRealValue(...values) {
  for (const value of values) {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (normalized && normalized.toLowerCase() !== "head" && normalized.toLowerCase() !== "unknown") {
      return normalized;
    }
  }
  return "unknown";
}

function gitCommitSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return undefined;
  }
}

const buildInfo = {
  service: "web",
  version: process.env.npm_package_version ?? process.env.APP_VERSION ?? "0.1.0",
  commitSha: firstRealValue(
    process.env.SOURCE_COMMIT,
    process.env.COOLIFY_GIT_COMMIT,
    process.env.COMMIT_SHA,
    process.env.BUILD_COMMIT_SHA,
    gitCommitSha(),
    process.env.NEXT_PUBLIC_BUILD_COMMIT_SHA,
    process.env.NEXT_PUBLIC_BUILD_SHA
  ),
  buildTime: firstRealValue(process.env.NEXT_PUBLIC_BUILD_TIME, process.env.BUILD_TIME, new Date().toISOString())
};

const publicDir = join(__dirname, "..", "apps", "web", "public");
mkdirSync(publicDir, { recursive: true });
writeFileSync(join(publicDir, "build-info.json"), `${JSON.stringify(buildInfo, null, 2)}\n`);
