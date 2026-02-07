/**
 * 添加到稍后再看
 * @param {number} aid 视频av号
 * @param {HTMLButtonElement} button 按钮元素
 */
async function addToWatchLater(aid, button) {
  try {
    button.disabled = true;
    
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: MESSAGE.ADD_TO_WATCH_LATER,
      aid,
      csrf: CSRF_TOKEN
    });

    if (response.code === 0) {
      button.textContent = '已添加';
      button.classList.add('added');
      
      // 发送成功通知
      chrome.runtime.sendMessage({
        action: MESSAGE.SHOW_NOTIFICATION,
        title: NOTIFICATION.SUCCESS_TITLE,
        message: NOTIFICATION.SUCCESS_MESSAGE.replace('{0}', 1),
        isSuccess: true
      });
    } else {
      throw new Error(response.message || ERROR_MESSAGES.ADD_FAILED);
    }
  } catch (error) {
    alert(`${ERROR_MESSAGES.ADD_FAILED}: ${error.message}`);
    button.disabled = false;
    
    // 发送失败通知
    chrome.runtime.sendMessage({
      action: MESSAGE.SHOW_NOTIFICATION,
      title: NOTIFICATION.ERROR_TITLE,
      message: error.message,
      isSuccess: false
    });
  }
}

/**
 * 批量添加到稍后再看
 * @param {Array} videos 视频列表
 */
async function batchAddToWatchLater(videos) {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  
  const addButton = document.getElementById('batchAdd');
  addButton.disabled = true;
  addButton.textContent = '添加中...';
  
  let successCount = 0;
  let failCount = 0;
  console.log(CSRF_TOKEN);
  try {
    for (const video of videos) {
      
      
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: MESSAGE.ADD_TO_WATCH_LATER,
        aid: video.aid,
        csrf: CSRF_TOKEN
      });
      
      // 更新对应视频的按钮状态
      const videoButton = document.querySelector(`[data-aid="${video.aid}"]`);
      if (response.code === 0) {
        videoButton.textContent = '已添加';
        videoButton.classList.add('added');
        successCount++;
      } else {
        videoButton.textContent = '添加失败';
        videoButton.classList.add('error');
        failCount++;
      }
      
      // 添加间隔,避免请求过快
      await new Promise(resolve => setTimeout(resolve, REQUEST.INTERVAL));
    }
    
    addButton.textContent = '全部添加完成';
    
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
    
  } catch (error) {
    alert(`${ERROR_MESSAGES.BATCH_ADD_FAILED}: ${error.message}`);
    addButton.textContent = '一键添加到稍后再看';
    addButton.disabled = false;
    
    // 发送错误通知
    chrome.runtime.sendMessage({
      action: MESSAGE.SHOW_NOTIFICATION,
      title: NOTIFICATION.ERROR_TITLE,
      message: error.message,
      isSuccess: false
    });
  }
}

/**
 * 在popup中显示视频列表
 * @param {Array} videos 视频信息数组
 */
function displayVideos(videos) {
  const videoList = document.getElementById('videoList');
  videoList.innerHTML = '';

  // 添加批量导入按钮（稍后绑定点击事件）
  const batchButton = document.createElement('button');
  batchButton.id = 'batchAdd';
  batchButton.className = 'batch-add-button';
  batchButton.textContent = '一键添加到稍后再看';
  videoList.appendChild(batchButton);

  // 读取黑名单，过滤展示，并绑定批量按钮事件
  chrome.storage.sync.get('upBlacklist', (data) => {
    const list = Array.isArray(data.upBlacklist) ? data.upBlacklist : [];
    const set = new Set(list.map(n => n.trim()).filter(Boolean));

    const filteredVideos = videos.filter(v => !set.has(String(v.uploader || '').trim()));

    // 绑定批量按钮：仅对过滤后的视频进行批量添加
    batchButton.addEventListener('click', () => batchAddToWatchLater(filteredVideos));

    filteredVideos.forEach(video => {
      const div = document.createElement('div');
      div.className = 'video-item';
      div.innerHTML = `
        <a href="${video.link}" target="_blank">${video.title}</a>
        <div>UP主: ${video.uploader}</div>
        <div>BV号: ${video.bvid}</div>
        <div>AV号: av${video.aid}</div>
        <button class="add-to-watch" data-aid="${video.aid}">添加到稍后再看</button>
      `;
      const addButton = div.querySelector('.add-to-watch');
      addButton.addEventListener('click', () => addToWatchLater(video.aid, addButton));
      videoList.appendChild(div);
    });
  });
}

// 创建一个显示CSRF令牌的元素
function createCSRFTokenDisplay() {
  const tokenDisplay = document.createElement('div');
  tokenDisplay.id = 'csrf-token-display';
  tokenDisplay.style.position = 'fixed';
  tokenDisplay.style.bottom = '10px';
  tokenDisplay.style.left = '10px';
  tokenDisplay.style.fontSize = '12px';
  tokenDisplay.style.color = '#666';
  tokenDisplay.style.backgroundColor = '#f5f5f5';
  tokenDisplay.style.padding = '5px';
  tokenDisplay.style.borderRadius = '3px';
  tokenDisplay.style.zIndex = '1000';
  document.body.appendChild(tokenDisplay);
  return tokenDisplay;
}

// 更新UI显示CSRF令牌
function updateUIWithCSRFToken() {
  let tokenDisplay = document.getElementById('csrf-token-display');
  if (!tokenDisplay) {
    tokenDisplay = createCSRFTokenDisplay();
  }
  tokenDisplay.textContent = `当前CSRF令牌: ${CSRF_TOKEN || '未获取'}`;
  console.log('当前使用的CSRF令牌:', CSRF_TOKEN);
}

// 获取当前标签页的视频信息
chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
  if (!tabs || tabs.length === 0) {
    console.error('无法获取当前活动标签页');
    document.body.innerHTML = '<p>无法获取当前标签页信息，请刷新后重试</p>';
    return;
  }
  
  const tab = tabs[0];
  
  // 从存储中获取最新的CSRF令牌
  chrome.storage.sync.get('biliJct', (data) => {
    if (data.biliJct) {
      CSRF_TOKEN = data.biliJct;
      console.log('从存储获取的CSRF令牌:', CSRF_TOKEN);
      updateUIWithCSRFToken();
    }
  });
  
  // 请求content script获取bili_jct
  try {
    chrome.tabs.sendMessage(tab.id, {action: 'getBiliJct'}, (response) => {
      if (chrome.runtime.lastError) {
        console.error('获取bili_jct时出错:', chrome.runtime.lastError.message);
        return;
      }
      
      if (response && response.biliJct) {
        CSRF_TOKEN = response.biliJct;
        console.log('从content script获取的CSRF令牌:', CSRF_TOKEN);
        
        // 保存到存储中
        chrome.storage.sync.set({ biliJct: response.biliJct });
        
        // 更新UI显示
        updateUIWithCSRFToken();
      }
    });
  } catch (error) {
    console.error('发送getBiliJct消息时出错:', error);
  }
  
  // 初始显示当前CSRF令牌
  setTimeout(updateUIWithCSRFToken, 500);
  
  if (tab.url && tab.url.includes(URL_PATTERNS.WEEKLY_PAGE)) {
    chrome.tabs.sendMessage(tab.id, {action: MESSAGE.GET_VIDEOS}, response => {
      if (response && response.videos) {
        displayVideos(response.videos);
      }
    });
  } else {
    document.body.innerHTML = '<p>请在B站每周必看页面使用此插件</p>';
  }
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender) => {
  if (request.action === MESSAGE.UPDATE_POPUP && request.videos) {
    displayVideos(request.videos);
  }
});

// 设置链接点击事件
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('openOptions').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
});