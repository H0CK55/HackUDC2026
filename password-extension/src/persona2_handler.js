import { evaluateStrength, checkBreach, generatePassword, generatePassphrase } from "./security.js";
import WORDLIST_ES, { WORDLIST_EN } from "../wordlist/wordlist.js";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const action = message?.action || message?.type;
  if (!message || !action) return false;

  switch (action) {

    case "CHECK_STRENGTH": {
      try {
        const result = evaluateStrength(message.password);
        sendResponse({ ok: true, data: result });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
      return false;
    }

    case "CHECK_BREACH": {
      checkBreach(message.password)
        .then(result => sendResponse({ ok: true, data: result }))
        .catch(e => sendResponse({ ok: false, error: e.message }));
      return true;
    }

    case "CHECK_FULL": {
      const strengthResult = evaluateStrength(message.password);
      checkBreach(message.password)
        .then(breachResult => {
          sendResponse({
            ok: true,
            data: {
              strength: strengthResult,
              breach: breachResult,
            }
          });
        })
        .catch(e => sendResponse({ ok: false, error: e.message }));
      return true;
    }

    case "GENERATE_PASSWORD": {
      try {
        const result = generatePassword(message.options || {});
        sendResponse({ ok: true, data: result });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
      return false;
    }

    case "GENERATE_PASSPHRASE": {
      try {
        const lang = message.options?.lang === "en" ? WORDLIST_EN : WORDLIST_ES;
        const result = generatePassphrase({
          wordList: lang,
          ...message.options,
        });
        sendResponse({ ok: true, data: result });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
      return false;
    }

    case "VERIFY_OR_CREATE": {
      const password = message.typed || "";
      const domain = message.domain || "";

      if (!password || password.length === 0) {
        try {
          const generated = generatePassword({ length: 16 });
          chrome.tabs.sendMessage(sender.tab.id, {
            type: "CREATED",
            data: {
              password: generated.password,
              domain: domain,
              entropy: generated.entropy
            }
          });
        } catch (e) {
          chrome.tabs.sendMessage(sender.tab.id, {
            type: "ERROR",
            data: { message: e.message }
          });
        }
        return false;
      }

      const strengthResult = evaluateStrength(password);
      checkBreach(password)
        .then(breachResult => {
          chrome.tabs.sendMessage(sender.tab.id, {
            type: "CHECK_RESULT",
            data: {
              strength: strengthResult,
              pwned: breachResult.pwned,
              breach: breachResult
            }
          });
        })
        .catch(e => {
          chrome.tabs.sendMessage(sender.tab.id, {
            type: "CHECK_RESULT",
            data: {
              strength: strengthResult,
              pwned: null,
              error: e.message
            }
          });
        });
      return false;
    }

    default:
      return false;
  }
});
