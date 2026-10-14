let ws = null;
let peer = null;
let conn = null;
let pc = null;
let dataChannel = null;
let localStream = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let currentRoomId = null;
let isConnected = false;

const SIGNALING_SERVERS = [
    'wss://free.blr2.piesocket.com/v1/room1?api_key=VCXCEuvhGcSkDPGJRN3CCogibnuCL8iljnNhF5ga&notify_self=0',
    'wss://socketsbay.com/wss/v2/2/demo/'
];

const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.stunprotocol.org:3478' }
    ]
};

const statusEl = document.getElementById('connectionStatus');
const joinBtn = document.getElementById('joinRoomBtn');
const roomIdInput = document.getElementById('roomIdInput');
const msgInput = document.getElementById('messageInput');
const sendTextBtn = document.getElementById('sendTextBtn');
const chatMessages = document.getElementById('chatMessages');
const togglePlusBtn = document.getElementById('togglePlusBtn');
const extensionPanel = document.getElementById('extensionPanel');
const fileInput = document.getElementById('fileInput');
const imageInput = document.getElementById('imageInput');

const mediaContainer = document.getElementById('mediaContainer');
const localVideo = document.getElementById('videoElement');
const remoteVideo = document.getElementById('remoteVideo');
const startVideoCallBtn = document.getElementById('startVideoCallBtn');
const startVoiceCallBtn = document.getElementById('startVoiceCallBtn');
const hangupCallBtn = document.getElementById('hangupCallBtn');

const recordVoiceBtn = document.getElementById('recordVoiceBtn');
const recordIcon = document.getElementById('recordIcon');
const recordLabel = document.getElementById('recordLabel');

function getCurrentTimeStr() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

joinBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim();
    if (!roomId) return alert('请输入房间号');
    currentRoomId = roomId;
    isConnected = false;

    statusEl.innerText = '连接中...';
    tryWsSignaling(roomId);

    setTimeout(() => {
        if (!isConnected) {
            tryPeerJsSignaling(roomId);
        }
    }, 1500);
});

function tryWsSignaling(roomId) {
    if (ws) ws.close();
    ws = new WebSocket(SIGNALING_SERVERS[0]);

    ws.onopen = () => {
        if (isConnected) return;
        ws.send(JSON.stringify({ type: 'join', roomId: roomId }));
        initPeerConnection(true, 'ws');
    };

    ws.onmessage = async (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.roomId && data.roomId !== roomId) return;

            if (data.offer) {
                if (!pc) initPeerConnection(false, 'ws');
                await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                ws.send(JSON.stringify({ type: 'signal', roomId: roomId, answer }));
            } else if (data.answer) {
                if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            } else if (data.candidate) {
                if (pc) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
        } catch (e) {}
    };
}

function tryPeerJsSignaling(roomId) {
    if (isConnected) return;
    statusEl.innerText = '启用备用信令...';

    const myPeerId = 'linkplus-' + roomId + '-' + Math.floor(Math.random() * 1000);
    const targetPeerId = 'linkplus-' + roomId;

    if (peer) peer.destroy();
    peer = new Peer(myPeerId);

    peer.on('open', (id) => {
        const callConn = peer.connect(targetPeerId);
        setupPeerConnectionData(callConn);

        peer.on('connection', (incomingConn) => {
            setupPeerConnectionData(incomingConn);
        });
    });

    peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
            const fallbackConn = new Peer().connect('linkplus-' + roomId);
            setupPeerConnectionData(fallbackConn);
        }
    });
}

function setupPeerConnectionData(connection) {
    conn = connection;
    conn.on('open', () => {
        isConnected = true;
        statusEl.innerText = '直连已建立 🟢';
    });
    conn.on('data', (data) => {
        handleIncomingData(data);
    });
}

function initPeerConnection(isInitiator, type) {
    if (pc) pc.close();
    pc = new RTCPeerConnection(rtcConfig);

    pc.ontrack = (event) => {
        mediaContainer.classList.add('active');
        remoteVideo.srcObject = event.streams[0];
    };

    pc.onicecandidate = (event) => {
        if (event.candidate && type === 'ws' && ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'signal', roomId: currentRoomId, candidate: event.candidate }));
        }
    };

    if (isInitiator && type === 'ws') {
        dataChannel = pc.createDataChannel("link-plus-channel");
        setupDataChannel();
        pc.createOffer().then(offer => pc.setLocalDescription(offer)).then(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'signal', roomId: currentRoomId, offer: pc.localDescription }));
            }
        });
    } else if (type === 'ws') {
        pc.ondatachannel = (event) => {
            dataChannel = event.channel;
            setupDataChannel();
        };
    }
}

function setupDataChannel() {
    dataChannel.onopen = () => {
        isConnected = true;
        statusEl.innerText = '直连已建立 🟢';
    };
    dataChannel.onclose = () => {
        statusEl.innerText = '直连断开 🔴';
    };
    dataChannel.onmessage = (event) => {
        handleIncomingData(event.data);
    };
}

let incomingFile = { name: '', size: 0, type: '', isImage: false, buffer: [], receivedSize: 0 };
let incomingAudio = { buffer: [], size: 0, receivedSize: 0 };

function handleIncomingData(data) {
    if (typeof data === 'string') {
        try {
            const msg = JSON.parse(data);
            if (msg.fileMeta) {
                incomingFile.name = msg.name;
                incomingFile.size = msg.size;
                incomingFile.type = msg.type;
                incomingFile.isImage = msg.isImage || false;
                incomingFile.buffer = [];
                incomingFile.receivedSize = 0;
                if (!incomingFile.isImage) {
                    appendMessage(`收到文件: ${msg.name} (${(msg.size/1024/1024).toFixed(2)}MB)`, 'incoming');
                }
                return;
            }
            if (msg.audioMeta) {
                incomingAudio.size = msg.size;
                incomingAudio.buffer = [];
                incomingAudio.receivedSize = 0;
                return;
            }
        } catch (e) {
            appendMessage(data, 'incoming');
        }
    } else {
        if (incomingAudio.size > 0 && incomingAudio.receivedSize < incomingAudio.size) {
            incomingAudio.buffer.push(data);
            incomingAudio.receivedSize += data.byteLength;
            if (incomingAudio.receivedSize >= incomingAudio.size) {
                const blob = new Blob(incomingAudio.buffer, { type: 'audio/webm' });
                appendAudioMessage(URL.createObjectURL(blob), 'incoming');
                incomingAudio.size = 0;
            }
            return;
        }

        incomingFile.buffer.push(data);
        incomingFile.receivedSize += data.byteLength;
        if (incomingFile.receivedSize >= incomingFile.size) {
            const blob = new Blob(incomingFile.buffer, { type: incomingFile.type });
            const url = URL.createObjectURL(blob);
            if (incomingFile.isImage) {
                appendImageMessage(url, 'incoming');
            } else {
                appendFileMessage(incomingFile.name, url, 'incoming');
            }
        }
    }
}

togglePlusBtn.addEventListener('click', () => {
    extensionPanel.classList.toggle('active');
});

function sendTextMessage() {
    const text = msgInput.value.trim();
    if (!text) return;
    if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(text);
        appendMessage(text, 'outgoing');
        msgInput.value = '';
    } else if (conn && conn.open) {
        conn.send(text);
        appendMessage(text, 'outgoing');
        msgInput.value = '';
    } else {
        alert('请先建立 P2P 直连！');
    }
}

sendTextBtn.addEventListener('click', sendTextMessage);
msgInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendTextMessage(); });

imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    extensionPanel.classList.remove('active');
    appendImageMessage(URL.createObjectURL(file), 'outgoing');

    const meta = JSON.stringify({ fileMeta: true, name: file.name, size: file.size, type: file.type, isImage: true });
    if (dataChannel && dataChannel.readyState === 'open') dataChannel.send(meta);
    else if (conn && conn.open) conn.send(meta);

    file.arrayBuffer().then(buf => {
        if (dataChannel && dataChannel.readyState === 'open') dataChannel.send(buf);
        else if (conn && conn.open) conn.send(buf);
    });
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    extensionPanel.classList.remove('active');
    appendMessage(`正在发送文件: ${file.name}`, 'outgoing');

    const meta = JSON.stringify({ fileMeta: true, name: file.name, size: file.size, type: file.type, isImage: false });
    if (dataChannel && dataChannel.readyState === 'open') dataChannel.send(meta);
    else if (conn && conn.open) conn.send(meta);

    file.arrayBuffer().then(buf => {
        if (dataChannel && dataChannel.readyState === 'open') dataChannel.send(buf);
        else if (conn && conn.open) conn.send(buf);
    });
});

startVideoCallBtn.addEventListener('click', async () => {
    extensionPanel.classList.remove('active');
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        mediaContainer.classList.add('active');
        localVideo.srcObject = localStream;
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        appendMessage('已发起视频通话 📹', 'outgoing');
    } catch (err) {
        alert('无法获取音视频权限');
    }
});

startVoiceCallBtn.addEventListener('click', async () => {
    extensionPanel.classList.remove('active');
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        appendMessage('已发起语音通话 📞', 'outgoing');
    } catch (err) {
        alert('无法获取麦克风权限');
    }
});

hangupCallBtn.addEventListener('click', () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    mediaContainer.classList.remove('active');
    appendMessage('通话已挂断', 'incoming');
});

recordVoiceBtn.addEventListener('click', async () => {
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunks, { type: 'audio/webm' });
                appendAudioMessage(URL.createObjectURL(blob), 'outgoing');

                const meta = JSON.stringify({ audioMeta: true, size: blob.size });
                if (dataChannel && dataChannel.readyState === 'open') dataChannel.send(meta);
                else if (conn && conn.open) conn.send(meta);

                blob.arrayBuffer().then(buf => {
                    if (dataChannel && dataChannel.readyState === 'open') dataChannel.send(buf);
                    else if (conn && conn.open) conn.send(buf);
                });
            };
            mediaRecorder.start();
            isRecording = true;
            recordIcon.innerText = '🔴';
            recordLabel.innerText = '停止';
        } catch (e) {
            alert('无法录音');
        }
    } else {
        mediaRecorder.stop();
        isRecording = false;
        recordIcon.innerText = '🎤';
        recordLabel.innerText = '录音';
        extensionPanel.classList.remove('active');
    }
});

function appendMessage(text, type) {
    const container = document.createElement('div');
    container.className = `message-container ${type}`;
    container.innerHTML = `<div class="message-time">${getCurrentTimeStr()}</div><div class="message-row ${type}"><div class="message-bubble">${text}</div></div>`;
    chatMessages.appendChild(container);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendImageMessage(url, type) {
    const container = document.createElement('div');
    container.className = `message-container ${type}`;
    container.innerHTML = `<div class="message-time">${getCurrentTimeStr()}</div><div class="message-row ${type}"><div class="message-bubble" style="padding:4px;"><img src="${url}" class="chat-image" onclick="window.open('${url}')"></div></div>`;
    chatMessages.appendChild(container);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendAudioMessage(url, type) {
    const container = document.createElement('div');
    container.className = `message-container ${type}`;
    container.innerHTML = `<div class="message-time">${getCurrentTimeStr()}</div><div class="message-row ${type}"><div class="message-bubble" style="display:flex;align-items:center;gap:8px;"><span>语音消息 🔊</span><audio src="${url}" controls style="height:30px;width:130px;"></audio></div></div>`;
    chatMessages.appendChild(container);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendFileMessage(name, url, type) {
    const container = document.createElement('div');
    container.className = `message-container ${type}`;
    container.innerHTML = `<div class="message-time">${getCurrentTimeStr()}</div><div class="message-row ${type}"><div class="message-bubble">文件接收完成：<a href="${url}" download="${name}" style="color:blue;text-decoration:underline;">点击下载 ${name}</a></div></div>`;
    chatMessages.appendChild(container);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
