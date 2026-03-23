export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-xl font-bold text-white mb-1">
              <span className="text-primary">CF</span>Japan
            </p>
            <p className="text-sm">合同会社CFJapan</p>
          </div>
          <nav className="flex gap-6 text-sm">
            <a href="#services" className="hover:text-white transition-colors">
              サービス
            </a>
            <a href="#works" className="hover:text-white transition-colors">
              実績
            </a>
            <a href="#process" className="hover:text-white transition-colors">
              開発の流れ
            </a>
            <a href="#contact" className="hover:text-white transition-colors">
              お問い合わせ
            </a>
          </nav>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-800 text-center text-xs">
          &copy; {new Date().getFullYear()} 合同会社CFJapan. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
