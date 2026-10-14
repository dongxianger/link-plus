// app.js
let ws = null;
let pc = null;
let dataChannel = null;
let localStream = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

const rtcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const statusEl = document.getElementById('connectionStatus');
const wsServerInput = document.getElementById('wsServerInput');
const connectWsBtn = document.getElementById('connectWsBtn');
const joinBtn = document.getElementById('joinRoomBtn');
const roomIdInput = document.getElementById('roomIdInput');
const msgInput = document.getElementById('messageInput');
const sendTextBtn = document.getElementById('sendTextBtn');
const chatMessages = document.getElementById('chatMessages');
const togglePlusBtn = document.getElementById('togglePlusBtn');
const extensionPanel = document.getElementById('extensionPanel');
const fileInput = document.getElementById('fileInput');

const mediaContainer = document.getElementById('mediaContainer');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startVideoCallBtn = document.getElementById('startVideoCallBtn');
const startVoiceCallBtn = document.getElementById('startVoiceCallBtn');
const hangupCallBtn = document.getElementById('hangupCallBtn');

const recordVoiceBtn = document.getElementById('recordVoiceBtn');
const recordIcon = document.getElementById('recordIcon');
const recordLabel = document.getElementById('recordLabel');

function getCurrentTimeStr() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

// 动态连接信令服务器
connectWsBtn.addEventListener('click', () => {
    const wsUrl = wsServerInput.value.trim();
    if (!wsUrl) return alert('请输入信令服务器地址');

    if (ws) ws.close();

    statusEl.innerText = '正在连接信令服务器...';
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        statusEl.innerText = '信令服务器已连接，请输入房间号加入 🟢';
    };

    ws.onerror = () => {
        statusEl.innerText = '信令服务器连接失败 🔴';
        alert('无法连接到该信令服务器，请检查地址是否正确或网络是否畅通！');
    };

    ws.onclose = () => {
        statusEl.innerText = '信令连接已断开 🔴';
    };

    ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'joined') {
            statusEl.innerText = '已加入房间，等待对方...';
            initPeerConnection(true);
        } else if (data.type === 'full') {
            alert('房间已满');
        } else if (data.offer) {
            if (!pc) initPeerConnection(false);
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify({ answer }));
        } else if (data.answer) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        } else if (data.candidate) {
            if (pc) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    };
});

// 默认点击自动连一次输入框里的地址
connectWsBtn.click();

// 加入房间
joinBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim();
    if (!roomId) return alert('请输入房间号');
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        return alert('请先成功连接信令服务器！');
    }
    ws.send(JSON.stringify({ type: 'join', roomId }));
    statusEl.innerText = '正在匹配房间...';
});

function initPeerConnection(isInitiator) {
    pc = new RTCPeerConnection(rtcConfig);

    pc.ontrack = (event) => {
        mediaContainer.classList.add('active');
        remoteVideo.srcObject = event.streams[0];
    };

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            ws.send(JSON.stringify({ candidate: event.candidate }));
        }
    };

    if (isInitiator) {
        dataChannel = pc.createDataChannel("link-plus-channel");
        setupDataChannel();
        pc.createOffer().then(offer => pc.setLocalDescription(offer)).then(() => {
            ws.send(JSON.stringify({ offer: pc.localDescription }));
        });
    } else {
        pc.ondatachannel = (event) => {
            dataChannel = event.channel;
            setupDataChannel();
        };
    }
}

function setupDataChannel() {
    dataChannel.onopen = () => {
        statusEl.innerText = 'Link+ P2P 直连已建立 🟢';
    };
    dataChannel.onclose = () => {
        statusEl.innerText = 'P2P直连已断开 🔴';
    };

    let incomingFile = { name: '', size: 0, type: '', buffer: [], receivedSize: 0 };
    let incomingAudio = { buffer: [], size: 0, receivedSize: 0 };

    dataChannel.onmessage = (event) => {
        if (typeof event.data === 'string') {
            try {
                const msg = JSON.parse(event.data);
                if (msg.fileMeta) {
                    incomingFile.name = msg.name;
                    incomingFile.size = msg.size;
                    incomingFile.type = msg.type;
                    incomingFile.buffer = [];
                    incomingFile.receivedSize = 0;
                    appendMessage(`收到文件传输请求: ${msg.name} (${(msg.size/1024/1024).toFixed(2)}MB)`, 'incoming');
                    return;
                }
                if (msg.audioMeta) {
                    incomingAudio.size = msg.size;
                    incomingAudio.buffer = [];
                    incomingAudio.receivedSize = 0;
                    return;
                }
            } catch (e) {
                appendMessage(event.data, 'incoming');
            }
        } else {
            if (incomingAudio.size > 0 && incomingAudio.receivedSize < incomingAudio.size) {
                incomingAudio.buffer.push(event.data);
                incomingAudio.receivedSize += event.data.byteLength;

                if (incomingAudio.receivedSize >= incomingAudio.size) {
                    const blob = new Blob(incomingAudio.buffer, { type: 'audio/webm' });
                    const audioUrl = URL.createObjectURL(blob);
                    appendAudioMessage(audioUrl, 'incoming');
                    incomingAudio.size = 0;
                }
                return;
            }

            incomingFile.buffer.push(event.data);
            incomingFile.receivedSize += event.data.byteLength;

            if (incomingFile.receivedSize >= incomingFile.size) {
                const blob = new Blob(incomingFile.buffer, { type: incomingFile.type });
                const url = URL.createObjectURL(blob);
                appendFileMessage(incomingFile.name, url, 'incoming');
            }
        }
    };
}

// 扩展面板控制
togglePlusBtn.addEventListener('click', () => {
    extensionPanel.classList.toggle('active');
});

// 发送文本
function sendTextMessage() {
    const text = msgInput.value.trim();
    if (!text) return;

    if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(text);
        appendMessage(text, 'outgoing');
        msgInput.value = '';
    } else {
        alert('请先建立 P2P 直连再发送消息！');
    }
}

sendTextBtn.addEventListener('click', sendTextMessage);
msgInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendTextMessage();
});

// 录音发送
recordVoiceBtn.addEventListener('click', async () => {
    if (!dataChannel || dataChannel.readyState !== 'open') {
        alert('请先建立 P2P 直连！');
        return;
    }

    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const localAudioUrl = URL.createObjectURL(audioBlob);
                appendAudioMessage(localAudioUrl, 'outgoing');

                dataChannel.send(JSON.stringify({ audioMeta: true, size: audioBlob.size }));
                audioBlob.arrayBuffer().then(buffer => {
                    dataChannel.send(buffer);
                });

                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            isRecording = true;
            recordIcon.classList.add('recording');
            recordIcon.innerText = '⏹️';
            recordLabel.innerText = '点击停止';
            extensionPanel.classList.remove('active');
        } catch (err) {
            alert('无法获取麦克风权限');
        }
    } else {
        mediaRecorder.stop();
        isRecording = false;
        recordIcon.classList.remove('recording');
        recordIcon.innerText = '🎤';
        recordLabel.innerText = '发送语音';
    }
});

// 视频通话
startVideoCallBtn.addEventListener('click', async () => {
    extensionPanel.classList.remove('active');
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        mediaContainer.classList.add('active');
        appendMessage('已发起视频通话...', 'outgoing');
        
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({ offer }));
    } catch (err) {
        alert('无法获取摄像头/麦克风权限');
    }
});

// 语音通话
startVoiceCallBtn.addEventListener('click', async () => {
    extensionPanel.classList.remove('active');
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        mediaContainer.classList.add('active');
        appendMessage('已发起语音通话连麦...', 'outgoing');
        
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({ offer }));
    } catch (err) {
        alert('无法获取麦克风权限');
    }
});

hangupCallBtn.addEventListener('click', () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    mediaContainer.classList.remove('active');
    appendMessage('通话已结束', 'outgoing');
});

// 万能文件快传
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!dataChannel || dataChannel.readyState !== 'open') {
        alert('请先建立 P2P 直连！');
        return;
    }

    extensionPanel.classList.remove('active');
    appendMessage(`正在发送文件: ${file.name}`, 'outgoing');

    dataChannel.send(JSON.stringify({ fileMeta: true, name: file.name, size: file.size, type: file.type }));

    const chunkSize = 16384;
    let offset = 0;
    const reader = new FileReader();

    reader.onload = (evt) => {
        dataChannel.send(evt.target.result);
        offset += evt.target.result.byteLength;
        if (offset < file.size) {
            readNextChunk();
        } else {
            appendMessage(`文件 ${file.name} 发送完毕！`, 'outgoing');
        }
    };

    function readNextChunk() {
        const slice = file.slice(offset, offset + chunkSize);
        reader.readAsArrayBuffer(slice);
    }

    readNextChunk();
});

function appendMessage(text, type) {
    const timeStr = getCurrentTimeStr();
    const container = document.createElement('div');
    container.className = `message-container ${type}`;
    container.innerHTML = `
        <div class="message-time">${timeStr}</div>
        <div class="message-row ${type}">
            <div class="message-bubble">${text}</div>
        </div>
    `;
    chatMessages.appendChild(container);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendAudioMessage(url, type) {
    const timeStr = getCurrentTimeStr();
    const container = document.createElement('div');
    container.className = `message-container ${type}`;
    container.innerHTML = `
        <div class="message-time">${timeStr}</div>
        <div class="message-row ${type}">
            <div class="message-bubble" style="display: flex; align-items: center; gap: 8px;">
                <span>语音消息 🔊</span>
                <audio src="${url}" controls style="height: 30px; width: 140px;"></audio>
            </div>
        </div>
    `;
    chatMessages.appendChild(container);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendFileMessage(name, url, type) {
    const timeStr = getCurrentTimeStr();
    const container = document.createElement('div');
    container.className = `message-container ${type}`;
    container.innerHTML = `
        <div class="message-time">${timeStr}</div>
        <div class="message-row ${type}">
            <div class="message-bubble">文件接收完成：<a href="${url}" download="${name}" style="color:blue; text-decoration:underline;">点击下载 ${name}</a></div>
        </div>
    `;
    chatMessages.appendChild(container);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
