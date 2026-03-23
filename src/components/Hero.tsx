export default function Hero() {
  return (
    <section className="relative pt-28 pb-20 sm:pt-36 sm:pb-28 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-cyan-50 -z-10" />
      <div className="absolute top-20 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-accent/5 rounded-full blur-3xl -z-10" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="max-w-3xl">
          <p className="inline-block text-sm font-semibold text-primary bg-primary/10 px-4 py-1.5 rounded-full mb-6">
            AI × 高速開発
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-6">
            AIの力で、
            <br />
            <span className="text-primary">1週間</span>で
            <span className="text-primary">アプリ</span>を届ける。
          </h1>
          <p className="text-lg sm:text-xl text-muted leading-relaxed mb-10 max-w-2xl">
            合同会社CFJapanは、AIを活用した高速Web開発・LINEミニアプリ構築で、
            自治体・中小企業のDXを支援します。
            構想から納品まで、圧倒的なスピードで実現します。
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="#contact"
              className="inline-flex items-center justify-center bg-primary text-white font-semibold px-8 py-4 rounded-full text-base hover:bg-primary-dark transition-colors shadow-lg shadow-primary/25"
            >
              無料相談する
            </a>
            <a
              href="#works"
              className="inline-flex items-center justify-center border-2 border-gray-200 text-foreground font-semibold px-8 py-4 rounded-full text-base hover:border-primary hover:text-primary transition-colors"
            >
              実績を見る
            </a>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-3 gap-6 max-w-lg">
          {[
            { value: "3+", label: "リリース済みアプリ" },
            { value: "1週間", label: "最短納品期間" },
            { value: "LINE", label: "ミニアプリ対応" },
          ].map((stat) => (
            <div key={stat.label} className="text-center sm:text-left">
              <p className="text-2xl sm:text-3xl font-bold text-primary">
                {stat.value}
              </p>
              <p className="text-xs sm:text-sm text-muted mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
