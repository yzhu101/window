const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../website/data/pokedex-config.json');
const dataPath = path.join(__dirname, '../website/data/pokedex.json');

// Read current data
let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
let pokedex = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// --- 1. CONFIG NORMALIZATION ---

// Replace "bird" with "animal" and update label/description
const typeBirdIndex = config.types.findIndex(t => t.key === 'bird');
if (typeBirdIndex !== -1) {
  config.types[typeBirdIndex] = {
    key: 'animal',
    label: '🪽 生灵纹系',
    description: '以飞鸟、昆虫等动物为母题的生动纹样。'
  };
}

// Remove "other" if "others" exists or vice versa to keep just one
const typeOtherIndex = config.types.findIndex(t => t.key === 'other');
const typeOthersIndex = config.types.findIndex(t => t.key === 'others');

if (typeOthersIndex !== -1 && typeOtherIndex !== -1) {
  // Merge "others" into "other" and delete "others"
  config.types.splice(typeOthersIndex, 1);
} else if (typeOthersIndex !== -1) {
  config.types[typeOthersIndex].key = 'other';
}

// Ensure label for other is good
const newOtherIndex = config.types.findIndex(t => t.key === 'other');
if (newOtherIndex !== -1) {
  config.types[newOtherIndex] = {
    key: 'other',
    label: '❓ 其他纹系',
    description: '尚未分类的未知纹样，待后续补充。'
  };
}

// Update categories: '原型' -> '基础款', '结构' -> '衍生款'
config.categories = config.categories.map(c => {
  if (c === '原型') return '基础款';
  if (c === '结构') return '衍生款';
  return c;
});


// --- 2. DATA NORMALIZATION ---

pokedex = pokedex.map(item => {
  let { name, type, category } = item;

  // Normalization 1: Type Mapping
  if (type === 'bird') type = 'animal';
  if (type === 'others') type = 'other';
  // If it's a butterfly, it's an animal now.
  if (name.includes('蝴蝶')) type = 'animal';
  
  // Normalization 2: Category Mapping
  if (category === '原型') category = '基础款';
  if (category === '结构') category = '衍生款';
  // Ensure strict mapping: if parentId is null, it should be 基础款. If parentId exists, it should be 衍生款.
  if (!item.parentId) category = '基础款';
  else category = '衍生款';

  // Normalization 3: Name Rules
  // Rule A: Remove "的" in names like "镂空的海棠纹", "抽象的盆栽"
  name = name.replace(/的/g, '');

  // Rule B: For base patterns, add "基础" prefix if it's missing, or at least "纹" suffix.
  // Actually, some names are "盆栽", "仙鹤", "竖琴", "花瓶", "蝴蝶". Let's standardize them.
  // If it's a base pattern (no parentId), and it doesn't have "基础", maybe add it?
  // Let's just make sure it has "纹" at the end if it's a noun.
  if (category === '基础款') {
    if (!name.startsWith('基础') && name.length <= 3) {
      name = '基础' + name;
    }
    if (!name.endsWith('形') && !name.endsWith('纹')) {
      name = name + '纹';
    }
  }

  // Rule C: For derivative patterns, ensure consistent format (e.g., [Modifier] + [BaseName])
  // E.g. "镂空海棠纹", "直线方孔海棠纹"
  if (category === '衍生款') {
    if (!name.endsWith('形') && !name.endsWith('纹') && !name.endsWith('瓣') && !name.endsWith('蕾')) {
      name = name + '纹';
    }
  }

  return { ...item, name, type, category };
});

// Write back
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
fs.writeFileSync(dataPath, JSON.stringify(pokedex, null, 2));

console.log('Normalization complete!');
