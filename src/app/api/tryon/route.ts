import { calculateFit, type Measurements } from '@/lib/fit';
import { CATEGORY_CONFIG, type ProductCategory } from '@/lib/product';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Accept both data URIs and plain https:// URLs
const DATA_URI_RE = /^data:image\/(jpeg|png|webp|gif);base64,/;
const HTTPS_RE    = /^https?:\/\//;

function validImage(s: string) {
  return DATA_URI_RE.test(s) || HTTPS_RE.test(s);
}

function getToken(): string {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN is not configured.');
  return token;
}

// ─── HuggingFace Space provider (free) ─────────────────────────────────────
const HF_SPACE = 'https://yisol-idm-vton.hf.space';

async function runWithHuggingFace(
  userImage: string,
  garmentImage: string,
  garmentDesc: string,
  seed: number,
): Promise<string> {
  const session_hash = Math.random().toString(36).slice(2, 14);

  // Gradio 4.x queue/join — fn_index 0 is the only (/tryon) endpoint
  const hfToken = process.env.HUGGINGFACE_TOKEN;
  const hfHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  if (hfToken) hfHeaders['Authorization'] = `Bearer ${hfToken}`;

  const joinRes = await fetch(`${HF_SPACE}/queue/join`, {
    method: 'POST',
    headers: hfHeaders,
    body: JSON.stringify({
      data: [
        // param 1: dict (ImageEditor) — background holds the human image
        { background: { url: userImage, orig_name: 'human.jpg' }, layers: [], composite: null },
        // param 2: garm_img (FileData)
        { url: garmentImage, orig_name: 'garment.jpg' },
        // param 3-7: scalars
        garmentDesc, true, false, 30, seed,
      ],
      event_data: null,
      fn_index: 0,
      trigger_id: null,
      session_hash,
    }),
  });
  if (!joinRes.ok) throw new Error(`HF queue join failed (${joinRes.status})`);

  // Read SSE events until process_completed
  const sseHeaders: Record<string, string> = { Accept: 'text/event-stream' };
  if (hfToken) sseHeaders['Authorization'] = `Bearer ${hfToken}`;
  const sseRes = await fetch(`${HF_SPACE}/queue/data?session_hash=${session_hash}`, {
    headers: sseHeaders,
    signal: AbortSignal.timeout(55_000),
  });
  if (!sseRes.ok) throw new Error('HF SSE connection failed');

  const reader = sseRes.body!.getReader();
  const dec    = new TextDecoder();
  let   buf    = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(line.slice(6)); } catch { continue; }

      if (msg.msg === 'process_completed') {
        // Robustly extract image from all known HF output shapes:
        // { output: { data: [FileData|string, ...] } }
        // { output: [string] }
        // { output: { image: string } }
        // { output: string }
        const out = msg.output;
        let img: unknown = null;

        if (out && typeof out === 'object' && 'data' in (out as object)) {
          // Most common: { data: [img, masked_img] }
          const arr = (out as { data: unknown[] }).data;
          img = Array.isArray(arr) ? arr[0] : null;
        } else if (Array.isArray(out)) {
          img = out[0];
        } else if (out && typeof out === 'object' && 'image' in (out as object)) {
          img = (out as { image: unknown }).image;
        } else if (out && typeof out === 'object' && 'url' in (out as object)) {
          img = out;
        } else {
          img = out;
        }

        if (typeof img === 'string' && img.startsWith('http')) return img;
        if (img && typeof img === 'object') {
          const o = img as Record<string, unknown>;
          if (typeof o.url === 'string')  return o.url;
          if (typeof o.path === 'string') return `${HF_SPACE}/file=${o.path}`;
        }
        // Log the raw output for debugging instead of hard-throwing
        throw new Error(`Unexpected HF output shape: ${JSON.stringify(out).slice(0, 300)}`);
      }
      if (msg.msg === 'process_errored') {
        throw new Error(`HF error: ${(msg.output as { error?: string } | undefined)?.error ?? 'unknown'}`);
      }
      if (msg.msg === 'queue_full') throw new Error('HuggingFace queue is full — try again in a moment');
    }
  }

  throw new Error('HF stream ended without a result');
}

// ─── POST /api/tryon — start prediction ─────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      userImage: string;
      garmentImage: string;
      garmentDescription?: string;
      measurements?: Measurements;
      category?: string;
      seed?: number;
      provider?: 'replicate' | 'hf';
    };

    const { userImage, garmentImage, garmentDescription, measurements, category, seed, provider } = body;

    if (!validImage(userImage) || !validImage(garmentImage)) {
      return Response.json(
        { error: 'userImage and garmentImage must be valid image URLs or base64 data URIs.' },
        { status: 400 },
      );
    }

    const safeDesc = typeof garmentDescription === 'string'
      ? garmentDescription.replace(/[<>"']/g, '').slice(0, 200)
      : 'a garment';

    const cat        = (category as ProductCategory | undefined);
    const fitWeights = cat && CATEGORY_CONFIG[cat] ? CATEGORY_CONFIG[cat].fitWeights : undefined;
    const fit        = measurements?.size ? calculateFit(measurements, fitWeights) : null;
    const resolvedSeed = typeof seed === 'number' ? seed : 42;

    // ── HuggingFace free provider ────────────────────────────────────────────
    if (provider === 'hf') {
      const imageUrl = await runWithHuggingFace(userImage, garmentImage, safeDesc, resolvedSeed);
      return Response.json({ imageUrl, fit });
    }

    // ── Replicate provider (default) ─────────────────────────────────────────
    const token = getToken();
    const IDM_VTON_VERSION = '0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985';
    const replicateRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=5',
      },
      body: JSON.stringify({
        version: IDM_VTON_VERSION,
        input: {
          human_img:       userImage,
          garm_img:        garmentImage,
          garment_des:     safeDesc,
          is_checked:      true,
          is_checked_crop: false,
          denoise_steps:   30,
          seed:            resolvedSeed,
        },
      }),
    });

    const rawText = await replicateRes.text();
    let predictionBody: Record<string, unknown>;
    try {
      predictionBody = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      return Response.json(
        { error: `Replicate returned non-JSON (HTTP ${replicateRes.status}): ${rawText.slice(0, 200)}` },
        { status: 502 },
      );
    }

    if (!replicateRes.ok) {
      const detail = typeof predictionBody.detail === 'string' ? predictionBody.detail : rawText.slice(0, 200);
      return Response.json({ error: `Replicate API error (${replicateRes.status}): ${detail}` }, { status: 502 });
    }

    const prediction = predictionBody as { id: string; [key: string]: unknown };
    return Response.json({ id: prediction.id, fit });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}

// GET /api/tryon?id=xxx — poll prediction status
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id') ?? '';

  if (!/^[a-zA-Z0-9]{10,64}$/.test(id)) {
    return Response.json({ error: 'Invalid prediction ID.' }, { status: 400 });
  }

  try {
    const token = getToken();
    const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!res.ok) {
      const errBody = await res.text();
      return Response.json({ error: `Replicate poll error (${res.status}): ${errBody.slice(0, 200)}` }, { status: 502 });
    }

    const rawPoll = await res.text();
    try {
      const prediction = JSON.parse(rawPoll);
      return Response.json(prediction);
    } catch {
      return Response.json({ error: `Non-JSON poll response: ${rawPoll.slice(0, 200)}` }, { status: 502 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
