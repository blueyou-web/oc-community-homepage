// =====================================================
//  CHZZK Together — app.js
//  채팅: Firestore  |  참여자/방장: Realtime Database
// =====================================================

import { initializeApp }    from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
    getFirestore, collection, addDoc,
    query, orderBy, onSnapshot,
    getDocs, writeBatch, doc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import {
    getDatabase,
    ref, set, remove, onValue,
    onDisconnect
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// ===== Firebase 설정 =====
// ⚠️  Firebase 콘솔 → Realtime Database → 데이터 탭 상단 URL을 databaseURL에 입력
const firebaseConfig = {
    apiKey:            "AIzaSyCokBoeWEMFP1lXa3TRyeiL4NZtJdPVkjM",
    authDomain:        "qwqweqwe-17b83.firebaseapp.com",
    projectId:         "qwqweqwe-17b83",
    storageBucket:     "qwqweqwe-17b83.firebasestorage.app",
    messagingSenderId: "687682911187",
    appId:             "1:687682911187:web:f8a641d183e6f4bfd30d26",
    databaseURL:       "https://qwqweqwe-17b83-default-rtdb.firebaseio.com"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const rtdb = getDatabase(app);

// ===== DOM =====
const chatForm          = document.getElementById('chat-form');
const messageInput      = document.getElementById('message-input');
const chatMessages      = document.getElementById('chat-messages');
const displayNameSpan   = document.getElementById('user-display-name');
const changeNameBtn     = document.getElementById('change-name-btn');
const profileImg        = document.getElementById('profile-img');
const clearChatBtn      = document.getElementById('clear-chat-btn');
const participantToggle = document.getElementById('participant-toggle');
const participantList   = document.getElementById('participant-list');
const userCountSpan     = document.getElementById('user-count');
const toggleArrow       = participantToggle.querySelector('.toggle-arrow');
const avatarModal       = document.getElementById('avatar-modal');
const avatarGrid        = document.getElementById('avatar-grid');
const avatarConfirmBtn  = document.getElementById('avatar-confirm-btn');
const avatarCancelBtn   = document.getElementById('avatar-cancel-btn');

// ===== 알림음 =====
// ===== 부드러운 알림음 (Web Audio API — 외부 파일 불필요) =====
const playNotificationSound = () => {
    try {
        const ctx    = new (window.AudioContext || window.webkitAudioContext)();
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
            o.stop(ctx.currentTime  + startT + decay);
            return o;
        };

        // 도 (C6)
        ding(1047, 0.00, 0.22, 0.18);
        ding(2093, 0.00, 0.06, 0.15);
        // 미 (E6)
        ding(1319, 0.12, 0.24, 0.28);
        const last = ding(2637, 0.12, 0.07, 0.26);

        last.onended = () => ctx.close();
    } catch (e) {}
};
let isInitialLoad = true;

// ===== 유저 정보 =====
const defaultProfile = "https://api.dicebear.com/8.x/bottts/svg?seed=default&backgroundColor=333333";
const userId = localStorage.getItem('chzzk_uid') || Math.random().toString(36).substring(2, 10);
localStorage.setItem('chzzk_uid', userId);

let userName = localStorage.getItem('chzzk_name') || `Guest_${Math.floor(Math.random() * 1000)}`;
let userPic  = localStorage.getItem('chzzk_pic')  || defaultProfile;
let amIHost  = false;
let myJoinedAt = null; // 최초 입장 시간 보존용

displayNameSpan.textContent = userName;
profileImg.src = userPic;

// ===== 아바타 목록 =====
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

let selectedAvatarUrl = null;
AVATARS.forEach((avatar) => {
    const item = document.createElement('div');
    item.className = 'avatar-option';
    item.dataset.url = avatar.url;
    item.innerHTML = `<img src="${avatar.url}" alt="${avatar.label}" loading="lazy"><div class="avatar-check">✓</div>`;
    item.addEventListener('click', () => {
        document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        selectedAvatarUrl = avatar.url;
        avatarConfirmBtn.disabled = false;
    });
    avatarGrid.appendChild(item);
});

const openAvatarModal = () => {
    selectedAvatarUrl = null;
    avatarConfirmBtn.disabled = true;
    document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
    const escaped = userPic.replace(/"/g, '\\"');
    const currentMatch = avatarGrid.querySelector(`[data-url="${escaped}"]`);
    if (currentMatch) { currentMatch.classList.add('selected'); selectedAvatarUrl = userPic; avatarConfirmBtn.disabled = false; }
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
    await updatePresence();
});

// =====================================================
//  🔥 REALTIME DATABASE 참여자 / 방장 시스템
//
//  동작 원리:
//  1. 접속 시 participants/{userId} 노드를 생성
//  2. onDisconnect().remove() 등록
//     → 네트워크 끊김/창 닫힘/강제종료 시 Firebase 서버가 자동 삭제
//  3. joinedAt(최초 입장 시간) 기준 정렬 → 가장 작은 값 = 방장
//  4. 이름/사진 변경 시 joinedAt은 그대로 유지
// =====================================================

const presenceRef       = ref(rtdb, `participants/${userId}`);
const allParticipants   = ref(rtdb, 'participants');

const updatePresence = async () => {
    // myJoinedAt: 최초 입장 시간을 세션 내내 보존
    if (!myJoinedAt) myJoinedAt = Date.now();

    await set(presenceRef, {
        name:     userName,
        pic:      userPic,
        joinedAt: myJoinedAt
    });

    // ✅ 핵심: 연결 끊기면 Firebase 서버가 이 노드를 자동 삭제
    //    (브라우저가 꺼지거나, 네트워크가 끊겨도 동작)
    await onDisconnect(presenceRef).remove();
};

// 이전 코드가 남긴 Firestore participants 잔재 청소
const cleanupOldFirestorePresence = async () => {
    try {
        const oldRef = doc(db, "participants", userId);
        await deleteDoc(oldRef);
    } catch (_) { /* 없으면 무시 */ }
};

// 참여자 목록 실시간 반영
onValue(allParticipants, (snapshot) => {
    const data = snapshot.val();
    participantList.innerHTML = '';

    if (!data) {
        userCountSpan.textContent = '0';
        amIHost = false;
        return;
    }

    // joinedAt 오름차순 정렬 (가장 먼저 입장한 사람이 방장)
    const sorted = Object.entries(data).sort(([, a], [, b]) => a.joinedAt - b.joinedAt);

    sorted.forEach(([uid, p], index) => {
        const isHost = (index === 0);
        const isMe   = (uid === userId);
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
});

// 참여자 패널 토글
let isPanelOpen = false;
participantToggle.addEventListener('click', () => {
    isPanelOpen = !isPanelOpen;
    participantList.style.display = isPanelOpen ? 'flex' : 'none';
    toggleArrow.classList.toggle('open', isPanelOpen);
});

// ===== 시스템 메시지 =====
const sendSystemMessage = async (text) => {
    await addDoc(collection(db, "shared_chat"), { type: "system", text, timestamp: Date.now() });
};

// ===== 입장 =====
window.addEventListener('load', async () => {
    // 1) 혹시 남은 stale RTDB 노드 제거 후 깨끗하게 재등록
    await remove(presenceRef);
    await updatePresence();

    // 2) 구버전 Firestore participants 잔재 청소
    await cleanupOldFirestorePresence();

    await sendSystemMessage(`${userName}님이 입장하셨습니다.`);
});

// ===== 이름 변경 =====
changeNameBtn.addEventListener('click', async () => {
    const oldName = userName;
    const newName = prompt('새로운 이름을 입력하세요:', userName);
    if (newName && newName.trim() && newName.trim() !== oldName) {
        userName = newName.trim();
        localStorage.setItem('chzzk_name', userName);
        displayNameSpan.textContent = userName;
        await updatePresence(); // joinedAt은 myJoinedAt으로 보존
        await sendSystemMessage(`'${oldName}'님이 '${userName}'(으)로 이름을 변경했습니다.`);
    }
});

// ===== 프로필 변경 =====
profileImg.addEventListener('click', openAvatarModal);

// ===== 채팅 지우기 (방장 전용) =====
clearChatBtn.addEventListener('click', async () => {
    if (!amIHost) { alert("권한이 없습니다! 방장만 채팅을 지울 수 있습니다."); return; }
    if (!confirm("정말 모든 채팅 내역을 삭제하시겠습니까?")) return;
    try {
        const snap = await getDocs(collection(db, "shared_chat"));
        const batch = writeBatch(db);
        snap.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        chatMessages.innerHTML = '';
        alert("채팅이 청소되었습니다!");
    } catch (err) {
        console.error("채팅 삭제 오류:", err);
        alert("오류: Firebase Rules 설정을 확인해주세요.");
    }
});

// ===== 메시지 전송 =====
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    if (!message) return;
    try {
        await addDoc(collection(db, "shared_chat"), {
            type: "normal", user: userName,
            text: message, profilePic: userPic, timestamp: Date.now()
        });
        messageInput.value = '';
        messageInput.focus();
    } catch (err) { console.error("전송 에러:", err); }
});

// ===== 메시지 수신 =====
const q = query(collection(db, "shared_chat"), orderBy("timestamp", "asc"));
onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
        if (change.type !== "added") return;
        const data = change.doc.data();
        const messageId = `msg-${change.doc.id}`;
        if (document.getElementById(messageId)) return;

        const div = document.createElement('div');
        div.id = messageId;
        div.classList.add('message');

        if (data.type === "system") {
            div.classList.add('system');
            div.innerHTML = `<span class="system-text">${escapeHtml(data.text)}</span>`;
        } else {
            if (data.user === userName) div.classList.add('my-message');
            div.innerHTML = `
                <img src="${data.profilePic || defaultProfile}" class="chat-profile-pic"
                     onerror="this.src='${defaultProfile}'">
                <div class="message-content">
                    <span class="message-user">${escapeHtml(data.user)}</span>
                    <span class="message-text">${escapeHtml(data.text)}</span>
                </div>`;
        }
        chatMessages.appendChild(div);
    });

    if (!isInitialLoad) {
        const added = snapshot.docChanges().filter(c => c.type === "added");
        if (added.length > 0) {
            const latest = added[added.length - 1].doc.data();
            if (latest.user !== userName && latest.type === "normal")
                playNotificationSound();
        }
    }
    isInitialLoad = false;
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

// ===== XSS 방지 =====
function escapeHtml(text = '') {
    return text.replace(/&/g,'&amp;').replace(/</g,'&lt;')
               .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
