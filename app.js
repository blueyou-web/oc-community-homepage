import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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

const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const chatMessages = document.getElementById('chat-messages');
const displayNameSpan = document.getElementById('user-display-name');
const changeNameBtn = document.getElementById('change-name-btn');
const profileImg = document.getElementById('profile-img');
const clearChatBtn = document.getElementById('clear-chat-btn'); 
const participantToggle = document.getElementById('participant-toggle');
const participantList = document.getElementById('participant-list');

const alertSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); 
let isInitialLoad = true; 

// --- [유저 정보 및 식별자 설정] ---
// 나를 식별하기 위한 고유 ID 생성 (접속자 목록 관리에 필요)
const userId = localStorage.getItem('chzzk_uid') || Math.random().toString(36).substring(2, 10);
localStorage.setItem('chzzk_uid', userId);
let amIHost = false; // 내가 방장인지 여부

const defaultProfile = "https://wallpapers.com/images/hd/netflix-profile-pictures-1000-x-1000-qo9h82134t9nv0j0.jpg";
let userName = localStorage.getItem('chzzk_name') || `Guest_${Math.floor(Math.random()*1000)}`;
let userPic = localStorage.getItem('chzzk_pic') || defaultProfile;

displayNameSpan.textContent = userName;
profileImg.src = userPic;

// --- [접속자 목록 (방장 시스템) 로직] ---
const userRef = doc(db, "participants", userId);

// 내 상태를 DB에 등록하는 함수
const updatePresence = async () => {
    await setDoc(userRef, {
        name: userName,
        pic: userPic,
        joinedAt: Date.now() // 들어온 시간으로 방장 결정
    }, { merge: true }); // 기존 데이터에 덮어쓰기
};

// 브라우저 창을 닫거나 새로고침 할 때 접속자 목록에서 내 이름 지우기
window.addEventListener('beforeunload', () => {
    deleteDoc(userRef);
});

// 참여자 목록 실시간 감시 (제일 먼저 들어온 사람이 방장)
const pQuery = query(collection(db, "participants"), orderBy("joinedAt", "asc"));
onSnapshot(pQuery, (snapshot) => {
    participantList.innerHTML = '';
    let count = 0;
    
    snapshot.forEach((docSnap, index) => {
        count++;
        const p = docSnap.data();
        const isHost = (index === 0); // 0번째(가장 먼저 온 사람)가 무조건 방장
        
        // 내가 방장인지 체크
        if (docSnap.id === userId) {
            amIHost = isHost;
        }

        participantList.innerHTML += `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <img src="${p.pic}" style="width: 24px; height: 24px; border-radius: 4px; object-fit: cover;">
                <span style="font-size: 0.85rem; color: white;">${p.name}</span>
                ${isHost ? '<span style="background: #E50914; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.6rem; font-weight: bold;">방장</span>' : ''}
                ${docSnap.id === userId ? '<span style="color: #B3B3B3; font-size: 0.7rem;">(나)</span>' : ''}
            </div>
        `;
    });
    
    participantToggle.textContent = `접속자 ${count}명 (▼)`;
});

// 참여자 목록 열고 닫기 버튼
participantToggle.addEventListener('click', () => {
    if (participantList.style.display === 'none') {
        participantList.style.display = 'block';
        participantToggle.textContent = participantToggle.textContent.replace('▼', '▲');
    } else {
        participantList.style.display = 'none';
        participantToggle.textContent = participantToggle.textContent.replace('▲', '▼');
    }
});


// --- [메시지 및 채팅 로직] ---
const sendSystemMessage = async (text) => {
    await addDoc(collection(db, "shared_chat"), {
        type: "system",
        text: text,
        timestamp: Date.now()
    });
};

window.addEventListener('load', async () => {
    await updatePresence(); // 접속하면 내 정보 등록
    sendSystemMessage(`${userName}님이 입장하셨습니다.`);
});

changeNameBtn.addEventListener('click', async () => {
    const oldName = userName;
    const newName = prompt('새로운 이름을 입력하세요:', userName);
    if (newName && newName.trim() && newName !== oldName) {
        userName = newName.trim();
        localStorage.setItem('chzzk_name', userName);
        displayNameSpan.textContent = userName;
        await updatePresence(); // 이름 바뀌면 접속자 목록도 갱신
        await sendSystemMessage(`'${oldName}'님이 '${userName}'(으)로 이름을 변경했습니다.`);
    }
});

profileImg.addEventListener('click', async () => {
    const newPic = prompt('원하는 프로필 이미지 주소(URL)를 입력하세요.\n(비워두면 기본 이미지로 돌아갑니다)', userPic);
    if (newPic !== null) {
        userPic = newPic.trim() ? newPic.trim() : defaultProfile;
        localStorage.setItem('chzzk_pic', userPic);
        profileImg.src = userPic;
        await updatePresence(); // 사진 바뀌면 접속자 목록도 갱신
    }
});

// 🚨 방장만 채팅 지우기 가능하도록 권한 체크 추가
clearChatBtn.addEventListener('click', async () => {
    if (!amIHost) {
        alert("권한이 없습니다! 방장만 채팅을 지울 수 있습니다.");
        return;
    }

    const confirmDelete = confirm("정말 모든 채팅 내역을 삭제하시겠습니까?\n이 작업은 복구할 수 없습니다.");
    if (!confirmDelete) return;

    try {
        const querySnapshot = await getDocs(collection(db, "shared_chat"));
        const batch = writeBatch(db);
        
        querySnapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit(); 
        chatMessages.innerHTML = '';
        alert("방장에 의해 채팅방이 깨끗하게 청소되었습니다!");
    } catch (error) {
        console.error("채팅 삭제 중 에러 발생:", error);
        alert("서버 오류: 파이어베이스 권한(Rules) 설정이 안 되어있을 수 있습니다.");
    }
});

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

const q = query(collection(db, "shared_chat"), orderBy("timestamp", "asc"));

onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
            const data = change.doc.data();
            
            const messageId = `msg-${change.doc.id}`;
            if (document.getElementById(messageId)) return;

            const messageDiv = document.createElement('div');
            messageDiv.id = messageId; 
            messageDiv.classList.add('message');
            
            if (data.type === "system") {
                messageDiv.classList.add('system');
                messageDiv.innerHTML = `<span class="system-text">${data.text}</span>`;
            } else {
                if (data.user === userName) messageDiv.classList.add('my-message');
                messageDiv.innerHTML = `
                    <img src="${data.profilePic || defaultProfile}" class="chat-profile-pic">
                    <div class="message-content">
                        <span class="message-user">${data.user}</span>
                        <span class="message-text">${data.text}</span>
                    </div>
                `;
            }
            
            chatMessages.appendChild(messageDiv);
        }
    });

    if (!isInitialLoad) {
        const addedDocs = snapshot.docChanges().filter(change => change.type === "added");
        if (addedDocs.length > 0) {
            const latestDoc = addedDocs[addedDocs.length - 1].doc.data();
            if (latestDoc.user !== userName && latestDoc.type === "normal") {
                alertSound.play().catch(() => {});
            }
        }
    }
    
    isInitialLoad = false;
    chatMessages.scrollTop = chatMessages.scrollHeight;
});
