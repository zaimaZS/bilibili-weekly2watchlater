// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'batchAddToWatchLater',
    title: '一键添加到稍后再看',
    contexts: ['page'],
    documentUrlPatterns: ['*://*.bilibili.com/v/popular/weekly*']
  });
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'batchAddToWatchLater') {
    chrome.tabs.sendMessage(tab.id, { action: 'batchAddFromContextMenu' });
  }
}); 