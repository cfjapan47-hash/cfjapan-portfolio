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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { lineUserId, action, tag } = req.body;
  if (!lineUserId || !tag) return res.status(400).json({ error: 'lineUserId and tag are required' });

  const customerRef = db.collection('salons').doc(SALON_ID).collection('customers').doc(lineUserId);

  try {
    const doc = await customerRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Customer not found' });

    const currentTags = doc.data().tags || [];

    if (action === 'add') {
      if (!currentTags.includes(tag)) {
        await customerRef.update({ tags: [...currentTags, tag] });
      }
      return res.status(200).json({ success: true });
    }

    if (action === 'remove') {
      const newTags = currentTags.filter(t => t !== tag);
      await customerRef.update({ tags: newTags });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('Tag error:', error);
    return res.status(500).json({ error: error.message });
  }
};

