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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const db = admin.firestore();
  const { type, messageId, id } = req.body;

  try {
    if (type === 'message') {
      await db.collection('messages').doc(messageId).delete();
    } else if (type === 'reservation') {
      await db.collection('reservations').doc(id).delete();
    } else {
      return res.status(400).json({ error: 'Invalid type' });
    }
    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
