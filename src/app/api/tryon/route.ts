import Replicate from 'replicate';
import { calculateFit, type Measurements } from '@/lib/fit';

// Vercel: allow up to 60s for prediction creation (fast, not the full generation time)
export const maxDuration = 60;

const DATA_URI_RE = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+=*$/;

function getClient(): Replicate {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error(
      'REPLICATE_API_TOKEN is not set. Add it to your Vercel environment variables at vercel.com/dashboard → Settings → Environment Variables.',
    );
  }
  return new Replicate({ auth: token });
}

// POST /api/tryon — start an IDM-VTON prediction, return { id, fit }
export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      userImage: string;
      garmentImage: string;
      garmentDescription?: string;
      measurements?: Measurements;
    };

    const { userImage, garmentImage, garmentDescription, measurements } = body;

    // Input validation
    if (typeof userImage !== 'string' || typeof garmentImage !== 'string') {
      return Response.json({ error: 'userImage and garmentImage are required strings.' }, { status: 400 });
    }
    if (!DATA_URI_RE.test(userImage) || !DATA_URI_RE.test(garmentImage)) {
      return Response.json(
        { error: 'Images must be valid JPEG/PNG/WebP base64 data URIs.' },
        { status: 400 },
      );
    }

    const safeDesc = typeof garmentDescription === 'string'
      ? garmentDescription.replace(/[<>"']/g, '').slice(0, 200)
      : 'a garment';

    const replicate = getClient();

    // IDM-VTON: https://replicate.com/cuuupid/idm-vton
    const prediction = await replicate.predictions.create({
      model: 'cuuupid/idm-vton',
      input: {
        human_img:    userImage,
        garm_img:     garmentImage,
        garment_des:  safeDesc,
        is_checked:       true,
        is_checked_crop:  false,
        denoise_steps:    30,
        seed:             42,
      },
    });

    // Fit score calculated server-side from measurements (no AI needed)
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

  // Replicate prediction IDs are alphanumeric, typically 24 chars
  if (!/^[a-zA-Z0-9]{10,64}$/.test(id)) {
    return Response.json({ error: 'Invalid prediction ID.' }, { status: 400 });
  }

  try {
    const replicate = getClient();
    const prediction = await replicate.predictions.get(id);
    return Response.json(prediction);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
