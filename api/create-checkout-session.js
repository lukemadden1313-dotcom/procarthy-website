import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({
      error: 'Server misconfigured: STRIPE_SECRET_KEY is not set in environment.',
    });
  }

  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided' });
    }

    // Never trust prices from the browser — we only pass Stripe price IDs, and
    // Stripe looks up the real amount server-side from the Price object.
    const validItems = items.filter(
      i => i && typeof i.priceId === 'string' && i.priceId && !i.priceId.startsWith('REPLACE_')
    );

    const lineItems = validItems.map(i => ({
      price: i.priceId,
      quantity: Math.max(1, Math.min(99, parseInt(i.qty, 10) || 1)),
    }));

    if (lineItems.length === 0) {
      return res.status(400).json({ error: 'No valid line items' });
    }

    // Stripe Checkout doesn't support per-line metadata, so we summarize sized
    // line items two ways: structured metadata (for export/automation) and a
    // human-readable description on the PaymentIntent. The description appears
    // at the top of every Payment record in the Stripe dashboard, so sizes
    // aren't buried under the Metadata section.
    const metadata = {};
    const summaryParts = [];
    validItems.forEach((i, idx) => {
      const displayName = String(i.name || '').slice(0, 80);
      const sku = String(i.sku || '').slice(0, 80);
      // Show the marketing name plus the Nike garment in brackets so fulfillment
      // knows exactly what to order, e.g. "Quarter Zip [Nike Dri-FIT Park 26]".
      const name = sku && sku !== displayName ? `${displayName} [${sku}]` : displayName;
      const qty = Math.max(1, Math.min(99, parseInt(i.qty, 10) || 1));
      // Variant attrs (color / print / size) — whichever are present.
      const attrs = [
        i.color ? `color ${i.color}` : '',
        i.print ? `print ${i.print}` : '',
        i.size ? `size ${i.size}` : '',
      ].filter(Boolean);
      const attrStr = attrs.join(', ');
      if (attrStr) {
        metadata[`item_${idx + 1}`] = `${name} | ${attrStr} | qty ${qty}`.slice(0, 500);
        summaryParts.push(`${name} (${attrStr}) x${qty}`);
      } else {
        summaryParts.push(`${name} x${qty}`);
      }
    });
    const description = summaryParts.join('; ').slice(0, 500);
    const hasSizes = Object.keys(metadata).length > 0;

    const origin = req.headers.origin || `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: `${origin}/shop.html?checkout=success`,
      cancel_url: `${origin}/shop.html?checkout=cancel`,
      shipping_address_collection: { allowed_countries: ['US', 'CA'] },
      phone_number_collection: { enabled: true },
      allow_promotion_codes: true,
      ...(hasSizes ? { metadata } : {}),
      payment_intent_data: {
        description,
        ...(hasSizes ? { metadata } : {}),
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('create-checkout-session error', err);
    // Surface the actual Stripe error so we don't have to dig through Vercel logs.
    // Stripe error messages are user-safe and don't leak secrets.
    return res.status(500).json({
      error: 'Failed to create checkout session',
      detail: err && err.message ? err.message : String(err),
      type: err && err.type ? err.type : undefined,
      code: err && err.code ? err.code : undefined,
    });
  }
}
