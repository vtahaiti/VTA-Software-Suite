// Code-native artwork: reproducible vector source, rasterized for Xcode assets.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const assets = path.resolve(__dirname, '../apps/web/ios/App/App/Assets.xcassets');
const mark = `<g fill="none" stroke="#fff" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"><path d="M350 252h324v206l-27-18-27 18-27-18-27 18-27-18-27 18-27-18-27 18-27-18-27 18-27-18-27 18V252Z"/><path d="M408 313h208M408 365h127"/></g><text x="512" y="642" text-anchor="middle" fill="white" font-family="Arial,Helvetica,sans-serif" font-size="154" font-weight="800">VTA</text><text x="512" y="747" text-anchor="middle" fill="#dcecff" font-family="Arial,Helvetica,sans-serif" font-size="75" font-weight="700" letter-spacing="18">POS</text>`;
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#0877f9"/>${mark}</svg>`;
const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732"><rect width="2732" height="2732" fill="#0877f9"/><g transform="translate(1007.6 1007.6) scale(.7)">${mark}</g></svg>`;
(async () => {
  fs.writeFileSync(path.resolve(__dirname, '../apps/web/public/vta-pos-icon.svg'), icon);
  await sharp(Buffer.from(icon)).removeAlpha().png().toFile(path.join(assets, 'AppIcon.appiconset/AppIcon-512@2x.png'));
  for (const file of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    await sharp(Buffer.from(splash)).png().toFile(path.join(assets, 'Splash.imageset', file));
  }
})();
