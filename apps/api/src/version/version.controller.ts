import { Controller, Get } from "@nestjs/common";
import { readFileSync } from "node:fs";

let cachedBuildTime: string | undefined;

function firstRealValue(...values: Array<string | undefined>) {
  return values.find((value) => {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 && normalized !== "head" && normalized !== "unknown";
  }) ?? "unknown";
}

function imageBuildTime() {
  if (cachedBuildTime !== undefined) return cachedBuildTime;
  try {
    cachedBuildTime = readFileSync("build-time", "utf8").trim();
  } catch {
    cachedBuildTime = "";
  }
  return cachedBuildTime;
}

function buildInfo(service: "api") {
  return {
    service,
    version: process.env.npm_package_version ?? process.env.APP_VERSION ?? "0.1.0",
    commitSha: firstRealValue(
      process.env.SOURCE_COMMIT,
      process.env.COOLIFY_GIT_COMMIT,
      process.env.COMMIT_SHA,
      process.env.BUILD_COMMIT_SHA
    ),
    buildTime: firstRealValue(process.env.BUILD_TIME, process.env.NEXT_PUBLIC_BUILD_TIME, imageBuildTime())
  };
}

@Controller("version")
export class VersionController {
  @Get()
  version() {
    return buildInfo("api");
  }
}
