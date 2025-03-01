/**
 * 添加到稍后再看
 * @param {number} aid 视频av号
 * @param {HTMLButtonElement} button 按钮元素
 */
async function addToWatchLater(aid, button) {
  const csrf = '724ff092f3a88c909ade1720cd2a3588';
  
  try {
    button.disabled = true;
    
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'addToWatchLater',
      aid,
      csrf
    });

    if (response.code === 0) {
      button.textContent = '已添加';
      button.classList.add('added');
    } else {
      throw new Error(response.message || '添加失败');
    }
  } catch (error) {
    alert(`添加失败: ${error.message}`);
    button.disabled = false;
  }
}

/**
 * 批量添加到稍后再看
 * @param {Array} videos 视频列表
 */
async function batchAddToWatchLater(videos) {
  const csrf = '724ff092f3a88c909ade1720cd2a3588';
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  
  const addButton = document.getElementById('batchAdd');
  addButton.disabled = true;
  addButton.textContent = '添加中...';
  
  try {
    for (const video of videos) {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'addToWatchLater',
        aid: video.aid,
        csrf
      });
      
      // 更新对应视频的按钮状态
      const videoButton = document.querySelector(`[data-aid="${video.aid}"]`);
      if (response.code === 0) {
        videoButton.textContent = '已添加';
        videoButton.classList.add('added');
      } else {
        videoButton.textContent = '添加失败';
        videoButton.classList.add('error');
      }
      
      // 添加间隔,避免请求过快
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    addButton.textContent = '全部添加完成';
  } catch (error) {
    alert(`批量添加失败: ${error.message}`);
    addButton.textContent = '一键添加到稍后再看';
    addButton.disabled = false;
  }
}

/**
 * 在popup中显示视频列表
 * @param {Array} videos 视频信息数组
 */
function displayVideos(videos) {
  const videoList = document.getElementById('videoList');
  videoList.innerHTML = '';

  // 添加批量导入按钮
  const batchButton = document.createElement('button');
  batchButton.id = 'batchAdd';
  batchButton.className = 'batch-add-button';
  batchButton.textContent = '一键添加到稍后再看';
  batchButton.addEventListener('click', () => batchAddToWatchLater(videos));
  videoList.appendChild(batchButton);

  videos.forEach(video => {
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
}

// 获取当前标签页的视频信息
chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
  const tab = tabs[0];
  if (tab.url.includes('/v/popular/weekly')) {
    chrome.tabs.sendMessage(tab.id, {action: 'getVideos'}, response => {
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
  if (request.action === 'updatePopup' && request.videos) {
    displayVideos(request.videos);
  }
}); 