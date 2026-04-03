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

// 효과음 설정
const alertSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); 
let isInitialLoad = true; 

// 유저 정보 초기화
const defaultProfile = "https://wallpapers.com/images/hd/netflix-profile-pictures-1000-x-1000-qo9h82134t9nv0j0.jpg";
let userName = localStorage.getItem('chzzk_name') || `Guest_${Math.floor(Math.random()*1000)}`;
let userPic = localStorage.getItem('chzzk_pic') || defaultProfile;

displayNameSpan.textContent = userName;
profileImg.src = userPic;

// 시스템 메시지 전송 함수 (Date.now() 사용)
const sendSystemMessage = async (text) => {
    await addDoc(collection(db, "shared_chat"), {
        type: "system",
        text: text,
        timestamp: Date.now() // ★ 즉시 시간을 생성해서 딜레이 없앰
    });
};

// 접속 알림
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
    const newPic = prompt('원하는 프로필 이미지 주소(URL)를 입력하세요.\n(비워두면 기본 이미지로 돌아갑니다)', userPic);
    if (newPic !== null) {
        userPic = newPic.trim() ? newPic.trim() : defaultProfile;
        localStorage.setItem('chzzk_pic', userPic);
        profileImg.src = userPic;
    }
});

// 채팅 지우기 기능
clearChatBtn.addEventListener('click', async () => {
    console.log("지우기 버튼 클릭됨!"); // 정상 작동하는지 콘솔창에 표시
    const confirmDelete = confirm("정말 모든 채팅 내역을 삭제하시겠습니까?\n이 작업은 복구할 수 없습니다.");
    if (!confirmDelete) return;

    try {
        const querySnapshot = await getDocs(collection(db, "shared_chat"));
        const batch = writeBatch(db);
        
        querySnapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit(); 
        chatMessages.innerHTML = ''; // 내 화면에서도 즉시 지우기
        alert("채팅방이 깨끗하게 청소되었습니다!");
    } catch (error) {
        console.error("채팅 삭제 중 에러 발생:", error);
        alert("채팅 삭제 권한이 없거나 에러가 발생했습니다.");
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
            timestamp: Date.now() // ★ 서버를 기다리지 않고 내 시간을 바로 찍음!
        });
        messageInput.value = ''; 
        messageInput.focus();
    } catch (error) {
        console.error("전송 에러:", error);
    }
});

// 실시간 채팅 수신
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
