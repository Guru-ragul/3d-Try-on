'use client';

import { useState, useCallback, useRef } from 'react';
import type { FitResult } from '@/lib/fit';

type TryOnState =
  | { status: 'idle' }
  | { status: 'loading'; message: string }
  | { status: 'done'; imageUrl: string; fit: FitResult | null }
  | { status: 'error'; message: string };

type ProductState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; imageUrl: string; title: string }
  | { status: 'error'; message: string };

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const STATUS_COLOR: Record<string, string> = {
  perfect:     'text-green-400',
  great:       'text-emerald-400',
  loose:       'text-yellow-400',
  tight:       'text-orange-400',
  'too-loose': 'text-red-300',
  'too-tight': 'text-red-400',
};
const STATUS_LABEL: Record<string, string> = {
  perfect:     'Perfect',
  great:       'Great',
  loose:       'Slightly Loose',
  tight:       'Slightly Tight',
  'too-loose': 'Too Loose',
  'too-tight': 'Too Tight',
};

function PhotoUpload({ preview, onImage, onClear }: { preview: string | null; onImage: (url: string) => void; onClear: () => void }) {
  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await fileToDataURL(file);
    onImage(url);
    e.target.value = '';
  }, [onImage]);

  return (
    <div className="space-y-2">
      <label className={`relative flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed overflow-hidden cursor-pointer transition-colors ${preview ? 'border-blue-500/60' : 'border-slate-700 hover:border-blue-500/60'}`} style={{ aspectRatio: '3/4' }}>
        {preview ? (
          <img src={preview} alt="Your photo" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-3xl">🧍</div>
            <div>
              <p className="text-sm font-semibold text-slate-300">Click to upload your photo</p>
              <p className="text-xs text-slate-500 mt-1">Stand straight, facing forward, full body visible</p>
            </div>
          </div>
        )}
        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleChange} />
      </label>
      {preview && <button onClick={onClear} className="text-xs text-slate-500 hover:text-red-400 transition-colors">Remove photo</button>}
      {!preview && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-300 space-y-1">
          <p className="font-semibold">For best results:</p>
          <ul className="space-y-0.5 text-amber-400/80">
            <li>• Stand straight, arms slightly away from body</li>
            <li>• Full body visible, front-facing</li>
            <li>• Plain background, good lighting</li>
            <li>• Wear fitted clothes (not oversized)</li>
          </ul>
        </div>
      )}
    </div>
  );
}

function ProductFetcher({ productState, onFetch, onClear, onDirectImage }: { productState: ProductState; onFetch: (url: string) => void; onClear: () => void; onDirectImage: (url: string) => void }) {
  const [url, setUrl] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleUrlChange = (val: string) => {
    setUrl(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.startsWith('http')) debounceRef.current = setTimeout(() => onFetch(val), 900);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Paste Amazon / Myntra / Flipkart / AJIO product URL</label>
        <div className="flex gap-2">
          <input type="url" value={url} onChange={e => handleUrlChange(e.target.value)} placeholder="https://www.amazon.in/dp/..." className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
          <button onClick={() => url && onFetch(url)} disabled={!url || productState.status === 'loading'} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-sm font-semibold transition-colors">{productState.status === 'loading' ? <Spinner /> : 'Fetch'}</button>
        </div>
      </div>

      {productState.status === 'done' && (
        <div className="flex items-start gap-3 p-3 bg-slate-800 rounded-xl border border-slate-700">
          <img src={productState.imageUrl} alt={productState.title} className="w-20 h-24 object-cover rounded-lg shrink-0 border border-slate-600" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-medium line-clamp-2">{productState.title}</p>
            <p className="text-xs text-emerald-400 mt-1">&#x2713; Product image fetched</p>
            <button onClick={onClear} className="text-xs text-slate-500 hover:text-red-400 transition-colors mt-2">Clear</button>
          </div>
        </div>
      )}

      {productState.status === 'error' && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-300 space-y-2">
          <p>{productState.message}</p>
          <p className="text-red-400/60">Tip: Right-click the product image on the website &rarr; &ldquo;Copy image address&rdquo; and paste it below.</p>
          <div className="flex gap-2 mt-1">
            <input type="url" placeholder="Paste direct image URL&hellip;" className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" id="direct-img-input" />
            <button onClick={() => { const v = (document.getElementById('direct-img-input') as HTMLInputElement)?.value; if(v) onDirectImage(v); }} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-semibold transition-colors">Use</button>
          </div>
        </div>
      )}

      {productState.status === 'idle' && <p className="text-xs text-slate-600 text-center">Supports Amazon, Myntra, Flipkart, AJIO, Zara, H&amp;M and more</p>}
    </div>
  );
}

export default function TryOnPage() {
  const [userImage,    setUserImage]    = useState<string | null>(null);
  const [garmentDesc,  setGarmentDesc]  = useState('');
  const [productSize,  setProductSize]  = useState('M');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [chest,  setChest]  = useState('');
  const [waist,  setWaist]  = useState('');
  const [hips,   setHips]   = useState('');
  const [productState, setProductState] = useState<ProductState>({ status: 'idle' });
  const [tryOnState,   setTryOnState]   = useState<TryOnState>({ status: 'idle' });

  const garmentImageUrl = productState.status === 'done' ? productState.imageUrl : null;
  const canGenerate = Boolean(userImage && garmentImageUrl);

  const fetchProduct = async (url: string) => {
    setProductState({ status: 'loading' });
    try {
      const res = await fetch('/api/product', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const data = await res.json() as { imageUrl?: string; title?: string; error?: string };
      if (!res.ok || !data.imageUrl) {
        setProductState({ status: 'error', message: data.error ?? 'Could not fetch product image.' });
      } else {
        setProductState({ status: 'done', imageUrl: data.imageUrl, title: data.title ?? 'Product' });
        if (!garmentDesc && data.title) setGarmentDesc(data.title.slice(0, 120));
      }
    } catch (err) { setProductState({ status: 'error', message: (err as Error).message }); }
  };

  const handleDirectImage = (url: string) => {
    setProductState({ status: 'done', imageUrl: url, title: 'Product (direct image)' });
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setTryOnState({ status: 'loading', message: 'Starting AI generation…' });
    try {
      const startRes = await fetch('/api/tryon', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userImage, garmentImage: garmentImageUrl, garmentDescription: garmentDesc, measurements: { size: productSize, chest, waist, hips, height, weight } }) });
      const startData = await startRes.json() as { id?: string; fit?: FitResult; error?: string };
      if (!startRes.ok || !startData.id) { setTryOnState({ status: 'error', message: startData.error ?? 'Failed to start.' }); return; }
      const { id, fit } = startData;
      setTryOnState({ status: 'loading', message: 'AI is generating your try-on… (~30s)' });
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const pollRes  = await fetch(`/api/tryon?id=${encodeURIComponent(id)}`);
        const pollData = await pollRes.json() as { status: string; output?: string | string[]; error?: string };
        if (pollData.status === 'succeeded') {
          const imageUrl = Array.isArray(pollData.output) ? pollData.output[0] : pollData.output;
          if (!imageUrl) { setTryOnState({ status: 'error', message: 'AI returned empty result.' }); return; }
          setTryOnState({ status: 'done', imageUrl, fit: fit ?? null });
          return;
        }
        if (pollData.status === 'failed' || pollData.status === 'canceled') { setTryOnState({ status: 'error', message: pollData.error ?? 'Generation failed.' }); return; }
      }
      setTryOnState({ status: 'error', message: 'Timed out. Please try again.' });
    } catch (err) { setTryOnState({ status: 'error', message: (err as Error).message }); }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="bg-slate-900/80 backdrop-blur border-b border-slate-800 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">AI Fit Try-On</h1>
            <p className="text-sm text-slate-400 mt-0.5">Upload your photo · paste a product link · see how it fits</p>
          </div>
          <a href="/" className="text-sm text-slate-500 hover:text-white transition-colors">&#8592; Home</a>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-5">
            <section className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
              <h2 className="font-semibold mb-4 flex items-center gap-2"><StepBadge n={1} /> Your Photo</h2>
              <PhotoUpload preview={userImage} onImage={setUserImage} onClear={() => setUserImage(null)} />
            </section>
            <section className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
              <h2 className="font-semibold mb-1 flex items-center gap-2"><StepBadge n={2} /> Your Measurements <span className="text-xs font-normal text-slate-500">(for fit score)</span></h2>
              <p className="text-xs text-slate-500 mb-4">Optional but recommended.</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Height (cm)"    value={height} onChange={setHeight} placeholder="e.g. 170" />
                <Field label="Weight (kg)"    value={weight} onChange={setWeight} placeholder="e.g. 65"  />
                <Field label="Chest (inches)" value={chest}  onChange={setChest}  placeholder="e.g. 36"  />
                <Field label="Waist (inches)" value={waist}  onChange={setWaist}  placeholder="e.g. 30"  />
                <div className="col-span-2"><Field label="Hips (inches)" value={hips} onChange={setHips} placeholder="e.g. 38" /></div>
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <section className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
              <h2 className="font-semibold mb-4 flex items-center gap-2"><StepBadge n={3} color="cyan" /> Product / Garment</h2>
              <ProductFetcher productState={productState} onFetch={fetchProduct} onClear={() => { setProductState({ status: 'idle' }); setGarmentDesc(''); }} onDirectImage={handleDirectImage} />
              <div className="mt-5 space-y-3">
                <Field label="Garment description (optional)" value={garmentDesc} onChange={setGarmentDesc} placeholder="e.g. navy slim-fit cotton shirt" />
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Size on product label</label>
                  <select value={productSize} onChange={e => setProductSize(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                    {['XS','S','M','L','XL','XXL','2XL'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </section>

            <button onClick={handleGenerate} disabled={!canGenerate || tryOnState.status === 'loading'} className="w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-lg disabled:cursor-not-allowed bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500">
              {tryOnState.status === 'loading' ? <span className="flex items-center justify-center gap-3"><Spinner />{tryOnState.message}</span> : '✨ Generate AI Try-On'}
            </button>

            {!canGenerate && tryOnState.status === 'idle' && <p className="text-xs text-slate-500 text-center">{!userImage ? 'Upload your photo' : 'Fetch a product'} to continue</p>}

            {tryOnState.status === 'error' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-sm text-red-300">
                <p className="font-semibold mb-1">Error</p>
                <p>{tryOnState.message}</p>
              </div>
            )}
          </div>
        </div>

        {tryOnState.status === 'done' && (
          <div className="grid lg:grid-cols-2 gap-6">
            <section className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 pt-4 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />AI Try-On Result
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={tryOnState.imageUrl} alt="AI try-on result" className="w-full object-contain" />
              <div className="p-4">
                <a href={tryOnState.imageUrl} download="tryon-result.png" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 underline">Download image</a>
              </div>
            </section>
            <FitPanel fit={tryOnState.fit} productSize={productSize} />
          </div>
        )}
      </div>
    </main>
  );
}

function FitPanel({ fit, productSize }: { fit: FitResult | null; productSize: string }) {
  if (!fit || fit.breakdown.length === 0) {
    return (
      <section className="bg-slate-900 rounded-2xl border border-slate-800 p-5 flex items-center justify-center min-h-48">
        <p className="text-slate-500 text-sm text-center">Add your measurements to see a detailed fit analysis.</p>
      </section>
    );
  }
  return (
    <section className="bg-slate-900 rounded-2xl border border-slate-800 p-5 flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-2xl font-bold">{fit.label}</div>
          <div className="text-sm text-slate-400 mt-1 max-w-xs">{fit.recommendation}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-4xl font-black leading-none">{fit.score}<span className="text-xl font-normal text-slate-400">/100</span></div>
          {fit.suggestedSize !== productSize && <div className="text-xs text-yellow-400 mt-1">Best size: <strong>{fit.suggestedSize}</strong></div>}
        </div>
      </div>
      <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${fit.score >= 85 ? 'bg-gradient-to-r from-emerald-500 to-green-400' : fit.score >= 70 ? 'bg-gradient-to-r from-yellow-500 to-amber-400' : 'bg-gradient-to-r from-red-500 to-orange-500'}`} style={{ width: `${fit.score}%` }} />
      </div>
      <div className="space-y-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Breakdown</p>
        {fit.breakdown.map(area => (
          <div key={area.area} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-slate-300">{area.area}</span>
              <span className={STATUS_COLOR[area.status] ?? 'text-slate-400'}>{STATUS_LABEL[area.status] ?? area.status} <span className="text-slate-500 text-xs">({area.userIn}&quot; vs {area.sizeRange[0]}&ndash;{area.sizeRange[1]}&quot;)</span></span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${area.score >= 90 ? 'bg-green-500' : area.score >= 75 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${area.score}%` }} />
            </div>
          </div>
        ))}
      </div>
      {fit.confidence < 100 && <p className="text-xs text-slate-500 border-t border-slate-800 pt-4">Fit confidence: <strong className="text-slate-400">{fit.confidence}%</strong></p>}
    </section>
  );
}

function StepBadge({ n, color = 'blue' }: { n: number; color?: 'blue' | 'cyan' }) {
  return <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold shrink-0 ${color === 'cyan' ? 'bg-cyan-600' : 'bg-blue-600'}`}>{n}</span>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs text-slate-400 mb-1 block">{label}</label>
      <input type="text" inputMode="decimal" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
