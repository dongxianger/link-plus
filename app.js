document.addEventListener('DOMContentLoaded', () => {
    const chatBox = document.getElementById('chat-box');
    const msgInput = document.getElementById('msg-input');
    const plusBtn = document.getElementById('plus-btn');
    const plusPanel = document.getElementById('plus-panel');
    const realFileInput = document.getElementById('real-file-input');
    const realTransferInput = document.getElementById('real-transfer-input');
    const realPhotoInput = document.getElementById('real-photo-input');

    // 1. 加号面板开关
    if (plusBtn && plusPanel) {
        plusBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            plusPanel.classList.toggle('active');
            scrollToBottom();
        });
    }

    if (msgInput) {
        msgInput.addEventListener('focus', () => {
            plusPanel.classList.remove('active');
        });
    }

    document.addEventListener('click', (e) => {
        if (plusPanel && plusPanel.classList.contains('active')) {
            if (!plusPanel.contains(e.target) && e.target !== plusBtn) {
                plusPanel.classList.remove('active');
            }
        }
    });

    // 2. 文本消息发送
    if (msgInput) {
        msgInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const val = msgInput.value.trim();
                if (!val) return;
                appendMessage(val, 'me');
                msgInput.value = '';
            }
        });
    }

    function appendMessage(content, sender, isHtml = false) {
        const div = document.createElement('div');
        div.className = `msg ${sender}`;
        div.innerHTML = `<div class="bubble">${isHtml ? content : escapeHtml(content)}</div>`;
        chatBox.appendChild(div);
        scrollToBottom();
    }

    function scrollToBottom() {
        requestAnimationFrame(() => {
            chatBox.scrollTop = chatBox.scrollHeight;
        });
    }

    function escapeHtml(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    // 3. 发文件
    const btnFile = document.getElementById('btn-file');
    if (btnFile) {
        btnFile.addEventListener('click', () => {
            plusPanel.classList.remove('active');
            realFileInput.click();
        });
    }

    if (realFileInput) {
        realFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            appendMessage(`[文件] 📄 ${file.name} (${(file.size/1024).toFixed(1)} KB)`, 'me');
            realFileInput.value = '';
        });
    }

    // 4. 文件传输（批量多选）
    const btnTransfer = document.getElementById('btn-transfer');
    if (btnTransfer) {
        btnTransfer.addEventListener('click', () => {
            plusPanel.classList.remove('active');
            realTransferInput.click();
        });
    }

    if (realTransferInput) {
        realTransferInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (!files.length) return;
            for (let file of files) {
                appendMessage(`[文件传输通道] 📤 ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB) 准备就绪`, 'me');
            }
            realTransferInput.value = '';
        });
    }

    // 5. 发照片
    const btnPhoto = document.getElementById('btn-photo');
    if (btnPhoto) {
        btnPhoto.addEventListener('click', () => {
            plusPanel.classList.remove('active');
            realPhotoInput.click();
        });
    }

    if (realPhotoInput) {
        realPhotoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(evt) {
                appendMessage(`<img src="${evt.target.result}" alt="图片" style="max-width:100%; border-radius:4px; display:block;">`, 'me', true);
            };
            reader.readAsDataURL(file);
            realPhotoInput.value = '';
        });
    }

    // 6. 打视频
    const btnVideo = document.getElementById('btn-video');
    if (btnVideo) {
        btnVideo.addEventListener('click', async () => {
            plusPanel.classList.remove('active');
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, 
                    audio: true 
                });
                const videoElement = document.createElement('video');
                videoElement.srcObject = stream;
                videoElement.autoplay = true;
                videoElement.playsInline = true;
                videoElement.muted = true;
                videoElement.style.width = '100%';
                videoElement.style.maxHeight = '220px';
                videoElement.style.borderRadius = '4px';
                videoElement.style.objectFit = 'cover';
                videoElement.style.backgroundColor = '#000000';

                const div = document.createElement('div');
                div.className = 'msg me';
                const bubble = document.createElement('div');
                bubble.className = 'bubble';
                bubble.style.backgroundColor = '#000000';
                bubble.style.padding = '4px';
                bubble.appendChild(videoElement);
                div.appendChild(bubble);
                chatBox.appendChild(div);
                scrollToBottom();
            } catch (err) {
                alert(`无法调用摄像头: ${err.message}`);
            }
        });
    }

    // 7. 打电话
    const btnVoice = document.getElementById('btn-voice');
    if (btnVoice) {
        btnVoice.addEventListener('click', async () => {
            plusPanel.classList.remove('active');
            try {
                await navigator.mediaDevices.getUserMedia({ 
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
                });
                appendMessage(`[语音通话] 📞 麦克风已成功激活（降噪与回音消除已开启）`, 'me');
            } catch (err) {
                alert(`无法调用麦克风: ${err.message}`);
            }
        });
    }
});
