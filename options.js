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

/**
 * 解析UP主黑名单输入文本为数组
 * @param {string} text - 文本框内容
 * @returns {string[]} 处理后的UP主名称数组（去重、去空白）
 */
function parseBlacklist(text) {
  return (text || '')
    .split(/\n|,|;|\s+/)
    .map(s => s.trim())
    .filter(Boolean)
    .reduce((acc, name) => acc.includes(name) ? acc : acc.concat(name), []);
}

// 页面加载时，优先从Cookie获取CSRF令牌，如果没有则从存储中获取
document.addEventListener('DOMContentLoaded', () => {
  // 先尝试从Cookie获取
  const biliJctFromCookie = getBiliJctFromCookie();
  if (biliJctFromCookie) {
    document.getElementById('biliJct').value = biliJctFromCookie;
    // 同时更新存储
    chrome.storage.sync.set({ biliJct: biliJctFromCookie });
  } else {
    // 如果Cookie中没有，从存储中获取
    chrome.storage.sync.get('biliJct', (data) => {
      if (data.biliJct) {
        document.getElementById('biliJct').value = data.biliJct;
      }
    });
  }

  // 读取黑名单
  chrome.storage.sync.get('upBlacklist', (data) => {
    const list = Array.isArray(data.upBlacklist) ? data.upBlacklist : [];
    document.getElementById('upBlacklist').value = list.join('\n');
  });

  // 保存按钮点击事件
  document.getElementById('saveButton').addEventListener('click', () => {
    const biliJct = document.getElementById('biliJct').value.trim();
    
    // 验证CSRF令牌
    if (!biliJct) {
      showStatus('请输入有效的CSRF令牌', 'error');
      return;
    }
    
    // 保存到存储
    chrome.storage.sync.set({ biliJct }, () => {
      if (chrome.runtime.lastError) {
        showStatus(`保存失败: ${chrome.runtime.lastError.message}`, 'error');
      } else {
        showStatus('CSRF令牌保存成功！', 'success');
        
        // 通知其他脚本更新CSRF令牌
        chrome.runtime.sendMessage({ action: 'updateBiliJct', biliJct });
      }
    });
    
    // 保存黑名单
    const blacklistText = document.getElementById('upBlacklist').value;
    const upBlacklist = parseBlacklist(blacklistText);
    chrome.storage.sync.set({ upBlacklist }, () => {
      if (chrome.runtime.lastError) {
        showStatus(`黑名单保存失败: ${chrome.runtime.lastError.message}`, 'error');
      } else {
        showStatus('黑名单保存成功！', 'success');
      }
    });
    
    // 提示用户此值会被自动从Cookie获取
    showStatus('注意：此值会在每次加载时自动从Cookie获取', 'success');
  });
});

/**
 * 显示状态消息
 * @param {string} message - 要显示的消息
 * @param {string} type - 消息类型 ('success' 或 'error')
 */
function showStatus(message, type) {
  const statusElement = document.getElementById('statusMessage');
  statusElement.textContent = message;
  statusElement.className = `status ${type}`;
  statusElement.style.display = 'block';
  
  // 3秒后隐藏消息
  setTimeout(() => {
    statusElement.style.display = 'none';
  }, 3000);
}