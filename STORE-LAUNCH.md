# ProCarthy Store — Go-Live Runbook

How money flows: a customer checks out → our Vercel function `/api/create-checkout-session`
builds a **Stripe Checkout** session using the **price IDs** in `shop.html` → Stripe charges
the card → funds land in whatever Stripe account owns the **`STRIPE_SECRET_KEY`** we set in Vercel.
So the two things that make it "ProCarthy's store": (1) the secret key is ProCarthy's Stripe
account, and (2) the price IDs come from that same account.

We will do **TEST mode first**, verify a full purchase with a test card, then flip to **LIVE**.

---

## What's already built (done before the call)
- ✅ Store page with 4 products, cart drawer, size picker, quick-view modal (`shop.html`)
- ✅ Cart + checkout logic (`js/shop.js`), store styles (`css/shop.css`)
- ✅ Stripe checkout serverless function (`api/create-checkout-session.js`)
- ✅ `package.json` (adds the Stripe library on Vercel), `.env.example`, `.gitignore`
- ⏳ Placeholders to replace: product **names, prices, images, and Stripe price IDs**

---

## PART A — Eduardo (Stripe side)

1. **Create/log into ProCarthy's Stripe account** at https://dashboard.stripe.com
   - Business details, then **connect ProCarthy's bank account** (Settings → Business → Bank accounts & payouts). Payouts can't happen until this is done.
   - Note: full bank verification can take a day or two, but you can still test and even take live payments; funds just hold until the bank is verified.

2. **Turn on TEST mode** (toggle, top-right of the Stripe dashboard).

3. **Create a Product + Price for each item** (Product catalog → Add product):
   - Name (e.g., "Training Top"), image, and a **one-time price** in USD.
   - After saving, open the price and copy its **Price ID** — it looks like `price_1QAbc...`.
   - Do this for every item. Give Luke the list: **product name → price ID**.
   - ⚠️ Price IDs are **different in test vs live** — we'll repeat this in live mode later.

4. **Get the TEST secret key**: Developers → API keys → copy **Secret key** (`sk_test_...`).
   Send it to Luke privately (Signal/1Password/etc.), **not** in a public channel.

*(Later, for live: repeat steps 3–4 in LIVE mode to get `price_...` live IDs and the `sk_live_...` key.)*

---

## PART B — Luke (site + Vercel side)

5. **Add the secret key to Vercel** (this is what routes money to ProCarthy):
   - Vercel → the `procarthy-website` project → Settings → **Environment Variables**
   - Add `STRIPE_SECRET_KEY` = the `sk_test_...` from Eduardo → Save.
   - **Redeploy** afterward (Deployments → ⋯ → Redeploy) so the function picks it up.

6. **Paste the price IDs into the site.** In `shop.html`, each product has
   `data-stripe-price-id="REPLACE_price_..."`. Replace each with the real `price_...` ID from Eduardo.
   *(Claude can do this in seconds once you have the list.)*

7. **Add real product info** while we're in there: real names, prices (`data-product-price` is in **cents** — $65.00 = `6500`), sizes, and swap the placeholder images in `images/shop/`.

8. **Push to `main`** → Vercel auto-deploys (~1–2 min).

---

## PART C — Test the full flow (still in TEST mode)

9. Go to the live URL `/shop.html`, add an item, open cart, click **Checkout**.
10. On Stripe's checkout page, pay with the **test card**: `4242 4242 4242 4242`, any future
    expiry, any CVC, any ZIP.
11. Confirm: you're redirected back to `…/shop.html?checkout=success`, the "Order confirmed"
    toast shows, and the cart empties.
12. In Stripe (test mode) → **Payments**: confirm the payment appears with the right amount, and
    the item/size shows in the payment description.

If all good → proceed to go live.

---

## PART D — Flip to LIVE

13. Eduardo: switch Stripe to **LIVE**, recreate the Products/Prices (or "Copy to live"),
    send Luke the **live** `price_...` IDs and the **live** `sk_live_...` key.
14. Luke: in Vercel, change `STRIPE_SECRET_KEY` to the `sk_live_...` value → **Redeploy**.
15. Luke: replace the price IDs in `shop.html` with the **live** ones → push.
16. **Smoke test with a real card**: buy the cheapest item, confirm it lands in Stripe (live)
    Payments, then **refund it** from the Stripe dashboard.
17. 🎉 Store is live.

---

## Go-live checklist
- [ ] ProCarthy Stripe account created + bank connected
- [ ] Products/prices created in Stripe (test) → price IDs sent to Luke
- [ ] `STRIPE_SECRET_KEY` (test) set in Vercel + redeployed
- [ ] Real names/prices/images/price IDs in `shop.html`
- [ ] Test purchase with `4242…` succeeds end-to-end
- [ ] Switched to live key + live price IDs, redeployed
- [ ] Real-card smoke test + refund
- [ ] Shipping/returns policy decided (see notes)

---

## Notes / decisions to make
- **Shipping:** checkout currently collects a US/Canada shipping address but charges **$0 shipping**.
  Decide: free shipping, flat rate, or Stripe shipping rates? (Easy to add — tell Claude the amount.)
- **Sales tax:** not enabled. If ProCarthy needs to collect tax, we can turn on **Stripe Tax**.
- **Who fulfills orders?** Stripe emails receipts automatically; someone needs to watch the Stripe
  dashboard (or set up email/Slack notifications) and ship orders. Sizes are in each payment's description.
- **Inventory:** this build has no stock limits — it won't stop overselling. Fine for limited drops;
  flag if you need stock counts.
- **Secret key hygiene:** never commit `sk_...` keys or put them in the HTML/JS. They live **only**
  in Vercel env vars. The `.gitignore` already blocks `.env` files.
