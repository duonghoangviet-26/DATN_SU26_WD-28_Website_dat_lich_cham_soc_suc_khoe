const { MongoClient } = require('mongodb');
async function run() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('datn');
  const hs = await db.collection('ho_so_benh_nhan').find({}).toArray();
  const hs1 = hs.filter(h => h.ho_ten.includes('Nam'));
  console.log('HS Nam:', hs1.map(h => ({ _id: h._id, ho_ten: h.ho_ten, so_dien_thoai: h.so_dien_thoai })));

  const hs2 = hs.filter(h => h.ho_ten.includes('Minh An'));
  console.log('HS An:', hs2.map(h => ({ _id: h._id, ho_ten: h.ho_ten, so_dien_thoai: h.so_dien_thoai })));
  
  if (hs1.length) {
    const kqk = await db.collection('ket_qua_kham').find({ ho_so_benh_nhan_id: hs1[0]._id }).toArray();
    console.log('KQK Nam:', kqk.map(k => ({ _id: k._id, status: k.status, buoc_hien_tai: k.buoc_hien_tai, chan_doan: k.chan_doan })));
    const lh = await db.collection('lich_hen').find({ ho_so_benh_nhan_id: hs1[0]._id }).toArray();
    console.log('LichHen Nam:', lh.map(l => ({ _id: l._id, status: l.status, nguon: l.nguon })));
  }

  if (hs2.length) {
    const kqk = await db.collection('ket_qua_kham').find({ ho_so_benh_nhan_id: hs2[0]._id }).toArray();
    console.log('KQK An (0):', kqk.map(k => ({ _id: k._id, status: k.status, buoc_hien_tai: k.buoc_hien_tai, chan_doan: k.chan_doan })));
    const lh = await db.collection('lich_hen').find({ ho_so_benh_nhan_id: hs2[0]._id }).toArray();
    console.log('LichHen An (0):', lh.map(l => ({ _id: l._id, status: l.status, nguon: l.nguon })));

    if (hs2[1]) {
        const kqk2 = await db.collection('ket_qua_kham').find({ ho_so_benh_nhan_id: hs2[1]._id }).toArray();
        console.log('KQK An (1):', kqk2.map(k => ({ _id: k._id, status: k.status, buoc_hien_tai: k.buoc_hien_tai, chan_doan: k.chan_doan })));
        const lh2 = await db.collection('lich_hen').find({ ho_so_benh_nhan_id: hs2[1]._id }).toArray();
        console.log('LichHen An (1):', lh2.map(l => ({ _id: l._id, status: l.status, nguon: l.nguon })));
    }
  }

  // Also check HangDoi for today
  const hd = await db.collection('hang_doi').find({ ten_benh_nhan: { $regex: 'Nam|An' } }).toArray();
  console.log('HangDoi:', hd.map(h => ({ _id: h._id, ten: h.ten_benh_nhan, loai: h.loai_lich_hen })));

  await client.close();
}
run().catch(console.error);
