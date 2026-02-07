/**
 * 常量配置文件
 * 存储项目中使用的公共变量
 */

// API相关
const API = {
  // 添加到稍后再看的API
  ADD_TO_WATCH_LATER: 'https://api.bilibili.com/x/v2/history/toview/add',
};

/**
 * 从Cookie中获取bili_jct值
 * @returns {string|null} 返回bili_jct值，如果不存在则返回null
 */
function getBiliJctFromCookie() {
  const cookies = document.cookie.split('; ');
  for (let i = 0; i < cookies.length; i++) {
    const parts = cookies[i].split('=');
    if (parts[0] === 'bili_jct') {
      return parts[1];
    }
  }
  return null;
}

// CSRF令牌 - 默认从Cookie中获取
let bili_jct = getBiliJctFromCookie();
let CSRF_TOKEN = bili_jct || 'ca655a9bf1bf94ca2a83af8ad827035d'; // 如果Cookie中没有，使用默认值

// 如果成功从Cookie获取了bili_jct，保存到存储中
if (typeof chrome !== 'undefined' && chrome.storage && bili_jct) {
  chrome.storage.sync.set({ biliJct: bili_jct }, () => {
    console.log('已从Cookie中获取并保存bili_jct');
    // 通知其他脚本更新CSRF令牌
    chrome.runtime.sendMessage({ action: 'updateBiliJct', biliJct: bili_jct });
  });
  
  console.log('当前CSRF令牌:', CSRF_TOKEN);

  // 监听CSRF令牌更新消息
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'updateBiliJct' && request.biliJct) {
      CSRF_TOKEN = request.biliJct;
      console.log('CSRF令牌已更新');
      return true;
    }
  });
}

// 请求与操作相关
const REQUEST = {
  // 请求间隔(ms)
  INTERVAL: 300,
  // 页面加载检查间隔(ms)  
  CHECK_INTERVAL: 1000,
  // 最大重试次数
  MAX_RETRIES: 10
};

// 消息类型
const MESSAGE = {
  GET_VIDEOS: 'getVideos',
  ADD_TO_WATCH_LATER: 'addToWatchLater',
  BATCH_ADD: 'batchAddFromContextMenu',
  UPDATE_POPUP: 'updatePopup',
  UPDATE_BILI_JCT: 'updateBiliJct',
  SHOW_NOTIFICATION: 'showNotification'
};

// 错误消息
const ERROR_MESSAGES = {
  NO_VIDEO_CARDS: '未找到视频卡片,请确认页面加载完成',
  CARD_INFO_INCOMPLETE: '视频卡片信息不完整,已跳过',
  BV_EXTRACT_FAILED: 'BV号提取失败,已跳过',
  ADD_FAILED: '添加失败',
  BATCH_ADD_FAILED: '批量添加失败',
  PAGE_LOAD_TIMEOUT: '页面加载超时'
};

// URL特征
const URL_PATTERNS = {
  WEEKLY_PAGE: '/v/popular/weekly'
};

// 通知相关
const NOTIFICATION = {
  SUCCESS_TITLE: '添加成功',
  ERROR_TITLE: '添加失败',
  SUCCESS_MESSAGE: '成功添加 {0} 个视频到稍后再看',
  PARTIAL_SUCCESS_MESSAGE: '成功添加 {0} 个视频，失败 {1} 个',
  ERROR_MESSAGE: '添加失败，请检查CSRF令牌是否正确',
  ICON_PATH: 'icon.png'
};

// 导出所有常量
if (typeof module !== 'undefined') {
  module.exports = {
    API,
    CSRF_TOKEN,
    REQUEST,
    MESSAGE,
    ERROR_MESSAGES,
    URL_PATTERNS,
    NOTIFICATION
  };
}