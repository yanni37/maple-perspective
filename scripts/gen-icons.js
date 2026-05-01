const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '../public/icons');
const jpgPath = path.join(iconsDir, 'maplePerspective.jpg');
const svgPath = path.join(iconsDir, 'icon.svg');

async function generate() {
  try {
    const input = fs.existsSync(jpgPath) ? jpgPath : svgPath;
    if (!fs.existsSync(input)) {
      console.error('❌ No input image found. Put `maplePerspective.jpg` or `icon.svg` in public/icons/.');
      process.exit(1);
    }

    await Promise.all([
      sharp(input).resize(192, 192).png().toFile(path.join(iconsDir, 'icon-192.png')),
      sharp(input).resize(512, 512).png().toFile(path.join(iconsDir, 'icon-512.png')),
      sharp(input).resize(180, 180).png().toFile(path.join(iconsDir, 'apple-touch-icon.png')),
    ]);

    console.log('✅ Icons generated: icon-192.png, icon-512.png, apple-touch-icon.png');
  } catch (e) {
    console.error('❌', e);
    process.exit(1);
  }
}

generate();
