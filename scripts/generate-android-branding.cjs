// Build Android launcher resources from the same code-native SVG as the iOS icon.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const resources = path.join(root, 'apps/web/android/app/src/main/res');
const source = fs.readFileSync(path.join(root, 'apps/web/public/vta-pos-icon.svg'), 'utf8');
const body = source.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
const mark = body.replace(/<rect width="1024" height="1024" fill="#[0-9a-fA-F]+"\/>/, '');
// Adaptive drawables include an outer inset; keep the visible mark the same size
// as the legacy icon and inside Android's circular/squircle safe area.
const foreground = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><g transform="translate(170.6667 170.6667) scale(.6666667)">${mark}</g></svg>`;
const round = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs><clipPath id="round"><circle cx="512" cy="512" r="512"/></clipPath></defs><g clip-path="url(#round)">${body}</g></svg>`;
(async () => {
  for (const [density, iconSize, adaptiveSize] of [['mdpi',48,108],['hdpi',72,162],['xhdpi',96,216],['xxhdpi',144,324],['xxxhdpi',192,432]]) {
    const directory = path.join(resources, `mipmap-${density}`);
    await sharp(Buffer.from(source)).resize(iconSize,iconSize).removeAlpha().png().toFile(path.join(directory,'ic_launcher.png'));
    await sharp(Buffer.from(round)).resize(iconSize,iconSize).png().toFile(path.join(directory,'ic_launcher_round.png'));
    await sharp(Buffer.from(foreground)).resize(adaptiveSize,adaptiveSize).png().toFile(path.join(directory,'ic_launcher_foreground.png'));
  }
  fs.writeFileSync(path.join(resources,'values/ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0877F9</color>\n</resources>\n');
  console.log('VTA POS Android launcher icons generated in five densities.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
