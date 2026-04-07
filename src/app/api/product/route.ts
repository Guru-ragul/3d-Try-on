import * as cheerio from 'cheerio';

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

    return Response.json({ imageUrl: absoluteImage, title: title.slice(0, 120) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.includes('timeout') || msg.includes('AbortError');
    return Response.json(
      { error: isTimeout ? 'The product page took too long to load. Try a different URL.' : `Failed to fetch product: ${msg}` },
      { status: 500 },
    );
  }
}
