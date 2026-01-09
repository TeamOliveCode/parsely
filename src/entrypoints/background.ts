export default defineBackground(() => {
  // Create context menu for selected text
  browser.contextMenus.create({
    id: 'read-selection',
    title: 'Read with Parsely',
    contexts: ['selection'],
  });

  // Handle context menu click
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
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
  });

  // Use browserAction for MV2 (Firefox), action for MV3 (Chrome)
  const actionApi = browser.action || browser.browserAction;
  actionApi.onClicked.addListener(async (tab) => {
    if (!tab.id || !tab.url) return;

    // Skip restricted pages where content scripts can't run
    const url = tab.url;
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
