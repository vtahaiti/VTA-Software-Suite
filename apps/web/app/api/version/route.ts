import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    service: "web",
    version: process.env.npm_package_version ?? process.env.APP_VERSION ?? "0.1.0",
    commitSha: process.env.BUILD_COMMIT_SHA ?? process.env.NEXT_PUBLIC_BUILD_COMMIT_SHA ?? process.env.COMMIT_SHA ?? process.env.COOLIFY_GIT_COMMIT ?? process.env.SOURCE_COMMIT ?? "unknown",
    buildTime: process.env.BUILD_TIME ?? process.env.NEXT_PUBLIC_BUILD_TIME ?? "unknown"
  });
}
