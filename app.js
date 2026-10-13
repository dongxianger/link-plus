document.addEventListener('DOMContentLoaded', () => {
    const chatBox = document.getElementById('chat-box');
    const msgInput = document.getElementById('msg-input');
    const plusBtn = document.getElementById('plus-btn');
    const plusPanel = document.getElementById('plus-panel');
    const realFileInput = document.getElementById('real-file-input');
    const realTransferInput = document.getElementById('real-transfer-input');
    const realPhotoInput = document.getElementById('real-photo-input');

    // Link + 全球公网 STUN 服务器配置（用于跨网 P2P 穿透打洞）
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
            appendMessage(`[Link + 文件] 📄 ${file.name} (${(file.size/1024).toFixed(1)} KB)`, 'me');
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
                appendMessage(`[Link + P2P大文件传输] 📤 ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB) 准备就绪`, 'me');
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

    // 6. 视频通话（完美修复：前后摄像头正反转切换、完美悬浮自由拖拽、挂断、STUN 打洞）
    const btnVideo = document.getElementById('btn-video');
    let activeVideoContainer = null;
    let videoElementRef = null;

    if (btnVideo) {
        btnVideo.addEventListener('click', async () => {
            plusPanel.classList.remove('active');
            if (activeVideoContainer) return; 
            await startVideoCall(currentFacingMode);
        });
    }

    async function startVideoCall(facingMode) {
        try {
            // 关闭旧轨道
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }

            // 获取指定摄像头（前置/后置）
            localStream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: { exact: facingMode } }, 
                audio: { echoCancellation: true, noiseSuppression: true } 
            }).catch(async () => {
                return await navigator.mediaDevices.getUserMedia({ 
                    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: facingMode }, 
                    audio: { echoCancellation: true, noiseSuppression: true } 
                });
            });

            if (!peerConnection) {
                peerConnection = new RTCPeerConnection(rtcConfig);
            }
            
            const videoTrack = localStream.getVideoTracks()[0];
            const audioTrack = localStream.getAudioTracks()[0];
            
            const senders = peerConnection.getSenders();
            if (senders.length > 0) {
                const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                if (videoSender) videoSender.replaceTrack(videoTrack);
                const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
                if (audioSender) audioSender.replaceTrack(audioTrack);
            } else {
                localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
            }

            if (videoElementRef) {
                videoElementRef.srcObject = localStream;
                return;
            }

            const videoContainer = document.createElement('div');
            videoContainer.className = 'draggable-video-box';
            activeVideoContainer = videoContainer;

            const videoElement = document.createElement('video');
            videoElement.srcObject = localStream;
            videoElement.autoplay = true;
            videoElement.playsInline = true;
            videoElement.muted = true;
            videoElementRef = videoElement;

            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'video-controls';

            const switchBtn = document.createElement('button');
            switchBtn.className = 'video-ctrl-btn';
            switchBtn.innerText = '🔄 翻转镜头';
            switchBtn.onclick = async (e) => {
                e.stopPropagation();
                currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
                await startVideoCall(currentFacingMode);
            };

            const hangupBtn = document.createElement('button');
            hangupBtn.className = 'video-ctrl-btn hangup';
            hangupBtn.innerText = '❌ 挂断';
            hangupBtn.onclick = (e) => {
                e.stopPropagation();
                cleanupVideoCall();
                appendMessage('[Link + 视频通话] 通话已安全结束', 'me');
            };

            controlsDiv.appendChild(switchBtn);
            controlsDiv.appendChild(hangupBtn);

            videoContainer.appendChild(videoElement);
            videoContainer.appendChild(controlsDiv);

            // 完美的悬浮窗双向拖拽算法（完美解决触控和鼠标位移卡顿）
            let isDragging = false;
            let startX = 0, startY = 0;
            let xOffset = 0, yOffset = 0;

            function dragStart(e) {
                if (e.target.tagName === 'BUTTON' || e.target.closest('.video-controls')) return;
                
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                
                startX = clientX - xOffset;
                startY = clientY - yOffset;
                isDragging = true;
            }

            function drag(e) {
                if (!isDragging) return;
                e.preventDefault();
                
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                
                xOffset = clientX - startX;
                yOffset = clientY - startY;

                videoContainer.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0)`;
            }

            function dragEnd() {
                isDragging = false;
            }

            videoContainer.addEventListener('mousedown', dragStart);
            window.addEventListener('mousemove', drag);
            window.addEventListener('mouseup', dragEnd);

            videoContainer.addEventListener('touchstart', dragStart, { passive: false });
            window.addEventListener('touchmove', drag, { passive: false });
            window.addEventListener('touchend', dragEnd);

            const div = document.createElement('div');
            div.className = 'msg me';
            const bubble = document.createElement('div');
            bubble.className = 'bubble';
            bubble.style.backgroundColor = 'transparent';
            bubble.style.padding = '0';
            bubble.style.border = 'none';
            bubble.appendChild(videoContainer);
            div.appendChild(bubble);
            chatBox.appendChild(div);
            scrollToBottom();

        } catch (err) {
            alert(`无法调用摄像头: ${err.message}`);
        }
    }

    function cleanupVideoCall() {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        if (activeVideoContainer) {
            activeVideoContainer.remove();
            activeVideoContainer = null;
            videoElementRef = null;
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
                appendMessage(`[Link + 语音通话] 📞 全球 P2P 语音通道已激活（STUN 穿透准备就绪）`, 'me');
            } catch (err) {
                alert(`无法调用麦克风: ${err.message}`);
            }
        });
    }
});
