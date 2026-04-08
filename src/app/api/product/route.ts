import * as cheerio from 'cheerio';

// ─── Affiliate tag ────────────────────────────────────────────────────────────
const AMAZON_AFFILIATE_TAG = '97870-21';

function buildAffiliateLink(rawUrl: string): string | null {
  try {
    const match = rawUrl.match(/\/dp\/([A-Z0-9]{10})/i);
    if (!match) return null;
    return `https://www.amazon.in/dp/${match[1]}?tag=${AMAZON_AFFILIATE_TAG}`;
  } catch { return null; }
}

// ─── Normalisation helpers ────────────────────────────────────────────────────
function detectCategory(title: string): 'top' | 'bottom' | 'full' {
  const t = title.toLowerCase();
  if (/pant|jean|trouser|short|skirt|legging|chino/.test(t)) return 'bottom';
  if (/dress|suit|co-ord|coord|jumpsuit|dungaree|saree|kurta set/.test(t)) return 'full';
  return 'top'; // default: shirt, t-shirt, jacket, hoodie, etc.
}

function detectFit(title: string): 'slim' | 'regular' | 'oversized' {
  const t = title.toLowerCase();
  if (/slim|skinny|fitted/.test(t))     return 'slim';
  if (/oversized|baggy|loose|relaxed/.test(t)) return 'oversized';
  return 'regular';
}

function detectFabric(title: string): string {
  const t = title.toLowerCase();
  if (/cotton/.test(t)) return 'cotton';
  if (/poly|polyester/.test(t)) return 'polyester';
  if (/linen/.test(t)) return 'linen';
  if (/denim/.test(t)) return 'denim';
  return 'blend';
}

// Block obviously non-product URLs
const ALLOWED_HOSTS = /\.(amazon\.|flipkart\.|myntra\.|ajio\.|meesho\.|nordstrom\.|zara\.|hm\.|uniqlo\.|asos\.|shopify\.com|shopifypreview\.com|cdn\.|static\.|media\.)/i;
const URL_RE = /^https?:\/\/.{4,}/;

export async function POST(req: Request) {
  try {
    const body = await req.json() as { url?: string };
    const rawUrl = (body.url ?? '').trim();

    if (!URL_RE.test(rawUrl)) {
      return Response.json({ error: 'Please provide a valid product URL.' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      return Response.json({ error: 'Invalid URL format.' }, { status: 400 });
    }

    // Only allow http/https
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return Response.json({ error: 'URL must use http or https.' }, { status: 400 });
    }

    const fetchRes = await fetch(rawUrl, {
      headers: {
        // Mimic a real browser to avoid bot blocks
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });

    if (!fetchRes.ok) {
      return Response.json(
        { error: `Could not fetch the product page (HTTP ${fetchRes.status}). The site may block scraping. Try copying the direct image URL instead.` },
        { status: 502 },
      );
    }

    const html = await fetchRes.text();
    const $ = cheerio.load(html);

    // Cascade of selectors — covers Amazon, Myntra, AJIO, Flipkart, generic OG
    const imageUrl =
      // Amazon
      $('#landingImage').attr('src') ||
      $('#imgTagWrapperId img').attr('src') ||
      $('#main-image-container img').attr('src') ||
      // Myntra
      $('img.image-grid-image').first().attr('src') ||
      $('img[class*="product"]').first().attr('src') ||
      // AJIO
      $('img.rilrtl-lazy-img').first().attr('src') ||
      // Flipkart
      $('img._396cs4').first().attr('src') ||
      $('img._2r_T1I').first().attr('src') ||
      // Open Graph (universal fallback)
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('meta[itemprop="image"]').attr('content') ||
      // Last resort: first big img
      $('img[width][height]').filter((_, el) => {
        const w = parseInt($(el).attr('width') ?? '0');
        const h = parseInt($(el).attr('height') ?? '0');
        return w >= 200 && h >= 200;
      }).first().attr('src');

    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="title"]').attr('content') ||
      $('title').text().trim().split(' | ')[0].split(' - ')[0] ||
      'Product';

    if (!imageUrl) {
      return Response.json(
        { error: 'Could not extract a product image from this URL. Try pasting the direct image URL in the garment image field instead.' },
        { status: 422 },
      );
    }

    // Resolve relative URLs
    const absoluteImage = imageUrl.startsWith('/')
      ? `${parsedUrl.origin}${imageUrl}`
      : imageUrl;

    const cleanTitle = title.slice(0, 120);
    const affiliateUrl = buildAffiliateLink(rawUrl) ?? rawUrl;

    return Response.json({
      imageUrl:     absoluteImage,
      title:        cleanTitle,
      affiliateUrl,
      // Normalised product metadata (used by recommendation engine)
      category:     detectCategory(cleanTitle),
      fit:          detectFit(cleanTitle),
      fabric:       detectFabric(cleanTitle),
      stretch:      cleanTitle.toLowerCase().includes('stretch'),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.includes('timeout') || msg.includes('AbortError');
    return Response.json(
      { error: isTimeout ? 'The product page took too long to load. Try a different URL.' : `Failed to fetch product: ${msg}` },
      { status: 500 },
    );
  }
}
