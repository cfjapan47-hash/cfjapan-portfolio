// api/_lib/merchant-config.js
// Webhook/API が受けた merchantId を Firestore 上の Merchant + crmConfig に解決するヘルパー。
// _ プレフィックスで Vercel Functions の自動デプロイ対象から外している。

const admin = require('firebase-admin');

function getDb() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return admin.firestore();
}

// merchantId 形式の軽い検証(URL injection 予防)
function isValidMerchantId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

/**
 * リクエストから merchantId を取り出す。
 * 優先順位: query.merchantId > body.merchantId > body.salonId(legacy send-reply) > env.SALON_ID
 * env フォールバックは Phase 1D 移行期間のみの過渡措置。
 */
function resolveMerchantId(req) {
  return (
    req.query?.merchantId ||
    req.body?.merchantId ||
    req.body?.salonId ||
    process.env.SALON_ID ||
    'menard-wakuizumi'
  );
}

/**
 * 管理系 API 用の軽い解決。isActive のみチェックし crmConfig は問わない。
 * 戻り値: { ok: true, merchant, db } | { ok: false, status, error }
 */
async function resolveMerchantBasic(merchantId) {
  if (!isValidMerchantId(merchantId)) {
    return { ok: false, status: 400, error: 'invalid merchantId' };
  }

  const db = getDb();
  const snap = await db.collection('merchants').doc(merchantId).get();

  if (!snap.exists) {
    return { ok: false, status: 404, error: 'merchant not found' };
  }

  const merchant = { id: snap.id, ...snap.data() };

  if (merchant.isActive === false) {
    return { ok: false, status: 403, error: 'merchant is inactive' };
  }

  return { ok: true, merchant, db };
}

/**
 * merchants/{id}/secrets/line から LINE 認証情報を取得。
 * admin SDK 経由なので Firestore Rules を通過する。
 * 旧互換: secrets ドキュメントが未作成の場合は crmConfig.line に inline されていた
 * 旧構造からフォールバックする(Phase 2C 移行期間のみの過渡措置)。
 */
async function resolveLineSecrets(merchantId, inlineLegacy) {
  const db = getDb();
  const snap = await db
    .collection('merchants')
    .doc(merchantId)
    .collection('secrets')
    .doc('line')
    .get();
  if (snap.exists) {
    const data = snap.data();
    return {
      channelSecret: data.channelSecret || inlineLegacy?.channelSecret || '',
      channelAccessToken:
        data.channelAccessToken || inlineLegacy?.channelAccessToken || '',
      anthropicApiKey: data.anthropicApiKey,
    };
  }
  return {
    channelSecret: inlineLegacy?.channelSecret || '',
    channelAccessToken: inlineLegacy?.channelAccessToken || '',
  };
}

/**
 * Webhook 用の強い解決。crmConfig.enabled まで確認し、シークレットも読み込む。
 * 戻り値: { ok: true, merchant, crmConfig, secrets, db } | { ok: false, status, error }
 */
async function resolveMerchant(merchantId) {
  const basic = await resolveMerchantBasic(merchantId);
  if (!basic.ok) return basic;

  const crmConfig = basic.merchant.crmConfig;
  if (!crmConfig || crmConfig.enabled !== true) {
    return { ok: false, status: 403, error: 'CRM disabled for this merchant' };
  }

  const secrets = await resolveLineSecrets(merchantId, crmConfig.line);

  return {
    ok: true,
    merchant: basic.merchant,
    crmConfig,
    secrets,
    db: basic.db,
  };
}

/**
 * LINE 署名検証。
 * crmConfig.line.channelSecret を使うため、resolveMerchant 後に呼ぶ。
 */
function verifyLineSignature(rawBody, signature, channelSecret) {
  if (!signature || !channelSecret) return false;
  const crypto = require('crypto');
  const hash = crypto.createHmac('SHA256', channelSecret).update(rawBody).digest('base64');
  return hash === signature;
}

module.exports = {
  getDb,
  isValidMerchantId,
  resolveMerchantId,
  resolveMerchantBasic,
  resolveLineSecrets,
  resolveMerchant,
  verifyLineSignature,
};
