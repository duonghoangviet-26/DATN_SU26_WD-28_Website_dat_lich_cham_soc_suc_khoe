const { MongoClient } = require('mongodb');
MongoClient.connect('mongodb+srv://lt1739274_db_user:luongtd1406@cluster0.zybgojw.mongodb.net/DATN_VITAFAMILY?appName=Cluster0')
  .then(async client => {
    const db = client.db();
    const invoices = await db.collection('hoa_don').find({ so_hoa_don: { $in: ['HD-260902-0004', 'HD-260901-0010', 'HD-260829-0006'] } }).toArray();
    console.log('Invoices:', invoices.map(i => ({ so_hoa_don: i.so_hoa_don, id: i._id, appointment_id: i.appointment_id })));
    const invoiceIds = invoices.map(i => i._id);
    const payments = await db.collection('thanh_toan').find({ hoa_don_id: { $in: invoiceIds } }).toArray();
    console.log('Payments:', payments);
    const appointments = await db.collection('lich_hen').find({ _id: { $in: invoices.map(i => i.appointment_id) } }).toArray();
    console.log('Appointments:', appointments.map(a => ({ id: a._id, payment_status: a.payment_status, hinh_thuc_dat_lich: a.hinh_thuc_dat_lich })));
    client.close();
  });
