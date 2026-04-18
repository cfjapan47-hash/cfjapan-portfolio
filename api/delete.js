// api/delete.js
// メッセージ/予約の削除。従来トップレベル collection を参照していたが、
// 実データは merchants/{merchantId}/... 配下にあるため修正。

const { resolveMerchantId, resolveMerchantBasic } = require('./_lib/merchant-config');
const { requireAuth } = require('./_lib/auth-check');

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { type, messageId, id } = req.body;

  const merchantId = resolveMerchantId(req);
  const resolved = await resolveMerchantBasic(merchantId);
  if (!resolved.ok) return res.status(resolved.status).json({ error: resolved.error });
  const { db } = resolved;

  try {
    if (type === 'message') {
      if (!messageId) return res.status(400).json({ error: 'messageId required' });
      await db.collection('merchants').doc(merchantId).collection('messages').doc(messageId).delete();
    } else if (type === 'reservation') {
      if (!id) return res.status(400).json({ error: 'id required' });
      await db.collection('merchants').doc(merchantId).collection('reservations').doc(id).delete();
    } else {
      return res.status(400).json({ error: 'Invalid type' });
    }
    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
