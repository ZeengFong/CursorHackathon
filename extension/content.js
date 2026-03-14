// ── BrainDump content script ───────────────────────────────────────────

const IFRAME_ID = 'BrainDump-overlay';
const ANIM_MS   = 200;

function getIframe() {
  return document.getElementById(IFRAME_ID);
}

function removeOverlay() {
  const iframe = getIframe();
  if (!iframe) return;
  // Reverse the entrance animation
  iframe.style.opacity   = '0';
  iframe.style.transform = 'translateY(20px)';
  setTimeout(() => iframe.remove(), ANIM_MS);
}

function createOverlay() {
  const iframe = document.createElement('iframe');
  iframe.id  = IFRAME_ID;
  iframe.src = chrome.runtime.getURL('overlay.html');

  // All styles use !important to survive aggressive host-page resets
  iframe.style.cssText = [
    'position: fixed !important',
    'bottom: 24px !important',
    'right: 24px !important',
    'width: 360px !important',
    'height: 560px !important',
    'border: none !important',
    'border-radius: 16px !important',
    'z-index: 2147483647 !important',
    'box-shadow: 0 24px 48px rgba(0,0,0,0.55) !important',
    'display: block !important',
    'color-scheme: dark !important',
    // Start state for entrance animation
    'opacity: 0 !important',
    'transform: translateY(20px) !important',
    `transition: opacity ${ANIM_MS}ms ease-out, transform ${ANIM_MS}ms ease-out !important`,
  ].join(';');

  (document.body ?? document.documentElement).appendChild(iframe);

  // Force two rAF so the browser registers the start state before animating
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      iframe.style.setProperty('opacity',   '1',           'important');
      iframe.style.setProperty('transform', 'translateY(0)', 'important');
    });
  });
}

function toggleOverlay() {
  if (getIframe()) removeOverlay();
  else             createOverlay();
}

// Messages from background.js
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'toggle') toggleOverlay();
});

// Messages from overlay.js (iframe can't open tabs or close itself)
window.addEventListener('message', (event) => {
  const iframe = getIframe();
  if (!iframe || event.source !== iframe.contentWindow) return;

  const { action, url } = event.data ?? {};

  if (action === 'BrainDump-close') {
    removeOverlay();
  } else if (action === 'BrainDump-open-url' && typeof url === 'string') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
});
