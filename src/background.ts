import { PROJECTIONS } from './types';

for (const projection of PROJECTIONS) {
  chrome.contextMenus.create({
    id: projection,
    title: projection,
    contexts: ['image'],
  });
}

const alreadyInjectedTabIds = new Set<number>();
async function injectIfNecessary(tabId: number) {
  if (!alreadyInjectedTabIds.has(tabId)) {
    await chrome.scripting.insertCSS({
      files: ['css/content.css'],
      target: { tabId },
    });
    await chrome.scripting.executeScript({
      files: ['dist/content.js'],
      target: { tabId },
    });
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log({ info, tab });
  if (tab?.id != null) {
    await injectIfNecessary(tab.id);
    // FIXME: This doesn't work because the current implementation relies on the content script
    // already being loaded to watch which elements are being context-menu'd. Firefox supports a
    // transient opaque ID to identify the target...
    //
    // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/menus/OnClickData#targetelementid
    //
    // ...but only Firefox. So this implementation is currently impossible.
    chrome.tabs.sendMessage(tab.id, { projection: info.menuItemId });
  }
});
