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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messageId } = req.body;

  if (!messageId) {
    return res.status(400).json({ error: 'messageId is required' });
  }

  try {
    await db.collection('salons').doc(SALON_ID).collection('messages').doc(messageId).delete();
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return res.status(500).json({ error: 'Failed to delete message' });
  }
};

