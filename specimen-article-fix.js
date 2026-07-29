(() => {
  'use strict';

  const normalizePath = (value) => {
    try {
      const url = new URL(value, window.location.href);
      return decodeURIComponent(url.pathname).replace(/^\/+/, '');
    } catch (_) {
      return String(value || '')
        .replace(/^\.\//, '')
        .replace(/^\/+/, '')
        .split('#')[0]
        .split('?')[0];
    }
  };

  const currentSpecimenCode = () => {
    const code = document.querySelector('#detailBody .code')?.textContent?.trim();
    return code || null;
  };

  async function openPrivateSpecimenDocument(anchor) {
    const sourcePath = normalizePath(anchor.getAttribute('href'));
    const code = currentSpecimenCode();
    const popup = window.open('', '_blank');

    if (popup) {
      popup.document.title = 'Opening private document…';
      popup.document.body.innerHTML = '<p style="font:16px system-ui;padding:24px">Opening private document…</p>';
    }

    try {
      if (!window.LISCloud?.signedIn?.()) throw new Error('Sign in before opening private documents.');
      const attachments = await window.LISCloud.listAttachments(code);
      const match = attachments.find((item) => normalizePath(item.source_path) === sourcePath)
        || attachments.find((item) => item.file_name && sourcePath.endsWith('/' + item.file_name));

      if (!match) throw new Error(`No private attachment record was found for ${sourcePath}.`);
      const url = await window.LISCloud.signedUrl(match.storage_path);

      if (popup) popup.location.replace(url);
      else window.location.href = url;
    } catch (error) {
      if (popup) {
        popup.document.title = 'Document could not be opened';
        popup.document.body.innerHTML = `<p style="font:16px system-ui;padding:24px">${String(error.message || error)}</p>`;
      }
      const message = document.querySelector('#cloudMessage');
      if (message) {
        message.textContent = `Document could not be opened: ${error.message || error}`;
        message.dataset.kind = 'error';
        message.classList.remove('hidden');
      }
      console.error('Private specimen document open failed:', sourcePath, error);
    }
  }

  document.addEventListener('click', (event) => {
    const anchor = event.target.closest('a[href]');
    if (!anchor) return;
    const path = normalizePath(anchor.getAttribute('href'));
    if (!path.startsWith('documents/specimens/')) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    openPrivateSpecimenDocument(anchor);
  }, true);
})();
