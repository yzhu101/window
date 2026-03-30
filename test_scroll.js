const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'website/data/works.json');
const works = JSON.parse(fs.readFileSync(p, 'utf8'));
for(let i=3; i<=15; i++) {
  works.push({
    "_id": `work_00${i}`,
    "title": `测试海鸥${i}`,
    "description": "大量数据测试",
    "userId": "admin",
    "rarity": "普通",
    "images": ["/assets/img/001.png"],
    "tags": [],
    "status": "approved",
    "location": {
      "lat": 31.2304 + i*0.01,
      "lng": 121.4737 + i*0.01,
      "address": `上海市测试地址 ${i}`,
      "city": "上海市"
    },
    "pokedexId": "",
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z"
  });
}
fs.writeFileSync(p, JSON.stringify(works, null, 2));
