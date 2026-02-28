// background.js — Service Worker HackUDC Vault

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_VAULT') {
    const domain = message.domain || '';

    // Guardamos el dominio para que popup.js lo pueda leer al abrirse
    chrome.storage.local.set({ pendingDomain: domain }, async () => {
      try {
        // Abre el popup nativo de la extensión (el de la barra del navegador)
        await chrome.action.openPopup();
      } catch (e) {
        // openPopup() puede fallar si la ventana no tiene foco en algunos builds de Chrome.
        // Fallback: ventana popup estándar.
        chrome.windows.create({
          url: chrome.runtime.getURL('popup.html'),
          type: 'popup',
          width: 400,
          height: 600,
          focused: true,
        });
      }
    });

    sendResponse({ ok: true });
  }
});