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

  const { lineUserId, action, text, staffName, memoId } = req.body;
  if (!lineUserId) return res.status(400).json({ error: 'lineUserId is required' });

  const customerRef = db.collection('salons').doc(SALON_ID).collection('customers').doc(lineUserId);

  try {
    if (action === 'add') {
      const memo = {
        id: uuidv4(),
        text: text || '',
        staffName: staffName || '担当者',
        createdAt: new Date().toISOString(),
      };
      await customerRef.update({
        memos: admin.firestore.FieldValue.arrayUnion(memo),
      });
      return res.status(200).json({ success: true, memo });
    }

    if (action === 'delete') {
      const doc = await customerRef.get();
      if (!doc.exists) return res.status(404).json({ error: 'Customer not found' });
      const memos = (doc.data().memos || []).filter(m => m.id !== memoId);
      await customerRef.update({ memos });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('Memo error:', error);
    return res.status(500).json({ error: error.message });
  }
};

