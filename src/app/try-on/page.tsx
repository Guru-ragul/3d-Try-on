'use client';

import { useState, useCallback } from 'react';
import type { FitResult } from '@/lib/fit';

// ─── Types ────────────────────────────────────────────────────────────────────

type TryOnState =
  | { status: 'idle' }
  | { status: 'loading'; message: string }
  | { status: 'done'; imageUrl: string; fit: FitResult | null }
  | { status: 'error'; message: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const STATUS_COLOR: Record<string, string> = {
  perfect:   'text-green-400',
  great:     'text-emerald-400',
  loose:     'text-yellow-400',
  tight:     'text-orange-400',
  'too-loose':  'text-red-300',
  'too-tight':  'text-red-400',
};

const STATUS_LABEL: Record<string, string> = {
  perfect:   'Perfect',
  great:     'Great',
  loose:     'Slightly Loose',
  tight:     'Slightly Tight',
  'too-loose':  'Too Loose',
  'too-tight':  'Too Tight',
};

// ─── ImageUpload component ────────────────────────────────────────────────────

interface ImageUploadProps {
  hint: string;
  preview: string | null;
  onImage: (dataUrl: string) => void;
  onClear: () => void;
}

function ImageUpload({ hint, preview, onImage, onClear }: ImageUploadProps) {
  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = await fileToDataURL(file);
      onImage(url);
      e.target.value = '';
    },
    [onImage],
  );

  return (
    <div className="space-y-2">
      <label
        className={`relative block w-full rounded-xl border-2 border-dashed overflow-hidden cursor-pointer transition-colors ${
          preview ? 'border-blue-500/60' : 'border-slate-700 hover:border-blue-500/60'
        }`}
        style={{ aspectRatio: '3/4' }}
      >
        {preview ? (
          <img src={preview} alt="upload preview" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500 px-4 text-center">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-medium text-slate-400">Click to upload</span>
            <span className="text-xs text-slate-600">{hint}</span>
          </div>
        )}
        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleChange} />
      </label>
      {preview && (
        <button onClick={onClear} className="text-xs text-slate-500 hover:text-red-400 transition-colors">
          Remove photo
        </button>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TryOnPage() {
  // Images
  const [userImage,    setUserImage]    = useState<string | null>(null);
  const [garmentImage, setGarmentImage] = useState<string | null>(null);

  // Product info
  const [garmentDesc,  setGarmentDesc]  = useState('');
  const [productSize,  setProductSize]  = useState('M');

  // Measurements
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [chest,  setChest]  = useState('');
  const [waist,  setWaist]  = useState('');
  const [hips,   setHips]   = useState('');

  // State machine
  const [state, setState] = useState<TryOnState>({ status: 'idle' });

  const canGenerate = Boolean(userImage && garmentImage);

  const handleGenerate = async () => {
    if (!canGenerate) return;

    setState({ status: 'loading', message: 'Sending to AI model...' });

    try {
      // 1) Start prediction
      const startRes = await fetch('/api/tryon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userImage,
          garmentImage,
          garmentDescription: garmentDesc,
          measurements: { size: productSize, chest, waist, hips, height, weight },
        }),
      });

      const startData = await startRes.json() as { id?: string; fit?: FitResult; error?: string };

      if (!startRes.ok || !startData.id) {
        setState({ status: 'error', message: startData.error ?? 'Failed to start generation.' });
        return;
      }

      const { id, fit } = startData;

      // 2) Poll for result (up to 3 minutes)
      setState({ status: 'loading', message: 'AI is generating your try-on… (~30 seconds)' });

      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 3000));

        const pollRes  = await fetch(`/api/tryon?id=${encodeURIComponent(id)}`);
        const pollData = await pollRes.json() as {
          status: string;
          output?: string | string[];
          error?: string;
        };

        if (pollData.status === 'succeeded') {
          const imageUrl = Array.isArray(pollData.output) ? pollData.output[0] : pollData.output;
          if (!imageUrl) {
            setState({ status: 'error', message: 'AI returned an empty result.' });
            return;
          }
          setState({ status: 'done', imageUrl, fit: fit ?? null });
          return;
        }

        if (pollData.status === 'failed' || pollData.status === 'canceled') {
          setState({ status: 'error', message: pollData.error ?? 'Generation failed.' });
          return;
        }
      }

      setState({ status: 'error', message: 'Timed out after 3 minutes. Please try again.' });
    } catch (err) {
      setState({ status: 'error', message: (err as Error).message });
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur border-b border-slate-800 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">AI Fit Try-On</h1>
            <p className="text-sm text-slate-400 mt-0.5">Upload your photo + any garment — see how it fits on you</p>
          </div>
          <a href="/" className="text-sm text-slate-500 hover:text-white transition-colors">← Home</a>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Step row ── */}
        <div className="grid lg:grid-cols-2 gap-6">

          {/* LEFT — Your photo + measurements */}
          <div className="space-y-5">

            {/* Photo */}
            <section className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <StepBadge n={1} /> Your Photo
              </h2>
              <ImageUpload
                hint="Clear full-body or upper-body photo, plain background preferred"
                preview={userImage}
                onImage={setUserImage}
                onClear={() => setUserImage(null)}
              />
            </section>

            {/* Measurements */}
            <section className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
              <h2 className="font-semibold mb-1 flex items-center gap-2">
                <StepBadge n={2} /> Your Measurements
                <span className="text-xs font-normal text-slate-500">(for fit analysis)</span>
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                More measurements = higher confidence fit score. All optional but recommended.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Height (cm)"     value={height} onChange={setHeight} placeholder="e.g. 170" />
                <Field label="Weight (kg)"     value={weight} onChange={setWeight} placeholder="e.g. 65"  />
                <Field label="Chest (inches)"  value={chest}  onChange={setChest}  placeholder="e.g. 36"  />
                <Field label="Waist (inches)"  value={waist}  onChange={setWaist}  placeholder="e.g. 30"  />
                <div className="col-span-2">
                  <Field label="Hips (inches)"   value={hips}   onChange={setHips}   placeholder="e.g. 38"  />
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT — Product + generate */}
          <div className="space-y-5">

            {/* Garment */}
            <section className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <StepBadge n={3} color="cyan" /> Garment / Product Image
              </h2>
              <ImageUpload
                hint="Front-facing product photo, plain/white background preferred"
                preview={garmentImage}
                onImage={setGarmentImage}
                onClear={() => setGarmentImage(null)}
              />
              <div className="mt-4 space-y-3">
                <Field
                  label="Garment description (improves AI accuracy)"
                  value={garmentDesc}
                  onChange={setGarmentDesc}
                  placeholder="e.g. navy slim-fit button-down shirt"
                />
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Size on product label</label>
                  <select
                    value={productSize}
                    onChange={e => setProductSize(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    {['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={!canGenerate || state.status === 'loading'}
              className="w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-lg disabled:cursor-not-allowed
                bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500
                disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500
                shadow-blue-500/20 disabled:shadow-none"
            >
              {state.status === 'loading' ? (
                <span className="flex items-center justify-center gap-3">
                  <Spinner /> {state.message}
                </span>
              ) : (
                <>✨ Try It On — AI Generate</>
              )}
            </button>

            {!canGenerate && state.status === 'idle' && (
              <p className="text-xs text-slate-500 text-center">
                Upload both your photo and a garment image to enable generation.
              </p>
            )}

            {/* Error */}
            {state.status === 'error' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-sm text-red-300">
                <span className="font-semibold">Error: </span>{state.message}
                {state.message.includes('REPLICATE_API_TOKEN') && (
                  <p className="mt-2 text-red-400/70">
                    Go to your <a href="https://replicate.com/account/api-tokens" target="_blank" rel="noopener noreferrer" className="underline">Replicate dashboard</a> to get a token, then add it to Vercel → Settings → Environment Variables as <code className="bg-red-500/20 px-1 rounded">REPLICATE_API_TOKEN</code>.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Result section ── */}
        {state.status === 'done' && (
          <div className="grid lg:grid-cols-2 gap-6">

            {/* Generated image */}
            <section className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 pt-4 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Try-On Result
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={state.imageUrl} alt="AI try-on result" className="w-full object-contain" />
            </section>

            {/* Fit analysis */}
            <section className="bg-slate-900 rounded-2xl border border-slate-800 p-5 flex flex-col gap-5">
              {state.fit && state.fit.breakdown.length > 0 ? (
                <>
                  {/* Score header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-2xl font-bold text-white">{state.fit.label}</div>
                      <div className="text-sm text-slate-400 mt-1 max-w-xs">{state.fit.recommendation}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-4xl font-black text-white leading-none">
                        {state.fit.score}
                        <span className="text-xl font-normal text-slate-400">/100</span>
                      </div>
                      {state.fit.suggestedSize !== productSize && (
                        <div className="text-xs text-yellow-400 mt-1">
                          Best size: <strong>{state.fit.suggestedSize}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Overall bar */}
                  <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        state.fit.score >= 85 ? 'bg-gradient-to-r from-emerald-500 to-green-400' :
                        state.fit.score >= 70 ? 'bg-gradient-to-r from-yellow-500 to-amber-400' :
                                                'bg-gradient-to-r from-red-500 to-orange-500'
                      }`}
                      style={{ width: `${state.fit.score}%` }}
                    />
                  </div>

                  {/* Per-area breakdown */}
                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Measurement Breakdown
                    </div>
                    {state.fit.breakdown.map(area => (
                      <div key={area.area} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-300">{area.area}</span>
                          <span className={STATUS_COLOR[area.status] ?? 'text-slate-400'}>
                            {STATUS_LABEL[area.status] ?? area.status}
                            {' '}
                            <span className="text-slate-500 text-xs">
                              ({area.userIn}" vs {area.sizeRange[0]}–{area.sizeRange[1]}")
                            </span>
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              area.score >= 90 ? 'bg-green-500' :
                              area.score >= 75 ? 'bg-yellow-500' :
                                                 'bg-red-500'
                            }`}
                            style={{ width: `${area.score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Confidence */}
                  {state.fit.confidence < 100 && (
                    <p className="text-xs text-slate-500 border-t border-slate-800 pt-4">
                      Fit confidence: <strong className="text-slate-400">{state.fit.confidence}%</strong> —
                      add {state.fit.confidence < 40 ? 'chest, waist & hips' : 'more measurements'} for a complete analysis.
                    </p>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                  Add your measurements above to see a detailed fit analysis here.
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Small subcomponents ──────────────────────────────────────────────────────

function StepBadge({ n, color = 'blue' }: { n: number; color?: 'blue' | 'cyan' }) {
  return (
    <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold shrink-0 ${
      color === 'cyan' ? 'bg-cyan-600' : 'bg-blue-600'
    }`}>
      {n}
    </span>
  );
}

function Field({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs text-slate-400 mb-1 block">{label}</label>
      <input
        type={placeholder?.includes('e.g.') ? 'number' : 'text'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
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

