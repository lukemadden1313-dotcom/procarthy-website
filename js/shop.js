/* ============================================
   PROCARTHY — Shop cart + Stripe checkout
   Products have Color + Print (Original/Pink Print) + Size variants.
   All variants of a product share ONE price / Stripe price ID; the chosen
   color/print/size ride to Stripe as metadata so Vincent sees what to order.
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('productGrid');
  if (!grid) return; // not the shop page

  const CART_KEY = 'procarthy_cart_v2';

  const COLOR_HEX = {
    'Black': '#1c1c1c', 'Grey': '#9b9b9b', 'White': '#f2f2f2',
    'Pink': '#e6007e', 'Turquoise': '#17b3ac', 'Light Blue': '#7fbce6',
  };

  const cartDrawer = document.getElementById('cartDrawer');
  const cartItemsEl = document.getElementById('cartItems');
  const cartEmptyEl = document.getElementById('cartEmpty');
  const cartSubtotalEl = document.getElementById('cartSubtotal');
  const cartCheckoutBtn = document.getElementById('cartCheckout');
  const cartErrorEl = document.getElementById('cartError');
  const cartCountEls = document.querySelectorAll('[data-cart-count]');
  const cartToggle = document.getElementById('cartToggle');

  const splitAttr = v => (v || '').split(',').map(s => s.trim()).filter(Boolean);

  // --- Build catalog from the DOM ---
  const catalog = {};
  document.querySelectorAll('.product-card').forEach(card => {
    catalog[card.dataset.productId] = {
      id: card.dataset.productId,
      name: card.dataset.productName || '',
      sku: card.dataset.productSku || '', // Nike garment name, for fulfillment
      price: parseInt(card.dataset.productPrice, 10) || 0, // cents
      stripePriceId: card.dataset.stripePriceId || '',
      image: card.dataset.productImage || '',
      images: splitAttr(card.dataset.productImages || card.dataset.productImage),
      colors: splitAttr(card.dataset.productColors),
      womenOnlyColors: splitAttr(card.dataset.productWomenOnlyColors),
      womenSizes: splitAttr(card.dataset.productWomenSizes),
      prints: splitAttr(card.dataset.productPrints),
      sizes: splitAttr(card.dataset.productSizes),
      description: card.dataset.productDescription || '',
    };
  });

  const formatUSD = cents => '$' + (cents / 100).toFixed(2);

  function loadCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(i => catalog[i.id]) : [];
    } catch { return []; }
  }
  function saveCart() { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }
  let cart = loadCart();

  // A cart line is unique per (product, color, print, size).
  const sameLine = (a, b) =>
    a.id === b.id && (a.color||'') === (b.color||'') &&
    (a.print||'') === (b.print||'') && (a.size||'') === (b.size||'');

  const variantLabel = i => [i.color, i.print, i.size].filter(Boolean).join(' · ');

  function updateCartCount() {
    const count = cart.reduce((n, i) => n + i.qty, 0);
    cartCountEls.forEach(el => { el.textContent = String(count); });
  }

  function renderCart() {
    if (!cartItemsEl) return;
    cartItemsEl.innerHTML = '';
    let subtotal = 0;
    cart.forEach((item, idx) => {
      const product = catalog[item.id];
      if (!product) return;
      subtotal += product.price * item.qty;
      const li = document.createElement('li');
      li.className = 'cart-item';
      li.dataset.idx = idx;
      li.innerHTML = `
        <div class="cart-item__img" style="background-image:url('${product.image}')"></div>
        <div>
          <p class="cart-item__name">${product.name}</p>
          <span class="cart-item__variant">${variantLabel(item)}</span>
          <span class="cart-item__price">${formatUSD(product.price)}</span>
          <div class="cart-item__qty">
            <button type="button" data-dec aria-label="Decrease">&minus;</button>
            <span>${item.qty}</span>
            <button type="button" data-inc aria-label="Increase">+</button>
          </div>
        </div>
        <button type="button" class="cart-item__remove" data-remove aria-label="Remove">&times;</button>`;
      cartItemsEl.appendChild(li);
    });
    if (cartEmptyEl) cartEmptyEl.hidden = cart.length > 0;
    if (cartSubtotalEl) cartSubtotalEl.textContent = formatUSD(subtotal);
    if (cartCheckoutBtn) cartCheckoutBtn.disabled = cart.length === 0;
    updateCartCount();
  }

  function addToCart(line) {
    const existing = cart.find(i => sameLine(i, line));
    if (existing) existing.qty = Math.min(99, existing.qty + 1);
    else cart.push({ ...line, qty: 1 });
    saveCart();
    renderCart();
  }

  function openCart() {
    if (!cartDrawer) return;
    cartDrawer.classList.add('open');
    cartDrawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeCart() {
    if (!cartDrawer) return;
    cartDrawer.classList.remove('open');
    cartDrawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (cartErrorEl) { cartErrorEl.hidden = true; cartErrorEl.textContent = ''; }
  }

  if (cartToggle) cartToggle.addEventListener('click', e => { e.preventDefault(); openCart(); });
  document.querySelectorAll('[data-cart-close]').forEach(el => el.addEventListener('click', closeCart));

  if (cartItemsEl) {
    cartItemsEl.addEventListener('click', e => {
      const li = e.target.closest('.cart-item');
      if (!li) return;
      const idx = parseInt(li.dataset.idx, 10);
      const item = cart[idx];
      if (!item) return;
      if (e.target.closest('[data-inc]')) item.qty = Math.min(99, item.qty + 1);
      else if (e.target.closest('[data-dec]')) { item.qty -= 1; if (item.qty < 1) cart.splice(idx, 1); }
      else if (e.target.closest('[data-remove]')) cart.splice(idx, 1);
      else return;
      saveCart();
      renderCart();
    });
  }

  // --- Product quick-view modal ---
  const productModal = document.getElementById('productModal');
  const pmMainImg = document.getElementById('productModalMainImg');
  const pmThumbs = document.getElementById('productModalThumbs');
  const pmName = document.getElementById('productModalName');
  const pmPrice = document.getElementById('productModalPrice');
  const pmDesc = document.getElementById('productModalDesc');
  const pmAdd = document.getElementById('productModalAdd');
  const pmPrev = document.getElementById('productModalPrev');
  const pmNext = document.getElementById('productModalNext');
  const pmColorRow = document.getElementById('pmColorRow');
  const pmColors = document.getElementById('pmColors');
  const pmColorVal = document.getElementById('pmColorVal');
  const pmPrintRow = document.getElementById('pmPrintRow');
  const pmPrints = document.getElementById('pmPrints');
  const pmSizeRow = document.getElementById('pmSizeRow');
  const pmSizes = document.getElementById('pmSizes');

  let pm = null; // { product, images, index, color, print, size }

  function pmAvailableSizes() {
    // Women-only colors (e.g. turquoise tee) restrict sizes to women's.
    if (pm.color && pm.product.womenOnlyColors.includes(pm.color) && pm.product.womenSizes.length) {
      return pm.product.womenSizes;
    }
    return pm.product.sizes;
  }
  function pmAvailablePrints() {
    // A pink garment can't take a pink print — offer Original only.
    if (pm.color === 'Pink') return pm.product.prints.filter(p => p !== 'Pink Print');
    return pm.product.prints;
  }

  function renderModalImage() {
    if (!pm.images.length) return;
    pmMainImg.style.backgroundImage = `url('${pm.images[pm.index]}')`;
    pmThumbs.querySelectorAll('.product-modal__thumb').forEach((t, i) => t.classList.toggle('active', i === pm.index));
    const single = pm.images.length <= 1;
    pmPrev.hidden = single; pmNext.hidden = single; pmThumbs.hidden = single;
  }

  function renderPills(container, values, selected, onPick) {
    container.innerHTML = '';
    values.forEach(v => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'product-modal__pill' + (v === selected ? ' selected' : '');
      b.textContent = v;
      b.addEventListener('click', () => onPick(v));
      container.appendChild(b);
    });
  }

  function renderColors() {
    pmColors.innerHTML = '';
    pm.product.colors.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'product-modal__swatch' + (c === pm.color ? ' selected' : '');
      b.title = c;
      b.setAttribute('aria-label', c);
      b.style.setProperty('--sw', COLOR_HEX[c] || '#888');
      b.addEventListener('click', () => {
        pm.color = c;
        // re-validate print + size against the new color
        if (!pmAvailablePrints().includes(pm.print)) pm.print = '';
        if (!pmAvailableSizes().includes(pm.size)) pm.size = '';
        renderVariantUI();
      });
      pmColors.appendChild(b);
    });
    pmColorVal.textContent = pm.color ? '— ' + pm.color : '';
  }

  function renderVariantUI() {
    renderColors();
    renderPills(pmPrints, pmAvailablePrints(), pm.print, v => { pm.print = v; renderVariantUI(); });
    renderPills(pmSizes, pmAvailableSizes(), pm.size, v => { pm.size = v; renderVariantUI(); });
    updateAddState();
  }

  function needs() {
    const missing = [];
    if (pm.product.colors.length && !pm.color) missing.push('color');
    if (pm.product.prints.length && !pm.print) missing.push('print');
    if (pm.product.sizes.length && !pm.size) missing.push('size');
    return missing;
  }
  function updateAddState() {
    const missing = needs();
    pmAdd.disabled = missing.length > 0;
    if (!pmAdd.classList.contains('is-added')) {
      pmAdd.textContent = missing.length ? 'Select ' + missing.join(', ') : 'Add to Cart';
    }
  }

  function openProductModal(card) {
    if (!productModal || !card) return;
    const product = catalog[card.dataset.productId];
    pm = {
      product,
      images: product.images.length ? product.images : [product.image],
      index: 0,
      color: product.colors.length === 1 ? product.colors[0] : '',
      print: '',
      size: '',
    };
    pmName.textContent = product.name;
    pmPrice.textContent = formatUSD(product.price);
    pmDesc.textContent = product.description;

    pmThumbs.innerHTML = '';
    pm.images.forEach((src, i) => {
      const t = document.createElement('div');
      t.className = 'product-modal__thumb';
      t.style.backgroundImage = `url('${src}')`;
      t.addEventListener('click', () => { pm.index = i; renderModalImage(); });
      pmThumbs.appendChild(t);
    });

    pmColorRow.hidden = !product.colors.length;
    pmPrintRow.hidden = !product.prints.length;
    pmSizeRow.hidden = !product.sizes.length;

    pmAdd.classList.remove('is-added');
    renderModalImage();
    renderVariantUI();

    productModal.classList.add('open');
    productModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeProductModal() {
    if (!productModal) return;
    productModal.classList.remove('open');
    productModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  if (pmPrev) pmPrev.addEventListener('click', () => { pm.index = (pm.index - 1 + pm.images.length) % pm.images.length; renderModalImage(); });
  if (pmNext) pmNext.addEventListener('click', () => { pm.index = (pm.index + 1) % pm.images.length; renderModalImage(); });
  document.querySelectorAll('[data-product-modal-close]').forEach(el => el.addEventListener('click', closeProductModal));

  if (pmAdd) pmAdd.addEventListener('click', () => {
    if (needs().length) return;
    addToCart({ id: pm.product.id, color: pm.color, print: pm.print, size: pm.size });
    pmAdd.classList.add('is-added');
    pmAdd.textContent = 'Added';
    setTimeout(() => { closeProductModal(); openCart(); pmAdd.classList.remove('is-added'); updateAddState(); }, 700);
  });

  // --- Product card clicks (whole card or button opens the modal) ---
  document.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => openProductModal(card));
  });

  // --- Checkout ---
  if (cartCheckoutBtn) {
    cartCheckoutBtn.addEventListener('click', async () => {
      if (cart.length === 0) return;
      const items = cart.map(i => ({
        priceId: catalog[i.id].stripePriceId,
        qty: i.qty,
        name: catalog[i.id].name,
        sku: catalog[i.id].sku,
        color: i.color || '',
        print: i.print || '',
        size: i.size || '',
      }));
      const missing = items.find(i => !i.priceId || i.priceId.startsWith('REPLACE_'));
      if (missing) {
        if (cartErrorEl) {
          cartErrorEl.hidden = false;
          cartErrorEl.textContent = 'Checkout is not configured yet. (Stripe price IDs pending.)';
        }
        return;
      }
      cartCheckoutBtn.classList.add('is-loading');
      cartCheckoutBtn.disabled = true;
      if (cartErrorEl) { cartErrorEl.hidden = true; cartErrorEl.textContent = ''; }
      try {
        const res = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        });
        if (!res.ok) throw new Error('Checkout failed (' + res.status + ')');
        const data = await res.json();
        if (!data.url) throw new Error('No checkout URL returned');
        window.location.href = data.url;
      } catch (err) {
        if (cartErrorEl) {
          cartErrorEl.hidden = false;
          cartErrorEl.textContent = 'Could not start checkout. Please try again.';
        }
        cartCheckoutBtn.classList.remove('is-loading');
        cartCheckoutBtn.disabled = false;
      }
    });
  }

  renderCart();

  // --- Checkout return state (Stripe redirects back with ?checkout=success|cancel) ---
  const params = new URLSearchParams(window.location.search);
  const checkoutState = params.get('checkout');
  if (checkoutState === 'success') {
    cart = [];
    saveCart();
    renderCart();
    const toast = document.getElementById('checkoutToast');
    if (toast) { toast.hidden = false; setTimeout(() => { toast.hidden = true; }, 6000); }
    if (typeof gtag === 'function') gtag('event', 'purchase_complete');
    window.history.replaceState({}, '', window.location.pathname);
  } else if (checkoutState === 'cancel') {
    openCart();
    window.history.replaceState({}, '', window.location.pathname);
  }
});
