const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const db = admin.firestore();
  try {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: `${d.getMonth() + 1}月`,
        messages: 0,
        reservations: 0,
      });
    }

    const msgsSnap = await db.collection('messages').get();
    msgsSnap.forEach(doc => {
      const ts = doc.data().createdAt;
      if (ts) {
        const date = typeof ts === 'string' ? new Date(ts) : ts.toDate ? ts.toDate() : null;
        if (date) {
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const m = months.find(x => x.key === key);
          if (m) m.messages++;
        }
      }
    });

    const custsSnap = await db.collection('customers').get();
    const totalCustomers = custsSnap.size;

    const resSnap = await db.collection('reservations').get();
    resSnap.forEach(doc => {
      const date = doc.data().date;
      if (date) {
        const key = date.substring(0, 7);
        const m = months.find(x => x.key === key);
        if (m) m.reservations++;
      }
    });

    return res.status(200).json({ months, totalCustomers });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
