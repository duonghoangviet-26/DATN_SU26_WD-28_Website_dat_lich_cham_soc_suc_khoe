import fs from 'fs';
import path from 'path';

const dir = 'e:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/backend/src/models';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'index.js');

let mermaid = 'erDiagram\n';
let relationships = '';

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  
  const modelMatch = content.match(/mongoose\.model\(['"]([^'"]+)['"]/);
  if (!modelMatch) continue;
  const modelName = modelMatch[1];
  
  mermaid += `    ${modelName} {\n`;
  mermaid += `        ObjectId id PK\n`;
  
  const fieldRegex = /([a-zA-Z0-9_]+):\s*{(?:[^}]*?type:\s*([a-zA-Z]+|mongoose\.Schema\.Types\.ObjectId|\[.*?\])[^}]*?|[^}]*?)}/g;
  let fieldMatch;
  while ((fieldMatch = fieldRegex.exec(content)) !== null) {
    const fieldName = fieldMatch[1];
    if (['timestamps', 'collection', 'toJSON', 'virtuals', 'versionKey', 'transform'].includes(fieldName)) continue;
    let fieldType = fieldMatch[2] || 'String';
    
    // Sanitize type
    if (fieldType.includes('ObjectId')) fieldType = 'ObjectId';
    else if (fieldType.includes('[')) fieldType = 'Array';
    else if (fieldType.includes('Mixed')) fieldType = 'Mixed';
    else if (fieldType.includes('Date')) fieldType = 'Date';
    else if (fieldType.includes('Number')) fieldType = 'Number';
    else if (fieldType.includes('Boolean')) fieldType = 'Boolean';
    else if (fieldType.includes('String')) fieldType = 'String';
    else fieldType = 'String'; // fallback to avoid syntax errors
    
    mermaid += `        ${fieldType} ${fieldName}\n`;
  }
  
  mermaid += `    }\n\n`;
  
  const refRegex = /([a-zA-Z0-9_]+):\s*{[^}]*?ref:\s*['"]([^'"]+)['"][^}]*?}/g;
  let refMatch;
  while ((refMatch = refRegex.exec(content)) !== null) {
    const refField = refMatch[1];
    const refModel = refMatch[2];
    relationships += `${modelName} ||--o{ ${refModel} : "${refField}"\n`;
  }
}

const finalOutput = '# Sơ đồ ERD Tổng hợp Database\n\n```mermaid\n' + mermaid + relationships + '\n```\n';
fs.writeFileSync('C:/Users/DELL/.gemini/antigravity-ide/brain/af1c77c0-c9ee-44da-a328-96b227c94b6c/artifacts/erd_tong_hop.md', finalOutput, 'utf8');
console.log('Done!');
