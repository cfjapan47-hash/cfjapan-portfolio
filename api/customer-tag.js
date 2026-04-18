const { resolveMerchantId, resolveMerchantBasic } = require('./_lib/merchant-config');
const { requireAuth } = require('./_lib/auth-check');

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { lineUserId, action, tag } = req.body;
  if (!lineUserId || !tag) return res.status(400).json({ error: 'lineUserId and tag are required' });

  const merchantId = resolveMerchantId(req);
  const resolved = await resolveMerchantBasic(merchantId);
  if (!resolved.ok) return res.status(resolved.status).json({ error: resolved.error });
  const { db } = resolved;

  const customerRef = db.collection('merchants').doc(merchantId).collection('customers').doc(lineUserId);

  try {
    const doc = await customerRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Customer not found' });

    const currentTags = doc.data().tags || [];

    if (action === 'add') {
      if (!currentTags.includes(tag)) {
        await customerRef.update({ tags: [...currentTags, tag] });
      }
      return res.status(200).json({ success: true });
    }

    if (action === 'remove') {
      const newTags = currentTags.filter(t => t !== tag);
      await customerRef.update({ tags: newTags });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('Tag error:', error);
    return res.status(500).json({ error: error.message });
  }
};
