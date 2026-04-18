const { resolveMerchantId, resolveMerchantBasic } = require('./_lib/merchant-config');
const { requireAuth } = require('./_lib/auth-check');

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const merchantId = resolveMerchantId(req);
  const resolved = await resolveMerchantBasic(merchantId);
  if (!resolved.ok) return res.status(resolved.status).json({ error: resolved.error });
  const { db } = resolved;

  try {
    const snap = await db
      .collection('merchants').doc(merchantId)
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
};
