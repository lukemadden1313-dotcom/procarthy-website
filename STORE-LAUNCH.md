# ProCarthy Store — Go-Live Runbook

_Updated after the call with Eduardo._

How money flows: a customer checks out → our Vercel function `/api/create-checkout-session`
builds a **Stripe Checkout** session using the **price IDs** in `shop.html` → Stripe charges
the card → funds land in whatever Stripe account owns the **`STRIPE_SECRET_KEY`** we set in Vercel.
So the two things that make it "ProCarthy's store": (1) the secret key is ProCarthy's Stripe
account, and (2) the price IDs come from that same account.

We will do **TEST mode first**, verify a full purchase with a test card, then flip to **LIVE**.

---

## People & roles (from the call)

- **Eduardo** — apparel partner (custom uniforms/gear for clubs & coaches; long history with Dan).
  Creates the **product mockups + images** and sends them to Luke. Helps **set up ProCarthy's Stripe account**.
  Does **not** build the store — we're using the store Luke already built (this repo).
- **Luke (Ralle)** — owns the website. Uploads images, adds products to the site, **creates/links the
  Stripe product IDs**, sets the key in Vercel, and **runs the test transactions**.
- **Vinnie (Vincent)** — handles **inventory** (sizes, quantities) and **places the orders** with the
  apparel supplier. Coordinates with Luke on Stripe setup. Likely the account holder / point person for
  ProCarthy's Stripe.
- **Dan's team (ProCarthy)** — the client. **Does not have a Stripe account yet — one needs to be created.**

> Note: the website has **no inventory tracking** — it won't stop overselling. Sizes/quantities are
> managed by Vinnie off-platform. Fine for limited drops; flag if you need live stock counts.

---

## What's already built
- ✅ Store page with products, cart drawer, size picker, quick-view modal (`shop.html`)
- ✅ Cart + checkout logic (`js/shop.js`), store styles (`css/shop.css`)
- ✅ Stripe checkout serverless function (`api/create-checkout-session.js`)
- ✅ `package.json` (adds the Stripe library on Vercel), `.env.example`, `.gitignore`
- ✅ Deployed on the **`store-launch`** branch (Vercel preview URL) — `main`/procarthy.com untouched
- ⏳ Placeholders to replace: product **names, prices, images, and Stripe price IDs**

---

## PART A — Create ProCarthy's Stripe account  *(Eduardo helps + Vinnie)*

1. Create ProCarthy's Stripe account at https://dashboard.stripe.com (Vinnie as account holder / point person).
2. Add business details, then **connect ProCarthy's bank account**
   (Settings → Business → Bank accounts & payouts). Payouts can't happen until this is done.
   Full bank verification can take a day or two; you can still test and take payments meanwhile —
   funds just hold until verified.

## PART B — Products & mockups  *(Eduardo → Luke; Luke creates Stripe prices)*

3. **Eduardo:** send Luke the **product mockups + images** and the list of items
   (name, price, available sizes).
4. **Luke:** in Stripe (**Test mode** first — toggle top-right), create a **Product + one-time Price**
   for each item (Product catalog → Add product). After saving, open each price and copy its
   **Price ID** — looks like `price_1QAbc...`.
   - ⚠️ Price IDs are **different in test vs live** — we repeat this in live mode later.

## PART C — Wire up the site  *(Luke)*

5. **Add the secret key to Vercel** (this routes money to ProCarthy):
   - Vercel → `procarthy-website` project → Settings → **Environment Variables**
   - Add `STRIPE_SECRET_KEY` = the `sk_test_...` key (Developers → API keys in Stripe).
   - **Enable it for the Preview environment** too, so the `store-launch` branch can be tested.
   - **Redeploy** afterward so the function picks it up.
6. **Paste the price IDs** into `shop.html` — each product has `data-stripe-price-id="REPLACE_price_..."`;
   replace with the real `price_...` ID. *(Claude can do this in seconds from Eduardo's list.)*
7. **Add real product info + images:** real names, prices (`data-product-price` is in **cents** —
   $65.00 = `6500`), sizes, and swap the placeholder images in `images/shop/` for Eduardo's.
8. **Push** → Vercel redeploys the `store-launch` preview (~1–2 min).

## PART D — Test the full flow  *(Luke — still in TEST mode)*

9. On the preview URL `/shop.html`, add an item, open cart, click **Checkout**.
10. Pay with the **test card**: `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.
11. Confirm: redirected back to `…/shop.html?checkout=success`, "Order confirmed" toast shows, cart empties.
12. In Stripe (test) → **Payments**: confirm the payment, amount, and that the item/size shows in the
    payment description.

## PART E — Flip to LIVE

13. **Luke:** in Stripe switch to **Live**, recreate the Products/Prices (or "Copy to live"),
    grab the **live** `price_...` IDs and the **live** `sk_live_...` key.
14. **Luke:** in Vercel set `STRIPE_SECRET_KEY` to the `sk_live_...` value → **Redeploy**.
15. **Luke:** replace the price IDs in `shop.html` with the **live** ones.
16. **Merge `store-launch` → `main`** so the store goes live on procarthy.com.
17. **Smoke test with a real card**, confirm it lands in Stripe (live) Payments, then **refund it**.
18. 🎉 Store is live.

---

## Next steps (owners)
- [ ] **Eduardo:** send product mockup images + item list (name/price/sizes) to Luke
- [ ] **Eduardo + Vinnie:** create ProCarthy's Stripe account + connect bank
- [ ] **Luke:** connect with Vinnie on inventory and the overall store plan
- [ ] **Luke:** create Stripe products/prices, wire IDs + images into the site, set Vercel key
- [ ] **Luke:** run test transaction (`4242…`), then go live + real-card smoke test/refund

---

## Decisions still open
- **Shipping:** checkout collects a US/Canada address but charges **$0 shipping**.
  Decide: free / flat rate / Stripe shipping rates? (Easy to add — tell Claude the amount.)
- **Sales tax:** off. Turn on **Stripe Tax** if ProCarthy needs to collect it.
- **Fulfillment:** Vinnie places orders with the supplier; sizes are in each Stripe payment's
  description. Decide who watches the Stripe dashboard / gets order notifications.
- **Inventory:** no stock limits on the site — Vinnie manages sizes/quantities manually.

## Secret-key hygiene
Never commit `sk_...` keys or put them in HTML/JS. They live **only** in Vercel env vars.
`.gitignore` already blocks `.env` files. Share keys privately (Signal/1Password), not public channels.
