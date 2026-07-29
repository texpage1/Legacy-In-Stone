(() => {
  'use strict';

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  let generation = 0;

  async function renderDirectMaterialLinks() {
    const body = document.querySelector('#detailBody');
    const code = body?.querySelector('.code')?.textContent?.trim();
    if (!code || !window.LISCloud?.signedIn?.()) return;

    const section = [...body.querySelectorAll('.detail-content section')]
      .find((item) => item.querySelector('h3')?.textContent?.trim() === 'Related materials');
    if (!section) return;

    const run = ++generation;
    section.dataset.directMaterialCode = code;
    section.querySelectorAll('.materials-list,.placeholder').forEach((item) => item.remove());
    section.insertAdjacentHTML('beforeend', '<div class="placeholder direct-material-loading">Loading private documents…</div>');

    try {
      const all = await window.LISCloud.listAttachments(code);
      if (run !== generation || section.dataset.directMaterialCode !== code) return;

      const documents = (all || []).filter((item) => {
        const mime = String(item.mime_type || '').toLowerCase();
        return item.material_type !== 'Specimen photograph' && !mime.startsWith('image/');
      });

      const resolved = await Promise.all(documents.map(async (item) => {
        try {
          return { item, url: await window.LISCloud.signedUrl(item.storage_path, 3600) };
        } catch (error) {
          console.error('Could not sign specimen document', item, error);
          return { item, url: null };
        }
      }));

      if (run !== generation || section.dataset.directMaterialCode !== code) return;
      section.querySelectorAll('.materials-list,.placeholder').forEach((item) => item.remove());

      const working = resolved.filter((entry) => entry.url);
      if (!working.length) {
        section.insertAdjacentHTML('beforeend', '<div class="placeholder">No private documents could be opened for this specimen.</div>');
        return;
      }

      const list = document.createElement('div');
      list.className = 'materials-list cloud-materials direct-material-links';
      list.innerHTML = working.map(({ item, url }) => `
        <a class="material-item" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
          <span class="material-type">${escapeHtml(item.material_type || 'Private document')}</span>
          <strong>${escapeHtml(item.file_name || 'Open private document')}</strong>
          <small>${escapeHtml(item.caption || 'Open private file')}</small>
        </a>`).join('');
      section.appendChild(list);
    } catch (error) {
      if (run !== generation) return;
      section.querySelectorAll('.materials-list,.placeholder').forEach((item) => item.remove());
      section.insertAdjacentHTML('beforeend', `<div class="placeholder">Private documents could not be loaded: ${escapeHtml(error.message || error)}</div>`);
      console.error('Specimen material loading failed', error);
    }
  }

  const observer = new MutationObserver(() => {
    const detail = document.querySelector('#detail');
    if (detail?.open) renderDirectMaterialLinks();
  });

  window.addEventListener('DOMContentLoaded', () => {
    const detailBody = document.querySelector('#detailBody');
    if (detailBody) observer.observe(detailBody, { childList: true, subtree: true });
  });
})();
