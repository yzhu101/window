import fs from 'fs/promises';
import path from 'path';

const API_BASE = 'https://windowmap.xyz';
const filesToSync = [
  'index.html',
  'upload.html',
  'pokedex.html',
  'pokedex-admin.html',
  'admin.html'
];

async function fetchAndSaveHTML(filename) {
  try {
    console.log(`Fetching ${filename}...`);
    const res = await fetch(`${API_BASE}/${filename}`);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const html = await res.text();
    
    const filePath = path.resolve(process.cwd(), 'website', filename);
    await fs.writeFile(filePath, html);
    console.log(`Saved to ${filePath}`);
  } catch (err) {
    console.error(`Failed to sync ${filename}:`, err.message);
  }
}

async function main() {
  for (const file of filesToSync) {
    await fetchAndSaveHTML(file);
  }
  console.log('Frontend sync complete.');
}

main();
