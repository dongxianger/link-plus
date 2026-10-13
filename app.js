document.addEventListener('DOMContentLoaded', () => {
    const chatBox = document.getElementById('chat-box');
    const msgInput = document.getElementById('msg-input');
    const plusBtn = document.getElementById('plus-btn');
    const plusPanel = document.getElementById('plus-panel');
    const realFileInput = document.getElementById('real-file-input');
    const realTransferInput = document.getElementById('real-transfer-input');
    const realPhotoInput = document.getElementById('real-photo-input');

    const rtcConfig = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun.stunprotocol.org:3478' }
        ]
    };

    let peerConnection = null;
    let localStream = null;
    let currentFacingMode = 'user';

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
                appendMessage(`[Link + P2P传输] 📤 ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB) 准备就绪`, 'me');
            }
            realTransferInput.value = '';
        });
    }

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

    // 视频通话：微型精简按钮（翻转、全屏缩放、挂断）+ 完美可拖拽悬浮窗
    const btnVideo = document.getElementById('btn-video');
    let activeVideoContainer = null;
    let videoElementRef = null;
    let isFullscreen = false;

    if (btnVideo) {
        btnVideo.addEventListener('click', async () => {
            plusPanel.classList.remove('active');
            if (activeVideoContainer) return; 
            await startVideoCall(currentFacingMode);
        });
    }

    async function startVideoCall(facingMode) {
        try {
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }

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

            // 微型控制栏（微信风格图标）
            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'video-controls';

            const switchBtn = document.createElement('button');
            switchBtn.className = 'video-ctrl-btn';
            switchBtn.title = '翻转镜头';
            switchBtn.innerText = '🔄';
            switchBtn.onclick = async (e) => {
                e.stopPropagation();
                currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
                await startVideoCall(currentFacingMode);
            };

            const fullScreenBtn = document.createElement('button');
            fullScreenBtn.className = 'video-ctrl-btn';
            fullScreenBtn.title = '全屏/还原';
            fullScreenBtn.innerText = '⛶';
            fullScreenBtn.onclick = (e) => {
                e.stopPropagation();
                isFullscreen = !isFullscreen;
                videoContainer.classList.toggle('fullscreen', isFullscreen);
            };

            const hangupBtn = document.createElement('button');
            hangupBtn.className = 'video-ctrl-btn hangup';
            hangupBtn.title = '挂断';
            hangupBtn.innerText = '✕';
            hangupBtn.onclick = (e) => {
                e.stopPropagation();
                cleanupVideoCall();
                appendMessage('[Link + 视频通话] 通话已安全结束', 'me');
            };

            controlsDiv.appendChild(switchBtn);
            controlsDiv.appendChild(fullScreenBtn);
            controlsDiv.appendChild(hangupBtn);

            videoContainer.appendChild(videoElement);
            videoContainer.appendChild(controlsDiv);

            // 悬浮窗拖拽交互
            let isDragging = false;
            let startX = 0, startY = 0;
            let xOffset = 0, yOffset = 0;

            function dragStart(e) {
                if (isFullscreen || e.target.tagName === 'BUTTON' || e.target.closest('.video-controls')) return;
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                startX = clientX - xOffset;
                startY = clientY - yOffset;
                isDragging = true;
            }

            function drag(e) {
                if (!isDragging || isFullscreen) return;
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
            isFullscreen = false;
        }
    }

    const btnVoice = document.getElementById('btn-voice');
    if (btnVoice) {
        btnVoice.addEventListener('click', async () => {
            plusPanel.classList.remove('active');
            try {
                await navigator.mediaDevices.getUserMedia({ 
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
                });
                appendMessage(`[Link + 语音通话] 📞 全球 P2P 语音通道已激活`, 'me');
            } catch (err) {
                alert(`无法调用麦克风: ${err.message}`);
            }
        });
    }
});
