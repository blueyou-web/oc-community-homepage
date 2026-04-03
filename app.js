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

// DOM 요소
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const chatMessages = document.getElementById('chat-messages');
const displayNameSpan = document.getElementById('user-display-name');
const changeNameBtn = document.getElementById('change-name-btn');
const profileImg = document.getElementById('profile-img');
const clearChatBtn = document.getElementById('clear-chat-btn'); // 채팅 지우기 버튼 추가

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

// 접속 시 알림
window.addEventListener('load', () => {
    sendSystemMessage(`${userName}님이 입장하셨습니다.`);
});

// 이름 변경
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

// 프로필 이미지 변경
profileImg.addEventListener('click', () => {
    const newPic = prompt('원하는 프로필 이미지 주소(URL)를 입력하세요.\n(비워두면 기본 넷플릭스 이미지로 돌아갑니다)', userPic);
    if (newPic !== null) {
        userPic = newPic.trim() ? newPic.trim() : defaultProfile;
        localStorage.setItem('chzzk_pic', userPic);
        profileImg.src = userPic;
    }
});

// [추가된 기능] 채팅방 지우기
clearChatBtn.addEventListener('click', async () => {
    const confirmDelete = confirm("정말 모든 채팅 내역을 삭제하시겠습니까?\n이 작업은 복구할 수 없습니다.");
    if (!confirmDelete) return;

    try {
        // 컬렉션 안의 모든 문서를 가져와서 한 번에 지웁니다.
        const querySnapshot = await getDocs(collection(db, "shared_chat"));
        const batch = writeBatch(db);
        
        querySnapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit(); // DB에서 삭제
        chatMessages.innerHTML = ''; // 내 화면에서도 즉시 지우기
        alert("채팅방이 깨끗하게 청소되었습니다!");
    } catch (error) {
        console.error("채팅 삭제 중 에러 발생:", error);
        alert("채팅 삭제에 실패했습니다.");
    }
});

// 메시지 전송 로직
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

// 실시간 채팅 수신 및 화면 렌더링 (새로고침 안 해도 바로 보이게 수정완료!)
const q = query(collection(db, "shared_chat"), orderBy("timestamp", "asc"));

// includeMetadataChanges를 true로 줘서 로컬에 추가된 즉시 화면에 그리도록 함
onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
            const data = change.doc.data();
            
            // 이미 화면에 렌더링 된 메시지인지 체크 (중복 방지용 고유 ID)
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

    // 새 메시지 알림음 재생
    if (!isInitialLoad && !snapshot.metadata.hasPendingWrites) {
        const addedDocs = snapshot.docChanges().filter(change => change.type === "added");
        if (addedDocs.length > 0) {
            const latestDoc = addedDocs[addedDocs.length - 1].doc.data();
            if (latestDoc.user !== userName && latestDoc.type === "normal") {
                alertSound.play().catch(() => {});
            }
        }
    }
    
    isInitialLoad = false;
    chatMessages.scrollTop = chatMessages.scrollHeight; // 항상 맨 아래로 스크롤
});
