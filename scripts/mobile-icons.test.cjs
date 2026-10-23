const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const web = path.join(root, "apps/web");

async function assertImage(relativePath, size, hasAlpha) {
  const file = path.join(root, relativePath);
  assert.equal(fs.existsSync(file), true, `${relativePath} is missing`);
  const metadata = await sharp(file).metadata();
  assert.equal(metadata.width, size, `${relativePath} width`);
  assert.equal(metadata.height, size, `${relativePath} height`);
  assert.equal(Boolean(metadata.hasAlpha), hasAlpha, `${relativePath} alpha`);
}

async function main() {
  await assertImage("apps/web/public/vta-pos-icon-192.png", 192, false);
  await assertImage("apps/web/public/vta-pos-icon-512.png", 512, false);
  await assertImage("apps/web/public/vta-pos-icon.png", 1024, false);
  await assertImage(
    "apps/web/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
    1024,
    false,
  );

  const densities = {
    mdpi: [48, 108],
    hdpi: [72, 162],
    xhdpi: [96, 216],
    xxhdpi: [144, 324],
    xxxhdpi: [192, 432],
  };

  for (const [density, [launcherSize, foregroundSize]] of Object.entries(densities)) {
    const base = `apps/web/android/app/src/main/res/mipmap-${density}`;
    await assertImage(`${base}/ic_launcher.png`, launcherSize, false);
    await assertImage(`${base}/ic_launcher_round.png`, launcherSize, true);
    await assertImage(`${base}/ic_launcher_foreground.png`, foregroundSize, false);
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(web, "public/manifest.json"), "utf8"));
  assert.deepEqual(
    manifest.icons.map(({ src, sizes }) => ({ src, sizes })),
    [
      { src: "/vta-pos-icon-192.png", sizes: "192x192" },
      { src: "/vta-pos-icon-512.png", sizes: "512x512" },
    ],
  );

  console.log("VTA POS mobile icon assets: OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
