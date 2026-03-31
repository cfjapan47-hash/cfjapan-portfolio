
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id, lineUserId, displayName, date, time, course, memo } = req.body;
  if (!date) return res.status(400).json({ error: 'date is required' });

  try {
    const docId = id || uuidv4();
    const ref = db.collection('salons').doc(SALON_ID).collection('reservations').doc(docId);

    await ref.set({
      lineUserId: lineUserId || '',
      displayName: displayName || '未設定',
      date,
      time: time || '',
      course: course || '',
      memo: memo || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return res.status(200).json({ success: true, id: docId });
  } catch (error) {
    console.error('Save reservation error:', error);
    return res.status(500).json({ error: error.message });
  }
};
