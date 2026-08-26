// =====================================================
//  CHZZK Together — app.js (v2)
// =====================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
    getFirestore, collection, addDoc, updateDoc, arrayUnion, arrayRemove,
    query, orderBy, onSnapshot,
    getDocs, writeBatch, doc, deleteDoc
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
let amIHost    = false;
let myJoinedAt = null;
let isInitialLoad = true;

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
const fireConfetti = (teamColor) => {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
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
        if (alive) requestAnimationFrame(animate);
        else ctx.clearRect(0, 0, canvas.width, canvas.height);
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
    const toggleArrow       = participantToggle?.querySelector('.toggle-arrow');
    const avatarModal       = document.getElementById('avatar-modal');
    const avatarGrid        = document.getElementById('avatar-grid');
    const avatarGridLck     = document.getElementById('avatar-grid-lck');
    const avatarConfirmBtn  = document.getElementById('avatar-confirm-btn');
    const avatarCancelBtn   = document.getElementById('avatar-cancel-btn');
    const cheerBtn          = document.getElementById('cheer-btn');
    const pollBtn           = document.getElementById('poll-btn');

    // ===== 유저 UI 초기화 =====
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
        try { await updatePresence(); } catch (_) {}
    });

    // ===== Realtime DB 참여자 =====
    const presenceRef     = ref(rtdb, `participants/${userId}`);
    const allParticipants = ref(rtdb, 'participants');
    const connectedRef    = ref(rtdb, '.info/connected');

    if (!myJoinedAt) myJoinedAt = Date.now();

    const updatePresence = async () => {
        await onDisconnect(presenceRef).remove();
        await set(presenceRef, { name: userName, pic: userPic, joinedAt: myJoinedAt });
    };

    // .info/connected 감시: 재연결 시 자동 재등록
    onValue(connectedRef, (snap) => {
        if (snap.val() !== true) return;
        updatePresence().catch(err => {
            console.error("Presence 등록 실패:", err);
            if (String(err).includes('PERMISSION_DENIED')) {
                console.error("⚠️ Firebase Realtime Database Rules에서 participants 경로의 read/write를 허용해주세요.");
            }
        });
    });

    // 직접 호출도 병행 (최초 입장 보장)
    try {
        await updatePresence();
    } catch (err) {
        console.error("최초 Presence 등록 실패:", err);
    }

    // 탭 닫을 때 정리
    window.addEventListener('beforeunload', () => {
        // navigator.sendBeacon으로 즉시 삭제 시도 (onDisconnect 백업)
        try { remove(presenceRef); } catch (_) {}
    });

    const cleanupOldFirestorePresence = async () => {
        try { await deleteDoc(doc(db, "participants", userId)); } catch (_) {}
    };

    onValue(allParticipants, (snapshot) => {
        const data = snapshot.val();
        participantList.innerHTML = '';
        if (!data) { userCountSpan.textContent = '0'; amIHost = false; return; }
        const sorted = Object.entries(data).sort(([,a],[,b]) => a.joinedAt - b.joinedAt);
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
        // ⚠️ RTDB 읽기 권한 에러 시 사용자에게 표시
        console.error("참여자 목록 읽기 실패:", err);
        userCountSpan.textContent = '!';
        participantList.innerHTML = `
            <div style="padding:12px;font-size:0.78rem;color:#ff6b6b;text-align:center;line-height:1.5;">
                ⚠️ Firebase Realtime Database 권한 오류<br>
                <span style="color:var(--text-gray);">RTDB Rules에서 participants 경로의<br>read/write를 허용해주세요.</span>
            </div>`;
        participantList.style.display = 'flex';
    });

    let isPanelOpen = false;
    participantToggle.addEventListener('click', () => {
        isPanelOpen = !isPanelOpen;
        participantList.style.display = isPanelOpen ? 'flex' : 'none';
        toggleArrow?.classList.toggle('open', isPanelOpen);
    });

    // ===== 시스템 메시지 =====
    const sendSystemMessage = async (text) => {
        await addDoc(collection(db, "shared_chat"), { type: "system", text, timestamp: Date.now() });
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
        try {
            const msgRef = doc(db, "shared_chat", docId);
            // 현재 상태를 DOM에서 확인 (mine 클래스)
            const chip = document.querySelector(`.reaction-chip[data-doc="${docId}"][data-emoji="${emoji}"]`);
            if (chip && chip.classList.contains('mine')) {
                await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayRemove(userId) });
            } else {
                await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayUnion(userId) });
            }
        } catch (err) { console.error("리액션 에러:", err); }
    };

    // 리액션 클릭 이벤트 위임
    chatMessages.addEventListener('click', (e) => {
        // 리액션 칩 클릭
        const chip = e.target.closest('.reaction-chip');
        if (chip) {
            toggleReaction(chip.dataset.doc, chip.dataset.emoji);
            return;
        }
        // 리액션 트리거 버튼 클릭
        const trigger = e.target.closest('.reaction-trigger');
        if (trigger) {
            // 이미 열린 피커 닫기
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
            // 외부 클릭으로 닫기
            setTimeout(() => {
                const close = (ev) => { if (!picker.contains(ev.target)) { picker.remove(); document.removeEventListener('click', close); } };
                document.addEventListener('click', close);
            }, 50);
            return;
        }
        // 투표 옵션 클릭
        const optBtn = e.target.closest('.poll-option-btn');
        if (optBtn) {
            votePoll(optBtn.dataset.doc, optBtn.dataset.option, JSON.parse(optBtn.dataset.options));
        }
    });

    // ===== 투표(Poll) 시스템 =====
    const votePoll = async (docId, option, allOptions) => {
        try {
            const updates = {};
            allOptions.forEach(opt => {
                updates[`votes.${opt}`] = (opt === option) ? arrayUnion(userId) : arrayRemove(userId);
            });
            await updateDoc(doc(db, "shared_chat", docId), updates);
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

    // 투표 생성 모달
    const openPollModal = () => {
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
                await addDoc(collection(db, "shared_chat"), {
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
                    await addDoc(collection(db, "shared_chat"), {
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

    // ===== 이벤트 리스너 (Firebase 전에 등록) =====

    changeNameBtn.addEventListener('click', async () => {
        const oldName = userName;
        const newName = prompt('새로운 이름을 입력하세요:', userName);
        if (newName && newName.trim() && newName.trim() !== oldName) {
            userName = newName.trim();
            localStorage.setItem('chzzk_name', userName);
            displayNameSpan.textContent = userName;
            try {
                await updatePresence();
                await sendSystemMessage(`'${oldName}'님이 '${userName}'(으)로 이름을 변경했습니다.`);
            } catch (err) { console.error("이름 변경 에러:", err); }
        }
    });

    profileImg.addEventListener('click', openAvatarModal);

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
        } catch (err) { alert("오류: Firebase Rules 설정을 확인해주세요."); }
    });

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = messageInput.value.trim();
        if (!message) return;
        try {
            await addDoc(collection(db, "shared_chat"), {
                type: "normal", user: userName,
                text: message, profilePic: userPic,
                timestamp: Date.now(), reactions: {}
            });
            messageInput.value = '';
            messageInput.focus();
        } catch (err) { console.error("전송 에러:", err); }
    });

    // ===== 입장 (presence는 .info/connected 리스너가 자동 처리) =====
    try {
        await cleanupOldFirestorePresence();
        await sendSystemMessage(`${userName}님이 입장하셨습니다.`);
    } catch (err) { console.error("입장 에러:", err); }

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

    // ===== 메시지 수신 =====
    const q = query(collection(db, "shared_chat"), orderBy("timestamp", "asc"));
    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            const data  = change.doc.data();
            const docId = change.doc.id;

            if (change.type === "added") {
                if (document.getElementById(`msg-${docId}`)) return;
                chatMessages.appendChild(renderMessage(data, docId));

                // 응원 컨페티
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
                    // 리액션만 업데이트
                    const content = existing.querySelector('.message-content');
                    if (content) {
                        const oldBar = content.querySelector('.reaction-bar');
                        if (oldBar) oldBar.remove();
                        const newBar = buildReactionBar(data.reactions, docId);
                        if (newBar) content.insertAdjacentHTML('beforeend', newBar);
                    }
                }
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
    });

}); // end load
