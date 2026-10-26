const CafeApp = (() => {
    let myName = '';
    let roomCode = '';
    let myChar = 'male';
    let peerState = { online: false, name: '', char: 'female' };
    let chatMinimized = false;

    const WEATHER_MODES = [
        { id: 'rain', label: 'بارانی', icon: '🌧️' },
        { id: 'autumn', label: 'پاییزی', icon: '🍂' },
        { id: 'snow', label: 'برفی', icon: '❄️' }
    ];
    let weatherIdx = 0;

    // سنتتایزر صدای باران و موسیقی Lo-Fi بدون نیاز به فایل صوتی حجیم خارجی
    let audioCtx = null;
    let ambiencePlaying = false;
    let ambienceNode = null;
    let gramophonePlaying = false;
    let gramophoneInterval = null;

    window.addEventListener('DOMContentLoaded', () => {
        CafeEngine.init();
        // بازیابی نام و اتاق قبلی از حافظه مرورگر برای ورود سریع‌تر
        const savedName = localStorage.getItem('khalvat_name');
        const savedRoom = localStorage.getItem('khalvat_room');
        const savedChar = localStorage.getItem('khalvat_char');
        if (savedName) document.getElementById('login-name').value = savedName;
        if (savedRoom) document.getElementById('login-room').value = savedRoom;
        if (savedChar) selectCharacter(savedChar);
    });

    function selectCharacter(charType) {
        myChar = charType;
        document.getElementById('pick-char-male').classList.toggle('selected', charType === 'male');
        document.getElementById('pick-char-female').classList.toggle('selected', charType === 'female');
    }

    function enterCafe() {
        myName = document.getElementById('login-name').value.trim();
        roomCode = document.getElementById('login-room').value.trim();

        if (!myName || !roomCode) {
            showToast('⚠️ لطفاً نام و شماره میز را وارد کنید');
            return;
        }

        localStorage.setItem('khalvat_name', myName);
        localStorage.setItem('khalvat_room', roomCode);
        localStorage.setItem('khalvat_char', myChar);

        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('top-hud').style.display = 'flex';
        document.getElementById('main-sanctuary').style.display = 'flex';
        document.getElementById('hud-room-title').textContent = 'میز: ' + roomCode;

        CafeEngine.updateState({ myName, myChar });

        CafeNetwork.connect(roomCode, { name: myName, char: myChar }, {
            onConnected: () => {
                document.getElementById('hud-peer-status').textContent = peerState.online
                    ? `${peerState.name}: آنلاین پشت میز ☕`
                    : 'متصل به کافه (منتظر یار...)';
            },
            onDisconnected: () => {
                document.getElementById('peer-dot').classList.remove('online');
                document.getElementById('hud-peer-status').textContent = 'در حال اتصال مجدد...';
            },
            onMessage: handleNetworkEvent
        });
    }

    function handleNetworkEvent(data) {
        if (data.type === 'join' || data.type === 'here' || data.type === 'heartbeat') {
            const wasOffline = !peerState.online;
            peerState.online = true;
            peerState.name = data.sender;
            peerState.char = data.char;

            document.getElementById('peer-dot').classList.add('online');
            document.getElementById('hud-peer-status').textContent = `${peerState.name}: آنلاین پشت میز ☕`;
            CafeEngine.updateState({ peerOnline: true, peerName: peerState.name });

            if (wasOffline) {
                showToast(`✨ ${peerState.name} پشت میز نشست!`);
                addSystemLog(`${peerState.name} وارد کافه شد و پشت میز نشست.`);
            }
            if (data.type === 'join') {
                CafeNetwork.announcePresence({ name: myName, char: myChar }, 'here');
            }
        } else if (data.type === 'leave') {
            peerState.online = false;
            document.getElementById('peer-dot').classList.remove('online');
            document.getElementById('hud-peer-status').textContent = `${data.sender} فعلاً رفت...`;
            CafeEngine.updateState({ peerOnline: false });
        } else if (data.type === 'chat') {
            renderMessageBubble(data.msg, false);
        } else if (data.type === 'action') {
            spawnFloatingReaction(data.char, data.emoji);
            addSystemLog(`${data.sender} ${data.text}`);
        } else if (data.type === 'weather') {
            weatherIdx = data.weatherIdx;
            applyWeatherUI();
            showToast(`天氣 کافه به حالت ${WEATHER_MODES[weatherIdx].label} تغییر کرد`);
        } else if (data.type === 'gramophone') {
            syncGramophoneState(data.playing);
        }
    }

    function handleSendMessage(e) {
        e.preventDefault();
        const input = document.getElementById('chat-text-input');
        const text = input.value.trim();
        if (!text) return;

        const msgObj = {
            senderName: myName,
            text: text,
            time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
        };

        renderMessageBubble(msgObj, true);
        CafeNetwork.sendEvent({ type: 'chat', msg: msgObj });
        input.value = '';
    }

    function renderMessageBubble(msg, isMe) {
        const listEl = document.getElementById('messages-list');
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble ' + (isMe ? 'me' : 'other');
        bubble.innerHTML = `
            <span class="msg-author">${isMe ? 'شما' : escapeHtml(msg.senderName)}</span>
            <div class="msg-body">${escapeHtml(msg.text)}</div>
            <div class="msg-meta">${msg.time || ''}</div>
        `;
        listEl.appendChild(bubble);
        listEl.scrollTop = listEl.scrollHeight;
    }

    function sendAction(text, emoji) {
        spawnFloatingReaction(myChar, emoji);
        addSystemLog(`شما ${text}`);
        CafeNetwork.sendEvent({ type: 'action', sender: myName, char: myChar, text, emoji });
    }

    function spawnFloatingReaction(charSide, emoji) {
        const layer = document.getElementById('reactions-layer');
        const el = document.createElement('div');
        el.className = 'floating-reaction';
        el.textContent = emoji;
        // مختصات دقیق بالای سر کاراکتر آقا یا خانم پشت میز ایزومتریک
        el.style.left = charSide === 'male' ? '44%' : '69%';
        el.style.top = charSide === 'male' ? '42%' : '45%';
        layer.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    }

    function cycleWeather(broadcast = false) {
        weatherIdx = (weatherIdx + 1) % WEATHER_MODES.length;
        applyWeatherUI();
        if (broadcast) {
            CafeNetwork.sendEvent({ type: 'weather', weatherIdx });
        }
    }

    function applyWeatherUI() {
        const mode = WEATHER_MODES[weatherIdx];
        document.getElementById('weather-btn').textContent = `${mode.icon} ${mode.label}`;
        CafeEngine.updateState({ weather: mode.id });
    }

    function toggleAmbience() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const btn = document.getElementById('ambience-btn');

        if (!ambiencePlaying) {
            // تولید صدای نرم باران کافه با Web Audio API
            const bufferSize = 2 * audioCtx.sampleRate;
            const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }
            const whiteNoise = audioCtx.createBufferSource();
            whiteNoise.buffer = noiseBuffer;
            whiteNoise.loop = true;

            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 650;

            const gainNode = audioCtx.createGain();
            gainNode.gain.value = 0.06;

            whiteNoise.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            whiteNoise.start(0);

            ambienceNode = whiteNoise;
            ambiencePlaying = true;
            btn.textContent = '🔊 محیط';
            btn.classList.add('active');
        } else {
            if (ambienceNode) ambienceNode.stop();
            ambiencePlaying = false;
            btn.textContent = '🔇 محیط';
            btn.classList.remove('active');
        }
    }

    function toggleGramophoneModal() {
        document.getElementById('gramophone-modal').classList.toggle('open');
    }

    function toggleGramophone() {
        const nextState = !gramophonePlaying;
        syncGramophoneState(nextState);
        CafeNetwork.sendEvent({ type: 'gramophone', playing: nextState });
    }

    function syncGramophoneState(play) {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        gramophonePlaying = play;
        CafeEngine.updateState({ gramophonePlaying: play });

        const btn = document.getElementById('gram-play-btn');
        if (play) {
            btn.textContent = '⏸ توقف';
            playLofiChordLoop();
        } else {
            btn.textContent = '▶ پخش';
            if (gramophoneInterval) clearInterval(gramophoneInterval);
        }
    }

    function playLofiChordLoop() {
        if (gramophoneInterval) clearInterval(gramophoneInterval);
        const notes = [261.63, 329.63, 392.00, 493.88]; // آکورد ملایم Cmaj7
        let idx = 0;
        gramophoneInterval = setInterval(() => {
            if (!gramophonePlaying) return;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = notes[idx % notes.length];
            gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.8);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 1.8);
            idx++;
        }, 900);
    }

    function toggleChatPanel(forceHide) {
        const sanctuary = document.getElementById('main-sanctuary');
        chatMinimized = typeof forceHide === 'boolean' ? forceHide : !chatMinimized;
        sanctuary.classList.toggle('chat-minimized', chatMinimized);
    }

    function addSystemLog(text) {
        const listEl = document.getElementById('messages-list');
        const div = document.createElement('div');
        div.className = 'system-event-msg';
        div.textContent = text;
        listEl.appendChild(div);
        listEl.scrollTop = listEl.scrollHeight;
    }

    function copyRoomCode() {
        navigator.clipboard.writeText(roomCode);
        showToast('📋 شماره میز کپی شد!');
    }

    function showToast(msg) {
        const t = document.getElementById('presence-toast');
        t.textContent = msg;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 3000);
    }

    function escapeHtml(str) {
        return str ? str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])) : '';
    }

    return {
        selectCharacter,
        enterCafe,
        handleSendMessage,
        sendAction,
        cycleWeather,
        toggleAmbience,
        toggleGramophoneModal,
        toggleGramophone,
        toggleChatPanel,
        copyRoomCode
    };
})();