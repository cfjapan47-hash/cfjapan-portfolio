#!/usr/bin/env node
// scripts/migrate-salon-to-merchant.js
//
// salons/{SALON_ID}/{customers,messages,reservations}
//   → merchants/{MERCHANT_ID}/{customers,messages,reservations}
// へデータをコピーし、加盟店ドキュメント本体(crmConfig 含む)を作成する。
//
// 設計方針:
//   - ソースを削除しない(ロールバック可能性を残す)
//   - 既存データがあれば上書きしない(--force で強制上書き)
//   - --dry-run でカウントのみ出力
//   - バッチ書き込み(500 件/バッチ)
//
// 使い方:
//   node scripts/migrate-salon-to-merchant.js --dry-run
//   node scripts/migrate-salon-to-merchant.js
//   node scripts/migrate-salon-to-merchant.js --force
//   node scripts/migrate-salon-to-merchant.js --salon-id menard-wakuizumi --merchant-id menard-wakuizumi --tenant-id menard
//
// 必須環境変数:
//   FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
//   LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN  (crmConfig 作成用)
//   LINE_CHANNEL_ID (任意、分からなければ空)

const admin = require('firebase-admin');

// ---- 引数パース ----
const args = process.argv.slice(2);
function getFlag(name) {
  return args.includes(`--${name}`);
}
function getOpt(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
}

const DRY_RUN = getFlag('dry-run');
const FORCE = getFlag('force');
const SALON_ID = getOpt('salon-id', process.env.SALON_ID || 'menard-wakuizumi');
const MERCHANT_ID = getOpt('merchant-id', SALON_ID);
const TENANT_ID = getOpt('tenant-id', 'menard');

// ---- Firebase 初期化 ----
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ---- ログ ----
const log = (...a) => console.log('[migrate]', ...a);
const warn = (...a) => console.warn('[migrate][warn]', ...a);
const err = (...a) => console.error('[migrate][error]', ...a);

// ---- メイン処理 ----
async function main() {
  log('---- Migration start ----');
  log(`SALON_ID    : ${SALON_ID}`);
  log(`MERCHANT_ID : ${MERCHANT_ID}`);
  log(`TENANT_ID   : ${TENANT_ID}`);
  log(`DRY_RUN     : ${DRY_RUN}`);
  log(`FORCE       : ${FORCE}`);
  log('-------------------------');

  const sourceRef = db.collection('salons').doc(SALON_ID);
  const targetRef = db.collection('merchants').doc(MERCHANT_ID);

  // 1. Merchant ドキュメント本体
  await migrateMerchantDoc(sourceRef, targetRef);

  // 2. 各サブコレクション
  const collections = ['customers', 'messages', 'reservations'];
  for (const name of collections) {
    await migrateSubcollection(sourceRef, targetRef, name);
  }

  log('---- Migration done ----');
}

// ---- Merchant ドキュメント作成 ----
async function migrateMerchantDoc(sourceRef, targetRef) {
  const existing = await targetRef.get();
  if (existing.exists && !FORCE) {
    warn(`merchants/${MERCHANT_ID} は既に存在します。スキップ(上書きするには --force)`);
    return;
  }

  // 既存 salons ドキュメントに最低限のメタがあれば拾う
  const salonDoc = await sourceRef.get();
  const salonMeta = salonDoc.exists ? salonDoc.data() : {};

  const merchant = {
    id: MERCHANT_ID,
    tenantId: TENANT_ID,
    name: salonMeta.name || 'メナードフェイシャルサロン若泉１丁目',
    category: salonMeta.category || 'フェイシャルエステ',
    address: salonMeta.address || '本庄市若泉１丁目３番３２号',
    phone: salonMeta.phone || '',
    email: salonMeta.email || '',
    ownerName: salonMeta.ownerName || '白石',
    ownerLineUserId: salonMeta.ownerLineUserId || '',
    entityType: salonMeta.entityType || 'individual',
    feeRate: typeof salonMeta.feeRate === 'number' ? salonMeta.feeRate : 0.02,
    balance: typeof salonMeta.balance === 'number' ? salonMeta.balance : 0,
    settlement: salonMeta.settlement || {
      bank: '',
      branch: '',
      accountType: 'ordinary',
      accountNumber: '',
      accountHolder: '',
    },
    crmConfig: {
      enabled: true,
      industry: 'salon',
      features: {
        aiReply: true,
        profileExtraction: true,
        reservation: true,
        beacon: false,
        segmentBroadcast: false,
      },
      line: {
        // シークレットは merchants/{id}/secrets/line に分離(Phase 2C)
        channelId: process.env.LINE_CHANNEL_ID || '',
      },
      tone: {
        politeness: 'polite',
        useEmoji: true,
        maxLines: 5,
      },
      shopInfo: {
        displayName: 'メナードフェイシャルサロン若泉１丁目',
        address: '本庄市若泉１丁目３番３２号',
        businessHours: '10:00〜17:00、完全予約制、不定休',
        notes: 'メナードの化粧品・フェイシャルエステを提供',
      },
    },
    isActive: true,
    createdAt: salonMeta.createdAt || FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const channelSecret = process.env.LINE_CHANNEL_SECRET || '';
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
  if (!channelSecret || !channelAccessToken) {
    warn('LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN が env に未設定です。');
    warn('CRM は作成されますが Webhook と返信送信は動作しません。後で secrets を更新してください。');
  }

  if (DRY_RUN) {
    log(`[dry-run] would write merchants/${MERCHANT_ID}`);
    log(`[dry-run] would write merchants/${MERCHANT_ID}/secrets/line`);
    return;
  }

  await targetRef.set(merchant, { merge: FORCE ? false : true });
  log(`✅ merchants/${MERCHANT_ID} を作成しました`);

  // シークレットは別ドキュメントに書き込む(Phase 2C: Rules で client 読み書き禁止)
  if (channelSecret || channelAccessToken) {
    await targetRef.collection('secrets').doc('line').set(
      {
        channelSecret,
        channelAccessToken,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    log(`✅ merchants/${MERCHANT_ID}/secrets/line を作成しました`);
  }
}

// ---- サブコレクションコピー ----
async function migrateSubcollection(sourceRef, targetRef, name) {
  const srcSnap = await sourceRef.collection(name).get();
  log(`--- ${name}: ${srcSnap.size} 件 ---`);

  if (srcSnap.empty) {
    log(`  (ソース空なのでスキップ)`);
    return;
  }

  // 既存件数チェック(force でなければ既に存在するコレクションは触らない)
  if (!FORCE) {
    const dstCountSnap = await targetRef.collection(name).limit(1).get();
    if (!dstCountSnap.empty) {
      warn(`  merchants/${MERCHANT_ID}/${name} に既にデータあり。スキップ(--force で上書き)`);
      return;
    }
  }

  let batch = db.batch();
  let batchCount = 0;
  let totalWritten = 0;

  for (const doc of srcSnap.docs) {
    const data = doc.data();
    const augmented = augmentForTarget(name, data);
    const destDocRef = targetRef.collection(name).doc(doc.id);

    if (!DRY_RUN) {
      batch.set(destDocRef, augmented, { merge: false });
      batchCount++;
      if (batchCount >= 450) {
        await batch.commit();
        totalWritten += batchCount;
        log(`  committed ${totalWritten}/${srcSnap.size}`);
        batch = db.batch();
        batchCount = 0;
      }
    } else {
      totalWritten++;
    }
  }

  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
    totalWritten += batchCount;
  }

  log(`  ${DRY_RUN ? '[dry-run] would copy' : 'copied'} ${totalWritten} docs to merchants/${MERCHANT_ID}/${name}`);
}

// ---- フィールド追加(新スキーマ整合) ----
function augmentForTarget(collectionName, data) {
  const base = { ...data, merchantId: MERCHANT_ID, tenantId: TENANT_ID };

  if (collectionName === 'customers') {
    return {
      ...base,
      lineUserId: data.lineUserId || undefined, // ドキュメント ID と同じなので任意
      tags: data.tags || [],
      memos: data.memos || [],
      visitCount: data.visitCount || 0,
      messageCount: data.messageCount || 0,
      profile: data.profile || {},
    };
  }

  if (collectionName === 'messages') {
    // editedReply → sentReply へ寄せる(send-reply.js の旧実装との互換)
    const sentReply = data.sentReply ?? data.editedReply;
    return {
      ...base,
      sentReply,
      status: data.status || (sentReply ? 'sent' : 'pending'),
    };
  }

  if (collectionName === 'reservations') {
    return {
      ...base,
      status: data.status || 'confirmed',
      updatedAt: data.updatedAt || data.createdAt || FieldValue.serverTimestamp(),
    };
  }

  return base;
}

// ---- 実行 ----
main().catch((e) => {
  err(e);
  process.exit(1);
});
