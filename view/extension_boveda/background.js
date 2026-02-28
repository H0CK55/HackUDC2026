importScripts('config.js');

const API_URL = (typeof VAULT_API_URL !== 'undefined' ? VAULT_API_URL : null) || "http://localhost:8000/api";
const _dec = new TextDecoder();

function _hex2buf(h) {
  const s = String(h).trim();
  return new Uint8Array(s.match(/.{1,2}/g).map(b => parseInt(b, 16)));
}

function _siteMatches(site, hostname) {
  const norm = s => s.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
  const s = norm(site), h = norm(hostname);
  return h === s || h.endsWith('.' + s) || s.endsWith('.' + h);
}

async function _getCredentials(hostname) {
  try {
    const { sessionToken, vkHex } = await chrome.storage.session.get(['sessionToken', 'vkHex']);
    if (!sessionToken || !vkHex) return { found: false };

    const res = await fetch(`${API_URL}/vault`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!res.ok) return { found: false };

    const vk = await crypto.subtle.importKey(
      'raw', _hex2buf(vkHex), { name: 'AES-GCM' }, false, ['decrypt']
    );

    const matching = [];
    for (const item of await res.json()) {
      try {
        const plain = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: _hex2buf(item.nonce) },
          vk,
          _hex2buf(item.encrypted_payload)
        );
        const parsed = JSON.parse(_dec.decode(plain));
        if (_siteMatches(parsed.site || '', hostname)) {
          matching.push({ site: parsed.site, password: parsed.password, id: item.id });
        }
      } catch {}
    }

    return { found: matching.length > 0, items: matching };
  } catch {
    return { found: false };
  }
}

async function _openPopup() {
  try {
    await chrome.action.openPopup();
  } catch {
    chrome.windows.create({
      url: chrome.runtime.getURL('popup.html'),
      type: 'popup',
      width: 400,
      height: 600,
      focused: true,
    });
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_VAULT') {
    const domain = message.domain || '';
    chrome.storage.local.set({ pendingDomain: domain }, () => _openPopup());
    sendResponse({ ok: true });
  }

  if (message.type === 'SAVE_CREDENTIAL_PROMPT') {
    const { site, password } = message;
    chrome.storage.local.set({ pendingSaveCredential: { site, password } }, () => _openPopup());
    sendResponse({ ok: true });
  }

  if (message.type === 'GET_CREDENTIALS') {
    _getCredentials(message.hostname).then(sendResponse);
    return true;
  }

});
