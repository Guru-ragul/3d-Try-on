import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-slate-950/80 backdrop-blur-md border-b border-slate-800 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-white">AI Fit Try-On</div>
            <div className="flex gap-4">
              <Link
                href="/try-on"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold"
              >
                Launch App
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-20 pb-20 px-6">
        <div className="max-w-6xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight">
              See How It Fits
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                Before You Buy
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto">
              Upload your photo and any garment. Our AI generates a realistic try-on and tells you exactly how it will fit your body.
            </p>
          </div>

          {/* CTA */}
          <div className="flex gap-4 justify-center pt-8">
            <Link
              href="/try-on"
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg font-semibold text-lg transition-all transform hover:scale-105 shadow-lg"
            >
              Try It On — Free
            </Link>
            <Link
              href="#how-it-works"
              className="px-8 py-4 border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white rounded-lg font-semibold text-lg transition-colors"
            >
              How It Works
            </Link>
          </div>

          {/* How it works */}
          <div id="how-it-works" className="pt-20">
            <h2 className="text-3xl font-bold text-white mb-3">How It Works</h2>
            <p className="text-slate-400 mb-10">Three steps to your perfect fit</p>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { step: '01', title: 'Upload Your Photo', description: 'A clear front-facing photo. No special equipment needed — your smartphone works perfectly.', icon: '🧍' },
                { step: '02', title: 'Pick a Garment', description: 'Upload any product image from any brand. Add your measurements for a precise fit score.', icon: '👕' },
                { step: '03', title: 'See the Result', description: 'AI generates a realistic try-on image and gives you a detailed fit breakdown with size recommendations.', icon: '✨' },
              ].map((step) => (
                <div key={step.step} className="bg-slate-900/50 border border-slate-800 rounded-lg p-8 backdrop-blur-sm hover:border-slate-700 transition-colors text-left">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">{step.icon}</span>
                    <span className="text-xs font-bold text-blue-400 tracking-widest">{step.step}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-slate-400">{step.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Features */}
          <div id="features" className="pt-20">
            <h2 className="text-3xl font-bold text-white mb-10">Built for Brands & Shoppers</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { title: 'AI Try-On Generation', description: 'State-of-the-art IDM-VTON diffusion model generates photorealistic try-on images from any garment.', icon: '🤖' },
                { title: 'Intelligent Fit Scoring', description: 'Chest, waist & hips measured against industry size charts. Weighted fit score up to 100 with per-area breakdown.', icon: '📐' },
                { title: 'Size Recommendation', description: 'Automatically finds the best-fitting size from your measurements — reducing returns and wrong-size orders.', icon: '🎯' },
              ].map((feature) => (
                <div key={feature.title} className="bg-slate-900/50 border border-slate-800 rounded-lg p-8 backdrop-blur-sm hover:border-slate-700 transition-colors">
                  <div className="text-4xl mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-slate-400">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tech Stack */}
          <div className="pt-20">
            <h2 className="text-3xl font-bold text-white mb-10">Powered By</h2>
            <div className="grid md:grid-cols-4 gap-4 max-w-3xl mx-auto">
              {['Next.js 16', 'React 19', 'IDM-VTON AI', 'Replicate API'].map((tech) => (
                <div key={tech} className="bg-slate-800/50 border border-slate-700 rounded-lg py-4 px-6 text-slate-300 font-semibold">
                  {tech}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-950/50 border-t border-slate-800 mt-20">
        <div className="max-w-7xl mx-auto px-6 py-8 text-center text-slate-500">
          <p>© 2026 AI Fit Try-On Platform. Built for fashion brands and smart shoppers.</p>
        </div>
      </footer>
    </div>
  );
}
