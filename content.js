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
    throw new Error('未找到视频卡片,请确认页面加载完成');
  }

  const videos = [];
  
  videoCards.forEach((card, index) => {
    try {
      const link = card.querySelector('a')?.href;
      const title = card.querySelector('.video-name')?.textContent;
      const uploader = card.querySelector('.up-name__text')?.textContent;
      
      if (!link || !title || !uploader) {
        console.warn(`视频卡片 ${index + 1} 信息不完整,已跳过`);
        return;
      }

      const bvid = extractBVID(link);
      if (!bvid) {
        console.warn(`视频卡片 ${index + 1} BV号提取失败,已跳过`);
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
  const url = 'https://api.bilibili.com/x/v2/history/toview/add';
  const formData = new URLSearchParams();
  formData.append('aid', aid);
  formData.append('csrf', csrf);

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const result = await response.json();
    if (result.code !== 0) {
      throw new Error(result.message || '添加失败');
    }
    return result;
  } catch (error) {
    throw new Error(`添加失败: ${error.message}`);
  }
}

/**
 * 批量添加所有视频到稍后再看
 * @returns {Promise<void>}
 */
async function batchAddAllVideos() {
  const csrf = '724ff092f3a88c909ade1720cd2a3588';
  let videos;
  
  try {
    videos = getVideoInfo();
  } catch (error) {
    console.error('获取视频信息失败:', error);
    return;
  }

  let successCount = 0;
  let failCount = 0;
  
  for (const video of videos) {
    try {
      await addToWatchLater(video.aid, csrf);
      console.log(`成功添加: ${video.title}`);
      successCount++;
      // 添加间隔,避免请求过快
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`添加视频 ${video.title} 失败:`, error);
      failCount++;
    }
  }

  console.log(`批量添加完成: 成功 ${successCount} 个, 失败 ${failCount} 个`);
}

// 监听来自popup和background的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getVideos':
      try {
        const videos = getVideoInfo();
        sendResponse({videos});
      } catch (error) {
        sendResponse({error: error.message});
      }
      break;
      
    case 'addToWatchLater':
      addToWatchLater(request.aid, request.csrf)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({error: error.message}));
      return true; // 保持消息通道开启以进行异步响应
      
    case 'batchAddFromContextMenu':
      batchAddAllVideos();
      break;
  }
});

// 如果是每周必看页面,自动获取视频信息
if (location.href.includes('/v/popular/weekly')) {
  let retryCount = 0;
  const MAX_RETRIES = 10;
  
  const checkContent = setInterval(() => {
    retryCount++;
    try {
      if (document.querySelector('.video-card')) {
        clearInterval(checkContent);
        const videos = getVideoInfo();
        chrome.runtime.sendMessage({ 
          action: 'updatePopup', 
          videos 
        });
      } else if (retryCount >= MAX_RETRIES) {
        clearInterval(checkContent);
        console.error('页面加载超时');
      }
    } catch (error) {
      console.warn('检查页面内容时出错:', error);
    }
  }, 1000);
} 