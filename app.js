import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    doc,         // ✅ 추가 (doc is not defined 에러 수정)
    setDoc,      // ✅ 추가
    deleteDoc,   // ✅ 추가
    getDocs,     // ✅ 추가
    writeBatch   // ✅ 추가
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ===== Firebase 설정 =====
const firebaseConfig = {
    apiKey: "AIzaSyCokBoeWEMFP1lXa3TRyeiL4NZtJdPVkjM",
    authDomain: "qwqweqwe-17b83.firebaseapp.com",
    projectId: "qwqweqwe-17b83",
    storageBucket: "qwqweqwe-17b83.firebasestorage.app",
    messagingSenderId: "687682911187",
    appId: "1:687682911187:web:f8a641d183e6f4bfd30d26"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===== DOM 요소 =====
const chatForm           = document.getElementById('chat-form');
const messageInput       = document.getElementById('message-input');
const chatMessages       = document.getElementById('chat-messages');
const displayNameSpan    = document.getElementById('user-display-name');
const changeNameBtn      = document.getElementById('change-name-btn');
const profileImg         = document.getElementById('profile-img');
const clearChatBtn       = document.getElementById('clear-chat-btn');
const participantToggle  = document.getElementById('participant-toggle');
const participantList    = document.getElementById('participant-list');
const userCountSpan      = document.getElementById('user-count');
const toggleArrow        = participantToggle.querySelector('.toggle-arrow');

// 아바타 모달
const avatarModal       = document.getElementById('avatar-modal');
const avatarGrid        = document.getElementById('avatar-grid');
const avatarConfirmBtn  = document.getElementById('avatar-confirm-btn');
const avatarCancelBtn   = document.getElementById('avatar-cancel-btn');

// ===== 넷플릭스 스타일 아바타 목록 =====
// DiceBear API로 다양한 캐릭터 아바타 생성
const AVATARS = [
    // 시리즈 1: Lorelei (애니메이션 스타일 인물)
    { url: 'https://api.dicebear.com/8.x/lorelei/svg?seed=Felix&backgroundColor=e50914',    label: 'Felix'    },
    { url: 'https://api.dicebear.com/8.x/lorelei/svg?seed=Jasper&backgroundColor=1565c0',   label: 'Jasper'   },
    { url: 'https://api.dicebear.com/8.x/lorelei/svg?seed=Mimi&backgroundColor=2e7d32',     label: 'Mimi'     },
    { url: 'https://api.dicebear.com/8.x/lorelei/svg?seed=Nova&backgroundColor=6a1b9a',     label: 'Nova'     },
    // 시리즈 2: Bottts (로봇 캐릭터)
    { url: 'https://api.dicebear.com/8.x/bottts/svg?seed=Ranger&backgroundColor=bf360c',    label: 'Ranger'   },
    { url: 'https://api.dicebear.com/8.x/bottts/svg?seed=Pixel&backgroundColor=00695c',     label: 'Pixel'    },
    { url: 'https://api.dicebear.com/8.x/bottts/svg?seed=Spark&backgroundColor=1a237e',     label: 'Spark'    },
    { url: 'https://api.dicebear.com/8.x/bottts/svg?seed=Zyx&backgroundColor=4a148c',       label: 'Zyx'      },
    // 시리즈 3: Fun Emoji
    { url: 'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Leo&backgroundColor=e65100',    label: 'Leo'      },
    { url: 'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Coco&backgroundColor=004d40',   label: 'Coco'     },
    { url: 'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Luna&backgroundColor=880e4f',   label: 'Luna'     },
    { url: 'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Kai&backgroundColor=263238',    label: 'Kai'      },
];

// 아바타 그리드 생성
let selectedAvatarUrl = null;

AVATARS.forEach((avatar) => {
    const item = document.createElement('div');
    item.className = 'avatar-option';
    item.dataset.url = avatar.url;
    item.innerHTML = `
        <img src="${avatar.url}" alt="${avatar.label}" loading="lazy">
        <div class="avatar-check">✓</div>
    `;
    item.addEventListener('click', () => {
        document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        selectedAvatarUrl = avatar.url;
        avatarConfirmBtn.disabled = false;
    });
    avatarGrid.appendChild(item);
});

// 모달 열기
const openAvatarModal = () => {
    selectedAvatarUrl = null;
    avatarConfirmBtn.disabled = true;
    document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));

    // 현재 내 사진과 같은 아바타가 있으면 미리 선택 표시
    const currentMatch = avatarGrid.querySelector(`[data-url="${userPic}"]`);
    if (currentMatch) {
        currentMatch.classList.add('selected');
        selectedAvatarUrl = userPic;
        avatarConfirmBtn.disabled = false;
    }

    avatarModal.style.display = 'flex';
};

// 모달 닫기
const closeAvatarModal = () => {
    avatarModal.style.display = 'none';
};

avatarCancelBtn.addEventListener('click', closeAvatarModal);
avatarModal.addEventListener('click', (e) => {
    if (e.target === avatarModal) closeAvatarModal();
});

// 선택 완료
avatarConfirmBtn.addEventListener('click', async () => {
    if (!selectedAvatarUrl) return;
    userPic = selectedAvatarUrl;
    localStorage.setItem('chzzk_pic', userPic);
    profileImg.src = userPic;
    closeAvatarModal();
    await updatePresence();
});

// ===== 알림음 =====
const alertSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
let isInitialLoad = true;

// ===== 유저 정보 =====
const defaultProfile = "https://wallpapers.com/images/hd/netflix-profile-pictures-1000-x-1000-qo9h82134t9nv0j0.jpg";
const userId   = localStorage.getItem('chzzk_uid') || Math.random().toString(36).substring(2, 10);
localStorage.setItem('chzzk_uid', userId);

let userName   = localStorage.getItem('chzzk_name') || `Guest_${Math.floor(Math.random() * 1000)}`;
let userPic    = localStorage.getItem('chzzk_pic')  || defaultProfile;
let amIHost    = false;

displayNameSpan.textContent = userName;
profileImg.src = userPic;

// ===== 참여자 목록 (방장 시스템) =====
const userRef = doc(db, "participants", userId);

const updatePresence = async () => {
    await setDoc(userRef, {
        name: userName,
        pic: userPic,
        joinedAt: Date.now()
    }, { merge: true });
};

// 창 닫을 때 참여자 목록에서 제거
window.addEventListener('beforeunload', () => {
    deleteDoc(userRef);
});

// 참여자 목록 실시간 감시 (첫 번째 입장자 = 방장)
const pQuery = query(collection(db, "participants"), orderBy("joinedAt", "asc"));

onSnapshot(pQuery, (snapshot) => {
    participantList.innerHTML = '';
    let count = 0;

    snapshot.forEach((docSnap, index) => {
        count++;
        const p = docSnap.data();
        const isHost = (index === 0);
        const isMe   = (docSnap.id === userId);

        if (isMe) amIHost = isHost;

        const item = document.createElement('div');
        item.className = 'participant-item' + (isMe ? ' is-me' : '');

        item.innerHTML = `
            <img src="${p.pic || defaultProfile}" class="participant-pic"
                 onerror="this.src='${defaultProfile}'">
            <div class="participant-info">
                <span class="participant-name">${escapeHtml(p.name)}</span>
                ${isHost ? '<span class="host-badge">방장</span>' : ''}
                ${isMe   ? '<span class="me-badge">나</span>'   : ''}
            </div>
        `;
        participantList.appendChild(item);
    });

    userCountSpan.textContent = count;
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
    await addDoc(collection(db, "shared_chat"), {
        type: "system",
        text: text,
        timestamp: Date.now()
    });
};

// ===== 입장 처리 =====
window.addEventListener('load', async () => {
    await updatePresence();
    sendSystemMessage(`${userName}님이 입장하셨습니다.`);
});

// ===== 이름 변경 =====
changeNameBtn.addEventListener('click', async () => {
    const oldName = userName;
    const newName = prompt('새로운 이름을 입력하세요:', userName);
    if (newName && newName.trim() && newName.trim() !== oldName) {
        userName = newName.trim();
        localStorage.setItem('chzzk_name', userName);
        displayNameSpan.textContent = userName;
        await updatePresence();
        await sendSystemMessage(`'${oldName}'님이 '${userName}'(으)로 이름을 변경했습니다.`);
    }
});

// ===== 프로필 사진 변경 (모달) =====
profileImg.addEventListener('click', openAvatarModal);

// ===== 채팅 지우기 (방장 전용) =====
clearChatBtn.addEventListener('click', async () => {
    if (!amIHost) {
        alert("권한이 없습니다! 방장만 채팅을 지울 수 있습니다.");
        return;
    }
    if (!confirm("정말 모든 채팅 내역을 삭제하시겠습니까?\n이 작업은 복구할 수 없습니다.")) return;

    try {
        const querySnapshot = await getDocs(collection(db, "shared_chat"));
        const batch = writeBatch(db);
        querySnapshot.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        chatMessages.innerHTML = '';
        alert("채팅이 청소되었습니다!");
    } catch (error) {
        console.error("채팅 삭제 오류:", error);
        alert("오류 발생: Firebase 권한(Rules) 설정을 확인해주세요.");
    }
});

// ===== 메시지 전송 =====
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    if (!message) return;

    try {
        await addDoc(collection(db, "shared_chat"), {
            type: "normal",
            user: userName,
            text: message,
            profilePic: userPic,
            timestamp: Date.now()
        });
        messageInput.value = '';
        messageInput.focus();
    } catch (error) {
        console.error("전송 에러:", error);
    }
});

// ===== 메시지 실시간 수신 =====
const q = query(collection(db, "shared_chat"), orderBy("timestamp", "asc"));

onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
        if (change.type !== "added") return;

        const data = change.doc.data();
        const messageId = `msg-${change.doc.id}`;
        if (document.getElementById(messageId)) return;

        const messageDiv = document.createElement('div');
        messageDiv.id = messageId;
        messageDiv.classList.add('message');

        if (data.type === "system") {
            messageDiv.classList.add('system');
            messageDiv.innerHTML = `<span class="system-text">${escapeHtml(data.text)}</span>`;
        } else {
            const isMe = data.user === userName;
            if (isMe) messageDiv.classList.add('my-message');
            messageDiv.innerHTML = `
                <img src="${data.profilePic || defaultProfile}" class="chat-profile-pic"
                     onerror="this.src='${defaultProfile}'">
                <div class="message-content">
                    <span class="message-user">${escapeHtml(data.user)}</span>
                    <span class="message-text">${escapeHtml(data.text)}</span>
                </div>
            `;
        }

        chatMessages.appendChild(messageDiv);
    });

    // 알림음: 내 메시지 아닌 경우에만
    if (!isInitialLoad) {
        const added = snapshot.docChanges().filter(c => c.type === "added");
        if (added.length > 0) {
            const latest = added[added.length - 1].doc.data();
            if (latest.user !== userName && latest.type === "normal") {
                alertSound.play().catch(() => {});
            }
        }
    }

    isInitialLoad = false;
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

// ===== XSS 방지용 이스케이프 =====
function escapeHtml(text = '') {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
