/* ═══════════════════════════════════════════════════════════
   OLIVE TRADE B2B DASHBOARD — app.js
   Fixed: DOMContentLoaded wrap · switchTab · error handling
   Supabase v2 · Real-time · Tab navigation · Modals
═══════════════════════════════════════════════════════════

   ⚠️  SECURITY REMINDER — SUPABASE ROW LEVEL SECURITY (RLS):
   ─────────────────────────────────────────────────────────
   If this dashboard shows no data even though rows exist in
   your tables, it is almost certainly because RLS is enabled
   and there is no policy allowing the 'anon' role to SELECT.

   To fix it, go to your Supabase project and do ONE of these:

   OPTION A — Quick (for development/trusted dashboards):
     Table Editor → your table → RLS → "Disable RLS"

   OPTION B — Proper policy (recommended for production):
     SQL Editor → run for EACH table (sellers, factories_orders, stores):

       CREATE POLICY "Public read access"
       ON public.sellers          -- change table name for each
       FOR SELECT
       TO anon
       USING (true);

   Without one of the above, the anon key will always get
   an empty [] result — NOT an error — which looks like
   "No records found" in the UI.
═══════════════════════════════════════════════════════════ */

// ── 1. CONSTANTS ─────────────────────────────────────────
const SUPABASE_URL  = 'https://vmnybntataouvqewquul.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtbnlibnRhdGFvdXZxZXdxdXVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0ODUxMzMsImV4cCI6MjA5NjA2MTEzM30.zMr1xngZH7p2b02eSXlJVJHD5PzxUZCGXX3y4WKOUjk';

const OLIVE_IMAGES = {
  kalamata:   'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&q=80',
  toffahi:    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
  arbequina:  'https://images.unsplash.com/photo-1601579112934-17ac2aa86292?w=600&q=80',
  manzanilla: 'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?w=600&q=80',
  picholine:  'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=600&q=80',
  mission:    'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=600&q=80',
  default:    'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&q=80',
};

// ✅ FIX 1: Wrap everything inside DOMContentLoaded so the DOM is fully
//    ready before any getElementById / querySelector calls are made.
document.addEventListener('DOMContentLoaded', async () => {

  console.log('✅ DOM ready — starting Olive Trade dashboard');

  // ── 2. SUPABASE INIT ────────────────────────────────────
  let db = null;

  function initSupabase() {
    console.log('Initializing Supabase client…');
    if (typeof supabase === 'undefined' || typeof supabase.createClient !== 'function') {
      throw new Error('Supabase SDK not loaded. Check the CDN <script> in <head>.');
    }
    db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    console.log('✅ Supabase client created successfully.');
    return db;
  }

  // ── 3. HELPERS ──────────────────────────────────────────
  function getOliveImage(oliveType) {
    if (!oliveType) return OLIVE_IMAGES.default;
    const key = oliveType.toLowerCase();
    for (const [name, url] of Object.entries(OLIVE_IMAGES)) {
      if (key.includes(name)) return url;
    }
    return OLIVE_IMAGES.default;
  }

  function cleanPhone(phone) {
    if (!phone) return null;
    return String(phone).replace(/\D/g, '');
  }

  function formatNumber(val, unit = '') {
    if (val === null || val === undefined || val === '') return '—';
    return `${Number(val).toLocaleString()}${unit}`;
  }

  function nowTimestamp() {
    return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  function setLastUpdated() {
    const el = document.getElementById('lastUpdated');
    if (el) el.textContent = `Updated ${nowTimestamp()}`;
  }

  function showError(msg) {
    const banner = document.getElementById('errorBanner');
    const msgEl  = document.getElementById('errorMsg');
    if (banner && msgEl) {
      msgEl.textContent = msg;
      banner.classList.remove('hidden');
    }
    console.error('[OliveTrade ERROR]', msg);
  }

  function hideError() {
    const banner = document.getElementById('errorBanner');
    if (banner) banner.classList.add('hidden');
  }

  function setCount(tabKey, n) {
    const el = document.getElementById(`count-${tabKey}`);
    if (el) el.textContent = n;
  }

  // ── 4. MODAL ────────────────────────────────────────────
  // ✅ FIX 4: All modal elements are retrieved INSIDE DOMContentLoaded
  const modalOverlay = document.getElementById('modalOverlay');
  const modalBody    = document.getElementById('modalBody');
  const modalClose   = document.getElementById('modalClose');

  function openModal(html) {
    console.log('Opening modal…');
    modalBody.innerHTML = html;
    modalOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modalOverlay.classList.add('hidden');
    document.body.style.overflow = '';
  }

  modalClose.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Expose closeModal globally for inline onclick in modal HTML
  window.closeModal = closeModal;

  // ── 5. TAB NAVIGATION ───────────────────────────────────
  // ✅ FIX 2: Single switchTab() function that handles everything

  // Maps tab name → { fetchFn, gridId, countKey }
  const TAB_CONFIG = {
    sellers:   { fetchFn: () => fetchSellers(),   gridId: 'grid-sellers',   countKey: 'sellers'   },
    factories: { fetchFn: () => fetchFactories(), gridId: 'grid-factories', countKey: 'factories' },
    stores:    { fetchFn: () => fetchStores(),    gridId: 'grid-stores',    countKey: 'stores'    },
  };

  let activeTab = 'sellers'; // track current tab

  async function switchTab(tabName) {
    console.log(`Switching to tab: "${tabName}"`);

    if (!TAB_CONFIG[tabName]) {
      console.warn(`Unknown tab: "${tabName}"`);
      return;
    }

    // a) Remove 'active' from ALL tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    // b) Hide ALL panels
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));

    // c) Mark the correct button as active
    const activeBtn = document.getElementById(`tab-${tabName}`);
    if (activeBtn) activeBtn.classList.add('active');

    // d) Show the correct panel
    const activePanel = document.getElementById(`panel-${tabName}`);
    if (activePanel) activePanel.classList.add('active');

    // e) Clear the grid and show skeletons while loading
    const { gridId, fetchFn } = TAB_CONFIG[tabName];
    const grid = document.getElementById(gridId);
    if (grid) {
      grid.innerHTML = `
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>`;
    }

    activeTab = tabName;

    // f) Call the dedicated fetch function for this tab
    await fetchFn();
  }

  // Wire up tab buttons — listen for clicks and call switchTab
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      console.log(`Tab button clicked: "${tab}"`);
      switchTab(tab);
    });
  });

  // ── 6. CARD RENDERERS ────────────────────────────────────

  /* 6a — SELLERS */
  function renderSellerCard(row) {
    const img      = getOliveImage(row.olive_type);
    const phone    = cleanPhone(row.phone);
    const waLink   = phone ? `https://wa.me/${phone}` : '#';
    const tons     = formatNumber(row.amount_tons, ' T');
    const price    = row.price_per_ton ? `$${formatNumber(row.price_per_ton)}/T` : '—';
    const oliveLbl = row.olive_type || 'Olive';
    const rowJson  = JSON.stringify(row).replace(/'/g, "\\'");

    return `
      <div class="card" data-type="seller">
        <img class="card-image" src="${img}" alt="${oliveLbl}" loading="lazy"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="card-image-placeholder" style="display:none">🫒</div>
        <div class="card-body">
          <div class="card-top-row">
            <span class="order-id-badge">SE-${row.id}</span>
            <span class="card-type-badge">🫒 ${oliveLbl}</span>
          </div>
          <h3 class="card-name">${row.name || 'Unknown Seller'}</h3>
          ${row.location ? `<p class="card-location">${row.location}</p>` : ''}
          <div class="card-badges">
            <span class="badge badge-tons">⚖️ ${tons}</span>
            <span class="badge badge-price">💰 ${price}</span>
          </div>
          <div class="card-actions">
            <button class="btn btn-details" onclick='openSellerModal(${JSON.stringify(JSON.stringify(row))})'>
              🔍 Full Details
            </button>
            ${phone
              ? `<a class="btn btn-whatsapp" href="${waLink}" target="_blank" rel="noopener">💬 WhatsApp</a>`
              : `<span class="btn btn-whatsapp" style="opacity:0.4;cursor:not-allowed">No Phone</span>`}
          </div>
        </div>
      </div>`;
  }

  function openSellerModal(jsonStr) {
    const row = JSON.parse(jsonStr);
    const phone = cleanPhone(row.phone);
    const waLink = phone ? `https://wa.me/${phone}` : null;
    openModal(`
      <div class="modal-header">
        <div class="modal-emoji">🧑‍🌾</div>
        <div class="modal-title">${row.name || 'Unknown Seller'}</div>
        <div class="modal-subtitle">Olive Seller Profile &nbsp;·&nbsp; <span style="color:var(--gold-lt);font-weight:700">SE-${row.id}</span></div>
      </div>
      <div class="modal-grid">
        <div class="modal-field"><div class="field-label">Olive Type</div><div class="field-value highlight">${row.olive_type || '—'}</div></div>
        <div class="modal-field"><div class="field-label">Location</div><div class="field-value">${row.location || '—'}</div></div>
        <div class="modal-field"><div class="field-label">Amount (Tons)</div><div class="field-value highlight">${formatNumber(row.amount_tons, ' T')}</div></div>
        <div class="modal-field"><div class="field-label">Price / Ton</div><div class="field-value highlight">${row.price_per_ton ? '$' + formatNumber(row.price_per_ton) : '—'}</div></div>
        <div class="modal-field"><div class="field-label">Phone</div><div class="field-value">${row.phone || '—'}</div></div>
        <div class="modal-field"><div class="field-label">Email</div><div class="field-value">${row.email || '—'}</div></div>
      </div>
      <div class="modal-actions">
        ${waLink ? `<a class="btn btn-whatsapp" href="${waLink}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ''}
        <button class="btn btn-details" onclick="closeModal()">✕ Close</button>
      </div>
    `);
  }
  window.openSellerModal = openSellerModal;

  /* 6b — FACTORIES */
  function renderFactoryCard(row) {
    const phone    = cleanPhone(row.phone);
    const waLink   = phone ? `https://wa.me/${phone}` : '#';
    const tons     = formatNumber(row.required_amount_tons, ' T');
    const price    = row.target_price ? `$${formatNumber(row.target_price)}/T` : '—';
    const oliveLbl = row.required_olive_type || 'Any Olive';
    const img      = getOliveImage(row.required_olive_type);

    return `
      <div class="card" data-type="factory">
        <img class="card-image" src="${img}" alt="${oliveLbl}" loading="lazy"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="card-image-placeholder" style="display:none">🏭</div>
        <div class="card-body">
          <div class="card-top-row">
            <span class="order-id-badge">FA-${row.id}</span>
            <span class="card-type-badge">🏭 Factory Order</span>
          </div>
          <h3 class="card-name">${row.factory_name || 'Unknown Factory'}</h3>
          <p class="card-location" style="font-size:0.78rem;color:var(--text-muted);margin-bottom:14px">Needs: ${oliveLbl}</p>
          <div class="card-badges">
            <span class="badge badge-tons">⚖️ ${tons}</span>
            <span class="badge badge-price">🎯 ${price}</span>
            ${row.deadline ? `<span class="badge badge-deadline">📅 ${row.deadline}</span>` : ''}
          </div>
          <div class="card-actions">
            <button class="btn btn-details" onclick='openFactoryModal(${JSON.stringify(JSON.stringify(row))})'>
              🔍 Full Details
            </button>
            ${phone
              ? `<a class="btn btn-whatsapp" href="${waLink}" target="_blank" rel="noopener">💬 WhatsApp</a>`
              : `<span class="btn btn-whatsapp" style="opacity:0.4;cursor:not-allowed">No Phone</span>`}
          </div>
        </div>
      </div>`;
  }

  function openFactoryModal(jsonStr) {
    const row = JSON.parse(jsonStr);
    const phone = cleanPhone(row.phone);
    const waLink = phone ? `https://wa.me/${phone}` : null;
    openModal(`
      <div class="modal-header">
        <div class="modal-emoji">🏭</div>
        <div class="modal-title">${row.factory_name || 'Unknown Factory'}</div>
        <div class="modal-subtitle">Factory Procurement Order &nbsp;·&nbsp; <span style="color:var(--gold-lt);font-weight:700">FA-${row.id}</span></div>
      </div>
      <div class="modal-grid">
        <div class="modal-field"><div class="field-label">Required Olive Type</div><div class="field-value highlight">${row.required_olive_type || '—'}</div></div>
        <div class="modal-field"><div class="field-label">Required Amount</div><div class="field-value highlight">${formatNumber(row.required_amount_tons, ' T')}</div></div>
        <div class="modal-field"><div class="field-label">Target Price / Ton</div><div class="field-value highlight">${row.target_price ? '$' + formatNumber(row.target_price) : '—'}</div></div>
        <div class="modal-field"><div class="field-label">Deadline</div><div class="field-value">${row.deadline || '—'}</div></div>
        <div class="modal-field"><div class="field-label">Phone</div><div class="field-value">${row.phone || '—'}</div></div>
        <div class="modal-field"><div class="field-label">Email</div><div class="field-value">${row.email || '—'}</div></div>
      </div>
      <div class="modal-actions">
        ${waLink ? `<a class="btn btn-whatsapp" href="${waLink}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ''}
        <button class="btn btn-details" onclick="closeModal()">✕ Close</button>
      </div>
    `);
  }
  window.openFactoryModal = openFactoryModal;

  /* 6c — STORES */
  function renderStoreCard(row) {
    const phone     = cleanPhone(row.phone);
    const waLink    = phone ? `https://wa.me/${phone}` : '#';
    const capacity  = formatNumber(row.available_capacity_tons, ' T');
    // ✅ FIXED: use actual Supabase column names
    const storageP  = row.price_per_ton
                      ? `${formatNumber(row.price_per_ton)} EGP/T`
                      : '—';
    const oliveLbl  = row.stored_olive_type || row.olive_type || null;
    const storedQty = row.stored_amount_tons != null
                      ? formatNumber(row.stored_amount_tons, ' T')
                      : (row.stored_quantity_tons != null ? formatNumber(row.stored_quantity_tons, ' T') : null);
    const storeImg  = oliveLbl
                      ? getOliveImage(oliveLbl)
                      : 'https://images.unsplash.com/photo-1586528116493-da5807982f2a?w=600&q=80';

    return `
      <div class="card" data-type="store">
        <img class="card-image"
          src="${storeImg}"
          alt="${oliveLbl || 'Warehouse'}" loading="lazy"
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="card-image-placeholder" style="display:none">🏪</div>
        <div class="card-body">
          <div class="card-top-row">
            <span class="order-id-badge">ST-${row.id}</span>
            <span class="card-type-badge">🏪 Warehouse</span>
          </div>
          <h3 class="card-name">${row.name || 'Unknown Store'}</h3>
          ${oliveLbl ? `<p class="card-olive-type" dir="auto">🫒 ${oliveLbl}</p>` : ''}
          ${row.location ? `<p class="card-location">${row.location}</p>` : ''}
          <div class="card-badges">
            <span class="badge badge-capacity">📦 ${capacity} free</span>
            ${storedQty ? `<span class="badge badge-tons">🫙 ${storedQty} stored</span>` : ''}
            <span class="badge badge-price">💰 ${storageP}</span>
          </div>
          <div class="card-actions">
            <button class="btn btn-details" onclick='openStoreModal(${JSON.stringify(JSON.stringify(row))})'>
              🔍 Full Details
            </button>
            ${phone
              ? `<a class="btn btn-whatsapp" href="${waLink}" target="_blank" rel="noopener">💬 WhatsApp</a>`
              : `<span class="btn btn-whatsapp" style="opacity:0.4;cursor:not-allowed">No Phone</span>`}
          </div>
        </div>
      </div>`;
  }

  function openStoreModal(jsonStr) {
    const row = JSON.parse(jsonStr);
    const phone = cleanPhone(row.phone);
    const waLink = phone ? `https://wa.me/${phone}` : null;
    // ✅ FIXED: use actual Supabase column names with fallbacks for safety
    const storedOliveType = row.stored_olive_type || row.olive_type || '—';
    const storedAmount    = row.stored_amount_tons != null
                            ? formatNumber(row.stored_amount_tons, ' T')
                            : (row.stored_quantity_tons != null ? formatNumber(row.stored_quantity_tons, ' T') : '—');
    const storagePrice    = row.price_per_ton
                            ? `${formatNumber(row.price_per_ton)} EGP/T`
                            : (row.storage_price_per_ton ? `${formatNumber(row.storage_price_per_ton)} EGP/T` : '—');
    openModal(`
      <div class="modal-header">
        <div class="modal-emoji">🏪</div>
        <div class="modal-title">${row.name || 'Unknown Store'}</div>
        <div class="modal-subtitle">Warehouse Storage Facility &nbsp;·&nbsp; <span style="color:var(--gold-lt);font-weight:700">ST-${row.id}</span></div>
      </div>
      <div class="modal-grid">
        <div class="modal-field"><div class="field-label">Stored Olive Type</div><div class="field-value highlight" dir="auto">${storedOliveType}</div></div>
        <div class="modal-field"><div class="field-label">Location</div><div class="field-value">${row.location || '—'}</div></div>
        <div class="modal-field"><div class="field-label">Stored Amount</div><div class="field-value highlight">${storedAmount}</div></div>
        <div class="modal-field"><div class="field-label">Available Capacity</div><div class="field-value highlight">${formatNumber(row.available_capacity_tons, ' T')}</div></div>
        <div class="modal-field"><div class="field-label">Storage Price / Ton</div><div class="field-value highlight">${storagePrice}</div></div>
        <div class="modal-field"><div class="field-label">Phone</div><div class="field-value">${row.phone || '—'}</div></div>
      </div>
      <div class="modal-actions">
        ${waLink ? `<a class="btn btn-whatsapp" href="${waLink}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ''}
        <button class="btn btn-details" onclick="closeModal()">✕ Close</button>
      </div>
    `);
  }
  window.openStoreModal = openStoreModal;

  // ── 7. DATA FETCHING ─────────────────────────────────────
  // ✅ FIX 3: Every step is logged; null/empty data shows a friendly message
  // excludeStatus: optional string — if provided, adds .neq('status', excludeStatus)
  //   e.g. 'completed' → hides completed records; shows 'new', 'New', 'pending', etc.
  //   e.g. null        → fetch all records regardless of status

  async function fetchAndRender(table, gridId, countKey, renderer, excludeStatus = null) {
    const grid = document.getElementById(gridId);
    if (!grid) {
      console.warn(`Grid element #${gridId} not found in DOM.`);
      return;
    }

    console.log(`Fetching ${table}${excludeStatus ? ` (excluding status = '${excludeStatus}')` : ' (all statuses)'}…`);

    try {
      // Build query — exclude a status value only when one is supplied
      let query = db.from(table).select('*').order('id', { ascending: false });
      if (excludeStatus) {
        query = query.neq('status', excludeStatus);
        console.log(`  ↳ Filter applied: status != '${excludeStatus}'`);
      }

      const { data, error } = await query;

      // ✅ FIX 3: Log EVERY outcome
      if (error) {
        console.error(`Error fetching ${table}:`, error);
        throw new Error(`[${table}] ${error.message}`);
      }

      console.log(`Data received from "${table}":`, data);

      grid.innerHTML = '';
      const count = data ? data.length : 0;
      setCount(countKey, count);

      // ✅ FIX 3: If data is null or empty, show "No records found"
      if (!data || data.length === 0) {
        console.warn(`"${table}" returned 0 rows. ` +
          (excludeStatus ? `All rows may have status='${excludeStatus}'. ` : '') +
          'Check RLS policies (see comment at top of app.js).');
        grid.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🫒</div>
            <h3>No active records</h3>
            <p>${excludeStatus
              ? `All records in <strong>${table}</strong> are currently <strong>${excludeStatus}</strong>.`
              : `No data in <strong>${table}</strong> yet, or RLS may be blocking access.`
            }<br>See the security note in app.js for RLS details.</p>
          </div>`;
        return;
      }

      grid.innerHTML = data.map(renderer).join('');
      hideError();
      setLastUpdated();
      console.log(`✅ Rendered ${count} cards for "${table}".`);

    } catch (err) {
      console.error(`Failed to load "${table}":`, err);
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3>Failed to load</h3>
          <p>${err.message}</p>
        </div>`;
      showError(`Failed to load ${table}: ${err.message}`);
    }
  }

  // ── Individual fetch functions called by switchTab ──────
  // All three exclude status='completed' so any other value (new, New, pending…)
  // is shown automatically. To show ALL records, pass null as the last argument.

  async function fetchSellers() {
    await fetchAndRender('sellers', 'grid-sellers', 'sellers', renderSellerCard, 'completed');
  }

  async function fetchFactories() {
    await fetchAndRender('factories_orders', 'grid-factories', 'factories', renderFactoryCard, 'completed');
  }

  async function fetchStores() {
    await fetchAndRender('stores', 'grid-stores', 'stores', renderStoreCard, 'completed');
  }

  // Load all three tables in parallel (used on initial load and refresh)
  async function loadAll() {
    console.log('Loading all tables…');
    hideError();
    await Promise.all([fetchSellers(), fetchFactories(), fetchStores()]);
    console.log('✅ All tables loaded.');
  }

  // ✅ FIX 4: Refresh button wired up
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      console.log('Manual refresh triggered.');
      refreshBtn.disabled = true;
      refreshBtn.textContent = '↻ Refreshing…';
      await loadAll();
      refreshBtn.disabled = false;
      refreshBtn.textContent = '↻ Refresh';
    });
  }

  // Retry button inside the error banner
  const retryBtn = document.getElementById('retryBtn');
  if (retryBtn) {
    retryBtn.addEventListener('click', loadAll);
  }

  // ── 8. REAL-TIME SUBSCRIPTIONS ───────────────────────────
  function subscribeRealtime() {
    console.log('Setting up real-time subscriptions…');

    db.channel('realtime:sellers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sellers' }, (payload) => {
        console.log('Real-time update on sellers:', payload);
        fetchSellers();
      })
      .subscribe();

    db.channel('realtime:factories_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'factories_orders' }, (payload) => {
        console.log('Real-time update on factories_orders:', payload);
        fetchFactories();
      })
      .subscribe();

    db.channel('realtime:stores')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, (payload) => {
        console.log('Real-time update on stores:', payload);
        fetchStores();
      })
      .subscribe();

    console.log('✅ Real-time subscriptions active.');
  }

  // ── 9. BOOTSTRAP ──────────────────────────────────────────
  // ✅ FIX 1: This async IIFE runs INSIDE DOMContentLoaded, so all IDs exist

  try {
    initSupabase();
    await loadAll();
    subscribeRealtime();
  } catch (err) {
    console.error('Bootstrap failed:', err);
    showError(`Initialization failed: ${err.message}`);
    const lastUpdatedEl = document.getElementById('lastUpdated');
    if (lastUpdatedEl) lastUpdatedEl.textContent = 'Connection failed';
  }

}); // end DOMContentLoaded