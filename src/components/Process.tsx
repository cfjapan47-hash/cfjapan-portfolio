const steps = [
  {
    number: "01",
    title: "ヒアリング",
    description: "課題・要件・ゴールをお伺いします。オンラインで30分〜1時間程度。",
    duration: "Day 0",
  },
  {
    number: "02",
    title: "設計・プロトタイプ",
    description: "画面構成と技術設計を固め、動くプロトタイプを共有します。",
    duration: "Day 1-2",
  },
  {
    number: "03",
    title: "AI高速開発",
    description: "AIアシスタントを活用し、通常の3〜5倍速で実装を進めます。",
    duration: "Day 3-5",
  },
  {
    number: "04",
    title: "納品・サポート",
    description: "テスト・デプロイ後に納品。運用サポートも対応します。",
    duration: "Day 6-7",
  },
];

export default function Process() {
  return (
    <section id="process" className="py-20 sm:py-28 bg-surface">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">
            Process
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold">
            開発の流れ
          </h2>
          <p className="mt-4 text-muted max-w-2xl mx-auto">
            お問い合わせから最短1週間で納品。スピード感のある開発を実現します。
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, i) => (
            <div key={step.number} className="relative">
              {/* Connector line (desktop) */}
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-full w-full h-0.5 bg-primary/20 -translate-x-4 z-0" />
              )}
              <div className="relative bg-white rounded-2xl p-6 border border-gray-100 z-10">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl font-bold text-primary/20">
                    {step.number}
                  </span>
                  <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">
                    {step.duration}
                  </span>
                </div>
                <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                <p className="text-sm text-muted leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
