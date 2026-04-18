// api/get-stats.js
// 過去6ヶ月のメッセージ/予約数と総顧客数を返す。
// 従来トップレベル collection を参照していたが merchants/{merchantId}/... 配下へ修正。

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
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: `${d.getMonth() + 1}月`,
        messages: 0,
        reservations: 0,
      });
    }

    const merchantRef = db.collection('merchants').doc(merchantId);

    const msgsSnap = await merchantRef.collection('messages').get();
    msgsSnap.forEach(doc => {
      const ts = doc.data().createdAt;
      if (!ts) return;
      const date = typeof ts === 'string' ? new Date(ts) : ts.toDate ? ts.toDate() : null;
      if (!date) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const m = months.find(x => x.key === key);
      if (m) m.messages++;
    });

    const custsSnap = await merchantRef.collection('customers').get();
    const totalCustomers = custsSnap.size;

    const resSnap = await merchantRef.collection('reservations').get();
    resSnap.forEach(doc => {
      const date = doc.data().date;
      if (!date) return;
      const key = date.substring(0, 7);
      const m = months.find(x => x.key === key);
      if (m) m.reservations++;
    });

    return res.status(200).json({ months, totalCustomers });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
