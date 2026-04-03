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

// 효과음 설정
const alertSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); 
let isInitialLoad = true; 

// 유저 정보 초기화 (로컬 스토리지)
const defaultProfile = "https://wallpapers.com/images/hd/netflix-profile-pictures-1000-x-1000-qo9h82134t9nv0j0.jpg";
let userName = localStorage.getItem('chzzk_name') || `Guest_${Math.floor(Math.random()*1000)}`;
let userPic = localStorage.getItem('chzzk_pic') || defaultProfile;

displayNameSpan.textContent = userName;
profileImg.src = userPic;

// 시스템 메시지 전송 함수
const sendSystemMessage = async (text) => {
    await addDoc(collection(db, "shared_chat"), {
        type: "system",
        text: text,
        timestamp: serverTimestamp()
    });
};

// 접속 시 알림 (페이지 로드)
window.addEventListener('load', () => {
    sendSystemMessage(`${userName}님이 입장하셨습니다.`);
});

// 이름 변경 로직
changeNameBtn.addEventListener('click', async () => {
    const oldName = userName;
    const newName = prompt('새로운 이름을 입력하세요:', userName);
    if (newName && newName.trim() && newName !== oldName) {
        userName = newName.trim();
        localStorage.setItem('chzzk_name', userName);
        displayNameSpan.textContent = userName;
        await sendSystemMessage(`'${oldName}'님이 '${userName}'(으)로 이름을 변경했습니다.`);
    }
});

// 프로필 이미지 변경 로직
profileImg.addEventListener('click', () => {
    const newPic = prompt('원하는 프로필 이미지 주소(URL)를 입력하세요.\n(비워두면 기본 넷플릭스 이미지로 돌아갑니다)', userPic);
    if (newPic !== null) {
        userPic = newPic.trim() ? newPic.trim() : defaultProfile;
        localStorage.setItem('chzzk_pic', userPic);
        profileImg.src = userPic;
    }
});

// 메시지 전송 로직 (새로고침 방지 포함)
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
            timestamp: serverTimestamp()
        });
        messageInput.value = ''; 
        messageInput.focus();
    } catch (error) {
        console.error("전송 에러:", error);
    }
});

// 실시간 채팅 수신 및 화면 렌더링 (새로고침 깜빡임 해결 부분)
const q = query(collection(db, "shared_chat"), orderBy("timestamp", "asc"));

onSnapshot(q, (snapshot) => {
    // 변경된(새로 추가된) 문서만 확인하여 맨 아래에 이어 붙입니다.
    snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
            const data = change.doc.data();
            if (!data.timestamp) return; // 서버 시간 기록 전이면 무시

            const messageDiv = document.createElement('div');
            messageDiv.classList.add('message');
            
            // 시스템 메시지 UI
            if (data.type === "system") {
                messageDiv.classList.add('system');
                messageDiv.innerHTML = `<span class="system-text">${data.text}</span>`;
            } 
            // 일반 메시지 UI
            else {
                if (data.user === userName) messageDiv.classList.add('my-message');
                messageDiv.innerHTML = `
                    <img src="${data.profilePic || defaultProfile}" class="chat-profile-pic">
                    <div class="message-content">
                        <span class="message-user">${data.user}</span>
                        <span class="message-text">${data.text}</span>
                    </div>
                `;
            }
            
            // 기존 채팅을 지우지 않고 새 메시지만 추가
            chatMessages.appendChild(messageDiv);
        }
    });

    // 새 메시지 알림음 재생 (첫 로딩 무시, 내가 보낸 메시지 무시)
    if (!isInitialLoad && snapshot.docChanges().some(change => change.type === "added")) {
        const addedDocs = snapshot.docChanges().filter(change => change.type === "added");
        if (addedDocs.length > 0) {
            const latestDoc = addedDocs[addedDocs.length - 1].doc.data();
            
            if (latestDoc.user !== userName && latestDoc.type === "normal") {
                // 브라우저 정책상 클릭 전에는 재생 안 될 수 있음
                alertSound.play().catch(() => console.log("사운드 재생을 위해 화면 클릭 필요"));
            }
        }
    }
    
    isInitialLoad = false;
    chatMessages.scrollTop = chatMessages.scrollHeight; // 스크롤 맨 아래로 유지
});
