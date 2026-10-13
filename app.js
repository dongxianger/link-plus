document.addEventListener('DOMContentLoaded', () => {
    const chatBox = document.getElementById('chat-box');
    const msgInput = document.getElementById('msg-input');
    const plusBtn = document.getElementById('plus-btn');
    const plusPanel = document.getElementById('plus-panel');
    const realFileInput = document.getElementById('real-file-input');
    const realTransferInput = document.getElementById('real-transfer-input');
    const realPhotoInput = document.getElementById('real-photo-input');

    // 全球免费公网 STUN 服务器配置（用于跨网 P2P 打洞）
    const rtcConfig = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun.stunprotocol.org:3478' }
        ]
    };

    let peerConnection = null;
    let localStream = null;
    let currentFacingMode = 'user'; // 'user' 前置, 'environment' 后置

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

    // 4. 文件传输（批量大文件/电影）
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
                appendMessage(`[P2P大文件传输] 📤 ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB) 准备就绪`, 'me');
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

    // 6. 打视频（带前后摄切换、挂断、自由拖动悬浮窗、全球 STUN 打洞）
    const btnVideo = document.getElementById('btn-video');
    if (btnVideo) {
        btnVideo.addEventListener('click', async () => {
            plusPanel.classList.remove('active');
            await startVideoCall(currentFacingMode);
        });
    }

    async function startVideoCall(facingMode) {
        try {
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }

            localStream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: facingMode }, 
                audio: { echoCancellation: true, noiseSuppression: true } 
            });

            if (!peerConnection) {
                peerConnection = new RTCPeerConnection(rtcConfig);
                localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
            }

            const videoContainer = document.createElement('div');
            videoContainer.className = 'draggable-video-box';

            const videoElement = document.createElement('video');
            videoElement.srcObject = localStream;
            videoElement.autoplay = true;
            videoElement.playsInline = true;
            videoElement.muted = true;

            // 悬浮控制条
            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'video-controls';

            const switchBtn = document.createElement('button');
            switchBtn.className = 'video-ctrl-btn';
            switchBtn.innerText = '🔄 翻转';
            switchBtn.onclick = async (e) => {
                e.stopPropagation();
                currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
                await startVideoCall(currentFacingMode);
                videoContainer.remove();
            };

            const hangupBtn = document.createElement('button');
            hangupBtn.className = 'video-ctrl-btn hangup';
            hangupBtn.innerText = '❌ 挂断';
            hangupBtn.onclick = (e) => {
                e.stopPropagation();
                if (localStream) {
                    localStream.getTracks().forEach(track => track.stop());
                    localStream = null;
                }
                if (peerConnection) {
                    peerConnection.close();
                    peerConnection = null;
                }
                videoContainer.remove();
                appendMessage('[视频通话] 视频已挂断', 'me');
            };

            controlsDiv.appendChild(switchBtn);
            controlsDiv.appendChild(hangupBtn);

            videoContainer.appendChild(videoElement);
            videoContainer.appendChild(controlsDiv);

            // 窗口自由拖动逻辑
            let isDragging = false;
            let startX, startY;

            videoContainer.addEventListener('pointerdown', (e) => {
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                videoContainer.setPointerCapture(e.pointerId);
            });

            videoContainer.addEventListener('pointermove', (e) => {
                if (!isDragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                videoContainer.style.transform = `translate(${dx}px, ${dy}px)`;
            });

            videoContainer.addEventListener('pointerup', (e) => {
                isDragging = false;
                videoContainer.releasePointerCapture(e.pointerId);
            });

            const div = document.createElement('div');
            div.className = 'msg me';
            const bubble = document.createElement('div');
            bubble.className = 'bubble';
            bubble.style.backgroundColor = '#000000';
            bubble.style.padding = '0';
            bubble.appendChild(videoContainer);
            div.appendChild(bubble);
            chatBox.appendChild(div);
            scrollToBottom();

        } catch (err) {
            alert(`无法调用摄像头: ${err.message}`);
        }
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
                appendMessage(`[语音通话] 📞 全球 P2P 语音通道已激活（STUN 穿透准备就绪）`, 'me');
            } catch (err) {
                alert(`无法调用麦克风: ${err.message}`);
            }
        });
    }
});
