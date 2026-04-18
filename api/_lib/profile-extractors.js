// api/_lib/profile-extractors.js
// crmConfig.industry に応じたキーワード→プロフィール更新ロジック。
// 既存 line-webhook.js の updateCustomerProfile を業種別に分離した形。

const SALON_EXTRACTOR = {
  skinType: [
    { keywords: ['乾燥肌', 'カサカサ'], value: '乾燥肌' },
    { keywords: ['脂性肌', 'オイリー', 'テカリ'], value: '脂性肌' },
    { keywords: ['敏感肌'], value: '敏感肌' },
    { keywords: ['混合肌'], value: '混合肌' },
  ],
  skinConcerns: {
    'シミ': 'シミ', 'しみ': 'シミ',
    'シワ': 'シワ', 'しわ': 'シワ',
    'たるみ': 'たるみ',
    'ニキビ': 'ニキビ', 'にきび': 'ニキビ', 'ポツポツ': 'ニキビ・吹き出物',
    'くすみ': 'くすみ',
    '毛穴': '毛穴',
    '乾燥': '乾燥',
  },
  hasChildrenKeywords: ['子ども', '子供', '息子', '娘', '赤ちゃん'],
};

const RESTAURANT_EXTRACTOR = {
  allergies: {
    '小麦': '小麦', 'グルテン': '小麦',
    '乳': '乳製品', '牛乳': '乳製品', 'チーズが苦手': '乳製品',
    '卵': '卵',
    'そば': 'そば',
    '落花生': '落花生', 'ピーナッツ': '落花生',
    'えび': '甲殻類', 'かに': '甲殻類', '甲殻類': '甲殻類',
  },
  visitScene: {
    '家族': 'family', '子ども連れ': 'family',
    'デート': 'date', '記念日': 'date',
    '接待': 'business', '会食': 'business',
    '一人': 'solo', 'ひとり': 'solo',
  },
};

const CLINIC_EXTRACTOR = {
  medicalHistory: {
    '高血圧': '高血圧',
    '糖尿病': '糖尿病',
    'アレルギー': 'アレルギー',
    '喘息': '喘息',
  },
};

function extractSalon(profile, message) {
  let updated = false;
  const p = { ...profile };

  for (const { keywords, value } of SALON_EXTRACTOR.skinType) {
    if (keywords.some(k => message.includes(k))) {
      p.skinType = value;
      updated = true;
      break;
    }
  }

  const concerns = p.skinConcerns ? [...p.skinConcerns] : [];
  for (const [keyword, concern] of Object.entries(SALON_EXTRACTOR.skinConcerns)) {
    if (message.includes(keyword) && !concerns.includes(concern)) {
      concerns.push(concern);
      updated = true;
    }
  }
  if (concerns.length > 0) p.skinConcerns = concerns;

  if (SALON_EXTRACTOR.hasChildrenKeywords.some(k => message.includes(k))) {
    if (p.hasChildren !== true) {
      p.hasChildren = true;
      updated = true;
    }
  }

  return { profile: p, updated };
}

function extractRestaurant(profile, message) {
  let updated = false;
  const p = { ...profile };

  const allergies = p.allergies ? [...p.allergies] : [];
  for (const [keyword, value] of Object.entries(RESTAURANT_EXTRACTOR.allergies)) {
    if (message.includes(keyword) && !allergies.includes(value)) {
      allergies.push(value);
      updated = true;
    }
  }
  if (allergies.length > 0) p.allergies = allergies;

  const scenes = p.visitScene ? [...p.visitScene] : [];
  for (const [keyword, value] of Object.entries(RESTAURANT_EXTRACTOR.visitScene)) {
    if (message.includes(keyword) && !scenes.includes(value)) {
      scenes.push(value);
      updated = true;
    }
  }
  if (scenes.length > 0) p.visitScene = scenes;

  return { profile: p, updated };
}

function extractClinic(profile, message) {
  let updated = false;
  const p = { ...profile };

  const history = p.medicalHistory ? [...p.medicalHistory] : [];
  for (const [keyword, value] of Object.entries(CLINIC_EXTRACTOR.medicalHistory)) {
    if (message.includes(keyword) && !history.includes(value)) {
      history.push(value);
      updated = true;
    }
  }
  if (history.length > 0) p.medicalHistory = history;

  return { profile: p, updated };
}

function extractGeneric() {
  return { profile: {}, updated: false };
}

const EXTRACTORS = {
  salon: extractSalon,
  restaurant: extractRestaurant,
  clinic: extractClinic,
  retail: extractGeneric,
  generic: extractGeneric,
};

function getExtractor(industry) {
  return EXTRACTORS[industry] || extractGeneric;
}

module.exports = { getExtractor };
