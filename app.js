// =====================================================
//  CHZZK Together — app.js (v3: multi-room)
// =====================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
    getFirestore, collection, addDoc, updateDoc, arrayUnion, arrayRemove,
    query, orderBy, limit, limitToLast, onSnapshot,
    getDocs, writeBatch, doc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import {
    getDatabase, ref, set, remove, onValue, onDisconnect
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const firebaseConfig = {
    apiKey:            "AIzaSyCokBoeWEMFP1lXa3TRyeiL4NZtJdPVkjM",
    authDomain:        "qwqweqwe-17b83.firebaseapp.com",
    projectId:         "qwqweqwe-17b83",
    storageBucket:     "qwqweqwe-17b83.firebasestorage.app",
    messagingSenderId: "687682911187",
    appId:             "1:687682911187:web:f8a641d183e6f4bfd30d26",
    databaseURL:       "https://qwqweqwe-17b83-default-rtdb.firebaseio.com"
};

const fbApp = initializeApp(firebaseConfig);
const db    = getFirestore(fbApp);
const rtdb  = getDatabase(fbApp);

// ===== 유저 정보 =====
const defaultProfile = "https://api.dicebear.com/8.x/bottts/svg?seed=default&backgroundColor=333333";
const userId   = localStorage.getItem('chzzk_uid') || Math.random().toString(36).substring(2, 10);
localStorage.setItem('chzzk_uid', userId);
let userName   = localStorage.getItem('chzzk_name') || `Guest_${Math.floor(Math.random() * 1000)}`;
let userPic    = localStorage.getItem('chzzk_pic')  || defaultProfile;

// ===== 방(Room) 상태 =====
// 한 번에 한 방에만 들어가 있을 수 있고, 이 방을 나가면 로비로 돌아감.
let currentRoomId    = null;
let currentRoomMeta  = null;
let amIHost          = false;
let myJoinedAt       = null;
let isInitialLoad    = true;
let unsubChat        = null; // Firestore 채팅 구독 해제 함수
let unsubParticipantsFn = null; // RTDB 참여자 구독 해제 함수
let unsubConnectedFn    = null; // RTDB .info/connected 구독 해제 함수
let updatePresenceFn    = null; // 현재 방에 맞는 presence 등록 함수
let presenceRefForRoom  = null; // 현재 방의 내 presence RTDB 경로

const CHAT_WINDOW = 150; // 채팅은 최근 150개만 실시간 구독 (렉 방지)

// ===== LCK 팀 데이터 =====
const makeLckSvg = (text, color, textColor = 'white') => {
    const fs = text.length > 3 ? 20 : text.length > 2 ? 24 : 32;
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='10' fill='%23${color}'/%3E%3Ctext x='50' y='55' text-anchor='middle' dominant-baseline='middle' font-family='Arial Black,Arial,sans-serif' font-weight='900' font-size='${fs}' fill='${textColor}'%3E${text}%3C/text%3E%3C/svg%3E`;
};

const LCK_TEAMS = [
    { name: 'T1',                 color: '#E2012D', logo: makeLckSvg('T1',   'E2012D') },
    { name: 'Gen.G',              color: '#AA8B2C', logo: makeLckSvg('GEN',  'AA8B2C') },
    { name: 'Hanwha Life',        color: '#FF6B00', logo: makeLckSvg('HLE',  'FF6B00') },
    { name: 'Dplus KIA',          color: '#5B2C8E', logo: makeLckSvg('DK',   '5B2C8E') },
    { name: 'BNK FEARX',          color: '#F5C518', logo: makeLckSvg('FX',   'F5C518', '%23000') },
    { name: 'KIWOOM DRX',         color: '#0A7DCF', logo: makeLckSvg('DRX',  '0A7DCF') },
    { name: 'kt Rolster',         color: '#CC0000', logo: makeLckSvg('KT',   'CC0000') },
    { name: 'DN SOOPers',         color: '#0B8457', logo: makeLckSvg('DN',   '0B8457') },
    { name: 'Nongshim RedForce',  color: '#D32F2F', logo: makeLckSvg('NS',   'D32F2F') },
    { name: 'HANJIN BRION',       color: '#1B5E20', logo: makeLckSvg('BRO',  '1B5E20') },
];

// ===== 리액션 이모지 =====
const REACTIONS = ['👍', '🔥', '😂', '❤️', '👏'];

// ===== 알림음 =====
const playNotificationSound = () => {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const master = ctx.createGain();
        master.gain.setValueAtTime(0.4, ctx.currentTime);
        master.connect(ctx.destination);
        const ding = (freq, startT, vol, decay) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g); g.connect(master);
            o.type = 'sine';
            o.frequency.setValueAtTime(freq, ctx.currentTime + startT);
            g.gain.setValueAtTime(0, ctx.currentTime + startT);
            g.gain.linearRampToValueAtTime(vol, ctx.currentTime + startT + 0.008);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startT + decay);
            o.start(ctx.currentTime + startT);
            o.stop(ctx.currentTime + startT + decay);
            return o;
        };
        ding(1047, 0, 0.22, 0.18); ding(2093, 0, 0.06, 0.15);
        ding(1319, 0.12, 0.24, 0.28);
        const last = ding(2637, 0.12, 0.07, 0.26);
        last.onended = () => ctx.close();
    } catch (_) {}
};

// ===== 컨페티 애니메이션 =====
let confettiRafId = null; // 동시에 여러 애니메이션 루프가 겹쳐 돌면서 렉을 유발하던 것 방지
const fireConfetti = (teamColor) => {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    if (confettiRafId !== null) cancelAnimationFrame(confettiRafId);
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = [teamColor, '#f5c518', '#ffffff', teamColor, '#ff6b6b'];
    const particles = Array.from({ length: 80 }, () => ({
        x: Math.random() * canvas.width,
        y: canvas.height + 10,
        vx: (Math.random() - 0.5) * 10,
        vy: -(Math.random() * 14 + 6),
        size: Math.random() * 7 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * 360,
        rotV: (Math.random() - 0.5) * 12,
        life: 1,
    }));
    const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;
        particles.forEach(p => {
            p.vy += 0.18;
            p.x += p.vx; p.y += p.vy;
            p.rot += p.rotV; p.life -= 0.009;
            if (p.life <= 0) return;
            alive = true;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot * Math.PI / 180);
            ctx.globalAlpha = Math.min(p.life, 1);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.55);
            ctx.restore();
        });
        if (alive) {
            confettiRafId = requestAnimationFrame(animate);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            confettiRafId = null;
        }
    };
    animate();
};

// ===== XSS 방지 =====
const escapeHtml = (t = '') =>
    t.replace(/&/g,'&amp;').replace(/</g,'&lt;')
     .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

// =====================================================
//  DOM LOAD
// =====================================================
window.addEventListener('load', async () => {

    // ===== DOM: 헤더/유저 =====
    const displayNameSpan   = document.getElementById('user-display-name');
    const changeNameBtn     = document.getElementById('change-name-btn');
    const profileImg        = document.getElementById('profile-img');
    const roomNameLabel     = document.getElementById('room-name-label');

    // ===== DOM: 로비(방 목록) =====
    const lobbyScreen       = document.getElementById('lobby-screen');
    const appMain           = document.getElementById('app-main');
    const roomListEl        = document.getElementById('room-list');
    const createRoomBtn     = document.getElementById('create-room-btn');
    const leaveRoomBtn      = document.getElementById('leave-room-btn');

    const roomCreateModal   = document.getElementById('room-create-modal');
    const roomNameInput     = document.getElementById('room-name-input');
    const roomPublicRadio   = document.getElementById('room-public-radio');
    const roomPrivateRadio  = document.getElementById('room-private-radio');
    const roomPasswordInput = document.getElementById('room-password-input');
    const roomCreateCancel  = document.getElementById('room-create-cancel');
    const roomCreateSubmit  = document.getElementById('room-create-submit');

    const roomPasswordModal       = document.getElementById('room-password-modal');
    const roomPasswordPromptInput = document.getElementById('room-password-prompt-input');
    const roomPasswordCancel      = document.getElementById('room-password-cancel');
    const roomPasswordSubmit      = document.getElementById('room-password-submit');

    // ===== DOM: 방 안(영상+채팅) =====
    const chatForm           = document.getElementById('chat-form');
    const messageInput       = document.getElementById('message-input');
    const chatMessages       = document.getElementById('chat-messages');
    const clearChatBtn       = document.getElementById('clear-chat-btn');
    const participantToggle  = document.getElementById('participant-toggle');
    const participantList    = document.getElementById('participant-list');
    const userCountSpan      = document.getElementById('user-count');
    const toggleArrow        = participantToggle?.querySelector('.toggle-arrow');
    const avatarModal        = document.getElementById('avatar-modal');
    const avatarGrid         = document.getElementById('avatar-grid');
    const avatarGridLck      = document.getElementById('avatar-grid-lck');
    const avatarConfirmBtn   = document.getElementById('avatar-confirm-btn');
    const avatarCancelBtn    = document.getElementById('avatar-cancel-btn');
    const cheerBtn           = document.getElementById('cheer-btn');
    const pollBtn             = document.getElementById('poll-btn');

    // ===== 유저 UI 초기화 (방과 무관하게 항상 존재) =====
    displayNameSpan.textContent = userName;
    profileImg.src = userPic;

    // ===== LCK 팀 아바타 그리드 =====
    let selectedAvatarUrl = null;

    const selectAvatar = (item, url) => {
        document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        selectedAvatarUrl = url;
        avatarConfirmBtn.disabled = false;
    };

    LCK_TEAMS.forEach((team) => {
        const item = document.createElement('div');
        item.className = 'avatar-option';
        item.dataset.url = team.logo;
        item.innerHTML = `
            <img src="${team.logo}" alt="${team.name}" loading="lazy">
            <span class="avatar-label">${team.name}</span>
            <div class="avatar-check">✓</div>`;
        item.addEventListener('click', () => selectAvatar(item, team.logo));
        avatarGridLck.appendChild(item);
    });

    // ===== 캐릭터 아바타 그리드 =====
    const AVATARS = [
        { url: 'https://api.dicebear.com/8.x/lorelei/svg?seed=Felix&backgroundColor=e50914',   label: 'Felix'  },
        { url: 'https://api.dicebear.com/8.x/lorelei/svg?seed=Jasper&backgroundColor=1565c0',  label: 'Jasper' },
        { url: 'https://api.dicebear.com/8.x/lorelei/svg?seed=Mimi&backgroundColor=2e7d32',    label: 'Mimi'   },
        { url: 'https://api.dicebear.com/8.x/lorelei/svg?seed=Nova&backgroundColor=6a1b9a',    label: 'Nova'   },
        { url: 'https://api.dicebear.com/8.x/bottts/svg?seed=Ranger&backgroundColor=bf360c',   label: 'Ranger' },
        { url: 'https://api.dicebear.com/8.x/bottts/svg?seed=Pixel&backgroundColor=00695c',    label: 'Pixel'  },
        { url: 'https://api.dicebear.com/8.x/bottts/svg?seed=Spark&backgroundColor=1a237e',    label: 'Spark'  },
        { url: 'https://api.dicebear.com/8.x/bottts/svg?seed=Zyx&backgroundColor=4a148c',      label: 'Zyx'    },
        { url: 'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Leo&backgroundColor=e65100',   label: 'Leo'    },
        { url: 'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Coco&backgroundColor=004d40',  label: 'Coco'   },
        { url: 'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Luna&backgroundColor=880e4f',  label: 'Luna'   },
        { url: 'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Kai&backgroundColor=263238',   label: 'Kai'    },
    ];

    AVATARS.forEach((avatar) => {
        const item = document.createElement('div');
        item.className = 'avatar-option';
        item.dataset.url = avatar.url;
        item.innerHTML = `
            <img src="${avatar.url}" alt="${avatar.label}" loading="lazy">
            <span class="avatar-label">${avatar.label}</span>
            <div class="avatar-check">✓</div>`;
        item.addEventListener('click', () => selectAvatar(item, avatar.url));
        avatarGrid.appendChild(item);
    });

    // ===== 아바타 모달 =====
    const openAvatarModal = () => {
        selectedAvatarUrl = null;
        avatarConfirmBtn.disabled = true;
        document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
        const escaped = userPic.replace(/"/g, '\\"');
        const match = document.querySelector(`.avatar-option[data-url="${escaped}"]`);
        if (match) { match.classList.add('selected'); selectedAvatarUrl = userPic; avatarConfirmBtn.disabled = false; }
        avatarModal.style.display = 'flex';
    };
    const closeAvatarModal = () => { avatarModal.style.display = 'none'; };

    avatarCancelBtn.addEventListener('click', closeAvatarModal);
    avatarModal.addEventListener('click', (e) => { if (e.target === avatarModal) closeAvatarModal(); });
    avatarConfirmBtn.addEventListener('click', async () => {
        if (!selectedAvatarUrl) return;
        userPic = selectedAvatarUrl;
        localStorage.setItem('chzzk_pic', userPic);
        profileImg.src = userPic;
        closeAvatarModal();
        if (currentRoomId && updatePresenceFn) {
            try { await updatePresenceFn(); } catch (_) {}
        }
    });

    profileImg.addEventListener('click', openAvatarModal);

    // ===== 이름 변경 (방과 무관하게 가능, 방에 있으면 presence/시스템 메시지도 갱신) =====
    changeNameBtn.addEventListener('click', async () => {
        const oldName = userName;
        const newName = prompt('새로운 이름을 입력하세요:', userName);
        if (newName && newName.trim() && newName.trim() !== oldName) {
            userName = newName.trim();
            localStorage.setItem('chzzk_name', userName);
            displayNameSpan.textContent = userName;
            if (currentRoomId) {
                try {
                    await updatePresenceFn();
                    await sendSystemMessage(`'${oldName}'님이 '${userName}'(으)로 이름을 변경했습니다.`);
                } catch (err) { console.error("이름 변경 에러:", err); }
            }
        }
    });

    // =====================================================
    //  방(Room) 목록 — 로비
    // =====================================================

    const renderRoomCard = (roomId, data) => {
        const card = document.createElement('div');
        card.className = 'room-card';
        const created = data.createdAt
            ? new Date(data.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '';
        card.innerHTML = `
            <div class="room-card-main">
                <div class="room-card-name">${data.isPrivate ? '<span class="room-lock-icon">🔒</span>' : '🌐'} ${escapeHtml(data.name || '이름 없는 방')}</div>
                <div class="room-card-meta">${created} 생성</div>
            </div>
            <div class="room-card-enter">입장하기</div>`;
        card.addEventListener('click', () => attemptJoinRoom(roomId, data));
        return card;
    };

    const renderRoomList = (snapshot) => {
        roomListEl.innerHTML = '';
        if (snapshot.empty) {
            roomListEl.innerHTML = '<div class="room-list-empty">아직 만들어진 방이 없어요. 첫 방을 만들어보세요! 🎬</div>';
            return;
        }
        snapshot.forEach((docSnap) => {
            roomListEl.appendChild(renderRoomCard(docSnap.id, docSnap.data()));
        });
    };

    const roomsQuery = query(collection(db, "rooms"), orderBy("createdAt", "desc"), limit(50));
    onSnapshot(roomsQuery, renderRoomList, (err) => {
        console.error("방 목록 읽기 실패:", err);
        roomListEl.innerHTML = `
            <div class="room-list-empty">
                ⚠️ 방 목록을 불러오지 못했습니다.<br>
                <span style="color:var(--text-gray);">Firestore Rules에서 rooms 컬렉션의 read를 허용해주세요.</span>
            </div>`;
    });

    // ===== 방 만들기 모달 =====
    const openRoomCreateModal = () => {
        roomNameInput.value = '';
        roomPublicRadio.checked = true;
        roomPasswordInput.value = '';
        roomPasswordInput.style.display = 'none';
        roomCreateModal.style.display = 'flex';
        roomNameInput.focus();
    };
    const closeRoomCreateModal = () => { roomCreateModal.style.display = 'none'; };

    createRoomBtn.addEventListener('click', openRoomCreateModal);
    roomCreateCancel.addEventListener('click', closeRoomCreateModal);
    roomCreateModal.addEventListener('click', (e) => { if (e.target === roomCreateModal) closeRoomCreateModal(); });

    const syncPasswordFieldVisibility = () => {
        roomPasswordInput.style.display = roomPrivateRadio.checked ? 'block' : 'none';
    };
    roomPublicRadio.addEventListener('change', syncPasswordFieldVisibility);
    roomPrivateRadio.addEventListener('change', syncPasswordFieldVisibility);

    roomCreateSubmit.addEventListener('click', async () => {
        const name = roomNameInput.value.trim();
        if (!name) { alert("방 이름을 입력해주세요!"); return; }
        const isPrivate = roomPrivateRadio.checked;
        const password = isPrivate ? roomPasswordInput.value.trim() : null;
        if (isPrivate && !password) { alert("비공개방은 비밀번호를 입력해주세요!"); return; }
        try {
            const docRef = await addDoc(collection(db, "rooms"), {
                name, isPrivate, password: password || null,
                hostUid: userId, createdAt: Date.now()
            });
            closeRoomCreateModal();
            await enterRoom(docRef.id, { name, isPrivate, password });
        } catch (err) {
            console.error("방 생성 에러:", err);
            alert("방 생성에 실패했습니다. Firestore Rules에서 rooms 컬렉션의 create를 허용해주세요.");
        }
    });

    // ===== 비공개방 비밀번호 모달 =====
    // 참고: 비밀번호는 Firestore 문서에 평문으로 저장/비교합니다.
    // 개발자 도구 네트워크 탭으로 보면 노출될 수 있는 수준의 "친구끼리 잠그는 방" 용도이며,
    // 결제 정보처럼 진짜 민감한 값을 지키는 보안 방식은 아니라는 점 참고해주세요.
    let pendingJoinRoom = null;

    const openRoomPasswordModal = (roomId, data) => {
        pendingJoinRoom = { id: roomId, data };
        roomPasswordPromptInput.value = '';
        roomPasswordModal.style.display = 'flex';
        roomPasswordPromptInput.focus();
    };
    const closeRoomPasswordModal = () => { roomPasswordModal.style.display = 'none'; pendingJoinRoom = null; };

    roomPasswordCancel.addEventListener('click', closeRoomPasswordModal);
    roomPasswordModal.addEventListener('click', (e) => { if (e.target === roomPasswordModal) closeRoomPasswordModal(); });
    roomPasswordSubmit.addEventListener('click', async () => {
        if (!pendingJoinRoom) return;
        const input = roomPasswordPromptInput.value;
        if (input === pendingJoinRoom.data.password) {
            const { id, data } = pendingJoinRoom;
            closeRoomPasswordModal();
            await enterRoom(id, data);
        } else {
            alert("비밀번호가 틀렸습니다.");
        }
    });
    roomPasswordPromptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); roomPasswordSubmit.click(); }
    });

    const attemptJoinRoom = (roomId, data) => {
        if (data.isPrivate) openRoomPasswordModal(roomId, data);
        else enterRoom(roomId, data);
    };

    // =====================================================
    //  방 입장 / 퇴장
    // =====================================================

    const subscribeParticipants = (roomId) => {
        const presenceRef       = ref(rtdb, `rooms/${roomId}/participants/${userId}`);
        const allParticipantsRef = ref(rtdb, `rooms/${roomId}/participants`);
        const connectedRef      = ref(rtdb, '.info/connected');
        presenceRefForRoom = presenceRef;

        updatePresenceFn = async () => {
            await onDisconnect(presenceRef).remove();
            await set(presenceRef, { name: userName, pic: userPic, joinedAt: myJoinedAt });
        };

        // .info/connected 감시: 재연결 시 자동 재등록
        unsubConnectedFn = onValue(connectedRef, (snap) => {
            if (snap.val() !== true) return;
            updatePresenceFn().catch(err => {
                console.error("Presence 등록 실패:", err);
                if (String(err).includes('PERMISSION_DENIED')) {
                    console.error("⚠️ Firebase Realtime Database Rules에서 rooms/participants 경로의 read/write를 허용해주세요.");
                }
            });
        });

        unsubParticipantsFn = onValue(allParticipantsRef, (snapshot) => {
            const data = snapshot.val();
            participantList.innerHTML = '';
            if (!data) { userCountSpan.textContent = '0'; amIHost = false; return; }
            const sorted = Object.entries(data).sort(([, a], [, b]) => a.joinedAt - b.joinedAt);
            sorted.forEach(([uid, p], i) => {
                const isHost = (i === 0), isMe = (uid === userId);
                if (isMe) amIHost = isHost;
                const item = document.createElement('div');
                item.className = 'participant-item' + (isMe ? ' is-me' : '');
                item.innerHTML = `
                    <img src="${p.pic || defaultProfile}" class="participant-pic"
                         onerror="this.src='${defaultProfile}'">
                    <div class="participant-info">
                        <span class="participant-name">${escapeHtml(p.name)}</span>
                        ${isHost ? '<span class="host-badge">👑 방장</span>' : ''}
                        ${isMe   ? '<span class="me-badge">나</span>'        : ''}
                    </div>`;
                participantList.appendChild(item);
            });
            userCountSpan.textContent = sorted.length;
        }, (err) => {
            console.error("참여자 목록 읽기 실패:", err);
            userCountSpan.textContent = '!';
            participantList.innerHTML = `
                <div style="padding:12px;font-size:0.78rem;color:#ff6b6b;text-align:center;line-height:1.5;">
                    ⚠️ Firebase Realtime Database 권한 오류<br>
                    <span style="color:var(--text-gray);">RTDB Rules에서 rooms/participants 경로의<br>read/write를 허용해주세요.</span>
                </div>`;
            participantList.style.display = 'flex';
        });
    };

    const messagesCollection = () => collection(db, "rooms", currentRoomId, "messages");

    const subscribeChat = (roomId) => {
        isInitialLoad = true;
        const q = query(messagesCollection(), orderBy("timestamp", "asc"), limitToLast(CHAT_WINDOW));
        unsubChat = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                const data  = change.doc.data();
                const docId = change.doc.id;

                if (change.type === "added") {
                    if (document.getElementById(`msg-${docId}`)) return;
                    chatMessages.appendChild(renderMessage(data, docId));
                    if (data.type === "cheer" && !isInitialLoad) {
                        fireConfetti(data.teamColor || '#E50914');
                    }
                }

                if (change.type === "modified") {
                    const existing = document.getElementById(`msg-${docId}`);
                    if (!existing) return;
                    if (data.type === "poll") {
                        existing.innerHTML = buildPollHtml(data, docId);
                    } else {
                        const content = existing.querySelector('.message-content');
                        if (content) {
                            const oldBar = content.querySelector('.reaction-bar');
                            if (oldBar) oldBar.remove();
                            const newBar = buildReactionBar(data.reactions, docId);
                            if (newBar) content.insertAdjacentHTML('beforeend', newBar);
                        }
                    }
                }

                // limitToLast 윈도우 밖으로 밀려난 오래된 메시지는 DOM에서도 제거
                if (change.type === "removed") {
                    const existing = document.getElementById(`msg-${docId}`);
                    if (existing) existing.remove();
                }
            });

            if (!isInitialLoad) {
                const added = snapshot.docChanges().filter(c => c.type === "added");
                if (added.length > 0) {
                    const latest = added[added.length - 1].doc.data();
                    if (latest.user !== userName && latest.type !== "system" && window.__isSoundOn?.())
                        playNotificationSound();
                }
            }
            isInitialLoad = false;
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, (err) => {
            console.error("채팅 구독 에러:", err);
        });
    };

    const enterRoom = async (roomId, data) => {
        currentRoomId   = roomId;
        currentRoomMeta = data;
        myJoinedAt      = Date.now();
        amIHost         = false;

        lobbyScreen.style.display   = 'none';
        appMain.style.display       = 'flex';
        roomNameLabel.style.display = 'inline-block';
        roomNameLabel.textContent   = (data.isPrivate ? '🔒 ' : '🌐 ') + (data.name || '');
        clearChatBtn.style.display  = 'inline-block';
        leaveRoomBtn.style.display  = 'inline-block';

        subscribeChat(roomId);
        subscribeParticipants(roomId);

        try {
            await updatePresenceFn();
            await sendSystemMessage(`${userName}님이 입장하셨습니다.`);
        } catch (err) {
            console.error("입장 에러:", err);
        }
    };

    const leaveRoom = async ({ silent = false } = {}) => {
        if (!currentRoomId) return;
        if (!silent) {
            try { await sendSystemMessage(`${userName}님이 퇴장하셨습니다.`); } catch (_) {}
        }
        try { if (presenceRefForRoom) await remove(presenceRefForRoom); } catch (_) {}
        if (unsubChat) { unsubChat(); unsubChat = null; }
        if (unsubParticipantsFn) { unsubParticipantsFn(); unsubParticipantsFn = null; }
        if (unsubConnectedFn) { unsubConnectedFn(); unsubConnectedFn = null; }
        updatePresenceFn   = null;
        presenceRefForRoom = null;
        currentRoomId      = null;
        currentRoomMeta    = null;
        amIHost            = false;

        chatMessages.innerHTML     = '';
        participantList.innerHTML = '';
        userCountSpan.textContent = '0';

        appMain.style.display       = 'none';
        lobbyScreen.style.display   = 'flex';
        roomNameLabel.style.display = 'none';
        clearChatBtn.style.display  = 'none';
        leaveRoomBtn.style.display  = 'none';
    };

    leaveRoomBtn.addEventListener('click', async () => {
        if (!confirm("방에서 나가시겠습니까?")) return;
        await leaveRoom();
    });

    // 탭 닫을 때 정리 (동기적으로 최선을 다해 presence 제거)
    window.addEventListener('beforeunload', () => {
        if (presenceRefForRoom) { try { remove(presenceRefForRoom); } catch (_) {} }
    });

    // ===== 참여자 패널 토글 =====
    let isPanelOpen = false;
    participantToggle.addEventListener('click', () => {
        isPanelOpen = !isPanelOpen;
        participantList.style.display = isPanelOpen ? 'flex' : 'none';
        toggleArrow?.classList.toggle('open', isPanelOpen);
    });

    // ===== 시스템 메시지 =====
    const sendSystemMessage = async (text) => {
        if (!currentRoomId) return;
        await addDoc(messagesCollection(), { type: "system", text, timestamp: Date.now() });
    };

    // ===== 메시지 렌더링 함수 =====
    const renderMessage = (data, docId) => {
        const div = document.createElement('div');
        div.id = `msg-${docId}`;
        div.classList.add('message');

        if (data.type === "system") {
            div.classList.add('system');
            div.innerHTML = `<span class="system-text">${escapeHtml(data.text)}</span>`;
            return div;
        }

        if (data.type === "poll") {
            div.classList.add('system');
            div.innerHTML = buildPollHtml(data, docId);
            return div;
        }

        if (data.type === "cheer") {
            const isMe = data.user === userName;
            if (isMe) div.classList.add('my-message');
            div.classList.add('cheer-message');
            div.innerHTML = `
                <img src="${data.profilePic || defaultProfile}" class="chat-profile-pic"
                     onerror="this.src='${defaultProfile}'">
                <div class="message-content">
                    <span class="message-user">${escapeHtml(data.user)}</span>
                    <span class="message-text">
                        <img src="${data.teamLogo}" class="cheer-team-logo">
                        ${escapeHtml(data.teamName)} 응원합니다! 📣🎉
                    </span>
                    ${buildReactionBar(data.reactions, docId)}
                </div>
                <span class="reaction-trigger">😊+</span>`;
            return div;
        }

        // normal message
        const isMe = data.user === userName;
        if (isMe) div.classList.add('my-message');
        div.innerHTML = `
            <img src="${data.profilePic || defaultProfile}" class="chat-profile-pic"
                 onerror="this.src='${defaultProfile}'">
            <div class="message-content">
                <span class="message-user">${escapeHtml(data.user)}</span>
                <span class="message-text">${escapeHtml(data.text)}</span>
                ${buildReactionBar(data.reactions, docId)}
            </div>
            <span class="reaction-trigger">😊+</span>`;
        return div;
    };

    // ===== 리액션 헬퍼 =====
    const buildReactionBar = (reactions, docId) => {
        if (!reactions || Object.keys(reactions).length === 0) return '';
        let html = '<div class="reaction-bar">';
        for (const [emoji, users] of Object.entries(reactions)) {
            if (!users || users.length === 0) continue;
            const isMine = users.includes(userId);
            html += `<span class="reaction-chip${isMine ? ' mine' : ''}" data-doc="${docId}" data-emoji="${emoji}">
                ${emoji} <span class="r-count">${users.length}</span></span>`;
        }
        html += '</div>';
        return html;
    };

    const toggleReaction = async (docId, emoji) => {
        if (!currentRoomId) return;
        try {
            const msgRef = doc(db, "rooms", currentRoomId, "messages", docId);
            const chip = document.querySelector(`.reaction-chip[data-doc="${docId}"][data-emoji="${emoji}"]`);
            if (chip && chip.classList.contains('mine')) {
                await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayRemove(userId) });
            } else {
                await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayUnion(userId) });
            }
        } catch (err) { console.error("리액션 에러:", err); }
    };

    // 리액션/투표 클릭 이벤트 위임
    chatMessages.addEventListener('click', (e) => {
        const chip = e.target.closest('.reaction-chip');
        if (chip) { toggleReaction(chip.dataset.doc, chip.dataset.emoji); return; }

        const trigger = e.target.closest('.reaction-trigger');
        if (trigger) {
            document.querySelectorAll('.reaction-picker').forEach(el => el.remove());
            const msg = trigger.closest('.message');
            const docId = msg.id.replace('msg-', '');
            const picker = document.createElement('div');
            picker.className = 'reaction-picker';
            picker.innerHTML = REACTIONS.map(e => `<span data-emoji="${e}">${e}</span>`).join('');
            picker.addEventListener('click', (ev) => {
                const emoji = ev.target.dataset?.emoji;
                if (emoji) { toggleReaction(docId, emoji); picker.remove(); }
            });
            msg.appendChild(picker);
            setTimeout(() => {
                const close = (ev) => { if (!picker.contains(ev.target)) { picker.remove(); document.removeEventListener('click', close); } };
                document.addEventListener('click', close);
            }, 50);
            return;
        }

        const optBtn = e.target.closest('.poll-option-btn');
        if (optBtn) {
            votePoll(optBtn.dataset.doc, optBtn.dataset.option, JSON.parse(optBtn.dataset.options));
        }
    });

    // ===== 투표(Poll) 시스템 =====
    const votePoll = async (docId, option, allOptions) => {
        if (!currentRoomId) return;
        try {
            const updates = {};
            allOptions.forEach(opt => {
                updates[`votes.${opt}`] = (opt === option) ? arrayUnion(userId) : arrayRemove(userId);
            });
            await updateDoc(doc(db, "rooms", currentRoomId, "messages", docId), updates);
        } catch (err) { console.error("투표 에러:", err); }
    };

    const buildPollHtml = (data, docId) => {
        const votes = data.votes || {};
        const total = Object.values(votes).reduce((s, arr) => s + (arr?.length || 0), 0);
        let optHtml = '';
        (data.options || []).forEach(opt => {
            const count = votes[opt]?.length || 0;
            const pct = total > 0 ? Math.round(count / total * 100) : 0;
            const voted = votes[opt]?.includes(userId) ? ' voted' : '';
            const optionsJson = escapeHtml(JSON.stringify(data.options));
            optHtml += `
                <button class="poll-option-btn${voted}" data-doc="${docId}" data-option="${escapeHtml(opt)}" data-options="${optionsJson}">
                    <div class="poll-bar-fill" style="width:${pct}%"></div>
                    <div class="poll-option-label">
                        <span>${escapeHtml(opt)}</span>
                        <span class="poll-pct">${pct}% (${count})</span>
                    </div>
                </button>`;
        });
        return `<div class="poll-card">
            <div class="poll-question"><span class="poll-icon">📊</span>${escapeHtml(data.question)}</div>
            ${optHtml}
            <div class="poll-total">${total}명 참여</div>
        </div>`;
    };

    const openPollModal = () => {
        if (!currentRoomId) return;
        if (!amIHost) { alert("방장만 투표를 만들 수 있습니다!"); return; }
        const overlay = document.createElement('div');
        overlay.className = 'poll-modal-overlay';
        overlay.innerHTML = `
            <div class="poll-modal-card">
                <h3>📊 투표 만들기</h3>
                <input id="poll-q" type="text" placeholder="질문 (예: 이번 경기 승리팀은?)" maxlength="100">
                <input id="poll-a" type="text" placeholder="선택지 1 (예: T1)" maxlength="30">
                <input id="poll-b" type="text" placeholder="선택지 2 (예: Gen.G)" maxlength="30">
                <div class="poll-modal-actions">
                    <button class="avatar-cancel-btn" id="poll-cancel">취소</button>
                    <button class="netflix-btn" id="poll-submit">만들기</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        overlay.querySelector('#poll-cancel').addEventListener('click', () => overlay.remove());
        overlay.querySelector('#poll-submit').addEventListener('click', async () => {
            const q = overlay.querySelector('#poll-q').value.trim();
            const a = overlay.querySelector('#poll-a').value.trim();
            const b = overlay.querySelector('#poll-b').value.trim();
            if (!q || !a || !b) { alert("모든 항목을 입력해주세요!"); return; }
            try {
                await addDoc(messagesCollection(), {
                    type: "poll", question: q,
                    options: [a, b],
                    votes: { [a]: [], [b]: [] },
                    createdBy: userId, timestamp: Date.now()
                });
                overlay.remove();
            } catch (err) { console.error("투표 생성 에러:", err); alert("투표 생성에 실패했습니다."); }
        });
    };

    pollBtn.addEventListener('click', openPollModal);

    // ===== 응원 시스템 =====
    let cheerDropdown = null;
    const closeCheerDropdown = () => { cheerDropdown?.remove(); cheerDropdown = null; };

    cheerBtn.addEventListener('click', () => {
        if (!currentRoomId) return;
        if (cheerDropdown) { closeCheerDropdown(); return; }
        cheerDropdown = document.createElement('div');
        cheerDropdown.className = 'cheer-dropdown';
        LCK_TEAMS.forEach(team => {
            const btn = document.createElement('button');
            btn.className = 'cheer-team-btn';
            btn.innerHTML = `<img src="${team.logo}" alt="${team.name}"><span>${team.name}</span>`;
            btn.addEventListener('click', async () => {
                closeCheerDropdown();
                try {
                    await addDoc(messagesCollection(), {
                        type: "cheer", user: userName, profilePic: userPic,
                        teamName: team.name, teamColor: team.color, teamLogo: team.logo,
                        timestamp: Date.now(), reactions: {}
                    });
                } catch (err) { console.error("응원 에러:", err); }
            });
            cheerDropdown.appendChild(btn);
        });
        cheerBtn.parentElement.appendChild(cheerDropdown);
        setTimeout(() => {
            const close = (ev) => {
                if (!cheerDropdown?.contains(ev.target) && ev.target !== cheerBtn) {
                    closeCheerDropdown(); document.removeEventListener('click', close);
                }
            };
            document.addEventListener('click', close);
        }, 50);
    });

    // ===== 채팅 전송 =====
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentRoomId) return;
        const message = messageInput.value.trim();
        if (!message) return;
        try {
            await addDoc(messagesCollection(), {
                type: "normal", user: userName,
                text: message, profilePic: userPic,
                timestamp: Date.now(), reactions: {}
            });
            messageInput.value = '';
            messageInput.focus();
        } catch (err) { console.error("전송 에러:", err); }
    });

    // ===== 채팅 지우기 (방장만) =====
    clearChatBtn.addEventListener('click', async () => {
        if (!currentRoomId) return;
        if (!amIHost) { alert("권한이 없습니다! 방장만 채팅을 지울 수 있습니다."); return; }
        if (!confirm("정말 모든 채팅 내역을 삭제하시겠습니까?")) return;
        try {
            const snap = await getDocs(messagesCollection());
            const docs = snap.docs;

            // Firestore batch는 한 번에 최대 500개 작업만 허용 -> 500개씩 나눠서 커밋
            const CHUNK = 500;
            for (let i = 0; i < docs.length; i += CHUNK) {
                const batch = writeBatch(db);
                docs.slice(i, i + CHUNK).forEach((d) => batch.delete(d.ref));
                await batch.commit();
            }

            chatMessages.innerHTML = '';
            alert(`채팅이 청소되었습니다! (${docs.length}개 삭제)`);
        } catch (err) {
            console.error("채팅 삭제 에러:", err);
            alert(`채팅 삭제 실패: ${err.code || err.message || err}\n(콘솔에서 자세한 내용을 확인하세요)`);
        }
    });

}); // end load
