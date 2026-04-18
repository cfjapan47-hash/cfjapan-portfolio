const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const { resolveMerchantId, resolveMerchantBasic } = require('./_lib/merchant-config');
const { requireAuth } = require('./_lib/auth-check');

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id, lineUserId, displayName, date, time, course, memo } = req.body;
  if (!date) return res.status(400).json({ error: 'date is required' });

  const merchantId = resolveMerchantId(req);
  const resolved = await resolveMerchantBasic(merchantId);
  if (!resolved.ok) return res.status(resolved.status).json({ error: resolved.error });
  const { db, merchant } = resolved;

  try {
    const docId = id || uuidv4();
    const ref = db.collection('merchants').doc(merchantId).collection('reservations').doc(docId);

    await ref.set({
      merchantId,
      tenantId: merchant.tenantId,
      lineUserId: lineUserId || '',
      displayName: displayName || '未設定',
      date,
      time: time || '',
      course: course || '',
      memo: memo || '',
      status: 'confirmed',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return res.status(200).json({ success: true, id: docId });
  } catch (error) {
    console.error('Save reservation error:', error);
    return res.status(500).json({ error: error.message });
  }
};
