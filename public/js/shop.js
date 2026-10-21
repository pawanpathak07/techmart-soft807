(async function () {
  await initPage({ active: 'shop' });

  const grid = document.getElementById('grid');
  const search = document.getElementById('search');
  const category = document.getElementById('category');
  let products = [];

  async function loadCategories() {
    const { categories } = await api('/products/meta/categories');
    category.innerHTML =
      '<option value="">All categories</option>' +
      categories.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  }

  async function load() {
    const qs = new URLSearchParams();
    if (search.value.trim()) qs.set('q', search.value.trim());
    if (category.value) qs.set('category', category.value);
    ({ products } = await api('/products?' + qs));
    render();
  }

  function stockText(p) {
    if (p.stock === 0) return '<span class="stock-out">Out of stock</span>';
    if (p.stock <= 5) return `<span class="stock-low">Only ${p.stock} left</span>`;
    return '<span class="muted small">In stock</span>';
  }

  function render() {
    if (!products.length) {
      grid.innerHTML = '<div class="empty card" style="grid-column:1/-1">No products match your search.</div>';
      return;
    }
    grid.innerHTML = products.map((p) => `
      <article class="card product">
        <div class="img">${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">` : '&#128722;'}</div>
        <div class="body">
          <div class="cat">${esc(p.category)}</div>
          <div class="name">${esc(p.name)}</div>
          <div class="rating-line">${p.rating_count ? `★ ${Number(p.rating_average).toFixed(1)} · ${p.rating_count} review${p.rating_count === 1 ? '' : 's'}` : 'No reviews yet'}</div>
          <div class="desc">${esc(p.description)}</div>
          ${stockText(p)}
          <div class="foot">
            <span class="price">${money(p.price)}</span>
            <button class="btn primary sm" data-add="${p.id}" ${p.stock === 0 ? 'disabled' : ''}>Add to cart</button>
          </div>
          <div class="rating-actions"><button class="btn sm" data-view-reviews="${p.id}">Read reviews</button><button class="btn sm" data-review="${p.id}">Rate product</button></div>
        </div>
      </article>`).join('');
  }

  grid.addEventListener('click', async (e) => {
    const viewBtn = e.target.closest('[data-view-reviews]');
    if (viewBtn) {
      const product = products.find((x) => x.id === Number(viewBtn.dataset.viewReviews));
      try {
        const { reviews, summary } = await api(`/products/${product.id}/reviews`);
        document.getElementById('reviewsTitle').textContent = `${product.name} — reviews`;
        const content = document.getElementById('reviewsContent');
        content.innerHTML = `<p class="rating-line">${summary.count ? `★ ${Number(summary.average).toFixed(1)} out of 5 · ${summary.count} review${summary.count === 1 ? '' : 's'}` : 'No reviews yet'}</p>` +
          (reviews.length ? reviews.map(r => `<article class="card" style="margin:10px 0;padding:14px"><strong>${esc(r.customer_name)}</strong> <span class="rating-line">★ ${r.rating}/5</span><p>${esc(r.comment || 'No written comment.')}</p><div class="muted small">${esc(dateText(r.created_at))}</div></article>`).join('') : '<p class="muted">Be the first to review this product.</p>');
        document.getElementById('reviewsDlg').showModal();
      } catch (err) { toast(err.message, 'error'); }
      return;
    }
    const reviewBtn = e.target.closest('[data-review]');
    if (reviewBtn) {
      const product = products.find((x) => x.id === Number(reviewBtn.dataset.review));
      try {
        const me = (await api('/auth/me')).user;
        if (!me) { location.href = '/login.html?next=' + encodeURIComponent(location.pathname); return; }
        if (me.role !== 'customer') { toast('Only customer accounts can review products', 'error'); return; }
        const ratingText = prompt(`Rate ${product.name} from 1 to 5 stars:`, '5');
        if (ratingText === null) return;
        const rating = Number(ratingText);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) { toast('Enter a whole number from 1 to 5', 'error'); return; }
        const comment = prompt('Optional review comment:', '') || '';
        await api(`/products/${product.id}/reviews`, { method: 'POST', body: { rating, comment } });
        toast('Thanks! Your review was saved.');
        await load();
      } catch (err) { toast(err.message, 'error'); }
      return;
    }
    const btn = e.target.closest('[data-add]');
    if (!btn) return;
    const p = products.find((x) => x.id === Number(btn.dataset.add));
    const inCart = (Cart.get().find((i) => i.id === p.id) || { qty: 0 }).qty;
    if (inCart >= p.stock) return toast(`You already have all ${p.stock} in your cart`, 'error');
    Cart.add(p);
    updateCartBadge();
    toast(`${p.name} added to cart`);
  });

  document.getElementById('closeReviews').addEventListener('click', () => document.getElementById('reviewsDlg').close());

  let timer;
  search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 250); });
  category.addEventListener('change', load);

  await loadCategories();
  await load();
})();
