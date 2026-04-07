import { calculateFit, type Measurements } from '@/lib/fit';

export const maxDuration = 60;

// Accept both data URIs and plain https:// URLs
const DATA_URI_RE = /^data:image\/(jpeg|png|webp|gif);base64,/;
const HTTPS_RE    = /^https?:\/\//;

function validImage(s: string) {
  return DATA_URI_RE.test(s) || HTTPS_RE.test(s);
}

function getToken(): string {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error(
      'REPLICATE_API_TOKEN is not configured. Add it to Vercel → Settings → Environment Variables.',
    );
  }
  return token;
}

// POST /api/tryon — start IDM-VTON prediction
export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      userImage: string;
      garmentImage: string;
      garmentDescription?: string;
      measurements?: Measurements;
    };

    const { userImage, garmentImage, garmentDescription, measurements } = body;

    if (!validImage(userImage) || !validImage(garmentImage)) {
      return Response.json(
        { error: 'userImage and garmentImage must be valid image URLs or base64 data URIs.' },
        { status: 400 },
      );
    }

    const safeDesc = typeof garmentDescription === 'string'
      ? garmentDescription.replace(/[<>"']/g, '').slice(0, 200)
      : 'a garment';

    const token = getToken();

    // Call Replicate directly with correct Authorization header format
    const replicateRes = await fetch('https://api.replicate.com/v1/models/cuuupid/idm-vton/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=5',
      },
      body: JSON.stringify({
        input: {
          human_img:       userImage,
          garm_img:        garmentImage,
          garment_des:     safeDesc,
          is_checked:      true,
          is_checked_crop: false,
          denoise_steps:   30,
          seed:            42,
        },
      }),
    });

    if (!replicateRes.ok) {
      const errBody = await replicateRes.text();
      return Response.json(
        { error: `Replicate API error (${replicateRes.status}): ${errBody}` },
        { status: 502 },
      );
    }

    const prediction = await replicateRes.json() as { id: string; [key: string]: unknown };
    const fit = measurements?.size ? calculateFit(measurements) : null;

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
      return Response.json({ error: `Replicate poll error (${res.status}): ${errBody}` }, { status: 502 });
    }

    const prediction = await res.json();
    return Response.json(prediction);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
