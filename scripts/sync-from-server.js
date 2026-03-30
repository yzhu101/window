import fs from 'fs/promises';
import path from 'path';

const API_BASE = 'https://windowmap.xyz';
const ADMIN_TOKEN = 'huage_admin_2024';

async function fetchAndSave(url, filePath, useAdmin = false) {
  try {
    const headers = useAdmin ? { 'x-admin-token': ADMIN_TOKEN } : {};
    console.log(`Fetching ${url}...`);
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const json = await res.json();
    const data = json.data || json; // extract data array/object
    
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`Saved to ${filePath}`);
  } catch (err) {
    console.error(`Failed to sync ${url}:`, err.message);
  }
}

async function main() {
  const dataDir = path.resolve(process.cwd(), 'website/data');
  await fs.mkdir(dataDir, { recursive: true });

  await fetchAndSave(`${API_BASE}/api/works`, path.join(dataDir, 'works.json'));
  await fetchAndSave(`${API_BASE}/api/works/admin/all`, path.join(dataDir, 'admin-all.json'), true);
  await fetchAndSave(`${API_BASE}/api/pokedex`, path.join(dataDir, 'pokedex.json'));
  await fetchAndSave(`${API_BASE}/api/pokedex/config`, path.join(dataDir, 'pokedex-config.json'));
  
  console.log('Sync complete.');
}

main();