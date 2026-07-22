// Gera os PNGs do PWA a partir de pwa/icon-source.svg.
// Uso pontual (a instalação do "sharp" é temporária, não fica como dependência do projeto):
//   npm install -D sharp && node pwa/generate-icons.mjs && npm uninstall sharp
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = join(__dirname, 'icon-source.svg');
const publicDir = join(__dirname, '..', 'public');

const targets = [
  { file: 'pwa-192x192.png', size: 192 },
  { file: 'pwa-512x512.png', size: 512 },
  { file: 'maskable-icon-512x512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'favicon-32x32.png', size: 32 },
  { file: 'favicon-16x16.png', size: 16 },
];

for (const { file, size } of targets) {
  await sharp(source, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(join(publicDir, file));
  console.log(`gerado: ${file}`);
}
