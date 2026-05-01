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

    const sizes = [36,48,72,96,128,144,152,180,192,384,512,1024];
    const tasks = [];

    for (const s of sizes) {
      const name = `icon-${s}.png`;
      tasks.push(sharp(input).resize(s, s).png().toFile(path.join(iconsDir, name)));
    }

    // apple-touch-icon (180) already covered by sizes but keep explicit name
    tasks.push(sharp(input).resize(180, 180).png().toFile(path.join(iconsDir, 'apple-touch-icon.png')));

    // Generate a maskable 512 icon for manifest `purpose: maskable`
    tasks.push(sharp(input).resize(512, 512).png().toFile(path.join(iconsDir, 'icon-512-maskable.png')));

    await Promise.all(tasks);

    console.log('✅ Icons generated: icon-192.png, icon-512.png, apple-touch-icon.png');
  } catch (e) {
    console.error('❌', e);
    process.exit(1);
  }
}

generate();
