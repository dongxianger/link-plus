// Link+ P2P核心控制逻辑与UI交互
document.addEventListener('DOMContentLoaded', () => {
  const togglePanelBtn = document.getElementById('toggle-panel-btn');
  const plusPanel = document.getElementById('plus-panel');
  const chatBox = document.getElementById('chat-box');
  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');

  // 切换加号面板显示状态
  if (togglePanelBtn && plusPanel) {
    togglePanelBtn.addEventListener('click', () => {
      const isActive = plusPanel.classList.toggle('active');
      if (isActive) {
        chatBox.scrollTop = chatBox.scrollHeight;
      }
    });
  }

  // 点击输入框时收起加号面板
  if (messageInput) {
    messageInput.addEventListener('focus', () => {
      if (plusPanel) plusPanel.classList.remove('active');
    });
  }

  // 发送文字消息逻辑
  function handleSend() {
    const text = messageInput.value.trim();
    if (!text) return;

    // 添加到本地聊天气泡
    const msgDiv = document.createElement('div');
    msgDiv.className = 'msg me';
    msgDiv.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
    chatBox.appendChild(msgDiv);

    messageInput.value = '';
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
