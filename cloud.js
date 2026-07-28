(() => {
  'use strict';
  const cfg = window.LEGACY_IN_STONE_CLOUD || {};
  let session = null;
  try { session = JSON.parse(localStorage.getItem('lis-cloud-session') || 'null'); } catch (_) {}

  const headers = (extra = {}) => ({
    apikey: cfg.supabaseAnonKey,
    'Content-Type': 'application/json',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    ...extra
  });

  async function request(path, options = {}) {
    const response = await fetch(cfg.supabaseUrl + path, {
      ...options,
      headers: headers(options.headers)
    });
    const text = await response.text();
    if (!response.ok) {
      let message = text || response.statusText || `HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(text);
        message = parsed.msg || parsed.message || parsed.error_description || parsed.error || message;
      } catch (_) {}
      throw new Error(message);
    }
    return text ? JSON.parse(text) : null;
  }

  async function signIn(email, password) {
    const result = await request('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email: String(email || '').trim(), password })
    });
    if (!result?.access_token || !result?.user?.id) throw new Error('Supabase did not return a valid login session.');
    session = result;
    localStorage.setItem('lis-cloud-session', JSON.stringify(session));
    return session;
  }

  function signOut() {
    session = null;
    localStorage.removeItem('lis-cloud-session');
  }

  async function pushCatalog(records) {
    if (!session?.user?.id) throw new Error('Sign in first.');
    const ownerId = session.user.id;
    const updatedAt = new Date().toISOString();
    const rows = records.map(record => ({
      owner_id: ownerId,
      specimen_code: record.specimen_code,
      payload: record,
      updated_at: updatedAt
    }));
    return request('/rest/v1/specimens?on_conflict=owner_id%2Cspecimen_code', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows)
    });
  }

  async function pullCatalog() {
    if (!session) throw new Error('Sign in first.');
    return request('/rest/v1/specimens?select=payload&order=specimen_code');
  }

  window.LISCloud = {
    configured: () => Boolean(cfg.enabled && cfg.supabaseUrl && cfg.supabaseAnonKey),
    signedIn: () => Boolean(session?.access_token),
    signIn,
    signOut,
    pushCatalog,
    pullCatalog
  };
})();
