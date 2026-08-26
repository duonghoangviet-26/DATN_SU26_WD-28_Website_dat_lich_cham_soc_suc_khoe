import { MongoClient } from 'mongodb';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI || "mongodb+srv://lt1739274_db_user:luongtd1406@cluster0.zybgojw.mongodb.net/DATN_VITAFAMILY?appName=Cluster0";
const dbName = "DATN_VITAFAMILY";

async function exportAll() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  
  if (!fs.existsSync('./backup')) fs.mkdirSync('./backup');
  const collections = await db.listCollections().toArray();

  for (let col of collections) {
    const data = await db.collection(col.name).find({}).toArray();
    fs.writeFileSync(`./backup/${col.name}.json`, JSON.stringify(data, null, 2));
    console.log(`Đã xuất: ${col.name}`);
  }
  console.log("-> Đã xuất xong toàn bộ vào thư mục 'backup'!");
  await client.close();
}

exportAll();
