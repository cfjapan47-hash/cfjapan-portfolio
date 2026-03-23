const works = [
  {
    title: "本庄市議会ウォッチ",
    category: "自治体DX",
    description:
      "本庄市議会の一般質問768件を可視化するWebアプリ。議員別・テーマ別に検索でき、選挙前の議員比較に活用可能。",
    tech: ["Next.js", "TypeScript", "Tailwind CSS", "DiscussVision API"],
    metrics: [
      { label: "議員データ", value: "21名" },
      { label: "一般質問", value: "768件" },
      { label: "テーマ", value: "8カテゴリ" },
    ],
    url: "https://honjo-gikai-watch.vercel.app",
    gradient: "from-blue-500 to-indigo-600",
  },
  {
    title: "児童センター イベントアプリ",
    category: "LINE ミニアプリ",
    description:
      "本庄市の児童センターイベント情報をLINEで確認できるミニアプリ。口コミ・年齢レコメンド・参加管理機能付き。",
    tech: ["Next.js", "Firebase", "LINE LIFF", "Cloud Functions"],
    metrics: [
      { label: "データソース", value: "市公式API" },
      { label: "リマインド", value: "自動配信" },
      { label: "認証", value: "LINE連携" },
    ],
    url: "https://liff.line.me/2009525840-yi1Ah5Dl",
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    title: "はにぽんPay",
    category: "地域デジタル通貨",
    description:
      "本庄市の地域経済活性化を目的としたデジタル通貨システム。市民向けQR決済・加盟店管理・行政ダッシュボードを一体提供。",
    tech: ["Next.js", "Firebase", "LINE LIFF", "QRコード決済"],
    metrics: [
      { label: "ユーザー", value: "市民向け" },
      { label: "加盟店", value: "管理機能" },
      { label: "管理者", value: "統計DB" },
    ],
    url: null,
    gradient: "from-amber-500 to-orange-600",
  },
];

export default function Works() {
  return (
    <section id="works" className="py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">
            Works
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold">開発実績</h2>
          <p className="mt-4 text-muted max-w-2xl mx-auto">
            自治体向けアプリを中心に、企画から開発・運用まで一貫して手がけています。
          </p>
        </div>

        <div className="space-y-12">
          {works.map((work, i) => (
            <div
              key={work.title}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="md:flex">
                {/* Visual area */}
                <div
                  className={`md:w-2/5 bg-gradient-to-br ${work.gradient} p-8 sm:p-12 flex flex-col justify-center min-h-[240px]`}
                >
                  <span className="inline-block text-white/80 text-xs font-semibold uppercase tracking-wider mb-2">
                    {work.category}
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                    {work.title}
                  </h3>
                  <div className="flex gap-4">
                    {work.metrics.map((m) => (
                      <div key={m.label}>
                        <p className="text-lg font-bold text-white">
                          {m.value}
                        </p>
                        <p className="text-xs text-white/70">{m.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Details */}
                <div className="md:w-3/5 p-8 sm:p-12 flex flex-col justify-center">
                  <p className="text-muted leading-relaxed mb-6">
                    {work.description}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {work.tech.map((t) => (
                      <span
                        key={t}
                        className="text-xs font-medium bg-surface px-3 py-1 rounded-full text-muted"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  {work.url ? (
                    <a
                      href={work.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                    >
                      サイトを見る
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085" />
                      </svg>
                      開発中 (MVP)
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
