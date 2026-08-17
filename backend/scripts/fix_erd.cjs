const fs = require('fs');
let content = fs.readFileSync('C:/Users/DELL/.gemini/antigravity-ide/brain/af1c77c0-c9ee-44da-a328-96b227c94b6c/artifacts/erd_tong_hop.md', 'utf8');

const dummyNode = "\n    HeThongCauHinh {\n        String phan_he\n        String mo_ta\n    }\n\n";
const firstRelIndex = content.indexOf('BacSi ||--o{');
content = content.slice(0, firstRelIndex) + dummyNode + content.slice(firstRelIndex);

const extraRels = "\nHeThongCauHinh ||--o{ CaiDatThanhToan : \"quan_ly\"\nHeThongCauHinh ||--o{ CauHinhPhongKham : \"quan_ly\"\nHeThongCauHinh ||--o{ Counter : \"quan_ly\"\n";
content = content.replace('\n```\n', extraRels + '\n```\n');

fs.writeFileSync('C:/Users/DELL/.gemini/antigravity-ide/brain/af1c77c0-c9ee-44da-a328-96b227c94b6c/artifacts/erd_hoan_chinh.md', content, 'utf8');
console.log('Done!');
