import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-slate-950/80 backdrop-blur-md border-b border-slate-800 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-white">3D Fit Try-On</div>
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
              Experience 3D
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                Fit Try-Ons
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto">
              Upload and preview 3D clothing models in real-time. Perfect for retailers and designers.
            </p>
          </div>

          {/* CTA Button */}
          <div className="flex gap-4 justify-center pt-8">
            <Link
              href="/try-on"
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg font-semibold text-lg transition-all transform hover:scale-105 shadow-lg"
            >
              Start Try-On Experience
            </Link>
            <Link
              href="#features"
              className="px-8 py-4 border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white rounded-lg font-semibold text-lg transition-colors"
            >
              Learn More
            </Link>
          </div>

          {/* Features */}
          <div id="features" className="grid md:grid-cols-3 gap-8 pt-20">
            {[
              {
                title: 'Multiple Formats',
                description: 'Support for GLB, GLTF, OBJ, and FBX 3D models',
                icon: '📦',
              },
              {
                title: 'Real-Time Preview',
                description: 'Instant 3D visualization with interactive controls',
                icon: '🎯',
              },
              {
                title: 'Production Ready',
                description: 'Built with Next.js 15, TypeScript, and Vercel deployment',
                icon: '⚡',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="bg-slate-900/50 border border-slate-800 rounded-lg p-8 backdrop-blur-sm hover:border-slate-700 transition-colors"
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* Tech Stack */}
          <div className="pt-20">
            <h2 className="text-3xl font-bold text-white mb-10">Built With</h2>
            <div className="grid md:grid-cols-4 gap-4 max-w-3xl mx-auto">
              {['Next.js 15', 'React 19', 'TypeScript', 'Three.js'].map((tech) => (
                <div
                  key={tech}
                  className="bg-slate-800/50 border border-slate-700 rounded-lg py-4 px-6 text-slate-300 font-semibold"
                >
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
          <p>© 2024 3D Fit Try-On Platform. Built for production.</p>
        </div>
      </footer>
    </div>
  );
}
