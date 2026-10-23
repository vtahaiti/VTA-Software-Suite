const path = require("node:path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const source = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, "apps/web/resources/vta-pos-icon-master.png");

const web = path.join(root, "apps/web");
const androidRes = path.join(web, "android/app/src/main/res");
const iosIcon = path.join(
  web,
  "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
);

const androidSizes = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

const adaptiveSizes = {
  mdpi: 108,
  hdpi: 162,
  xhdpi: 216,
  xxhdpi: 324,
  xxxhdpi: 432,
};

async function squarePng(size) {
  return sharp(source)
    .resize(size, size, { fit: "cover" })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function roundPng(size) {
  const circle = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${
      size / 2
    }" r="${size / 2}" fill="white"/></svg>`,
  );

  return sharp(await squarePng(size))
    .ensureAlpha()
    .composite([{ input: circle, blend: "dest-in" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function writeIcons() {
  await sharp(await squarePng(1024)).toFile(iosIcon);
  await sharp(await squarePng(1024)).toFile(path.join(web, "public/vta-pos-icon.png"));
  await sharp(await squarePng(512)).toFile(path.join(web, "public/vta-pos-icon-512.png"));
  await sharp(await squarePng(192)).toFile(path.join(web, "public/vta-pos-icon-192.png"));

  for (const [density, size] of Object.entries(androidSizes)) {
    const directory = path.join(androidRes, `mipmap-${density}`);
    await sharp(await squarePng(size)).toFile(path.join(directory, "ic_launcher.png"));
    await sharp(await roundPng(size)).toFile(path.join(directory, "ic_launcher_round.png"));
  }

  for (const [density, size] of Object.entries(adaptiveSizes)) {
    const directory = path.join(androidRes, `mipmap-${density}`);
    await sharp(await squarePng(size)).toFile(path.join(directory, "ic_launcher_foreground.png"));
  }
}

writeIcons()
  .then(() => console.log("VTA POS mobile icons generated for Web, Android and iOS."))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
