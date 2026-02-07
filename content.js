/**
 * 从URL中提取BV号
 * @param {string} url - 视频链接
 * @returns {string} 提取的BV号,如果未找到则返回空字符串
 */
function extractBVID(url) {
  const match = url.match(/BV\w+/);
  return match ? match[0] : '';
}

/**
 * 获取页面上所有视频卡片信息
 * @returns {Array<Object>} 视频信息数组,每个对象包含title,link,uploader,bvid,aid等信息
 * @throws {Error} 当页面结构不符合预期时抛出错误
 */
function getVideoInfo() {
  const videoCards = document.querySelectorAll('.video-card');
  if (!videoCards.length) {
    throw new Error(ERROR_MESSAGES.NO_VIDEO_CARDS);
  }

  const videos = [];
  
  videoCards.forEach((card, index) => {
    try {
      const link = card.querySelector('a')?.href;
      const title = card.querySelector('.video-name')?.textContent;
      const uploader = card.querySelector('.up-name__text')?.textContent;
      
      if (!link || !title || !uploader) {
        console.warn(`${ERROR_MESSAGES.CARD_INFO_INCOMPLETE}`);
        return;
      }

      const bvid = extractBVID(link);
      if (!bvid) {
        console.warn(`${ERROR_MESSAGES.BV_EXTRACT_FAILED}`);
        return;
      }

      const aid = bv2av(bvid);
      
      videos.push({
        title,
        link,
        uploader,
        bvid,
        aid
      });
    } catch (error) {
      console.error(`处理视频卡片 ${index + 1} 时出错:`, error);
    }
  });

  return videos;
}

/**
 * 添加视频到稍后再看
 * @param {number} aid - 视频av号
 * @param {string} csrf - CSRF令牌
 * @returns {Promise<Object>} B站API的响应结果
 * @throws {Error} 当请求失败或返回错误码时抛出错误
 */
async function addToWatchLater(aid, csrf) {
  const formData = new URLSearchParams();
  formData.append('aid', aid);
  formData.append('csrf', csrf);

  try {
    const response = await fetch(API.ADD_TO_WATCH_LATER, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const result = await response.json();
    if (result.code !== 0) {
      throw new Error(result.message || ERROR_MESSAGES.ADD_FAILED);
    }
    return result;
  } catch (error) {
    throw new Error(`${ERROR_MESSAGES.ADD_FAILED}: ${error.message}`);
  }
}

/**
 * 批量添加所有视频到稍后再看
 * @returns {Promise<void>}
 */
/**
 * 根据黑名单过滤视频
 * @param {Array<Object>} videos - 原始视频列表
 * @param {string[]} upBlacklist - UP主黑名单（名称数组）
 * @returns {Array<Object>} 过滤后的视频列表
 */
function filterVideosByBlacklist(videos, upBlacklist) {
  if (!Array.isArray(upBlacklist) || upBlacklist.length === 0) return videos;
  const set = new Set(upBlacklist.map(name => name.trim()).filter(Boolean));
  return videos.filter(v => !set.has(String(v.uploader || '').trim()));
}
async function batchAddAllVideos() {
  let videos;
  
  try {
    videos = getVideoInfo();
  } catch (error) {
    console.error('获取视频信息失败:', error);
    // 发送错误通知
    chrome.runtime.sendMessage({
      action: MESSAGE.SHOW_NOTIFICATION,
      title: NOTIFICATION.ERROR_TITLE,
      message: error.message,
      isSuccess: false
    });
    return;
  }

  // 读取黑名单并过滤
  try {
    const { upBlacklist } = await new Promise(resolve => chrome.storage.sync.get('upBlacklist', resolve));
    const list = Array.isArray(upBlacklist) ? upBlacklist : [];
    videos = filterVideosByBlacklist(videos, list);
  } catch (e) {
    console.warn('读取黑名单失败，按原列表处理', e);
  }

  let successCount = 0;
  let failCount = 0;
  
  for (const video of videos) {
    try {
      await addToWatchLater(video.aid, CSRF_TOKEN);
      console.log(`成功添加: ${video.title}`);
      successCount++;
      // 添加间隔,避免请求过快
      await new Promise(resolve => setTimeout(resolve, REQUEST.INTERVAL));
    } catch (error) {
      console.error(`添加视频 ${video.title} 失败:`, error);
      failCount++;
    }
  }

  console.log(`批量添加完成: 成功 ${successCount} 个, 失败 ${failCount} 个`);
  
  // 发送完成通知
  let notificationTitle, notificationMessage, isSuccess;
  
  if (successCount > 0 && failCount === 0) {
    // 全部成功
    notificationTitle = NOTIFICATION.SUCCESS_TITLE;
    notificationMessage = NOTIFICATION.SUCCESS_MESSAGE.replace('{0}', successCount);
    isSuccess = true;
  } else if (successCount > 0 && failCount > 0) {
    // 部分成功
    notificationTitle = NOTIFICATION.SUCCESS_TITLE;
    notificationMessage = NOTIFICATION.PARTIAL_SUCCESS_MESSAGE
      .replace('{0}', successCount)
      .replace('{1}', failCount);
    isSuccess = true;
  } else {
    // 全部失败
    notificationTitle = NOTIFICATION.ERROR_TITLE;
    notificationMessage = NOTIFICATION.ERROR_MESSAGE;
    isSuccess = false;
  }
  
  chrome.runtime.sendMessage({
    action: MESSAGE.SHOW_NOTIFICATION,
    title: notificationTitle,
    message: notificationMessage,
    isSuccess
  });
}

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

// 监听来自popup和background的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  let keepChannelOpen = false;
  
  switch (request.action) {
    case 'getBiliJct':
      // 从Cookie中获取bili_jct并返回
      const biliJct = getBiliJctFromCookie();
      console.log('content script中获取的bili_jct:', biliJct);
      // 立即返回结果
      sendResponse({biliJct});
      keepChannelOpen = true; // 需要保持消息通道开启
      break;
      
    case MESSAGE.GET_VIDEOS:
      try {
        const videos = getVideoInfo();
        sendResponse({videos});
      } catch (error) {
        sendResponse({error: error.message});
      }
      break;
      
    case MESSAGE.ADD_TO_WATCH_LATER:
      (async () => {
        try {
          // 读取黑名单
          const { upBlacklist } = await new Promise(resolve => chrome.storage.sync.get('upBlacklist', resolve));
          const list = Array.isArray(upBlacklist) ? upBlacklist : [];
          const set = new Set(list.map(n => n.trim()).filter(Boolean));

          // 在当前页面视频列表中查找该aid对应的视频，以获取UP主
          let blocked = false;
          if (set.size > 0) {
            try {
              const videos = getVideoInfo();
              const target = videos.find(v => v.aid === request.aid);
              if (target && set.has(String(target.uploader || '').trim())) {
                blocked = true;
              }
            } catch (_) {
              // 如果页面结构发生变化导致获取失败，则不阻断，按默认流程添加
            }
          }

          if (blocked) {
            sendResponse({ code: -1, message: '该UP主在黑名单中，已跳过' });
            return;
          }

          const result = await addToWatchLater(request.aid, request.csrf);
          sendResponse(result);
        } catch (error) {
          sendResponse({ code: -1, message: error.message });
        }
      })();
      keepChannelOpen = true; // 需要保持消息通道开启
      break;
      
    case MESSAGE.BATCH_ADD:
      batchAddAllVideos();
      break;
  }
  
  // 返回true以保持消息通道开启（用于异步响应）
  return keepChannelOpen;
});

// 如果是每周必看页面,自动获取视频信息
if (location.href.includes(URL_PATTERNS.WEEKLY_PAGE)) {
  let retryCount = 0;
  
  const checkContent = setInterval(() => {
    retryCount++;
    try {
      if (document.querySelector('.video-card')) {
        clearInterval(checkContent);
        const videos = getVideoInfo();
        chrome.runtime.sendMessage({ 
          action: MESSAGE.UPDATE_POPUP, 
          videos 
        });
      } else if (retryCount >= REQUEST.MAX_RETRIES) {
        clearInterval(checkContent);
        console.error(ERROR_MESSAGES.PAGE_LOAD_TIMEOUT);
      }
    } catch (error) {
      console.warn('检查页面内容时出错:', error);
    }
  }, REQUEST.CHECK_INTERVAL);
}