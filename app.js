// Link+ 成品核心交互逻辑（含右侧加号、高输入框、动态发送按钮）
document.addEventListener('DOMContentLoaded', () => {
  const togglePanelBtn = document.getElementById('toggle-panel-btn');
  const plusPanel = document.getElementById('plus-panel');
  const chatBox = document.getElementById('chat-box');
  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');

  // 动态聊天对象名称支持
  window.currentPeerName = "";

  window.updateTargetPeer = function(name) {
    window.currentPeerName = name || "";
    if (messageInput) {
      messageInput.placeholder = window.currentPeerName ? `给 ${window.currentPeerName} 发消息或文件...` : "输入消息...";
    }
  };

  // 切换加号面板
  if (togglePanelBtn && plusPanel) {
    togglePanelBtn.addEventListener('click', () => {
      const isActive = plusPanel.classList.toggle('active');
      if (isActive) {
        chatBox.scrollTop = chatBox.scrollHeight;
      }
    });
  }

  // 输入框聚焦时收起面板
  if (messageInput) {
    messageInput.addEventListener('focus', () => {
      if (plusPanel) plusPanel.classList.remove('active');
    });

    // 实时监听输入内容，控制发送按钮与加号按钮的动态显隐/切换
    messageInput.addEventListener('input', () => {
      const hasText = messageInput.value.trim().length > 0;
      if (sendBtn && togglePanelBtn) {
        if (hasText) {
          sendBtn.style.display = 'block';
          togglePanelBtn.style.display = 'none'; // 有文字时右侧显示发送，隐藏加号
        } else {
          sendBtn.style.display = 'none';
          togglePanelBtn.style.display = 'flex'; // 没文字时显示加号，隐藏发送
        }
      }
    });
  }

  // 发送消息逻辑
  function handleSend() {
    if (!messageInput) return;
    const text = messageInput.value.trim();
    if (!text) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = 'msg me';
    msgDiv.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
    chatBox.appendChild(msgDiv);

    messageInput.value = '';
    if (sendBtn) sendBtn.style.display = 'none';
    if (togglePanelBtn) togglePanelBtn.style.display = 'flex';
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', handleSend);
  }

  if (messageInput) {
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleSend();
      }
    });
  }

  function escapeHtml(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
});
