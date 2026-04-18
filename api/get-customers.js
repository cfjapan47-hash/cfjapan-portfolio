const { resolveMerchantId, resolveMerchantBasic } = require('./_lib/merchant-config');
const { requireAuth } = require('./_lib/auth-check');

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const merchantId = resolveMerchantId(req);
  const resolved = await resolveMerchantBasic(merchantId);
  if (!resolved.ok) return res.status(resolved.status).json({ error: resolved.error });
  const { db } = resolved;

  try {
    const snapshot = await db
      .collection('merchants').doc(merchantId)
      .collection('customers')
      .get();

    const customers = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      customers.push({
        lineUserId: doc.id,
        displayName: data.displayName || '不明',
        profileImageUrl: data.profileImageUrl || null,
        firstVisit: data.firstVisit?.toDate?.()?.toISOString() || null,
        lastVisit: data.lastVisit?.toDate?.()?.toISOString() || null,
        visitCount: data.visitCount || 0,
        tags: data.tags || [],
        memos: (data.memos || []).map(m => ({
          id: m.id,
          text: m.text,
          createdAt: m.createdAt?.toDate?.()?.toISOString() || m.createdAt || null,
          staffName: m.staffName || '',
        })),
        aiSummary: data.aiSummary || null,
        profile: data.profile || {},
      });
    });

    customers.sort((a, b) => {
      if (!a.lastVisit && !b.lastVisit) return 0;
      if (!a.lastVisit) return 1;
      if (!b.lastVisit) return -1;
      return new Date(b.lastVisit) - new Date(a.lastVisit);
    });

    return res.status(200).json({ customers });
  } catch (error) {
    console.error('Get customers error:', error);
    return res.status(500).json({ error: error.message });
  }
};
