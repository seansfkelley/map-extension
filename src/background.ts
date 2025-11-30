interface MenuCallbacks {
  [title: string]: (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => void;
}

const menuCallbacks: MenuCallbacks = {
  'Analyze Image': (info, tab) => {
    console.log('Analyze image clicked:', info.srcUrl, tab?.id);
  },
  'Convert Projection': (info, tab) => {
    console.log('Convert projection clicked:', info.srcUrl, tab?.id);
  },
  'Extract Coordinates': (info, tab) => {
    console.log('Extract coordinates clicked:', info.srcUrl, tab?.id);
  },
};

for (const title of Object.keys(menuCallbacks)) {
  chrome.contextMenus.create({
    id: title,
    title,
    contexts: ['image'],
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const callback = menuCallbacks[info.menuItemId as string];
  if (callback) {
    callback(info, tab);
  }
});
