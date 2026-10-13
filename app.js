document.addEventListener('DOMContentLoaded', () => {
    const chatBox = document.getElementById('chat-box');
    const msgInput = document.getElementById('msg-input');
    const plusBtn = document.getElementById('plus-btn');
    const plusPanel = document.getElementById('plus-panel');
    const realFileInput = document.getElementById('real-file-input');
    const realPhotoInput = document.getElementById('real-photo-input');

    // 1. 加号面板开关
    if (plusBtn && plusPanel) {
        plusBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            plusPanel.classList.toggle('active');
            chatBox.scrollTop = chatBox.scrollHeight;
        });
    }

    // 2. 文本输入回车发送
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
        chatBox.scrollTop = chatBox.scrollHeight;
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
            appendMessage(`[文件传输] 📄 ${file.name} (${(file.size/1024).toFixed(1)} KB)`, 'me');
            realFileInput.value = '';
        });
    }

    // 4. 发照片
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

    // 5. 打视频（实时渲染摄像头画面）
    const btnVideo = document.getElementById('btn-video');
    if (btnVideo) {
        btnVideo.addEventListener('click', async () => {
            plusPanel.classList.remove('active');
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                const videoElement = document.createElement('video');
                videoElement.srcObject = stream;
                videoElement.autoplay = true;
                videoElement.playsInline = true;
                videoElement.style.width = '100%';
                videoElement.style.maxHeight = '200px';
                videoElement.style.borderRadius = '4px';
                videoElement.style.objectFit = 'cover';

                const div = document.createElement('div');
                div.className = 'msg me';
                const bubble = document.createElement('div');
                bubble.className = 'bubble';
                bubble.appendChild(videoElement);
                div.appendChild(bubble);
                chatBox.appendChild(div);
                chatBox.scrollTop = chatBox.scrollHeight;
            } catch (err) {
                alert(`无法调用摄像头: ${err.message}`);
            }
        });
    }

    // 6. 打电话
    const btnVoice = document.getElementById('btn-voice');
    if (btnVoice) {
        btnVoice.addEventListener('click', async () => {
            plusPanel.classList.remove('active');
            try {
                await navigator.mediaDevices.getUserMedia({ audio: true });
                appendMessage(`[语音通话] 📞 麦克风已成功激活并接入`, 'me');
            } catch (err) {
                alert(`无法调用麦克风: ${err.message}`);
            }
        });
    }
});
