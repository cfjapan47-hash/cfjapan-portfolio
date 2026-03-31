
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

const db = admin.firestore();
const SALON_ID = process.env.SALON_ID || 'menard-wakuizumi';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { month } = req.query; // YYYY-MM 形式

  try {
    let query = db.collection('salons').doc(SALON_ID).collection('reservations');

    if (month) {
      query = query
        .where('date', '>=', month + '-01')
        .where('date', '<=', month + '-31');
    }

    const snapshot = await query.get();
    const reservations = [];
    snapshot.forEach(doc => {
      reservations.push({ id: doc.id, ...doc.data() });
    });

    reservations.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.time || '').localeCompare(b.time || '');
    });

    return res.status(200).json({ reservations });
  } catch (error) {
    console.error('Get reservations error:', error);
    return res.status(500).json({ error: error.message });
  }
};
