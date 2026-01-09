// Check if URL is a PDF
function isPdfUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    // Check file extension
    if (urlObj.pathname.toLowerCase().endsWith('.pdf')) {
      return true;
    }
    // Check common PDF hosting patterns
    if (urlObj.hostname.includes('arxiv.org') && urlObj.pathname.includes('/pdf/')) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Open PDF in Parsely PDF Reader
function openPdfReader(pdfUrl: string) {
  // Get extension base URL and construct PDF reader URL
  // WXT builds pdf-reader/index.html as pdf-reader.html
  const extUrl = browser.runtime.getURL('');
  const readerUrl = `${extUrl}pdf-reader.html`;
  browser.tabs.create({
    url: `${readerUrl}?url=${encodeURIComponent(pdfUrl)}`,
  });
}

export default defineBackground(() => {
  // Create context menu for selected text
  browser.contextMenus.create({
    id: 'read-selection',
    title: 'Read with Parsely',
    contexts: ['selection'],
  });

  // Create context menu for PDF links
  browser.contextMenus.create({
    id: 'read-pdf-link',
    title: 'Read PDF with Parsely',
    contexts: ['link'],
    targetUrlPatterns: ['*://*/*.pdf', '*://*/*.pdf?*', '*://arxiv.org/pdf/*'],
  });

  // Handle context menu click
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    // Handle PDF link click
    if (info.menuItemId === 'read-pdf-link' && info.linkUrl) {
      openPdfReader(info.linkUrl);
      return;
    }

    // Handle text selection
    if (info.menuItemId === 'read-selection' && tab?.id) {
      try {
        await browser.tabs.sendMessage(tab.id, { type: 'READ_SELECTION' });
      } catch {
        // Content script not loaded - inject it first
        try {
          await browser.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['/content-scripts/content.js'],
          });
          await new Promise((resolve) => setTimeout(resolve, 100));
          await browser.tabs.sendMessage(tab.id, { type: 'READ_SELECTION' });
        } catch (e) {
          console.error('Failed to inject content script:', e);
        }
      }
    }
  });

  // Handle messages from content scripts
  browser.runtime.onMessage.addListener((message) => {
    if (message.type === 'OPEN_SHORTCUTS_PAGE') {
      // Firefox uses about:addons (can't open directly), Chrome/Edge use chrome://extensions/shortcuts
      const isFirefox = navigator.userAgent.includes('Firefox');
      const url = isFirefox
        ? 'https://support.mozilla.org/en-US/kb/manage-extension-shortcuts-firefox'
        : 'chrome://extensions/shortcuts';
      browser.tabs.create({ url });
    }

    // Handle PDF reader request
    if (message.type === 'OPEN_PDF_READER' && message.url) {
      openPdfReader(message.url);
    }
  });

  // Use browserAction for MV2 (Firefox), action for MV3 (Chrome)
  const actionApi = browser.action || browser.browserAction;
  actionApi.onClicked.addListener(async (tab) => {
    if (!tab.id || !tab.url) return;

    const url = tab.url;

    // Skip restricted pages where content scripts can't run
    if (
      url.startsWith('chrome://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('about:') ||
      url.startsWith('edge://') ||
      url.startsWith('moz-extension://') ||
      url === 'about:blank'
    ) {
      return;
    }

    // If current page is a PDF, open PDF reader
    if (isPdfUrl(url)) {
      openPdfReader(url);
      return;
    }

    // Otherwise, toggle normal reader
    try {
      await browser.tabs.sendMessage(tab.id, { type: 'TOGGLE_READER' });
    } catch {
      // Content script not loaded yet - inject it first, then send message
      try {
        await browser.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['/content-scripts/content.js'],
        });
        // Give the script a moment to set up the message listener
        await new Promise((resolve) => setTimeout(resolve, 100));
        await browser.tabs.sendMessage(tab.id, { type: 'TOGGLE_READER' });
      } catch (e) {
        console.error('Failed to inject content script:', e);
      }
    }
  });
});
