// api/send-reply.js
// 管理画面から返信を送信する API。
// LINE アクセストークンは crmConfig.line.channelAccessToken から取得する。

const { FieldValue } = require('firebase-admin/firestore');
const { resolveMerchantId, resolveMerchant } = require('./_lib/merchant-config');
const { requireAuth } = require('./_lib/auth-check');

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messageId, lineUserId, replyText, feedback } = req.body;
  if (!messageId || !lineUserId || !replyText) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const merchantId = resolveMerchantId(req);
  const resolved = await resolveMerchant(merchantId);
  if (!resolved.ok) return res.status(resolved.status).json({ error: resolved.error });
  const { db, secrets } = resolved;

  try {
    const accessToken = secrets.channelAccessToken;
    if (!accessToken) {
      return res.status(500).json({ error: 'LINE channel access token not configured' });
    }

    const lineRes = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
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

    // sentReply に記録することで line-webhook.js の AI 学習ロジックに取り込まれる
    await db
      .collection('merchants').doc(merchantId)
      .collection('messages').doc(messageId)
      .update({
        sentReply: replyText,
        feedback: feedback || 'good',
        sentAt: FieldValue.serverTimestamp(),
        status: 'sent',
      });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('send-reply error:', err);
    return res.status(500).json({ error: err.message });
  }
};
