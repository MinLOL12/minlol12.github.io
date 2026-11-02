(() => {
  const $ = s => document.querySelector(s);
  const cfg = window.ADL_CONFIG || {};
  const configured = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  const db = configured ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  // Discord-only sign-in. The whole site is gated unless requireLogin is set to false in config.js.
  const gateActive = configured && cfg.requireLogin !== false;
  let user = null, isAdmin = false, levels = [], records = [];
  const redirectTo = () => window.location.origin + window.location.pathname;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function toast(message) { const el = $('#toast'); el.textContent = message; el.style.display = 'block'; clearTimeout(toast.timer); toast.timer = setTimeout(() => el.style.display = 'none', 5000); }
  function modal(title, content) { $('#modal-title').textContent = title; $('#modal-content').innerHTML = content; if (!$('#modal').open) $('#modal').showModal(); }
  function setupRequired() { toast('Discord login is not configured yet. See README for setup.'); }
  function displayName(u) {
    const m = u?.user_metadata || {};
    return m.global_name || m.full_name || m.name || m.user_name || m.preferred_username || m.nickname || (u?.email ? u.email.split('@')[0] : '') || 'Discord user';
  }
  function avatarUrl(u) {
    const m = u?.user_metadata || {};
    const url = m.avatar_url || m.picture || '';
    return /^https?:\/\//i.test(url) ? url : '';
  }
  async function signInWithDiscord(button, errorEl) {
    if (!db) return setupRequired();
    const original = button ? button.innerHTML : '';
    if (button) { button.disabled = true; button.innerHTML = 'Redirecting to Discord…'; }
    if (errorEl) errorEl.textContent = '';
    const { error } = await db.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: redirectTo(), scopes: 'identify' }
    });
    if (error) {
      if (button) { button.disabled = false; button.innerHTML = original; }
      if (errorEl) errorEl.textContent = error.message; else toast(error.message);
      return;
    }
    // Supabase redirects the browser to Discord; nothing else to do here.
  }
  function submission(type) {
    if (!db) return setupRequired();
    if (!user) { toast('Please log in with Discord to submit.'); return signInWithDiscord($('#wall-login'), $('#auth-error')); }
    const level = type === 'level';
    modal(level ? 'Submit a level.' : 'Submit a record.', `<form class="form" id="submit-form"><label>Level name<input name="level_name" maxlength="100" required></label>${level ? '<label>Creator<input name="creator" maxlength="100" required></label><label>Difficulty<select name="difficulty" required><option>Easy Demon</option><option>Medium Demon</option><option>Hard Demon</option><option>Insane Demon</option><option>Extreme Demon</option></select></label><label>Suggested rank (optional)<input name="suggested_rank" type="number" min="1" max="10000"></label>' : '<label>Player name<input name="player_name" maxlength="100" required></label><label>Progress (%)<input name="progress" type="number" min="1" max="100" required></label><label>Video proof URL<input name="proof_url" type="url" placeholder="https://..." required></label>'}<label>Notes (optional)<textarea name="notes" maxlength="2000"></textarea></label><p class="form-note">Submissions are reviewed by an administrator before appearing on the list.</p><div class="error" id="form-error"></div><button class="button button-primary">Send submission <span>↗</span></button></form>`);
    $('#submit-form').onsubmit = async e => { e.preventDefault(); const form = e.currentTarget, f = new FormData(form); const payload = Object.fromEntries(f); const button = form.querySelector('button'); button.disabled = true; const {error} = await db.from('submissions').insert({type, payload, submitted_by:user.id}); button.disabled = false; if (error) return $('#form-error').textContent = error.message; $('#modal').close(); toast('Submission sent for review. Thank you!'); };
  }
  function renderLevels() {
    const query = $('#search').value.trim().toLowerCase(); const filtered = levels.filter(l => `${l.name} ${l.creator}`.toLowerCase().includes(query)); $('#level-count').textContent = levels.length;
    if (!filtered.length) { $('#levels').innerHTML = `<div class="empty"><span class="empty-icon">✧</span><h3>${query ? 'No levels found.' : 'The list starts here.'}</h3><p>${query ? 'Try a different search.' : 'Approved levels will appear here. Be the first to suggest one!'}</p>${query ? '' : '<a href="#submit">Submit a level →</a>'}</div>`; return; }
    $('#levels').innerHTML = filtered.map(l => { const matching = records.filter(r => r.level_id === l.id); return `<div class="level-row"><div><div class="level-name"><span class="rank">#${esc(l.rank)}</span><span>${esc(l.name)}</span></div>${matching.length ? `<div class="form-note" style="margin:8px 0 0 45px">${matching.map(r => `${esc(r.player_name)} · ${esc(r.progress)}% ${r.proof_url && /^https?:\/\//i.test(r.proof_url) ? `<a href="${esc(r.proof_url)}" target="_blank" rel="noopener noreferrer">↗</a>` : ''}`).join(' &nbsp; / &nbsp; ')}</div>` : ''}</div><span class="muted">${esc(l.creator)}</span><span class="difficulty">${esc(l.difficulty)}</span><span class="row-arrow">↗</span></div>`; }).join('');
  }
  async function loadLevels() { if (!db) return; const [l, r] = await Promise.all([db.from('levels').select('*').order('rank'), db.from('records').select('*')]); if (l.error || r.error) { toast('Could not load the list. Check the database setup.'); return; } levels = l.data; records = r.data; renderLevels(); }
  async function loadQueue() { if (!isAdmin) return; const {data,error} = await db.from('submissions').select('*').eq('status','pending').order('created_at'); if (error) { $('#queue').textContent = error.message; return; } $('#queue').innerHTML = data.length ? data.map(s => `<div class="queue-card"><strong>${esc(s.type.toUpperCase())} · ${esc(s.payload.level_name)}</strong><p>${esc(Object.entries(s.payload).map(([k,v]) => `${k.replaceAll('_',' ')}: ${v}`).join('\n'))}</p><button class="button button-primary" data-review="approve" data-id="${esc(s.id)}">Approve</button><button class="button button-outline" data-review="reject" data-id="${esc(s.id)}">Reject</button>${s.type === 'level' ? '<label class="form-note"> Rank on approval: <input type="number" min="1" max="10000" class="rank-input" style="width:80px;background:#0b0e15;color:white;border:1px solid #39414c;padding:8px" required></label>' : '<label class="form-note"> Level ID on approval: <input type="number" min="1" class="level-id-input" style="width:80px;background:#0b0e15;color:white;border:1px solid #39414c;padding:8px" required></label>'}</div>`).join('') : '<div class="empty"><h3>All caught up.</h3><p>There are no pending submissions.</p></div>'; }
  function applyGate() { const root = document.documentElement; root.classList.remove('auth-pending'); root.classList.toggle('needs-auth', gateActive && !user); }
  async function updateSession(session) {
    user = session?.user || null; isAdmin = false;
    const name = user ? displayName(user) : '';
    const avatar = user ? avatarUrl(user) : '';
    $('#user-label').textContent = name; $('#user-label').title = name;
    const img = $('#user-avatar');
    if (avatar) { img.src = avatar; img.alt = `${name} on Discord`; img.classList.remove('hidden'); } else { img.removeAttribute('src'); img.classList.add('hidden'); }
    $('#auth-button').innerHTML = user ? 'Log out <span>↗</span>' : 'Log in with Discord <span>↗</span>';
    if (user) $('#auth-error').textContent = '';
    applyGate();
    if (user) { const {data} = await db.from('admins').select('user_id').eq('user_id',user.id).maybeSingle(); isAdmin = !!data; }
    $('.admin-link').classList.toggle('hidden',!isAdmin); $('#admin').classList.toggle('hidden',!isAdmin); if (isAdmin) loadQueue();
  }
  function surfaceAuthError() {
    const raw = (window.location.hash || window.location.search || '').replace(/^[#?]/, '');
    if (!raw) return false;
    const params = new URLSearchParams(raw);
    const message = params.get('error_description') || params.get('error');
    if (!message) return false;
    const text = decodeURIComponent(message.replace(/\+/g, ' '));
    $('#auth-error').textContent = text; toast(text);
    history.replaceState(null, '', redirectTo());
    return true;
  }
  $('#auth-button').onclick = async () => { if (!user) return signInWithDiscord($('#auth-button'), $('#auth-error')); const {error} = await db.auth.signOut(); if (error) toast(error.message); else { toast('Signed out.'); setTimeout(applyGate, 0); } };
  $('#wall-login').onclick = () => signInWithDiscord($('#wall-login'), $('#auth-error'));
  document.querySelectorAll('[data-submit]').forEach(b => b.onclick = () => submission(b.dataset.submit)); $('.close').onclick = () => $('#modal').close(); $('#modal').addEventListener('click', e => { if (e.target === $('#modal')) $('#modal').close(); }); $('#search').addEventListener('input',renderLevels); document.addEventListener('keydown',e => { if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName) && !$('#modal').open) { e.preventDefault(); $('#search').focus(); } }); $('#refresh-queue').onclick = loadQueue;
  $('#queue').onclick = async e => { const button = e.target.closest('[data-review]'); if (!button) return; const approve = button.dataset.review === 'approve', card = button.closest('.queue-card'); const rank = card.querySelector('.rank-input')?.value, levelId = card.querySelector('.level-id-input')?.value; if (approve && !(Number(rank) > 0 || Number(levelId) > 0)) return toast('Enter a rank or level ID before approving.'); button.disabled = true; const {error} = await db.rpc('review_submission',{submission_id:button.dataset.id, approve, level_rank:rank ? Number(rank) : null, record_level_id:levelId ? Number(levelId) : null}); button.disabled = false; if (error) return toast(error.message); toast(approve ? 'Submission approved.' : 'Submission rejected.'); loadQueue(); loadLevels(); };
  if (db) {
    surfaceAuthError();
    db.auth.onAuthStateChange((_event,session) => { setTimeout(() => updateSession(session),0); });
    db.auth.getSession().then(({data}) => updateSession(data.session)).catch(() => toast('Could not check your Discord session.'));
    loadLevels();
  } else { applyGate(); renderLevels(); }
})();
