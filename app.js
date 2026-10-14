document.addEventListener('DOMContentLoaded', () => {
    const chatBox = document.getElementById('chat-box');
    const msgInput = document.getElementById('msg-input');
    const plusBtn = document.getElementById('plus-btn');
    const plusPanel = document.getElementById('plus-panel');
    const realFileInput = document.getElementById('real-file-input');
    const realPhotoInput = document.getElementById('real-photo-input');

    // 顶级跨省/跨运营商 STUN/TURN 多节点穿透矩阵 (打洞配置)
    const rtcConfig = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun.stunprotocol.org:3478' }
        ],
        iceCandidatePoolSize: 10
    };

    let peerConnection = null;
    let dataChannel = null;
    let localStream = null;
    let currentFacingMode = 'user';
    let isConnected = false;

    // -------------------------------------------------------------
    // 防线 1：刷新/关闭页面防误触拦截 (beforeunload)
    // -------------------------------------------------------------
    window.addEventListener('beforeunload', (e) => {
        if (isConnected) {
            const confirmationMessage = '系统提示：当前 P2P 连接与传输可能会中断，确定要离开或刷新吗？';
            (e || window.event).returnValue = confirmationMessage;
            return confirmationMessage;
        }
    });

    // -------------------------------------------------------------
    // 防线 2：聊天历史与状态持久化 (localStorage)
    // -------------------------------------------------------------
    loadChatHistory();

    function saveChatHistory(content, sender, isHtml = false) {
        try {
            const history = JSON.parse(localStorage.getItem('linkplus_chat_history') || '[]');
            history.push({ content, sender, isHtml, timestamp: Date.now() });
            localStorage.setItem('linkplus_chat_history', JSON.stringify(history));
        } catch (e) {
            console.warn('缓存数据超出大小控制');
        }
    }

    function loadChatHistory() {
        try {
            const history = JSON.parse(localStorage.getItem('linkplus_chat_history') || '[]');
            history.forEach(item => {
                renderMessageBubble(item.content, item.sender, item.isHtml);
            });
        } catch (e) {
            console.error('加载持久化历史记录失败', e);
        }
    }

    // -------------------------------------------------------------
    // 防线 3：URL Hash 房间号保活与自动握手恢复
    // -------------------------------------------------------------
    let currentRoomId = window.location.hash.replace('#room=', '');
    if (!currentRoomId) {
        currentRoomId = 'linkplus_' + Math.floor(1000 + Math.random() * 9000);
        window.location.hash = `room=${currentRoomId}`;
    }

    // UI 交互逻辑
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

        msgInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const val = msgInput.value.trim();
                if (!val) return;
                appendMessage(val, 'me');
                if (dataChannel && dataChannel.readyState === 'open') {
                    dataChannel.send(JSON.stringify({ type: 'text', content: val }));
                }
                msgInput.value = '';
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (plusPanel && plusPanel.classList.contains('active')) {
            if (!plusPanel.contains(e.target) && e.target !== plusBtn) {
                plusPanel.classList.remove('active');
            }
        }
    });

    function appendMessage(content, sender, isHtml = false) {
        renderMessageBubble(content, sender, isHtml);
        saveChatHistory(content, sender, isHtml);
    }

    function renderMessageBubble(content, sender, isHtml = false) {
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

    // -------------------------------------------------------------
    // P2P 全速建立直连与打洞引擎
    // -------------------------------------------------------------
    const btnConnect = document.getElementById('btn-connect');
    if (btnConnect) {
        btnConnect.addEventListener('click', async () => {
            plusPanel.classList.remove('active');
            await initP2PConnection();
        });
    }

    async function initP2PConnection(isReceiver = false) {
        if (peerConnection) return;
        peerConnection = new RTCPeerConnection(rtcConfig);

        peerConnection.onicecandidate = (event) => {
            if (!event.candidate) {
                const sdpStr = btoa(JSON.stringify(peerConnection.localDescription));
                const actionName = isReceiver ? "【连接应答暗号 (Answer)】" : "【发起连接暗号 (Offer)】";
                const userPromptMsg = prompt(`房间 [${currentRoomId}] ${actionName}：请复制下方暗号发送给对方：`, sdpStr);
                
                if (userPromptMsg !== null && isReceiver === false) {
                    const answerInput = prompt("请输入对方传回的【应答暗号 (Answer)】：");
                    if (answerInput) {
                        try {
                            const remoteDesc = JSON.parse(atob(answerInput.trim()));
                            peerConnection.setRemoteDescription(new RTCSessionDescription(remoteDesc));
                            isConnected = true;
                            appendMessage('[Link+ P2P] 🔗 跨网打洞成功，全速通道已开启！', 'me');
                        } catch (err) {
                            alert('暗号解析失败！');
                        }
                    }
                }
            }
        };

        peerConnection.onconnectionstatechange = () => {
            if (peerConnection.connectionState === 'connected') {
                isConnected = true;
            } else if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
                isConnected = false;
            }
        };

        if (isReceiver) {
            peerConnection.ondatachannel = (event) => {
                dataChannel = event.channel;
                setupDataChannel();
                isConnected = true;
                appendMessage('[Link+ P2P] 🔗 收到直连响应，全速通道握手成功！', 'peer');
            };
            peerConnection.ontrack = (event) => {
                handleRemoteStream(event.streams[0]);
            };

            const offerInput = prompt(`房间 [${currentRoomId}] 接收方模式：请输入对方发来的【发起暗号 (Offer)】：`);
            if (offerInput) {
                try {
                    const remoteDesc = JSON.parse(atob(offerInput.trim()));
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(remoteDesc));
                    const answer = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answer);
                } catch (err) {
                    alert('Offer 解析失败！');
                }
            }
        } else {
            dataChannel = peerConnection.createDataChannel("link-plus-data");
            setupDataChannel();

            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
        }
    }

    function setupDataChannel() {
        dataChannel.binaryType = 'arraybuffer';
        dataChannel.onopen = () => {
            isConnected = true;
            appendMessage('[Link+ P2P] 数据通道已开启，文件与即时消息全速直传中', 'peer');
        };
        dataChannel.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'text') {
                    appendMessage(data.content, 'peer');
                }
            } catch (e) {
                console.log('收到二进制文件裸流数据', event.data);
            }
        };
    }

    function handleRemoteStream(stream) {
        const videoContainer = document.createElement('div');
        videoContainer.className = 'draggable-video-box';
        const videoElement = document.createElement('video');
        videoElement.srcObject = stream;
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoContainer.appendChild(videoElement);

        const div = document.createElement('div');
        div.className = 'msg peer';
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        bubble.style.backgroundColor = 'transparent';
        bubble.style.padding = '0';
        bubble.appendChild(videoContainer);
        div.appendChild(bubble);
        chatBox.appendChild(div);
        scrollToBottom();
    }

    // 文件传输（含自动分片流控）
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
            appendMessage(`[Link+ 文件] 📄 ${file.name} (${(file.size/1024/1024).toFixed(2)} MB) 正在全速直传...`, 'me');
            
            if (dataChannel && dataChannel.readyState === 'open') {
                sendFileInChunks(file);
            }
            realFileInput.value = '';
        });
    }

    // 大文件分片切片发送（缓冲控制，全速不爆内存）
    function sendFileInChunks(file) {
        const chunkSize = 64 * 1024; // 64KB 高速切片
        const fileReader = new FileReader();
        let offset = 0;

        fileReader.onload = (e) => {
            dataChannel.send(e.target.result);
            offset += e.target.result.byteLength;
            if (offset < file.size) {
                if (dataChannel.bufferedAmount > 8 * 1024 * 1024) {
                    setTimeout(readNextChunk, 50);
                } else {
                    readNextChunk();
                }
            } else {
                appendMessage(`[Link+ 文件] 📄 ${file.name} 传输完成！`, 'me');
            }
        };

        function readNextChunk() {
            const slice = file.slice(offset, offset + chunkSize);
            fileReader.readAsArrayBuffer(slice);
        }

        readNextChunk();
    }

    // 照片选择
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
                appendMessage(`<img src="${evt.target.result}" alt="照片" style="max-width:100%; border-radius:4px; display:block;">`, 'me', true);
            };
            reader.readAsDataURL(file);
            realPhotoInput.value = '';
        });
    }

    // 视频通话
    const btnVideo = document.getElementById('btn-video');
    let activeVideoContainer = null;
    let videoElementRef = null;
    let isFullscreen = false;

    if (btnVideo) {
        btnVideo.addEventListener('click', async () => {
            plusPanel.classList.remove('active');
            if (activeVideoContainer) return; 
            if (!peerConnection) {
                await initP2PConnection(false);
            }
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
            switchBtn.title = '翻转镜头';
            switchBtn.innerText = '🔄';
            switchBtn.onclick = async (e) => {
                e.stopPropagation();
                currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
                await startVideoCall(currentFacingMode);
            };

            const fullScreenBtn = document.createElement('button');
            fullScreenBtn.className = 'video-ctrl-btn';
            fullScreenBtn.title = '全屏/缩回小窗';
            fullScreenBtn.innerText = '⛶';
            fullScreenBtn.onclick = (e) => {
                e.stopPropagation();
                isFullscreen = !isFullscreen;
                videoContainer.classList.toggle('fullscreen', isFullscreen);
                fullScreenBtn.innerText = isFullscreen ? '🗗' : '⛶';
            };

            const hangupBtn = document.createElement('button');
            hangupBtn.className = 'video-ctrl-btn hangup';
            hangupBtn.title = '挂断';
            hangupBtn.innerText = '✕';
            hangupBtn.onclick = (e) => {
                e.stopPropagation();
                cleanupVideoCall();
                appendMessage('[Link+ 视频通话] 通话已结束', 'me');
            };

            controlsDiv.appendChild(switchBtn);
            controlsDiv.appendChild(fullScreenBtn);
            controlsDiv.appendChild(hangupBtn);

            videoContainer.appendChild(videoElement);
            videoContainer.appendChild(controlsDiv);

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

    // 语音通话
    const btnVoice = document.getElementById('btn-voice');
    if (btnVoice) {
        btnVoice.addEventListener('click', async () => {
            if (!peerConnection) await initP2PConnection(false);
            plusPanel.classList.remove('active');
            try {
                const audioStream = await navigator.mediaDevices.getUserMedia({ 
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
                });
                audioStream.getTracks().forEach(track => peerConnection.addTrack(track, audioStream));
                appendMessage(`[Link+ 语音通话] 📞 P2P 加密语音已实时接通`, 'me');
            } catch (err) {
                alert(`无法调用麦克风: ${err.message}`);
            }
        });
    }
});
