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

  try {
    const snapshot = await db
      .collection('salons').doc(SALON_ID)
      .collection('customers')
      .get();

    const customers = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      customers.push({
        lineUserId: doc.id,
        displayName: data.displayName || '不明',
        profileImageUrl: data.profileImageUrl || null,
        firstVisit: data.firstVisit?.toDate?.()?.toISOString() || null,
        lastVisit: data.lastVisit?.toDate?.()?.toISOString() || null,
        visitCount: data.visitCount || 0,
        tags: data.tags || [],
        memos: (data.memos || []).map(m => ({
          id: m.id,
          text: m.text,
          createdAt: m.createdAt?.toDate?.()?.toISOString() || m.createdAt || null,
          staffName: m.staffName || '',
        })),
        aiSummary: data.aiSummary || null,
        profile: data.profile || {},
      });
    });

    customers.sort((a, b) => {
      if (!a.lastVisit && !b.lastVisit) return 0;
      if (!a.lastVisit) return 1;
      if (!b.lastVisit) return -1;
      return new Date(b.lastVisit) - new Date(a.lastVisit);
    });

    return res.status(200).json({ customers });
  } catch (error) {
    console.error('Get customers error:', error);
    return res.status(500).json({ error: error.message });
  }
};

