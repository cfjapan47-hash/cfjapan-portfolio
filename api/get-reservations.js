const { resolveMerchantId, resolveMerchantBasic } = require('./_lib/merchant-config');
const { requireAuth } = require('./_lib/auth-check');

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const merchantId = resolveMerchantId(req);
  const resolved = await resolveMerchantBasic(merchantId);
  if (!resolved.ok) return res.status(resolved.status).json({ error: resolved.error });
  const { db } = resolved;

  const { month } = req.query; // YYYY-MM

  try {
    let query = db.collection('merchants').doc(merchantId).collection('reservations');

    if (month) {
      query = query
        .where('date', '>=', month + '-01')
        .where('date', '<=', month + '-31');
    }

    const snapshot = await query.get();
    const reservations = [];
    snapshot.forEach(doc => {
      reservations.push({ id: doc.id, ...doc.data() });
    });

    reservations.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.time || '').localeCompare(b.time || '');
    });

    return res.status(200).json({ reservations });
  } catch (error) {
    console.error('Get reservations error:', error);
    return res.status(500).json({ error: error.message });
  }
};
