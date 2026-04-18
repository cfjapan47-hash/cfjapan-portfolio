const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const { resolveMerchantId, resolveMerchantBasic } = require('./_lib/merchant-config');
const { requireAuth } = require('./_lib/auth-check');

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { lineUserId, action, text, staffName, memoId } = req.body;
  if (!lineUserId) return res.status(400).json({ error: 'lineUserId is required' });

  const merchantId = resolveMerchantId(req);
  const resolved = await resolveMerchantBasic(merchantId);
  if (!resolved.ok) return res.status(resolved.status).json({ error: resolved.error });
  const { db } = resolved;

  const customerRef = db.collection('merchants').doc(merchantId).collection('customers').doc(lineUserId);

  try {
    if (action === 'add') {
      const memo = {
        id: uuidv4(),
        text: text || '',
        staffName: staffName || '担当者',
        createdAt: new Date().toISOString(),
      };
      await customerRef.update({
        memos: admin.firestore.FieldValue.arrayUnion(memo),
      });
      return res.status(200).json({ success: true, memo });
    }

    if (action === 'delete') {
      const doc = await customerRef.get();
      if (!doc.exists) return res.status(404).json({ error: 'Customer not found' });
      const memos = (doc.data().memos || []).filter(m => m.id !== memoId);
      await customerRef.update({ memos });
      return res.status(200).json({ success: true });
    }

    if (action === 'profile') {
      const { skinType, skinConcerns, birthday, phone } = req.body;
      const updateData = {};
      if (skinType !== undefined) updateData['profile.skinType'] = skinType;
      if (skinConcerns !== undefined) updateData['profile.skinConcerns'] = skinConcerns;
      if (birthday !== undefined) updateData['profile.birthday'] = birthday;
      if (phone !== undefined) updateData['profile.phone'] = phone;
      await customerRef.update(updateData);
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('Memo error:', error);
    return res.status(500).json({ error: error.message });
  }
};
