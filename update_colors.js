const fs = require('fs');
const path = require('path');

const files = ['website/index.html', 'website/pokedex.html', 'website/upload.html', 'website/admin.html'];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // 1. Backgrounds
  content = content.replace(/background:\s*(?:#ffffff|#fff|white|#f9f9f9|#f5f5f5)/gi, 'background: #f5f1e6');
  content = content.replace(/background-color:\s*(?:#ffffff|#fff|white)/gi, 'background-color: #f5f1e6');
  content = content.replace(/rgba\(255,\s*255,\s*255,\s*([0-9.]+)\)/gi, 'rgba(245, 241, 230, $1)');

  // 2. Text Colors
  content = content.replace(/color:\s*(?:#666666|#666|#888888|#888|#999999|#999|#9AA2AF)/gi, 'color: #454545');
  content = content.replace(/color:\s*(?:#ffffff|#fff|white)/gi, 'color: #f5f1e6');

  // 3. Borders
  content = content.replace(/border:\s*1px\s*(?:solid|dashed)\s*(?:#eeeeee|#eee|#dddddd|#ddd|#cccccc|#ccc)/gi, match => match.replace(/#eeeeee|#eee|#dddddd|#ddd|#cccccc|#ccc/i, '#5e3643'));
  content = content.replace(/border-bottom:\s*1px\s*solid\s*(?:#eeeeee|#eee|#dddddd|#ddd|#cccccc|#ccc)/gi, 'border-bottom: 1px solid #5e3643');
  content = content.replace(/border-color:\s*(?:#eeeeee|#eee|#dddddd|#ddd|#cccccc|#ccc)/gi, 'border-color: #5e3643');
  content = content.replace(/border:\s*3px\s*solid\s*(?:#ffffff|#fff|white)/gi, 'border: 3px solid #f5f1e6');
  content = content.replace(/border:\s*2px\s*solid\s*(?:#eeeeee|#eee|#dddddd|#ddd|#cccccc|#ccc)/gi, 'border: 2px solid #5e3643');

  // 4. Map Marker / Rarity Colors
  content = content.replace(/#4b7b91/gi, '#454545'); // Normal -> Dark Gray
  content = content.replace(/#f8c653/gi, '#5e3643'); // Rare -> Burgundy
  content = content.replace(/#ec6e5f/gi, '#f5f1e6'); // Very Rare -> Beige
  
  // For Very Rare to be visible, add border if it's the marker
  content = content.replace(/<div class="marker-pin" style="background-color: #f5f1e6;">/g, '<div class="marker-pin" style="background-color: #f5f1e6; border: 3px solid #5e3643;">');
  content = content.replace(/<div class="legend-dot very-rare"><\/div>/g, '<div class="legend-dot very-rare" style="border: 1px solid #5e3643;"></div>');

  // 5. Admin specific colors
  content = content.replace(/#d4a574/gi, '#5e3643'); // Gold to Burgundy
  content = content.replace(/#4caf50/gi, '#454545'); // Green to Dark Gray
  content = content.replace(/#f44336/gi, '#5e3643'); // Red to Burgundy
  content = content.replace(/#2196f3/gi, '#454545'); // Blue to Dark Gray
  content = content.replace(/#e8f5e9/gi, 'transparent'); // Status bg
  content = content.replace(/#2e7d32/gi, '#454545'); // Status text
  content = content.replace(/#ffebee/gi, 'transparent'); // Status bg
  content = content.replace(/#c62828/gi, '#5e3643'); // Status text
  content = content.replace(/#fff3e0/gi, 'transparent'); // Status bg
  content = content.replace(/#e65100/gi, '#454545'); // Status text

  // 6. Leaflet popup override in index.html
  if (file.includes('index.html')) {
    if (!content.includes('.leaflet-popup-content-wrapper')) {
       content = content.replace('</style>', `
    .leaflet-popup-content-wrapper, .leaflet-popup-tip { background: #f5f1e6; color: #454545; border: 1px solid #5e3643; box-shadow: 4px 4px 0 rgba(94, 54, 67, 0.2); }
    .leaflet-container a.leaflet-popup-close-button { color: #5e3643; }
  </style>`);
    }
  }

  // Write back
  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
});
