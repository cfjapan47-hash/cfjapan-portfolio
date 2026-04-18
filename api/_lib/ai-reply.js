// api/_lib/ai-reply.js
// Claude で返信案を生成。crmConfig.aiPromptOverride / industry / shopInfo を注入する。

const DEFAULT_PROMPTS = {
  salon:
    'あなたは{{shopName}}の受付AIアシスタントです。オーナーに代わってお客様への返信案を作成します。\n' +
    '【最重要ルール】\n' +
    '1. 過去の会話履歴を確認し、すでに話した内容を繰り返さないでください。\n' +
    '2. お客様の情報が不明な場合、その話題に触れないでください。\n' +
    '3. 過去にオーナーが修正して送信した返信があれば、その言い回し・トーンを学んで次回以降に反映してください。\n' +
    '4. この返信案はオーナーが確認・修正してからお客様に送信されます。\n',
  restaurant:
    'あなたは{{shopName}}の受付AIアシスタントです。オーナーに代わってお客様への返信案を作成します。\n' +
    '【最重要ルール】\n' +
    '1. 予約可否はオーナーが判断するため、在庫や空き状況を断定しないでください。\n' +
    '2. アレルギー情報が判明している場合は配慮した表現にしてください。\n' +
    '3. オーナーが修正して送信した過去返信のトーンを学習してください。\n',
  clinic:
    'あなたは{{shopName}}の受付AIアシスタントです。\n' +
    '【最重要ルール】\n' +
    '1. 医療的な判断や診断行為は一切しないでください。\n' +
    '2. 予約受付と一般的な案内のみに留めてください。\n' +
    '3. 緊急性がありそうな場合は「直接お電話ください」と案内してください。\n',
  retail:
    'あなたは{{shopName}}の受付AIアシスタントです。在庫・取り置き・入荷予定の問い合わせに対する返信案を作成します。\n' +
    '在庫確定はオーナーが判断するため断定表現は避けてください。\n',
  generic:
    'あなたは{{shopName}}の受付AIアシスタントです。お客様への返信案を親しみやすく丁寧に作成してください。\n',
};

function renderPrompt(template, vars) {
  return Object.entries(vars).reduce(
    (acc, [key, val]) => acc.split(`{{${key}}}`).join(String(val ?? '')),
    template,
  );
}

function buildHistoryText(history) {
  if (!history || history.length === 0) return '';
  let out = '\n\n【過去の会話履歴(古い順)】\n';
  for (const h of history) {
    out += `お客様: ${h.customerMessage}\n`;
    if (h.sentReply && h.sentReply !== h.aiReply) {
      out += `AI案: ${h.aiReply}\n`;
      out += `オーナーが修正して送信: ${h.sentReply}（★このスタイルを学んでください）\n`;
    } else if (h.sentReply || (h.status === 'sent' && h.aiReply)) {
      out += `サロン(送信済み): ${h.sentReply || h.aiReply}\n`;
    } else {
      out += '(未返信)\n';
    }
    out += '---\n';
  }
  return out;
}

function buildProfileText(profile, industry) {
  if (!profile || Object.keys(profile).length === 0) return '';
  const lines = ['\n\n【このお客様について判明していること】'];

  if (industry === 'salon') {
    if (profile.skinType) lines.push(`肌タイプ: ${profile.skinType}`);
    if (profile.skinConcerns?.length) lines.push(`肌の悩み: ${profile.skinConcerns.join('、')}`);
    if (profile.hasChildren === true) lines.push('お子様: あり');
  } else if (industry === 'restaurant') {
    if (profile.allergies?.length) lines.push(`アレルギー: ${profile.allergies.join('、')}`);
    if (profile.favoriteMenu?.length) lines.push(`好きなメニュー: ${profile.favoriteMenu.join('、')}`);
    if (profile.visitScene?.length) lines.push(`利用シーン: ${profile.visitScene.join('、')}`);
  } else if (industry === 'clinic') {
    if (profile.medicalHistory?.length) lines.push(`既往歴: ${profile.medicalHistory.join('、')}`);
    if (profile.currentMedications?.length) lines.push(`服用中: ${profile.currentMedications.join('、')}`);
  }

  if (profile.preferredTime) lines.push(`希望時間帯: ${profile.preferredTime}`);
  if (profile.visitCount) lines.push(`来店回数: ${profile.visitCount}回`);
  if (profile.notes) lines.push(`メモ: ${profile.notes}`);

  return lines.length > 1 ? lines.join('\n') : '';
}

function buildToneText(tone) {
  if (!tone) return '';
  const politeness = { casual: 'カジュアル', polite: '親しみやすく丁寧', formal: '丁寧で格式のある' }[tone.politeness] || '丁寧';
  return (
    '\n【返信のトーン】\n' +
    `- ${politeness}な言い回し\n` +
    `- 絵文字: ${tone.useEmoji ? '1〜2個まで可' : '使わない'}\n` +
    `- 長さ: ${tone.maxLines ?? 5}行程度まで\n`
  );
}

/**
 * Claude API を呼び出して返信案を生成。
 * crmConfig が持たない値は引数で渡されたフォールバックを使う。
 */
async function generateAiReply({
  crmConfig,
  customerMessage,
  customerDisplayName,
  customerProfile,
  conversationHistory,
  shopName,
  shopAddress,
  anthropicApiKey,
}) {
  const industry = crmConfig.industry || 'generic';
  const baseTemplate = crmConfig.aiPromptOverride || DEFAULT_PROMPTS[industry] || DEFAULT_PROMPTS.generic;

  const shopInfo = crmConfig.shopInfo || {};
  const vars = {
    shopName: shopInfo.displayName || shopName || '店舗',
    address: shopInfo.address || shopAddress || '',
    hours: shopInfo.businessHours || '',
    customerName: customerDisplayName || '不明',
    notes: shopInfo.notes || '',
  };

  const header = renderPrompt(baseTemplate, vars);
  const profileText = buildProfileText(customerProfile, industry);
  const historyText = buildHistoryText(conversationHistory);
  const toneText = buildToneText(crmConfig.tone);

  const body =
    header +
    '\n【店舗情報】\n' +
    `- 店舗名: ${vars.shopName}\n` +
    (vars.address ? `- 住所: ${vars.address}\n` : '') +
    (vars.hours ? `- 営業: ${vars.hours}\n` : '') +
    (vars.notes ? `- 補足: ${vars.notes}\n` : '') +
    `- お客様の名前: ${vars.customerName}\n` +
    toneText +
    profileText +
    historyText +
    '\n【今回のお客様のメッセージ】\n' +
    customerMessage +
    '\n\n上記を踏まえ、自然で適切な返信案を作成してください。';

  const model = crmConfig.aiModel || 'claude-sonnet-4-6';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      messages: [{ role: 'user', content: body }],
    }),
  });

  if (!res.ok) {
    console.error('Claude API error:', await res.text());
    return 'ご連絡ありがとうございます。確認してご連絡いたしますね。';
  }

  const data = await res.json();
  return data.content?.[0]?.text || 'ご連絡ありがとうございます。';
}

module.exports = { generateAiReply };
