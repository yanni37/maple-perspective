const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svg = fs.readFileSync(path.join(__dirname, '../public/icons/icon.svg'));

Promise.all([
  sharp(svg).resize(192, 192).png().toFile(path.join(__dirname, '../public/icons/icon-192.png')),
  sharp(svg).resize(512, 512).png().toFile(path.join(__dirname, '../public/icons/icon-512.png')),
  sharp(svg).resize(180, 180).png().toFile(path.join(__dirname, '../public/icons/apple-touch-icon.png')),
]).then(() => console.log('✅ Icons generated: icon-192.png, icon-512.png, apple-touch-icon.png'))
  .catch(e => { console.error('❌', e); process.exit(1); });
