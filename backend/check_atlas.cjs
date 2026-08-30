const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://dhn31082004:hoangnam318@cluster0.k512b.mongodb.net/datn?retryWrites=true&w=majority&appName=Cluster0';
async function run() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('datn');
  const appointments = await db.collection('lich_hens').find({ 
    ngay_kham: '2026-08-30'
  }).toArray();
  console.log('Appointments today:', appointments.map(a => ({
    ma: a.ma_lich_hen, 
    status: a.status, 
    hinh_thuc: a.hinh_thuc_dat_lich,
    bac_si: a.doctor_id
  })));
  
  const queues = await db.collection('hang_dois').find({
    checkin_time: { $gte: new Date('2026-08-29T00:00:00Z') }
  }).toArray();
  console.log('Queues today:', queues.map(q => ({
    ma: q.ma_so_thu_tu,
    status: q.trang_thai,
    nguon: q.nguon,
    appt_id: q.appointment_id
  })));
  
  client.close();
}
run().catch(console.error);
