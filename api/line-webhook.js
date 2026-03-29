// api/line-webhook.js
// Vercel API Route - LINE Webhook + Claude AI返信生成

import crypto from 'crypto';

export const config = { api: { bodyParser: false } };

// リクエストボディを取得
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// LINE署名検証
function verifySignature(body, signature, secret) {
  const hash = crypto
    .createHmac('SHA256', secret)
    .update(body)
    .digest('base64');
  return hash === signature;
}

// Claude APIで返信文を生成
async function generateReply(userMessage) {
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
- 柔らかく親しみやすいです・ます調
- 絵文字は1〜2個まで
- 150文字以内
- 返信文のみ出力（前置き不要）
サロン情報：埼玉県本庄市若泉１丁目３番３２号、営業時間10:00〜17:00、お子様連れOK、完全予約制`,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || '（生成エラー）';
}

// LINEにメッセージ送信
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

// 自分（オーナー）にプッシュ通知
async function pushToOwner(originalMsg, replyDraft) {
  const ownerUserId = process.env.LINE_OWNER_USER_ID;
  if (!ownerUserId) return;

  const text = `📩 お客様からメッセージ\n「${originalMsg}」\n\n💬 AI返信案\n${replyDraft}\n\n─\nこの文章をコピーして返信してください`;

  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: ownerUserId,
      messages: [{ type: 'text', text }],
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'LINE Webhook Ready' });
  }

  const rawBody = await getRawBody(req);
  const signature = req.headers['x-line-signature'];

  // 署名検証
  if (!verifySignature(rawBody, signature, process.env.LINE_CHANNEL_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const body = JSON.parse(rawBody.toString());
  const events = body.events || [];

  for (const event of events) {
    if (event.type !== 'message' || event.message.type !== 'text') continue;

    const userMessage = event.message.text;
    const replyToken = event.replyToken;

    // Claude APIで返信案を生成
    const replyDraft = await generateReply(userMessage);

    // オーナーに返信案をプッシュ通知
    await pushToOwner(userMessage, replyDraft);

    // ★自動返信したい場合はこの行を有効化★
    // await sendLineMessage(replyToken, replyDraft);
  }

  res.status(200).json({ status: 'ok' });
}
