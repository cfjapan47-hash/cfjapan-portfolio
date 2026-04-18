// api/line-webhook/[merchantId].js
// 加盟店別の LINE Webhook エンドポイント。
// LINE Developers Console の Webhook URL に以下を設定する:
//   https://<domain>/api/line-webhook/<merchantId>
//
// フロー:
//   1. merchantId を URL から取得し、Merchant + crmConfig を解決
//   2. crmConfig.line.channelSecret で署名検証
//   3. 各 message event を merchants/{merchantId}/{customers,messages} に書き込み
//   4. crmConfig.industry に応じたプロフィール抽出
//   5. crmConfig.features.aiReply が true なら Claude で返信案生成

const admin = require('firebase-admin');
const { resolveMerchant, verifyLineSignature } = require('../_lib/merchant-config');
const { getExtractor } = require('../_lib/profile-extractors');
const { generateAiReply } = require('../_lib/ai-reply');

async function getLineProfile(userId, accessToken) {
  const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json();
}

async function getOrCreateCustomer(db, merchantId, tenantId, userId, displayName) {
  const ref = db.collection('merchants').doc(merchantId).collection('customers').doc(userId);
  const doc = await ref.get();

  if (doc.exists) return { ref, data: doc.data() };

  const newCustomer = {
    lineUserId: userId,
    merchantId,
    tenantId,
    displayName: displayName || '不明',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    messageCount: 0,
    visitCount: 0,
    tags: [],
    memos: [],
    profile: {},
  };
  await ref.set(newCustomer);
  return { ref, data: newCustomer };
}

/**
 * LINE beacon event を処理する。
 *   enter: 来店検知 → 顧客 visitCount++, lastVisit更新, 必要なら自動お礼メッセージpush
 *   leave: 退店検知 → 直近 enter を引いて dwellSeconds 計算
 *   banner: ビーコン圏内でバナータップ(利用者アクション) → イベント記録のみ
 */
async function handleBeaconEvent(db, merchant, secrets, event) {
  const userId = event.source?.userId;
  const hwid = event.beacon?.hwid;
  const beaconType = event.beacon?.type; // enter | leave | banner
  if (!userId || !hwid || !beaconType) return;

  const merchantRef = db.collection('merchants').doc(merchant.id);
  const now = admin.firestore.FieldValue.serverTimestamp();

  // 登録済みビーコンか確認(未登録でも動作はさせるがラベルは空)
  const beaconSnap = await merchantRef.collection('beacons').doc(hwid).get();
  const beaconLabel = beaconSnap.exists ? (beaconSnap.data().label || '') : '';
  const enterMessage = beaconSnap.exists ? beaconSnap.data().enterMessage : undefined;

  // イベント記録
  const eventRef = merchantRef.collection('beaconEvents').doc();
  const eventData = {
    merchantId: merchant.id,
    tenantId: merchant.tenantId || '',
    hwid,
    lineUserId: userId,
    type: beaconType,
    createdAt: now,
  };

  // leave の場合、直近の enter を引いて dwell 計算
  if (beaconType === 'leave') {
    const enterSnap = await merchantRef
      .collection('beaconEvents')
      .where('lineUserId', '==', userId)
      .where('hwid', '==', hwid)
      .where('type', '==', 'enter')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    if (!enterSnap.empty) {
      const enterDoc = enterSnap.docs[0];
      const enterAt = enterDoc.data().createdAt;
      const enterMs = enterAt?.toMillis ? enterAt.toMillis() : 0;
      if (enterMs > 0) {
        eventData.pairedEnterEventId = enterDoc.id;
        eventData.dwellSeconds = Math.round((Date.now() - enterMs) / 1000);
      }
    }
  }

  await eventRef.set(eventData);

  // enter の場合、顧客ドキュメントの visit を更新 + 自動メッセージ push(設定時のみ)
  if (beaconType === 'enter') {
    const lineProfile = await getLineProfile(userId, secrets.channelAccessToken);
    const displayName = lineProfile?.displayName || '不明';

    const customerRef = merchantRef.collection('customers').doc(userId);
    const customerDoc = await customerRef.get();
    if (customerDoc.exists) {
      const data = customerDoc.data();
      const visitCount = (data.visitCount || 0) + 1;
      await customerRef.update({
        visitCount,
        lastVisit: now,
        isRegular: visitCount >= 3,
        updatedAt: now,
      });
    } else {
      await customerRef.set({
        lineUserId: userId,
        merchantId: merchant.id,
        tenantId: merchant.tenantId || '',
        displayName,
        visitCount: 1,
        messageCount: 0,
        firstVisit: now,
        lastVisit: now,
        tags: [],
        memos: [],
        profile: {},
        isRegular: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 自動メッセージ(ビーコン登録時に設定されていれば)
    if (enterMessage && secrets.channelAccessToken) {
      try {
        await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${secrets.channelAccessToken}`,
          },
          body: JSON.stringify({
            to: userId,
            messages: [{ type: 'text', text: enterMessage }],
          }),
        });
      } catch (e) {
        console.error(`[webhook/${merchant.id}] enter push failed:`, e);
      }
    }
  }
  // 便利のため未使用変数抑制
  void beaconLabel;
}

async function getConversationHistory(db, merchantId, userId) {
  const snap = await db
    .collection('merchants').doc(merchantId)
    .collection('messages')
    .where('lineUserId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();

  const history = [];
  snap.forEach(d => {
    const v = d.data();
    history.push({
      customerMessage: v.customerMessage,
      aiReply: v.aiReply,
      sentReply: v.sentReply || null,
      status: v.status || 'pending',
      createdAt: v.createdAt,
    });
  });
  return history.reverse();
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).json({ status: 'ok' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { merchantId } = req.query;

  const resolved = await resolveMerchant(merchantId);
  if (!resolved.ok) return res.status(resolved.status).json({ error: resolved.error });

  const { merchant, crmConfig, secrets, db } = resolved;

  const signature = req.headers['x-line-signature'];
  const rawBody = JSON.stringify(req.body);
  if (!verifyLineSignature(rawBody, signature, secrets.channelSecret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const events = req.body?.events || [];
  if (events.length === 0) return res.status(200).json({ status: 'ok' });

  const anthropicKey = secrets.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  const extract = getExtractor(crmConfig.industry);

  for (const event of events) {
    // ==== ビーコン入退店 ====
    if (event.type === 'beacon' && crmConfig.features?.beacon) {
      try {
        await handleBeaconEvent(db, merchant, secrets, event);
      } catch (err) {
        console.error(`[webhook/${merchant.id}] beacon error:`, err);
      }
      continue;
    }

    // ==== テキストメッセージ ====
    if (event.type !== 'message' || event.message?.type !== 'text') continue;
    const userId = event.source?.userId;
    const messageText = event.message.text;
    if (!userId || !messageText) continue;

    try {
      const lineProfile = await getLineProfile(userId, secrets.channelAccessToken);
      const displayName = lineProfile?.displayName || '不明';

      const { ref: customerRef, data: customerData } = await getOrCreateCustomer(
        db, merchant.id, merchant.tenantId, userId, displayName,
      );

      await customerRef.update({
        displayName,
        messageCount: admin.firestore.FieldValue.increment(1),
        lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // プロフィール自動抽出(業種別)
      if (crmConfig.features?.profileExtraction) {
        const { profile, updated } = extract(customerData.profile || {}, messageText);
        if (updated) await customerRef.update({ profile });
      }

      // AI 返信案生成
      let aiReply = '';
      if (crmConfig.features?.aiReply && anthropicKey) {
        const fresh = (await customerRef.get()).data();
        const history = await getConversationHistory(db, merchant.id, userId);
        aiReply = await generateAiReply({
          crmConfig,
          customerMessage: messageText,
          customerDisplayName: displayName,
          customerProfile: fresh.profile,
          conversationHistory: history,
          shopName: merchant.name,
          shopAddress: merchant.address,
          anthropicApiKey: anthropicKey,
        });
      }

      await db
        .collection('merchants').doc(merchant.id)
        .collection('messages').add({
          merchantId: merchant.id,
          tenantId: merchant.tenantId,
          lineUserId: userId,
          displayName,
          customerMessage: messageText,
          aiReply,
          status: aiReply ? 'pending' : 'skipped',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (err) {
      console.error(`[webhook/${merchant.id}] error processing event:`, err);
    }
  }

  return res.status(200).json({ status: 'ok' });
};
