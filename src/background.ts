import { PROJECTIONS } from './types';

for (const projection of PROJECTIONS) {
  chrome.contextMenus.create({
    id: projection,
    title: projection,
    contexts: ['image'],
  });
  // consider a separator to split the xkcd ones from other interesting ones
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (tab?.id != null) {
    chrome.tabs.sendMessage(tab.id, { projection: info.menuItemId });
  }
});
