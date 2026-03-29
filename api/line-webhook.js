// api/line-webhook.js
// LINE Webhook + Claude AI自動返信 + Firestore顧客管理
 
import crypto from 'crypto';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
 
export const config = { api: { bodyParser: false } };
 
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
 
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
 
function verifySignature(body, signature, secret) {
  const hash = crypto.createHmac('SHA256', secret).update(body).digest('base64');
  return hash === signature;
}
 
async function getLineProfile(userId) {
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    });
    return await res.json();
  } catch {
    return { displayName: '不明', pictureUrl: '' };
  }
}
 
async function getOrCreateCustomer(db, salonId, lineUserId) {
  const ref = db.collection('salons').doc(salonId).collection('customers').doc(lineUserId);
  const snap = await ref.get();
  if (snap.exists) return { ref, data: snap.data() };
 
  const profile = await getLineProfile(lineUserId);
  const newCustomer = {
    lineUserId,
    displayName: profile.displayName || '不明',
    pictureUrl: profile.pictureUrl || '',
    visitCount: 0,
    firstContactAt: FieldValue.serverTimestamp(),
    lastContactAt: FieldValue.serverTimestamp(),
    notes: '',
    goodReplies: [],
  };
  await ref.set(newCustomer);
  return { ref, data: newCustomer };
}
 
async function getGoodReplies(db, salonId) {
  const snap = await db
    .collection('salons').doc(salonId)
    .collection('messages')
    .where('feedback', '==', 'good')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();
 
  return snap.docs.map(d => ({
    customerMessage: d.data().customerMessage,
    aiReply: d.data().editedReply || d.data().aiReply,
  }));
}
 
async function generateReply(customerMessage, customerData, goodReplies) {
  const visitInfo = customerData.visitCount > 0
    ? `過去${customerData.visitCount}回来店済みのリピーター`
    : '新規のお客様';
 
  const goodReplyExamples = goodReplies.length > 0
    ? '\n\n【過去に好評だった返信例】\n' + goodReplies.map((r, i) =>
        `例${i + 1}:\nお客様:「${r.customerMessage}」\n返信:「${r.aiReply}」`
      ).join('\n')
    : '';
 
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: `あなたはメナードフェイシャルサロン若泉１丁目のオーナー白石です。
お客様からのLINEメッセージへの返信文を作成してください。
 
【ルール】
- 柔らかく親しみやすいです・ます調
- 絵文字は1〜2個まで
- 150文字以内
- 返信文のみ出力（前置き不要）
- お客様は${visitInfo}です
- お名前：${customerData.displayName}様
 
【サロン情報】
住所：埼玉県本庄市若泉１丁目３番３２号
営業時間：10:00〜17:00
お子様連れOK、完全予約制${goodReplyExamples}`,
      messages: [{ role: 'user', content: customerMessage }],
    }),
  });
 
  const data = await res.json();
  return data.content?.[0]?.text || 'ご連絡ありがとうございます。確認してご連絡いたします。';
}
 
async function sendLineMessage(replyToken, text) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }],
    }),
  });
}
 
async function saveMessage(db, salonId, lineUserId, customerMessage, aiReply) {
  const ref = await db
    .collection('salons').doc(salonId)
    .collection('messages')
    .add({
      lineUserId,
      customerMessage,
      aiReply,
      editedReply: null,
      feedback: null,
      createdAt: FieldValue.serverTimestamp(),
    });
  return ref.id;
}
 
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'LINE Webhook Ready' });
  }
 
  const rawBody = await getRawBody(req);
  const signature = req.headers['x-line-signature'];
 
  if (!verifySignature(rawBody, signature, process.env.LINE_CHANNEL_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
 
  const body = JSON.parse(rawBody.toString());
  const events = body.events || [];
  const salonId = process.env.SALON_ID || 'menard-wakuizumi';
  const db = initFirebase();
 
  for (const event of events) {
    if (event.type !== 'message' || event.message.type !== 'text') continue;
 
    const lineUserId = event.source.userId;
    const customerMessage = event.message.text;
    const replyToken = event.replyToken;
 
    const { ref: customerRef, data: customerData } = await getOrCreateCustomer(db, salonId, lineUserId);
    const goodReplies = await getGoodReplies(db, salonId);
    const aiReply = await generateReply(customerMessage, customerData, goodReplies);
 
    // await sendLineMessage(replyToken, aiReply);
    await saveMessage(db, salonId, lineUserId, customerMessage, aiReply);
    await customerRef.update({
      lastContactAt: FieldValue.serverTimestamp(),
      visitCount: FieldValue.increment(1),
    });
  }
 
  res.status(200).json({ status: 'ok' });
}
 
