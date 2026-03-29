// api/send-reply.js
// 管理画面から返信を送信するAPI

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messageId, salonId, lineUserId, replyText, feedback } = req.body;

  if (!messageId || !lineUserId || !replyText) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // LINEにpush messageで送信
    const lineRes = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: 'text', text: replyText }],
      }),
    });

    if (!lineRes.ok) {
      const error = await lineRes.json();
      return res.status(500).json({ error: 'LINE送信エラー', detail: error });
    }

    // Firestoreのメッセージを更新
    const db = initFirebase();
    const sid = salonId || process.env.SALON_ID || 'menard-wakuizumi';

    await db
      .collection('salons').doc(sid)
      .collection('messages').doc(messageId)
      .update({
        editedReply: replyText,
        feedback: feedback || 'good',
        sentAt: FieldValue.serverTimestamp(),
        status: 'sent',
      });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('send-reply error:', err);
    return res.status(500).json({ error: err.message });
  }
}
