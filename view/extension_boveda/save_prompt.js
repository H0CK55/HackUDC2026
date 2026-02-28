let _domain     = '';
let _password   = '';
let _online     = false;
let _myWindowId = null;

chrome.windows.getCurrent(w => { _myWindowId = w.id; });

function closeMe() {
  if (_myWindowId !== null) chrome.windows.remove(_myWindowId);
}

chrome.storage.local.get('pendingSave', ({ pendingSave }) => {
  if (pendingSave) {
    _domain   = pendingSave.domain   || '';
    _password = pendingSave.password || '';
    document.getElementById('domainLabel').textContent = _domain;
  }

  chrome.runtime.sendMessage({ type: 'CHECK_SESSION' }, (response) => {
    _online = !!(response && response.online);
    const statusEl = document.getElementById('statusLabel');
    if (_online) {
      statusEl.textContent = '● Sesión activa — se guardará directamente';
      statusEl.className = 'status online';
    } else {
      statusEl.textContent = '○ Sin sesión — tendrás que iniciar sesión';
      statusEl.className = 'status offline';
    }
    document.getElementById('btnSave').disabled = false;
  });
});

document.getElementById('btnSave').addEventListener('click', () => {
  document.getElementById('btnSave').disabled = true;
  chrome.runtime.sendMessage({
    type:     'CONFIRM_SAVE',
    domain:   _domain,
    password: _password,
    autoSave: _online,
  }, () => closeMe());
});

document.getElementById('btnDismiss').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'DISMISS_SAVE' }, () => closeMe());
});

setTimeout(() => {
  chrome.runtime.sendMessage({ type: 'DISMISS_SAVE' });
  closeMe();
}, 15000);
