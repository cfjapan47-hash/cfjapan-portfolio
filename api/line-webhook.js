// api/line-webhook.js
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
    // お客様プロフィール（会話から自動学習）
    hasChildren: null,       // true/false/null（不明）
    skinType: null,          // 乾燥肌・脂性肌・混合肌・敏感肌など
    skinConcerns: [],        // 悩み（シミ・シワ・毛穴など）
    preferredMenu: null,     // 好みのメニュー
    notes: '',               // その他メモ
    conversationHistory: [], // 直近10件の会話履歴
  };
  await ref.set(newCustomer);
  return { ref, data: newCustomer };
}

// Claudeでお客様情報を抽出・更新
async function extractAndUpdateProfile(db, salonId, lineUserId, customerMessage, customerData) {
  const extractRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: `お客様のメッセージから個人情報を抽出してJSON形式で返してください。
抽出できない場合はnullを返してください。
返すJSONのキー：
- hasChildren: お子さんがいる場合true、いない場合false、不明null
- skinType: 肌タイプ（文字列または null）
- skinConcerns: 肌の悩みの配列（例：["シミ","乾燥"]）または空配列
- preferredMenu: 希望メニュー（文字列または null）
JSONのみ返してください。前置き不要。`,
      messages: [{ role: 'user', content: customerMessage }],
    }),
  });

  const extractData = await extractRes.json();
  const extractText = extractData.content?.[0]?.text || '{}';

  try {
    const extracted = JSON.parse(extractText.replace(/```json|```/g, '').trim());
    const ref = db.collection('salons').doc(salonId).collection('customers').doc(lineUserId);

    const updates = {};
    if (extracted.hasChildren !== null && extracted.hasChildren !== undefined) {
      updates.hasChildren = extracted.hasChildren;
    }
    if (extracted.skinType) updates.skinType = extracted.skinType;
    if (extracted.skinConcerns?.length > 0) updates.skinConcerns = extracted.skinConcerns;
    if (extracted.preferredMenu) updates.preferredMenu = extracted.preferredMenu;

    // 会話履歴を追加（直近10件まで）
    const history = customerData.conversationHistory || [];
    history.unshift({ role: 'customer', text: customerMessage, at: new Date().toISOString() });
    updates.conversationHistory = history.slice(0, 10);

    if (Object.keys(updates).length > 0) {
      await ref.update(updates);
      return { ...customerData, ...updates };
    }
  } catch (e) {
    console.error('Profile extraction error:', e);
  }
  return customerData;
}

// AIで返信文を生成（お客様プロフィールを活用）
async function generateReply(customerMessage, customerData, goodReplies) {
  const visitInfo = customerData.visitCount > 0
    ? `過去${customerData.visitCount}回来店済みのリピーター`
    : '初めてのお客様';

  // お客様プロフィール情報を構築
  const profileParts = [];
  if (customerData.hasChildren === true) profileParts.push('お子様連れでの来店あり');
  if (customerData.hasChildren === false) profileParts.push('お子様なし（子連れ案内は不要）');
  if (customerData.skinType) profileParts.push(`肌タイプ：${customerData.skinType}`);
  if (customerData.skinConcerns?.length > 0) profileParts.push(`肌の悩み：${customerData.skinConcerns.join('・')}`);
  if (customerData.preferredMenu) profileParts.push(`好みのメニュー：${customerData.preferredMenu}`);
  if (customerData.notes) profileParts.push(`備考：${customerData.notes}`);

  const profileInfo = profileParts.length > 0
    ? `\n\n【お客様プロフィール】\n${profileParts.join('\n')}`
    : '';

  // 過去の会話履歴
  const historyText = customerData.conversationHistory?.length > 0
    ? `\n\n【過去の会話】\n${customerData.conversationHistory.slice(0, 5).map(h => `・${h.text}`).join('\n')}`
    : '';

  const goodReplyExamples = goodReplies.length > 0
    ? `\n\n【好評だった返信例】\n` + goodReplies.map((r, i) =>
        `例${i + 1}: お客様「${r.customerMessage}」→「${r.aiReply}」`
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

【返信ルール】
- 柔らかく親しみやすいです・ます調
- 絵文字は1〜2個まで
- 150文字以内
- 返信文のみ出力（前置き不要）
- お客様は${visitInfo}
- お名前：${customerData.displayName}様
- プロフィールにない情報は返信に含めない（例：子連れ情報が不明なら子連れ案内は書かない）

【サロン情報】
住所：埼玉県本庄市若泉１丁目３番３２号
営業時間：10:00〜17:00
完全予約制${profileInfo}${historyText}${goodReplyExamples}`,
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
      status: null,
      createdAt: FieldValue.serverTimestamp(),
    });
  return ref.id;
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

    // 顧客情報取得
    const { ref: customerRef, data: customerData } = await getOrCreateCustomer(db, salonId, lineUserId);

    // メッセージからプロフィール情報を抽出・更新
    const updatedCustomerData = await extractAndUpdateProfile(db, salonId, lineUserId, customerMessage, customerData);

    // 好評返信例を取得
    const goodReplies = await getGoodReplies(db, salonId);

    // AI返信生成（更新済みプロフィールを使用）
    const aiReply = await generateReply(customerMessage, updatedCustomerData, goodReplies);

    // Firestoreに保存
    await saveMessage(db, salonId, lineUserId, customerMessage, aiReply);

    // 顧客情報更新
    await customerRef.update({
      lastContactAt: FieldValue.serverTimestamp(),
      visitCount: FieldValue.increment(1),
    });

    // 自動返信はオフ（管理画面から手動送信）
    // await sendLineMessage(replyToken, aiReply);
  }

  res.status(200).json({ status: 'ok' });
}
