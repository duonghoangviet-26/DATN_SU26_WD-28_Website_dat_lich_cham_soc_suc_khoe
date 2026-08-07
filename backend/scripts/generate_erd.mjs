import fs from 'fs';
import path from 'path';

const dir = 'e:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/backend/src/models';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'index.js');

let mermaid = 'erDiagram\n';
let relationships = '';

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  
  // Try to find the model name
  const modelMatch = content.match(/mongoose\.model\(['"]([^'"]+)['"]/);
  if (!modelMatch) continue;
  const modelName = modelMatch[1];
  
  mermaid += `    ${modelName} {\n`;
  mermaid += `        ObjectId id PK\n`;
  
  // Extract fields - simplified regex for basic fields
  const fieldRegex = /([a-zA-Z0-9_]+):\s*{(?:[^}]*?type:\s*([a-zA-Z]+|mongoose\.Schema\.Types\.ObjectId|\[.*?\])[^}]*?|[^}]*?)}/g;
  let fieldMatch;
  while ((fieldMatch = fieldRegex.exec(content)) !== null) {
    const fieldName = fieldMatch[1];
    if (['timestamps', 'collection', 'toJSON', 'virtuals', 'versionKey', 'transform'].includes(fieldName)) continue;
    let fieldType = fieldMatch[2] || 'String';
    if (fieldType.includes('ObjectId')) fieldType = 'ObjectId';
    if (fieldType.includes('String')) fieldType = 'String';
    if (fieldType.includes('Number')) fieldType = 'Number';
    if (fieldType.includes('Date')) fieldType = 'Date';
    if (fieldType.includes('Boolean')) fieldType = 'Boolean';
    mermaid += `        ${fieldType} ${fieldName}\n`;
  }
  
  mermaid += `    }\n\n`;
  
  // Extract refs
  const refRegex = /([a-zA-Z0-9_]+):\s*{[^}]*?ref:\s*['"]([^'"]+)['"][^}]*?}/g;
  let refMatch;
  while ((refMatch = refRegex.exec(content)) !== null) {
    const refField = refMatch[1];
    const refModel = refMatch[2];
    relationships += `${modelName} ||--o{ ${refModel} : "${refField}"\n`;
  }
}

console.log(mermaid + relationships);
