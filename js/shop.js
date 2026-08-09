/* ============================================
   PROCARTHY — Shop cart + Stripe checkout
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('productGrid');
  if (!grid) return; // not the shop page

  const CART_KEY = 'procarthy_cart_v1';

  const cartDrawer = document.getElementById('cartDrawer');
  const cartItemsEl = document.getElementById('cartItems');
  const cartEmptyEl = document.getElementById('cartEmpty');
  const cartSubtotalEl = document.getElementById('cartSubtotal');
  const cartCheckoutBtn = document.getElementById('cartCheckout');
  const cartErrorEl = document.getElementById('cartError');
  const cartCountEls = document.querySelectorAll('[data-cart-count]');
  const cartToggle = document.getElementById('cartToggle');

  // --- Build catalog from the DOM ---
  const catalog = {};
  document.querySelectorAll('.product-card').forEach(card => {
    catalog[card.dataset.productId] = {
      id: card.dataset.productId,
      name: card.dataset.productName || '',
      price: parseInt(card.dataset.productPrice, 10) || 0, // cents
      stripePriceId: card.dataset.stripePriceId || '',
      image: card.dataset.productImage || '',
      images: (card.dataset.productImages || card.dataset.productImage || '')
        .split(',').map(s => s.trim()).filter(Boolean),
      sizes: (card.dataset.productSizes || '').split(',').map(s => s.trim()).filter(Boolean),
      description: card.dataset.productDescription || '',
    };
  });

  const formatUSD = cents => '$' + (cents / 100).toFixed(2);

  function loadCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      // drop any lines whose product no longer exists
      return Array.isArray(parsed) ? parsed.filter(i => catalog[i.id]) : [];
    } catch { return []; }
  }
  function saveCart() { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }
  let cart = loadCart();

  // A line is uniquely identified by (productId, size) so S and M are separate rows.
  const sameLine = (a, b) => a.id === b.id && (a.size || '') === (b.size || '');

  function updateCartCount() {
    const count = cart.reduce((n, i) => n + i.qty, 0);
    cartCountEls.forEach(el => { el.textContent = String(count); });
  }

  function renderCart() {
    if (!cartItemsEl) return;
    cartItemsEl.innerHTML = '';
    let subtotal = 0;
    cart.forEach(item => {
      const product = catalog[item.id];
      if (!product) return;
      subtotal += product.price * item.qty;
      const li = document.createElement('li');
      li.className = 'cart-item';
      li.dataset.id = item.id;
      li.dataset.size = item.size || '';
      const sizeLabel = item.size ? `<span class="cart-item__size">Size ${item.size}</span>` : '';
      li.innerHTML = `
        <div class="cart-item__img" style="background-image:url('${product.image}')"></div>
        <div>
          <p class="cart-item__name">${product.name}</p>
          ${sizeLabel}
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

  function addToCart(productId, size) {
    const ref = { id: productId, size: size || '' };
    const existing = cart.find(i => sameLine(i, ref));
    if (existing) existing.qty = Math.min(99, existing.qty + 1);
    else cart.push({ id: productId, qty: 1, size: size || '' });
    saveCart();
    renderCart();
  }
  function changeQty(ref, delta) {
    const item = cart.find(i => sameLine(i, ref));
    if (!item) return;
    item.qty += delta;
    if (item.qty < 1) cart = cart.filter(i => !sameLine(i, ref));
    saveCart();
    renderCart();
  }
  function removeLine(ref) {
    cart = cart.filter(i => !sameLine(i, ref));
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

  // Cart item row interactions (delegated)
  if (cartItemsEl) {
    cartItemsEl.addEventListener('click', e => {
      const li = e.target.closest('.cart-item');
      if (!li) return;
      const ref = { id: li.dataset.id, size: li.dataset.size };
      if (e.target.closest('[data-inc]')) changeQty(ref, 1);
      else if (e.target.closest('[data-dec]')) changeQty(ref, -1);
      else if (e.target.closest('[data-remove]')) removeLine(ref);
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
  const pmSizes = document.getElementById('productModalSizes');
  const pmSizesRow = document.getElementById('productModalSizesRow');

  let pmImages = [], pmIndex = 0, pmProductId = null, pmSizesAvail = [], pmSelectedSize = '';

  function updatePmAddState() {
    if (!pmAdd) return;
    const needsSize = pmSizesAvail.length > 0;
    pmAdd.disabled = needsSize && !pmSelectedSize;
    if (!pmAdd.classList.contains('is-added')) {
      pmAdd.textContent = (needsSize && !pmSelectedSize) ? 'Select a Size' : 'Add to Cart';
    }
  }
  function renderModalImage() {
    if (!pmImages.length) return;
    pmMainImg.style.backgroundImage = `url('${pmImages[pmIndex]}')`;
    pmThumbs.querySelectorAll('.product-modal__thumb').forEach((t, i) => t.classList.toggle('active', i === pmIndex));
    const single = pmImages.length <= 1;
    pmPrev.hidden = single; pmNext.hidden = single; pmThumbs.hidden = single;
  }
  function openProductModal(card) {
    if (!productModal || !card) return;
    const product = catalog[card.dataset.productId];
    pmProductId = product.id;
    pmImages = product.images.length ? product.images : [product.image];
    pmIndex = 0;
    pmName.textContent = product.name;
    pmPrice.textContent = formatUSD(product.price);
    pmDesc.textContent = product.description;
    pmThumbs.innerHTML = '';
    pmImages.forEach((src, i) => {
      const t = document.createElement('div');
      t.className = 'product-modal__thumb';
      t.style.backgroundImage = `url('${src}')`;
      t.addEventListener('click', () => { pmIndex = i; renderModalImage(); });
      pmThumbs.appendChild(t);
    });
    // sizes
    pmSizesAvail = product.sizes;
    pmSelectedSize = '';
    pmSizes.innerHTML = '';
    if (pmSizesAvail.length) {
      pmSizesRow.hidden = false;
      pmSizesAvail.forEach(sz => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'product-modal__size';
        b.textContent = sz;
        b.addEventListener('click', () => {
          pmSelectedSize = sz;
          pmSizes.querySelectorAll('.product-modal__size').forEach(x => x.classList.toggle('selected', x === b));
          updatePmAddState();
        });
        pmSizes.appendChild(b);
      });
    } else {
      pmSizesRow.hidden = true;
    }
    pmAdd.classList.remove('is-added');
    updatePmAddState();
    renderModalImage();
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
  if (pmPrev) pmPrev.addEventListener('click', () => { pmIndex = (pmIndex - 1 + pmImages.length) % pmImages.length; renderModalImage(); });
  if (pmNext) pmNext.addEventListener('click', () => { pmIndex = (pmIndex + 1) % pmImages.length; renderModalImage(); });
  document.querySelectorAll('[data-product-modal-close]').forEach(el => el.addEventListener('click', closeProductModal));
  if (pmAdd) pmAdd.addEventListener('click', () => {
    if (pmSizesAvail.length && !pmSelectedSize) return;
    addToCart(pmProductId, pmSelectedSize);
    pmAdd.classList.add('is-added');
    pmAdd.textContent = 'Added';
    setTimeout(() => { closeProductModal(); openCart(); pmAdd.classList.remove('is-added'); updatePmAddState(); }, 700);
  });

  // --- Product card clicks ---
  document.querySelectorAll('.product-card').forEach(card => {
    // Clicking the card opens the quick view
    card.addEventListener('click', e => {
      if (e.target.closest('.product-card__add')) return; // handled below
      openProductModal(card);
    });
  });
  document.querySelectorAll('.product-card__add').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const card = btn.closest('.product-card');
      const product = catalog[card.dataset.productId];
      // Sized products must pick a size — funnel to the modal.
      if (product.sizes.length) { openProductModal(card); return; }
      addToCart(product.id);
      btn.classList.add('is-added');
      btn.textContent = 'Added';
      setTimeout(() => { btn.classList.remove('is-added'); btn.textContent = 'Add to Cart'; }, 1200);
      openCart();
    });
  });

  // --- Checkout ---
  if (cartCheckoutBtn) {
    cartCheckoutBtn.addEventListener('click', async () => {
      if (cart.length === 0) return;
      const items = cart.map(i => ({
        priceId: catalog[i.id].stripePriceId,
        qty: i.qty,
        size: i.size || '',
        name: catalog[i.id].name,
      }));
      // Refuse to call Stripe with placeholder IDs — surfaces config errors early.
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
    if (toast) {
      toast.hidden = false;
      setTimeout(() => { toast.hidden = true; }, 6000);
    }
    if (typeof gtag === 'function') gtag('event', 'purchase_complete');
    // clean the URL so a refresh doesn't re-show the toast
    window.history.replaceState({}, '', window.location.pathname);
  } else if (checkoutState === 'cancel') {
    openCart();
    window.history.replaceState({}, '', window.location.pathname);
  }
});
