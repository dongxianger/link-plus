// app.js
const ws = new WebSocket('wss://linkplus-signal.903744040.workers.dev/');

let pc = null;
let dataChannel = null;
let localStream = null;
const rtcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const statusEl = document.getElementById('connectionStatus');
const joinBtn = document.getElementById('joinRoomBtn');
const roomIdInput = document.getElementById('roomIdInput');
const msgInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendMsgBtn');
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

ws.onopen = () => {
    statusEl.innerText = '信令服务器已连接，请对暗号';
};

ws.onerror = () => {
    statusEl.innerText = '信令服务器连接失败 🔴';
};

// 扩展面板显隐控制
togglePlusBtn.addEventListener('click', () => {
    extensionPanel.classList.toggle('active');
});

// 对暗号连接
joinBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim();
    if (!roomId) return alert('请输入暗号');
    ws.send(JSON.stringify({ type: 'join', roomId }));
    statusEl.innerText = '正在匹配服务器...';
});

// 完美匹配你的后端角色分发逻辑，绝对不改动任何 UI
ws.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    
    if (data.role === 'initiator' || data.type === 'joined') {
        statusEl.innerText = '暗号已对上，正在建立直连...';
        initPeerConnection(true); // 发起方
    } else if (data.role === 'peer') {
        statusEl.innerText = '暗号已对上，正在等待对方握手...';
        initPeerConnection(false); // 接收方
    } else if (data.type === 'full') {
        alert('当前暗号通道已满');
    } else if (data.offer) {
        if (!pc) initPeerConnection(false);
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws.send(JSON.stringify({ answer }));
    } else if (data.answer) {
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    } else if (data.candidate) {
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
};

function initPeerConnection(isInitiator) {
    pc = new RTCPeerConnection(rtcConfig);

    // 接收远端音视频流
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
        msgInput.disabled = false; // 解锁输入框
    };
    dataChannel.onclose = () => {
        statusEl.innerText = '连接已断开 🔴';
        msgInput.disabled = true;
    };

    let incomingFile = { name: '', size: 0, type: '', buffer: [], receivedSize: 0 };

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
            } catch (e) {
                appendMessage(event.data, 'incoming');
            }
        } else {
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

// 拨打视频电话
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

// 拨打语音电话
startVoiceCallBtn.addEventListener('click', async () => {
    extensionPanel.classList.remove('active');
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        mediaContainer.classList.add('active');
        appendMessage('已发起语音通话...', 'outgoing');
        
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({ offer }));
    } catch (err) {
        alert('无法获取麦克风权限');
    }
});

// 挂断通话
hangupCallBtn.addEventListener('click', () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    mediaContainer.classList.remove('active');
    appendMessage('通话已结束', 'outgoing');
});

// 发送文本消息
sendBtn.addEventListener('click', () => {
    const text = msgInput.value.trim();
    if (!text || !dataChannel || dataChannel.readyState !== 'open') return;
    dataChannel.send(text);
    appendMessage(text, 'outgoing');
    msgInput.value = '';
});

// 发送大文件切片
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file || !dataChannel || dataChannel.readyState !== 'open') return;

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
    const row = document.createElement('div');
    row.className = `message-row ${type}`;
    row.innerHTML = `<div class="message-bubble">${text}</div>`;
    chatMessages.appendChild(row);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendFileMessage(name, url, type) {
    const row = document.createElement('div');
    row.className = `message-row ${type}`;
    row.innerHTML = `<div class="message-bubble">文件接收完成：<a href="${url}" download="${name}" style="color:blue; text-decoration:underline;">点击下载 ${name}</a></div>`;
    chatMessages.appendChild(row);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
