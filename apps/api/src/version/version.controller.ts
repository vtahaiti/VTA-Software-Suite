import { Controller, Get } from "@nestjs/common";

function buildInfo(service: "api") {
  return {
    service,
    version: process.env.npm_package_version ?? process.env.APP_VERSION ?? "0.1.0",
    commitSha: process.env.BUILD_COMMIT_SHA ?? process.env.COMMIT_SHA ?? process.env.COOLIFY_GIT_COMMIT ?? process.env.SOURCE_COMMIT ?? "unknown",
    buildTime: process.env.BUILD_TIME ?? process.env.NEXT_PUBLIC_BUILD_TIME ?? "unknown"
  };
}

@Controller("version")
export class VersionController {
  @Get()
  version() {
    return buildInfo("api");
  }
}
