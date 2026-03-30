const crypto = require('crypto');

// Firebase Admin
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

// LINE署名検証
function verifySignature(body, signature) {
  const hash = crypto
    .createHmac('SHA256', process.env.LINE_CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  return hash === signature;
}

// LINEプロフィール取得
async function getLineProfile(userId) {
  const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
    headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
  });
  if (!res.ok) return null;
  return res.json();
}

// 顧客プロフィール取得・作成
async function getOrCreateCustomer(userId, displayName) {
  const customerRef = db.collection('salons').doc(SALON_ID).collection('customers').doc(userId);
  const doc = await customerRef.get();

  if (doc.exists) {
    return { ref: customerRef, data: doc.data() };
  }

  const newCustomer = {
    displayName: displayName || '不明',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    messageCount: 0,
    profile: {},
  };
  await customerRef.set(newCustomer);
  return { ref: customerRef, data: newCustomer };
}

// 過去の会話履歴を取得（最新20件）
async function getConversationHistory(userId) {
  const messagesRef = db.collection('salons').doc(SALON_ID).collection('messages');
  const snapshot = await messagesRef
    .where('lineUserId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();

  const history = [];
  snapshot.forEach(doc => {
    const d = doc.data();
    history.push({
      customerMessage: d.customerMessage,
      aiReply: d.aiReply,
      sentReply: d.sentReply || null,
      status: d.status || 'pending',
      createdAt: d.createdAt,
    });
  });

  // 古い順に並べ替え
  return history.reverse();
}

// Claude APIで返信案を生成
async function generateAIReply(customerMessage, customerData, conversationHistory) {
  // 会話履歴をテキストに変換
  let historyText = '';
  if (conversationHistory.length > 0) {
    historyText = '\n\n【過去の会話履歴（古い順）】\n';
    for (const h of conversationHistory) {
      historyText += `お客様: ${h.customerMessage}\n`;
      if (h.sentReply && h.sentReply !== h.aiReply) {
        historyText += `AI案: ${h.aiReply}\n`;
        historyText += `オーナーが修正して送信: ${h.sentReply}（★このスタイルを学んでください）\n`;
      } else if (h.sentReply || (h.status === 'sent' && h.aiReply)) {
        historyText += `サロン（送信済み）: ${h.sentReply || h.aiReply}\n`;
      } else {
        historyText += `（未返信）\n`;
      }
      historyText += '---\n';
    }
  }

  // 顧客プロフィール情報
  let profileText = '';
  if (customerData.profile && Object.keys(customerData.profile).length > 0) {
    profileText = '\n\n【このお客様について判明していること】\n';
    const p = customerData.profile;
    if (p.skinType) profileText += `肌タイプ: ${p.skinType}\n`;
    if (p.skinConcerns?.length) profileText += `肌の悩み: ${p.skinConcerns.join('、')}\n`;
    if (p.hasChildren === true) profileText += `お子様: あり\n`;
    if (p.preferredTime) profileText += `希望時間帯: ${p.preferredTime}\n`;
    if (p.visitCount) profileText += `来店回数: ${p.visitCount}回\n`;
    if (p.notes) profileText += `メモ: ${p.notes}\n`;
  }

  const systemPrompt = `あなたはメナードフェイシャルサロン若泉１丁目の受付AIアシスタントです。
オーナーの白石さんに代わって、お客様からのメッセージに対する返信案を作成します。

【最重要ルール】
1. 過去の会話履歴を必ず確認し、すでに話した内容を繰り返さないでください。
   - すでに予約の話をしているお客様に「ご予約はいかがですか？」と聞くのは禁止です。
   - 会話の続きとして自然な返信をしてください。
2. お客様の情報が不明な場合は、その話題に触れないでください。お子様がいるかわからないのに「お子様連れOK」と言わないこと。
3. 過去にオーナーが修正して送信した返信がある場合、その言い回し・トーン・対応方法を学んでください。AI案ではなく「サロン（送信済み）」の内容がオーナーの好む返信スタイルです。次回から同じような状況ではオーナーのスタイルに合わせてください。
4. この返信案はオーナーが確認・修正してからお客様に送信されます。

【サロン情報】
- 営業時間: 10:00〜17:00、完全予約制、不定休
- 住所: 本庄市若泉１丁目３番３２号（ホームサロン）
- メナードの化粧品・フェイシャルエステを提供
- お客様の名前: ${customerData.displayName || '不明'}

【返信のトーン】
- 親しみやすく丁寧（堅すぎない）
- 絵文字は控えめに（1〜2個まで）
- 短めに（3〜5行程度）
- 会話の流れを自然に続ける
${profileText}${historyText}

【今回のお客様のメッセージ】
${customerMessage}

上記の会話の流れとお客様情報を踏まえて、自然で適切な返信案を作成してください。`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: systemPrompt }],
    }),
  });

  if (!res.ok) {
    console.error('Claude API error:', await res.text());
    return 'ご連絡ありがとうございます。確認してご連絡いたしますね。';
  }

  const data = await res.json();
  return data.content[0].text;
}

// お客様のプロフィールを会話から自動更新
async function updateCustomerProfile(customerRef, customerData, message) {
  const profile = customerData.profile || {};
  let updated = false;

  if (message.includes('乾燥肌') || message.includes('カサカサ')) {
    profile.skinType = '乾燥肌'; updated = true;
  } else if (message.includes('脂性肌') || message.includes('オイリー') || message.includes('テカリ')) {
    profile.skinType = '脂性肌'; updated = true;
  } else if (message.includes('敏感肌')) {
    profile.skinType = '敏感肌'; updated = true;
  }

  const concerns = profile.skinConcerns || [];
  const concernKeywords = {
    'シミ': 'シミ', 'しみ': 'シミ',
    'シワ': 'シワ', 'しわ': 'シワ',
    'たるみ': 'たるみ',
    'ニキビ': 'ニキビ', 'にきび': 'ニキビ', 'ポツポツ': 'ニキビ・吹き出物',
    'くすみ': 'くすみ',
    '毛穴': '毛穴',
    '乾燥': '乾燥',
  };
  for (const [keyword, concern] of Object.entries(concernKeywords)) {
    if (message.includes(keyword) && !concerns.includes(concern)) {
      concerns.push(concern);
      updated = true;
    }
  }
  if (updated && concerns.length > 0) profile.skinConcerns = concerns;

  if (message.includes('子ども') || message.includes('子供') || message.includes('息子') || message.includes('娘') || message.includes('赤ちゃん')) {
    profile.hasChildren = true; updated = true;
  }

  if (updated) {
    await customerRef.update({ profile });
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const signature = req.headers['x-line-signature'];
  const body = JSON.stringify(req.body);

  if (signature && !verifySignature(body, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const events = req.body?.events || [];

  if (events.length === 0) {
    return res.status(200).json({ status: 'ok' });
  }

  for (const event of events) {
    if (event.type !== 'message' || event.message?.type !== 'text') continue;

    const userId = event.source?.userId;
    const messageText = event.message.text;

    if (!userId || !messageText) continue;

    try {
      const lineProfile = await getLineProfile(userId);
      const displayName = lineProfile?.displayName || '不明';

      const { ref: customerRef, data: customerData } = await getOrCreateCustomer(userId, displayName);

      await customerRef.update({
        messageCount: admin.firestore.FieldValue.increment(1),
        lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await updateCustomerProfile(customerRef, customerData, messageText);

      const updatedDoc = await customerRef.get();
      const updatedCustomerData = updatedDoc.data();

      const conversationHistory = await getConversationHistory(userId);

      const aiReply = await generateAIReply(messageText, updatedCustomerData, conversationHistory);

      await db.collection('salons').doc(SALON_ID).collection('messages').add({
        lineUserId: userId,
        displayName: displayName,
        customerMessage: messageText,
        aiReply: aiReply,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    } catch (error) {
      console.error('Error processing message:', error);
    }
  }

  return res.status(200).json({ status: 'ok' });
};
