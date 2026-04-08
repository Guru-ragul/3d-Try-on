'use client';

import { useState, useCallback, useRef } from 'react';
import type { FitResult } from '@/lib/fit';
import { CATEGORY_CONFIG, type ProductCategory } from '@/lib/product';
import { getRecommendations } from '@/lib/recommend';

// ─── Types ────────────────────────────────────────────────────────────────────

type TryOnState =
  | { status: 'idle' }
  | { status: 'loading'; message: string }
  | { status: 'done'; imageUrl: string; fit: FitResult | null; alternatives: string[] }
  | { status: 'error'; message: string };

type ProductState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; imageUrl: string; title: string; affiliateUrl?: string }
  | { status: 'error'; message: string };

// ─── Utilities ────────────────────────────────────────────────────────────────

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Resize + re-encode to JPEG so the base64 payload stays under Vercel's 4.5 MB
 * body limit. A 12 MP phone photo is ~4-8 MB raw; after this it's ~150-350 KB.
 */
function compressImage(dataUrl: string, maxPx = 1024, quality = 0.85): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height, 1));
      const w = Math.round(img.width  * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl); // fallback: send as-is
    img.src = dataUrl;
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

// ─── Step 0: Category picker ──────────────────────────────────────────────────

function CategoryPicker({ onSelect }: { onSelect: (c: ProductCategory) => void }) {
  const cats: ProductCategory[] = ['top', 'bottom', 'full'];
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div>
          <h1 className="text-4xl font-black text-white">What are you trying on?</h1>
          <p className="text-slate-400 mt-3">Choose a category — the form adapts to what matters for that garment.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {cats.map(cat => {
            const cfg = CATEGORY_CONFIG[cat];
            return (
              <button
                key={cat}
                onClick={() => onSelect(cat)}
                className="group flex flex-col items-center gap-4 p-7 bg-slate-900 border-2 border-slate-800 hover:border-blue-500 rounded-2xl transition-all hover:bg-slate-800/80 text-center"
              >
                <span className="text-5xl group-hover:scale-110 transition-transform">{cfg.emoji}</span>
                <div>
                  <p className="font-bold text-white text-lg">{cfg.label}</p>
                  <p className="text-xs text-slate-400 mt-1">{cfg.description}</p>
                </div>
              </button>
            );
          })}
        </div>
        <a href="/" className="text-sm text-slate-600 hover:text-slate-400 transition-colors">&larr; Back to Home</a>
      </div>
    </div>
  );
}

// ─── Photo upload ─────────────────────────────────────────────────────────────

function PhotoUpload({ preview, hint, onImage, onClear }: {
  preview: string | null;
  hint: string;
  onImage: (url: string) => void;
  onClear: () => void;
}) {
  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onImage(await fileToDataURL(file));
    e.target.value = '';
  }, [onImage]);

  return (
    <div className="space-y-2">
      <label
        className={`relative flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed overflow-hidden cursor-pointer transition-colors ${preview ? 'border-blue-500/60' : 'border-slate-700 hover:border-blue-500/60'}`}
        style={{ aspectRatio: '3/4' }}
      >
        {preview ? (
          <img src={preview} alt="Your photo" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-3xl">🧍</div>
            <div>
              <p className="text-sm font-semibold text-slate-300">Click to upload your photo</p>
              <p className="text-xs text-slate-500 mt-1">{hint}</p>
            </div>
          </div>
        )}
        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleChange} />
      </label>
      {preview && (
        <button onClick={onClear} className="text-xs text-slate-500 hover:text-red-400 transition-colors">Remove photo</button>
      )}
    </div>
  );
}

// ─── Product fetcher ──────────────────────────────────────────────────────────

function ProductFetcher({ productState, onFetch, onClear, onDirectImage }: {
  productState: ProductState;
  onFetch: (url: string) => void;
  onClear: () => void;
  onDirectImage: (url: string) => void;
}) {
  const [url, setUrl] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const directRef   = useRef<HTMLInputElement>(null);

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
          <input
            type="url"
            value={url}
            onChange={e => handleUrlChange(e.target.value)}
            placeholder="https://www.myntra.com/..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            onClick={() => url && onFetch(url)}
            disabled={!url || productState.status === 'loading'}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            {productState.status === 'loading' ? <Spinner /> : 'Fetch'}
          </button>
        </div>
      </div>

      {productState.status === 'done' && (
        <div className="flex items-start gap-3 p-3 bg-slate-800 rounded-xl border border-slate-700">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={productState.imageUrl} alt={productState.title} className="w-20 h-24 object-cover rounded-lg shrink-0 border border-slate-600" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-medium line-clamp-2">{productState.title}</p>
            <p className="text-xs text-emerald-400 mt-1">&#x2713; Product image fetched</p>
            <div className="flex items-center gap-3 mt-2">
              <button onClick={onClear} className="text-xs text-slate-500 hover:text-red-400 transition-colors">Clear</button>
              {productState.affiliateUrl && (
                <a href={productState.affiliateUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">Buy on Amazon &rarr;</a>
              )}
            </div>
          </div>
        </div>
      )}

      {productState.status === 'error' && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-300 space-y-2">
          <p>{productState.message}</p>
          <p className="text-red-400/60">Tip: Right-click the product image &rarr; &ldquo;Copy image address&rdquo; and paste below.</p>
          <div className="flex gap-2 mt-1">
            <input
              ref={directRef}
              type="url"
              placeholder="Paste direct image URL&hellip;"
              className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => { const v = directRef.current?.value; if (v) onDirectImage(v); }}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-semibold transition-colors"
            >
              Use
            </button>
          </div>
        </div>
      )}

      {productState.status === 'idle' && (
        <p className="text-xs text-slate-600 text-center">Supports Amazon, Myntra, Flipkart, AJIO, Zara, H&amp;M and more</p>
      )}
    </div>
  );
}

// ─── Measurement form (category-aware) ───────────────────────────────────────

interface MeasureState { height: string; weight: string; chest: string; waist: string; hips: string }

function MeasurementForm({ category, state, onChange }: {
  category: ProductCategory;
  state: MeasureState;
  onChange: (k: keyof MeasureState, v: string) => void;
}) {
  const primary = CATEGORY_CONFIG[category].primaryMeasurements;
  const isPrimary = (k: 'chest' | 'waist' | 'hips') => primary.includes(k);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Height (cm)" value={state.height} onChange={v => onChange('height', v)} placeholder="e.g. 170" />
        <Field label="Weight (kg)" value={state.weight} onChange={v => onChange('weight', v)} placeholder="e.g. 65"  />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label={isPrimary('chest') ? 'Chest / Bust (in) *' : 'Chest / Bust (in)'}
          value={state.chest}
          onChange={v => onChange('chest', v)}
          placeholder="e.g. 36"
          highlight={isPrimary('chest')}
        />
        <Field
          label={isPrimary('waist') ? 'Waist (in) *' : 'Waist (in)'}
          value={state.waist}
          onChange={v => onChange('waist', v)}
          placeholder="e.g. 30"
          highlight={isPrimary('waist')}
        />
      </div>
      <Field
        label={isPrimary('hips') ? 'Hips (in) *' : 'Hips (in)'}
        value={state.hips}
        onChange={v => onChange('hips', v)}
        placeholder="e.g. 38"
        highlight={isPrimary('hips')}
      />
      {primary.length > 0 && (
        <p className="text-xs text-slate-500">* Primary measurements for this category &mdash; most important for fit accuracy.</p>
      )}
    </div>
  );
}

// ─── Fit panel ────────────────────────────────────────────────────────────────

function FitPanel({ fit, productSize }: { fit: FitResult | null; productSize: string }) {
  if (!fit || fit.breakdown.length === 0) {
    return (
      <section className="bg-slate-900 rounded-2xl border border-slate-800 p-5 flex items-center justify-center min-h-40">
        <p className="text-slate-500 text-sm text-center">Add measurements to see fit breakdown.</p>
      </section>
    );
  }
  return (
    <section className="bg-slate-900 rounded-2xl border border-slate-800 p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-2xl font-bold">{fit.label}</div>
          <div className="text-sm text-slate-400 mt-1 max-w-xs">{fit.recommendation}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-4xl font-black leading-none">
            {fit.score}<span className="text-xl font-normal text-slate-400">/100</span>
          </div>
          {fit.suggestedSize !== productSize && (
            <div className="text-xs text-yellow-400 mt-1">Best size: <strong>{fit.suggestedSize}</strong></div>
          )}
        </div>
      </div>
      <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${fit.score >= 85 ? 'bg-gradient-to-r from-emerald-500 to-green-400' : fit.score >= 70 ? 'bg-gradient-to-r from-yellow-500 to-amber-400' : 'bg-gradient-to-r from-red-500 to-orange-500'}`}
          style={{ width: `${fit.score}%` }}
        />
      </div>
      <div className="space-y-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Breakdown</p>
        {fit.breakdown.map(area => (
          <div key={area.area} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-slate-300">{area.area}</span>
              <span className={STATUS_COLOR[area.status] ?? 'text-slate-400'}>
                {STATUS_LABEL[area.status] ?? area.status}{' '}
                <span className="text-slate-500 text-xs">({area.userIn}&quot; vs {area.sizeRange[0]}&ndash;{area.sizeRange[1]}&quot;)</span>
              </span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${area.score >= 90 ? 'bg-green-500' : area.score >= 75 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${area.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      {fit.confidence < 100 && (
        <p className="text-xs text-slate-500 border-t border-slate-800 pt-3">
          Fit confidence: <strong className="text-slate-400">{fit.confidence}%</strong>
          {fit.confidence < 60 && ' — add more measurements for a better estimate'}
        </p>
      )}
    </section>
  );
}

// ─── Recommendation panel ─────────────────────────────────────────────────────

function RecommendationPanel({ category, selectedSize, fit }: {
  category: ProductCategory;
  selectedSize: string;
  fit: FitResult | null;
}) {
  const recs = getRecommendations(category, selectedSize, fit);

  const upsellStyle: Record<string, string> = {
    'size-up':   'border-orange-500/30 bg-orange-500/5',
    'size-down': 'border-yellow-500/30 bg-yellow-500/5',
    'perfect':   'border-emerald-500/30 bg-emerald-500/5',
    'no-data':   'border-slate-700 bg-slate-800/40',
  };
  const upsellTextColor: Record<string, string> = {
    'size-up':   'text-orange-400',
    'size-down': 'text-yellow-400',
    'perfect':   'text-emerald-400',
    'no-data':   'text-slate-400',
  };
  const upsellIcon: Record<string, string> = {
    'size-up':   '📐',
    'size-down': '🔽',
    'perfect':   '✅',
    'no-data':   '📏',
  };

  return (
    <section className="space-y-5">
      <h2 className="text-lg font-bold text-white flex items-center gap-2">
        <span className="text-xl">💡</span> Recommendations
      </h2>

      {recs.upsell && (
        <div className={`rounded-2xl border p-4 ${upsellStyle[recs.upsell.type] ?? 'border-slate-800'}`}>
          <div className="flex items-start gap-3">
            <div className="text-2xl mt-0.5">{upsellIcon[recs.upsell.type]}</div>
            <div className="flex-1">
              <p className={`font-semibold text-sm ${upsellTextColor[recs.upsell.type] ?? 'text-white'}`}>{recs.upsell.headline}</p>
              <p className="text-sm text-slate-400 mt-1">{recs.upsell.detail}</p>
              {recs.upsell.type !== 'perfect' && recs.upsell.type !== 'no-data' && recs.upsell.suggestedSize !== selectedSize && (
                <div className="mt-3 inline-flex items-center gap-2 bg-slate-900/60 rounded-lg px-3 py-1.5 border border-slate-700">
                  <span className="text-xs text-slate-400">Recommended size:</span>
                  <span className="text-sm font-bold text-white">{recs.upsell.suggestedSize}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {recs.bundleNote && (
        <p className="text-sm text-slate-400 border-l-2 border-blue-500/50 pl-3">{recs.bundleNote}</p>
      )}

      {recs.crossSell.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Complete Your Look</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {recs.crossSell.map(cs => (
              <div key={cs.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                <p className="font-semibold text-sm text-white">{cs.label}</p>
                <p className="text-xs text-slate-500">{cs.examples}</p>
                <a
                  href={cs.myntraUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1"
                >
                  Browse on Myntra &rarr;
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TryOnPage() {
  const [category,    setCategory]    = useState<ProductCategory | null>(null);
  const [step,        setStep]        = useState<0 | 1 | 2>(0);
  const [userImage,   setUserImage]   = useState<string | null>(null);
  const [garmentDesc, setGarmentDesc] = useState('');
  const [productSize, setProductSize] = useState('M');
  const [measures,    setMeasures]    = useState<MeasureState>({ height: '', weight: '', chest: '', waist: '', hips: '' });
  const [productState, setProductState] = useState<ProductState>({ status: 'idle' });
  const [tryOnState,   setTryOnState]   = useState<TryOnState>({ status: 'idle' });
  const [provider,     setProvider]     = useState<'replicate' | 'hf'>('replicate');

  const garmentImageUrl = productState.status === 'done' ? productState.imageUrl : null;
  const cfg = category ? CATEGORY_CONFIG[category] : null;
  const canGenerate = Boolean(userImage && garmentImageUrl);

  const setMeasure = (k: keyof MeasureState, v: string) =>
    setMeasures(prev => ({ ...prev, [k]: v }));

  const fetchProduct = async (url: string) => {
    setProductState({ status: 'loading' });
    try {
      const res  = await fetch('/api/product', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url }),
      });
      const data = await res.json() as { imageUrl?: string; title?: string; affiliateUrl?: string; error?: string };
      if (!res.ok || !data.imageUrl) {
        setProductState({ status: 'error', message: data.error ?? 'Could not fetch product image.' });
      } else {
        setProductState({ status: 'done', imageUrl: data.imageUrl, title: data.title ?? 'Product', affiliateUrl: data.affiliateUrl });
        if (!garmentDesc && data.title) setGarmentDesc(data.title.slice(0, 120));
      }
    } catch (err) {
      setProductState({ status: 'error', message: (err as Error).message });
    }
  };

  // Start one prediction. Replicate returns { id, fit }; HF returns { imageUrl, fit } directly.
  const startPrediction = async (compressedUser: string, seed: number) => {
    const res = await fetch('/api/tryon', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userImage:          compressedUser,
        garmentImage:       garmentImageUrl,
        garmentDescription: garmentDesc,
        category,
        seed,
        provider,
        measurements: { size: productSize, ...measures },
      }),
    });
    return res.json() as Promise<{ id?: string; imageUrl?: string; fit?: FitResult; error?: string }>;
  };

  // Poll one prediction id until succeeded/failed. Returns output URL or null.
  const pollUntilDone = async (id: string): Promise<string | null> => {
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const pollRes  = await fetch(`/api/tryon?id=${encodeURIComponent(id)}`);
      const pollData = await pollRes.json() as { status: string; output?: string | string[]; error?: string; detail?: string };
      if (pollData.status === 'succeeded') {
        const url = Array.isArray(pollData.output) ? pollData.output[0] : pollData.output;
        return url ?? null;
      }
      if (pollData.status === 'failed' || pollData.status === 'canceled') return null;
    }
    return null; // timeout
  };

  const handleGenerate = async () => {
    if (!canGenerate || !category) return;
    setTryOnState({ status: 'loading', message: 'Compressing photo…' });
    try {
      // Compress client-side: keeps JSON body well under Vercel's 4.5 MB limit
      const compressedUser = userImage!.startsWith('data:')
        ? await compressImage(userImage!)
        : userImage!;

      // HF is synchronous so only 1 call; Replicate uses 2 seeds for variety
      const SEEDS = provider === 'hf' ? [42] : [42, 137];
      setTryOnState({ status: 'loading', message: provider === 'hf' ? 'Running on HuggingFace… (~45–90s)' : 'Starting 2 AI generations…' });
      const starts = await Promise.all(SEEDS.map(s => startPrediction(compressedUser, s)));

      // ── HuggingFace: response contains imageUrl directly (no polling) ────
      if (provider === 'hf') {
        const result = starts[0];
        if (result?.error) {
          setTryOnState({ status: 'error', message: result.error });
          return;
        }
        if (result?.imageUrl) {
          setTryOnState({ status: 'done', imageUrl: result.imageUrl, fit: result.fit ?? null, alternatives: [] });
          setStep(2);
          return;
        }
        setTryOnState({ status: 'error', message: 'HuggingFace did not return an image. Try again.' });
        return;
      }

      // ── Replicate: poll prediction ids ──────────────────────────────────────
      const validStarts = starts.filter(d => !!d.id);
      if (validStarts.length === 0) {
        setTryOnState({ status: 'error', message: starts[0]?.error ?? 'Failed to start generation.' });
        return;
      }
      const fit = validStarts[0].fit ?? null;
      const ids = validStarts.map(d => d.id!);

      setTryOnState({ status: 'loading', message: 'AI is generating your try-on… (~30–45s)' });

      // Poll all ids; show the first that succeeds, collect the rest as alternatives
      let shown = false;

      await Promise.all(ids.map(async id => {
        const url = await pollUntilDone(id);
        if (!url) return;
        if (!shown) {
          shown = true;
          setTryOnState({ status: 'done', imageUrl: url, fit, alternatives: [] });
          setStep(2);
        } else {
          setTryOnState(prev =>
            prev.status === 'done'
              ? { ...prev, alternatives: [...prev.alternatives, url] }
              : prev
          );
        }
      }));

      if (!shown) {
        setTryOnState({ status: 'error', message: 'Generation timed out or failed. Please try again.' });
      }
    } catch (err) {
      setTryOnState({ status: 'error', message: (err as Error).message });
    }
  };

  const reset = () => {
    setCategory(null);
    setStep(0);
    setUserImage(null);
    setGarmentDesc('');
    setProductSize('M');
    setMeasures({ height: '', weight: '', chest: '', waist: '', hips: '' });
    setProductState({ status: 'idle' });
    setTryOnState({ status: 'idle' });
  };

  if (step === 0) {
    return <CategoryPicker onSelect={cat => { setCategory(cat); setStep(1); }} />;
  }

  if (step === 2 && tryOnState.status === 'done') {
    const { imageUrl, fit, alternatives } = tryOnState;
    const buyUrl = productState.status === 'done' ? productState.affiliateUrl : undefined;
    const productImg = productState.status === 'done' ? productState.imageUrl : undefined;
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <Header category={category!} cfg={cfg!} onReset={reset} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
          {cfg?.tryOnNote && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-300">
              {cfg.tryOnNote}
            </div>
          )}

          {/* ── Main result row ─────────────────────────────────────────── */}
          <div className="grid lg:grid-cols-2 gap-6">
            <section className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 pt-4 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />AI Try-On Result
                {alternatives.length > 0 && (
                  <span className="ml-auto text-slate-500">{alternatives.length + 1} variations generated</span>
                )}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="AI try-on result" className="w-full object-contain" />

              {/* ── Alternatives strip ───────────────────────────────── */}
              {alternatives.length > 0 && (
                <div className="px-4 pb-3 space-y-2">
                  <p className="text-xs text-slate-500">Other variation</p>
                  <div className="flex gap-2">
                    {alternatives.map((alt, i) => (
                      <button
                        key={i}
                        onClick={() => setTryOnState(prev =>
                          prev.status === 'done'
                            ? { ...prev, imageUrl: alt, alternatives: [imageUrl, ...prev.alternatives.filter(a => a !== alt)] }
                            : prev
                        )}
                        className="w-16 h-20 rounded-lg overflow-hidden border-2 border-slate-700 hover:border-blue-500 transition-colors shrink-0"
                        title="Use this variation"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={alt} alt={`Variation ${i + 2}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-4 flex items-center gap-4">
                <a href={imageUrl} download="tryon-result.png" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 underline">Download image</a>
                <button onClick={() => setStep(1)} className="text-xs text-slate-500 hover:text-white transition-colors">&larr; Adjust</button>
              </div>
            </section>

            <div className="space-y-5">
              <FitPanel fit={fit} productSize={productSize} />

              {/* ── Buy CTA ─────────────────────────────────────────── */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
                <div className="flex items-center gap-4">
                  {productImg && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={productImg} alt="Product" className="w-16 h-20 object-cover rounded-lg border border-slate-700 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 mb-1">You tried on</p>
                    <p className="text-sm font-semibold text-white line-clamp-2">
                      {productState.status === 'done' ? productState.title : 'This product'}
                    </p>
                    {fit && (
                      <p className="text-xs mt-1">
                        <span className={fit.score >= 85 ? 'text-emerald-400' : fit.score >= 70 ? 'text-yellow-400' : 'text-orange-400'}>
                          {fit.label}
                        </span>
                        {' '}in size <strong className="text-white">{productSize}</strong>
                        {fit.suggestedSize !== productSize && (
                          <span className="text-yellow-400"> (try {fit.suggestedSize})</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
                {buyUrl ? (
                  <a
                    href={buyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-base bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white transition-all shadow-lg"
                  >
                    🛒 Buy on Amazon
                  </a>
                ) : (
                  <button
                    onClick={() => setStep(1)}
                    className="w-full py-3.5 rounded-xl font-bold text-base bg-slate-800 hover:bg-slate-700 text-white transition-colors"
                  >
                    Try a different product
                  </button>
                )}
                <button
                  onClick={() => { setStep(1); setTryOnState({ status: 'idle' }); }}
                  className="w-full py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Generate again with same product
                </button>
              </div>
            </div>
          </div>

          <RecommendationPanel category={category!} selectedSize={productSize} fit={fit} />
          <div className="text-center">
            <button onClick={reset} className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white transition-colors">Try another product</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Header category={category!} cfg={cfg!} onReset={reset} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {cfg?.tryOnNote && (
          <div className="mb-6 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-300">
            {cfg.tryOnNote}
          </div>
        )}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-5">
            <section className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
              <h2 className="font-semibold mb-4 flex items-center gap-2"><StepBadge n={1} /> Your Photo</h2>
              <PhotoUpload
                preview={userImage}
                hint={cfg!.photoHint}
                onImage={setUserImage}
                onClear={() => setUserImage(null)}
              />
            </section>
            <section className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
              <h2 className="font-semibold mb-1 flex items-center gap-2">
                <StepBadge n={2} /> Measurements
                <span className="text-xs font-normal text-slate-500">(drives fit score)</span>
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                {category === 'bottom'
                  ? 'Waist & hips are essential for pants fit accuracy.'
                  : 'Optional but recommended for a personalised fit score.'}
              </p>
              <MeasurementForm category={category!} state={measures} onChange={setMeasure} />
            </section>
          </div>

          <div className="space-y-5">
            <section className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
              <h2 className="font-semibold mb-4 flex items-center gap-2"><StepBadge n={3} color="cyan" /> Product</h2>
              <ProductFetcher
                productState={productState}
                onFetch={fetchProduct}
                onClear={() => { setProductState({ status: 'idle' }); setGarmentDesc(''); }}
                onDirectImage={url => setProductState({ status: 'done', imageUrl: url, title: 'Custom image' })}
              />
              <div className="mt-5 space-y-3">
                <Field
                  label="Garment description (optional)"
                  value={garmentDesc}
                  onChange={setGarmentDesc}
                  placeholder="e.g. navy slim-fit cotton shirt"
                />
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Size on product label</label>
                  <select
                    value={productSize}
                    onChange={e => setProductSize(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    {['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </section>

            {/* Provider toggle */}
            <div className="flex items-center justify-center gap-1 p-1 bg-slate-800 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setProvider('replicate')}
                className={`flex-1 py-2 rounded-lg transition-colors ${provider === 'replicate' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Replicate <span className="opacity-60 font-normal">(paid)</span>
              </button>
              <button
                onClick={() => setProvider('hf')}
                className={`flex-1 py-2 rounded-lg transition-colors ${provider === 'hf' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                HuggingFace <span className="opacity-60 font-normal">(free)</span>
              </button>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!canGenerate || tryOnState.status === 'loading'}
              className="w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-lg disabled:cursor-not-allowed bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500"
            >
              {tryOnState.status === 'loading'
                ? <span className="flex items-center justify-center gap-3"><Spinner />{tryOnState.message}</span>
                : '✨ Generate AI Try-On'}
            </button>

            {!canGenerate && tryOnState.status !== 'loading' && (
              <p className="text-xs text-slate-500 text-center">
                {!userImage && !garmentImageUrl
                  ? 'Upload your photo + fetch a product to continue'
                  : !userImage
                  ? 'Upload your photo to continue'
                  : 'Fetch a product to continue'}
              </p>
            )}

            {tryOnState.status === 'error' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-sm text-red-300 space-y-3">
                <div>
                  <p className="font-semibold mb-1">Generation failed</p>
                  <p>{tryOnState.message}</p>
                </div>
                <button
                  onClick={() => { setTryOnState({ status: 'idle' }); handleGenerate(); }}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg text-xs font-semibold transition-colors"
                >
                  ↺ Try again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function Header({ category, cfg, onReset }: {
  category: ProductCategory;
  cfg: { label: string; emoji: string };
  onReset: () => void;
}) {
  void category;
  return (
    <header className="bg-slate-900/80 backdrop-blur border-b border-slate-800 px-6 py-4 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onReset} className="text-xl" title="Change category">{cfg.emoji}</button>
          <div>
            <h1 className="text-xl font-bold">AI Try-On &mdash; {cfg.label}</h1>
            <p className="text-xs text-slate-400 mt-0.5">Photo &middot; Measurements &middot; Product URL &middot; Fit Score &middot; Recommendations</p>
          </div>
        </div>
        <button onClick={onReset} className="text-sm text-slate-500 hover:text-white transition-colors">Change category</button>
      </div>
    </header>
  );
}

function StepBadge({ n, color = 'blue' }: { n: number; color?: 'blue' | 'cyan' }) {
  return (
    <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold shrink-0 ${color === 'cyan' ? 'bg-cyan-600' : 'bg-blue-600'}`}>
      {n}
    </span>
  );
}

function Field({ label, value, onChange, placeholder, highlight }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <label className={`text-xs mb-1 block ${highlight ? 'text-blue-400 font-semibold' : 'text-slate-400'}`}>{label}</label>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-slate-800 border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors ${highlight ? 'border-blue-600/60 focus:border-blue-400' : 'border-slate-700 focus:border-blue-500'}`}
      />
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
