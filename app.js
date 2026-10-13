class ChatApp {
    constructor() {
        this.initDOM();
        this.bindEvents();
    }

    initDOM() {
        this.chatBox = document.getElementById('chat-box');
        this.msgInput = document.getElementById('msg-input');
        this.plusBtn = document.getElementById('plus-btn');
        this.plusPanel = document.getElementById('plus-panel');
        this.backBtn = document.getElementById('back-btn');
        this.moreBtn = document.getElementById('more-btn');
    }

    bindEvents() {
        // 切换加号面板
        this.plusBtn.addEventListener('click', () => {
            this.plusPanel.classList.toggle('active');
            this.scrollToBottom();
        });

        // 顶部按钮点击事件
        this.backBtn.addEventListener('click', () => alert('返回上一页'));
        this.moreBtn.addEventListener('click', () => alert('更多设置选项'));

        // 输入框回车发送
        this.msgInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.sendText();
            }
        });

        // 宫格面板各项点击事件绑定
        const gridItems = this.plusPanel.querySelectorAll('.grid-item');
        gridItems.forEach(item => {
            item.addEventListener('click', () => {
                const actionName = item.getAttribute('data-action');
                this.handleGridAction(actionName);
            });
        });
    }

    // 发送文字消息逻辑
    sendText() {
        const val = this.msgInput.value.trim();
        if (!val) return;

        const div = document.createElement('div');
        div.className = 'msg me';
        div.innerHTML = `<div class="bubble">${val}</div>`;
        this.chatBox.appendChild(div);

        this.msgInput.value = '';
        this.scrollToBottom();
    }

    // 处理宫格面板功能
    handleGridAction(actionName) {
        alert(`触发核心功能: ${actionName}`);
        this.plusPanel.classList.remove('active'); // 点击后收起面板
    }

    // 滚动条保持最底部
    scrollToBottom() {
        this.chatBox.scrollTop = this.chatBox.scrollHeight;
    }
}

// 页面加载完成后实例化应用
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ChatApp();
});
