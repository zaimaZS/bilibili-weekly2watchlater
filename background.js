// 导入常量文件
importScripts('constants.js');

// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  // 添加到稍后再看的菜单
  chrome.contextMenus.create({
    id: 'batchAddToWatchLater',
    title: '一键添加到稍后再看',
    contexts: ['page'],
    documentUrlPatterns: [`*://*.bilibili.com${URL_PATTERNS.WEEKLY_PAGE}*`]
  });
  
  // 添加设置选项菜单
  chrome.contextMenus.create({
    id: 'openOptions',
    title: '设置',
    contexts: ['action']
  });
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'batchAddToWatchLater') {
    chrome.tabs.sendMessage(tab.id, { action: MESSAGE.BATCH_ADD });
  } else if (info.menuItemId === 'openOptions') {
    chrome.runtime.openOptionsPage();
  }
});

/**
 * 显示通知
 * @param {string} title - 通知标题
 * @param {string} message - 通知内容
 * @param {boolean} isSuccess - 是否成功通知
 */
function showNotification(title, message, isSuccess = true) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: NOTIFICATION.ICON_PATH,
    title: title,
    message: message,
    priority: 1
  });
}

// 监听来自content script和popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === MESSAGE.SHOW_NOTIFICATION) {
    const { title, message, isSuccess } = request;
    showNotification(title, message, isSuccess);
  }
  return true;
}); 