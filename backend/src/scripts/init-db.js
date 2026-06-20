import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import trực tiếp cấu hình .env (lên 2 cấp thư mục)
dotenv.config({ path: path.join(__dirname, '../../.env') });

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('❌ Lỗi: Chưa có MONGODB_URI trong file .env');
  process.exit(1);
}

async function syncDB() {
  try {
    console.log(`⏳ Đang kết nối tới MongoDB Cloud với URI:\n   ${uri.replace(/:([^:@]+)@/, ':***@')}`);
    await mongoose.connect(uri);
    console.log('✅ Kết nối thành công!\n');

    console.log('⏳ Đang tải và đồng bộ các Model mới (tiếng Việt)...');
    
    // Nạp tất cả các model thông qua index.js (file Barrel)
    const models = await import('../models/index.js');
    
    for (const [modelName, model] of Object.entries(models)) {
      if (model && model.init) {
        await model.init();
        console.log(`  - Đã đồng bộ Collection: ${model.collection.name}`);
      }
    }

    console.log('\n🎉 Hoàn tất! Toàn bộ Database (DATN_VITAFAMILY) và Indexes đã được đẩy lên MongoDB Cloud.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi trong quá trình đồng bộ:', error);
    process.exit(1);
  }
}

syncDB();
