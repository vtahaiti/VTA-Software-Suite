import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type BuildInfo = {
  buildTime?: string;
  commitSha?: string;
  service?: string;
  version?: string;
};

let cachedBuildInfo: BuildInfo | undefined;

function firstRealValue(...values: Array<string | undefined>) {
  return values.find((value) => {
    const normalized = value?.trim();
    return normalized && normalized !== "HEAD" && normalized.toLowerCase() !== "unknown";
  }) ?? "unknown";
}

function readBuildInfo() {
  if (cachedBuildInfo !== undefined) return cachedBuildInfo;

  const candidates = [
    join(process.cwd(), "apps", "web", "public", "build-info.json"),
    join(process.cwd(), "public", "build-info.json")
  ];

  for (const filePath of candidates) {
    try {
      cachedBuildInfo = JSON.parse(readFileSync(filePath, "utf8")) as BuildInfo;
      return cachedBuildInfo;
    } catch {
      // Keep trying the next runtime layout.
    }
  }

  cachedBuildInfo = {};
  return cachedBuildInfo;
}

export function GET() {
  const buildInfo = readBuildInfo();

  return NextResponse.json({
    service: "web",
    version: buildInfo.version ?? process.env.npm_package_version ?? process.env.APP_VERSION ?? "0.1.0",
    commitSha: firstRealValue(
      buildInfo.commitSha,
      process.env.SOURCE_COMMIT,
      process.env.COOLIFY_GIT_COMMIT,
      process.env.COMMIT_SHA,
      process.env.BUILD_COMMIT_SHA,
      process.env.NEXT_PUBLIC_BUILD_COMMIT_SHA,
      process.env.NEXT_PUBLIC_BUILD_SHA
    ),
    buildTime: firstRealValue(buildInfo.buildTime, process.env.NEXT_PUBLIC_BUILD_TIME, process.env.BUILD_TIME)
  });
}
