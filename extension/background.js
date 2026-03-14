// ── BrainDump background service worker ───────────────────────────────

function sendToggle(tabId) {
  chrome.tabs.sendMessage(tabId, { action: 'toggle' }, () => {
    // Suppress "Could not establish connection" errors on chrome:// pages etc.
    void chrome.runtime.lastError;
  });
}

// Keyboard shortcut: Ctrl+Shift+Space / MacCtrl+Shift+Space
chrome.commands.onCommand.addListener((command) => {
  if (command !== 'toggle-overlay') return;
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab?.id) sendToggle(tab.id);
  });
});

// Extension icon click
chrome.action.onClicked.addListener((tab) => {
  if (tab?.id) sendToggle(tab.id);
});
