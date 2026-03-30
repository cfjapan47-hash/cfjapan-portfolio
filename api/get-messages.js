// api/get-messages.js
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function initFirebase() {
  if (getApps().length > 0) return getFirestore();
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
  return getFirestore();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const salonId = process.env.SALON_ID || 'menard-wakuizumi';
  try {
    const db = initFirebase();
    const snap = await db
      .collection('salons').doc(salonId)
      .collection('messages')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const messages = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() || null,
      sentAt: d.data().sentAt?.toDate?.()?.toISOString() || null,
    }));

    return res.status(200).json({ messages });
  } catch (err) {
    console.error('get-messages error:', err);
    return res.status(500).json({ error: err.message });
  }
}

