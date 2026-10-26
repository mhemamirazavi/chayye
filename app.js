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

    // لیست ۳ موزیک کامل و طولانی Lo-Fi + قابلیت افزودن ترک سفارشی
    let tracks = [
        {
            id: 'lofi_rain',
            title: '۱. باران شبانه کافه (Lo-Fi Chill)',
            type: 'synth',
            tempo: 420,
            chords: [
                [261.63, 329.63, 392.00, 493.88], // Cmaj7
                [220.00, 261.63, 329.63, 392.00], // Am7
                [174.61, 220.00, 261.63, 349.23], // Fmaj7
                [196.00, 246.94, 293.66, 349.23]  // G7
            ],
            melody: [523.25, 659.25, 587.33, 493.88, 523.25, 392.00, 440.00, 329.63, 349.23, 440.00, 392.00, 329.63, 293.66, 349.23, 329.63, 261.63]
        },
        {
            id: 'lofi_autumn',
            title: '۲. قهوه و دلتنگی (Cozy Guitar)',
            type: 'synth',
            tempo: 360,
            chords: [
                [220.00, 261.63, 329.63], // Am
                [146.83, 220.00, 293.66], // Dm
                [196.00, 246.94, 293.66], // G
                [164.81, 246.94, 329.63]  // Em
            ],
            melody: [440.00, 523.25, 659.25, 587.33, 493.88, 440.00, 392.00, 440.00, 587.33, 523.25, 493.88, 392.00, 440.00, 329.63, 293.66, 329.63]
        },
        {
            id: 'lofi_stars',
            title: '۳. ستاره‌های نیمه‌شب (Dreamy Box)',
            type: 'synth',
            tempo: 480,
            chords: [
                [174.61, 220.00, 261.63, 329.63], // Fmaj7
                [164.81, 196.00, 246.94, 293.66], // Em7
                [146.83, 174.61, 220.00, 261.63], // Dm7
                [130.81, 164.81, 196.00, 246.94]  // Cmaj7
            ],
            melody: [659.25, 783.99, 698.46, 659.25, 587.33, 523.25, 587.33, 659.25, 523.25, 440.00, 493.88, 523.25, 392.00, 440.00, 392.00, 349.23]
        }
    ];
    let currentTrackIdx = 0;
    let gramophonePlaying = false;
    let gramophoneTimer = null;

    // موتور صدای محیط تفکیک‌شده برای هر فصل
    let audioCtx = null;
    let ambiencePlaying = false;
    let ambienceNodes = [];
    let ambienceEffectTimer = null;

    window.addEventListener('DOMContentLoaded', () => {
        CafeEngine.init();
        renderTrackList();

        // اتصال مستقیم فرم ارسال پیام برای جلوگیری از هرگونه باگ عدم ارسال
        const chatForm = document.getElementById('chat-form');
        if (chatForm) {
            chatForm.addEventListener('submit', handleSendMessage);
        }

        const savedName = localStorage.getItem('khalvat_name');
        const savedRoom = localStorage.getItem('khalvat_room');
        const savedChar = localStorage.getItem('khalvat_char');
        if (savedName) document.getElementById('login-name').value = savedName;
        if (savedRoom) document.getElementById('login-room').value = savedRoom;
        if (savedChar) selectCharacter(savedChar);
    });

    function ensureAudioContext() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

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
        } else if (data.type === 'chat' && data.msg) {
            renderMessageBubble(data.msg, false);
        } else if (data.type === 'action') {
            spawnFloatingReaction(data.char, data.emoji);
            addSystemLog(`${data.sender} ${data.text}`);
        } else if (data.type === 'weather') {
            weatherIdx = data.weatherIdx;
            applyWeatherUI();
            showToast(`آب‌وهوای کافه به حالت ${WEATHER_MODES[weatherIdx].label} تغییر کرد`);
        } else if (data.type === 'gramophone') {
            if (data.customTrack) {
                const exists = tracks.some(t => t.id === data.customTrack.id);
                if (!exists) {
                    tracks.push(data.customTrack);
                    renderTrackList();
                }
            }
            if (typeof data.trackIdx === 'number') {
                currentTrackIdx = data.trackIdx;
            }
            syncGramophoneState(data.playing);
        }
    }

    function handleSendMessage(e) {
        if (e) e.preventDefault();
        const input = document.getElementById('chat-text-input');
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;

        const msgObj = {
            senderName: myName || 'شما',
            text: text,
            time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
        };

        renderMessageBubble(msgObj, true);
        CafeNetwork.sendEvent({ type: 'chat', msg: msgObj });
        input.value = '';
        input.focus();
    }

    function renderMessageBubble(msg, isMe) {
        const listEl = document.getElementById('messages-list');
        if (!listEl) return;
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
        el.style.left = charSide === 'male' ? '44%' : '69%';
        el.style.top = charSide === 'male' ? '41%' : '40%';
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
        // اگر صدای محیط روشن است، بلافاصله صدای متناسب با فصل جدید پخش شود
        if (ambiencePlaying) {
            startWeatherAmbience(mode.id);
        }
    }

    // --- موتور صدای محیط اختصاصی برای هر فصل ---
    function toggleAmbience() {
        ensureAudioContext();
        const btn = document.getElementById('ambience-btn');

        if (!ambiencePlaying) {
            ambiencePlaying = true;
            btn.textContent = '🔊 محیط';
            btn.classList.add('active');
            startWeatherAmbience(WEATHER_MODES[weatherIdx].id);
        } else {
            ambiencePlaying = false;
            btn.textContent = '🔇 محیط';
            btn.classList.remove('active');
            stopWeatherAmbience();
        }
    }

    function stopWeatherAmbience() {
        if (ambienceEffectTimer) clearInterval(ambienceEffectTimer);
        ambienceNodes.forEach(n => {
            try { n.stop(); } catch (e) {}
            try { n.disconnect(); } catch (e) {}
        });
        ambienceNodes = [];
    }

    function startWeatherAmbience(weatherId) {
        stopWeatherAmbience();
        ensureAudioContext();

        const bufferSize = 2 * audioCtx.sampleRate;
        const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.997 * b0 + white * 0.029;
            b1 = 0.985 * b1 + white * 0.032;
            b2 = 0.950 * b2 + white * 0.048;
            output[i] = (b0 + b1 + b2 + white * 0.015) * 3.5;
        }

        const noiseSource = audioCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;

        const filter = audioCtx.createBiquadFilter();
        const gainNode = audioCtx.createGain();

        if (weatherId === 'rain') {
            // صدای شرشر باران روی شیشه + چکه‌های آب
            filter.type = 'bandpass';
            filter.frequency.value = 1100;
            filter.Q.value = 0.7;
            gainNode.gain.value = 0.14;

            ambienceEffectTimer = setInterval(() => {
                if (!ambiencePlaying) return;
                // صدای چکه‌های باران روی لبه پنجره
                const dropOsc = audioCtx.createOscillator();
                const dropGain = audioCtx.createGain();
                dropOsc.type = 'sine';
                const freq = 900 + Math.random() * 600;
                dropOsc.frequency.setValueAtTime(freq, audioCtx.currentTime);
                dropOsc.frequency.exponentialRampToValueAtTime(freq * 1.35, audioCtx.currentTime + 0.045);
                dropGain.gain.setValueAtTime(0.018, audioCtx.currentTime);
                dropGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.05);
                dropOsc.connect(dropGain);
                dropGain.connect(audioCtx.destination);
                dropOsc.start();
                dropOsc.stop(audioCtx.currentTime + 0.055);
            }, 220);

        } else if (weatherId === 'autumn') {
            // صدای وزش نسیم پاییزی در میان برگ‌ها (فیلتر متحرک سینوسی) + خش‌خش برگ
            filter.type = 'bandpass';
            filter.frequency.value = 420;
            filter.Q.value = 2.8;
            gainNode.gain.value = 0.16;

            const lfo = audioCtx.createOscillator();
            const lfoGain = audioCtx.createGain();
            lfo.frequency.value = 0.18;
            lfoGain.gain.value = 260;
            lfo.connect(lfoGain);
            lfoGain.connect(filter.frequency);
            lfo.start();
            ambienceNodes.push(lfo);

            ambienceEffectTimer = setInterval(() => {
                if (!ambiencePlaying) return;
                triggerFireCrackle(0.015);
            }, 480);

        } else if (weatherId === 'snow') {
            // سکوت گرم زمستانی همراه با صدای واضح‌تر سوختن هیزم شومینه کافه
            filter.type = 'lowpass';
            filter.frequency.value = 210;
            gainNode.gain.value = 0.08;

            ambienceEffectTimer = setInterval(() => {
                if (!ambiencePlaying) return;
                triggerFireCrackle(0.032);
            }, 260);
        }

        noiseSource.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        noiseSource.start(0);
        ambienceNodes.push(noiseSource);
    }

    function triggerFireCrackle(vol) {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140 + Math.random() * 280, audioCtx.currentTime);
        g.gain.setValueAtTime(vol, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.035);
        osc.connect(g);
        g.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.04);
    }

    // --- گرامافون مشترک (۳ ترک Lo-Fi طولانی + موزیک دلخواه) ---
    function toggleGramophoneModal() {
        document.getElementById('gramophone-modal').classList.toggle('open');
    }

    function renderTrackList() {
        const listEl = document.getElementById('gram-track-list');
        if (!listEl) return;
        listEl.innerHTML = '';

        tracks.forEach((tr, idx) => {
            const item = document.createElement('div');
            item.className = 'track-item' + (idx === currentTrackIdx ? ' active' : '');
            item.innerHTML = `
                <span>${escapeHtml(tr.title)}</span>
                <span>${idx === currentTrackIdx && gramophonePlaying ? '🔊 در حال پخش' : '▶ انتخاب'}</span>
            `;
            item.onclick = () => selectTrack(idx, true);
            listEl.appendChild(item);
        });

        const current = tracks[currentTrackIdx];
        if (current) {
            document.getElementById('np-track-title').textContent = current.title;
        }
    }

    function selectTrack(idx, broadcast = false) {
        currentTrackIdx = idx;
        syncGramophoneState(true);
        if (broadcast) {
            CafeNetwork.sendEvent({
                type: 'gramophone',
                playing: true,
                trackIdx: currentTrackIdx
            });
        }
    }

    function toggleGramophone(broadcast = false) {
        const nextState = !gramophonePlaying;
        syncGramophoneState(nextState);
        if (broadcast) {
            CafeNetwork.sendEvent({
                type: 'gramophone',
                playing: nextState,
                trackIdx: currentTrackIdx
            });
        }
    }

    function syncGramophoneState(play) {
        ensureAudioContext();
        gramophonePlaying = play;
        CafeEngine.updateState({ gramophonePlaying: play });

        const btn = document.getElementById('gram-play-btn');
        const extAudio = document.getElementById('external-audio-player');

        if (gramophoneTimer) clearInterval(gramophoneTimer);
        if (extAudio) {
            extAudio.pause();
        }

        if (play) {
            btn.textContent = '⏸ توقف';
            const track = tracks[currentTrackIdx] || tracks[0];
            document.getElementById('np-track-title').textContent = track.title;

            if (track.type === 'url' && extAudio) {
                extAudio.src = track.url;
                extAudio.play().catch(() => {
                    showToast('⚠️ برای پخش موزیک یک بار روی صفحه کلیک کنید');
                });
            } else {
                startRichLofiSynth(track);
            }
        } else {
            btn.textContent = '▶ پخش';
        }

        renderTrackList();
    }

    function startRichLofiSynth(track) {
        let step = 0;
        gramophoneTimer = setInterval(() => {
            if (!gramophonePlaying) return;

            const chord = track.chords[Math.floor(step / 4) % track.chords.length];
            const melodyNote = track.melody[step % track.melody.length];

            // پخش آکورد گرم پیانو الکتریک در سرضرب‌ها
            if (step % 4 === 0) {
                chord.forEach(freq => {
                    playWarmTone(freq, 0.024, 1.6, 'sine');
                });
            }

            // پخش نت ملودی Lo-Fi
            playWarmTone(melodyNote, 0.032, 0.75, 'triangle');

            // صدای ظریف خش‌خش سوزن گرامافون
            if (step % 2 === 0) {
                triggerFireCrackle(0.006);
            }

            step++;
        }, track.tempo || 420);
    }

    function playWarmTone(freq, volume, duration, waveType) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = waveType || 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

        gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration + 0.05);
    }

    function addCustomUrlTrack() {
        const titleInput = document.getElementById('custom-track-title');
        const urlInput = document.getElementById('custom-track-url');
        const title = titleInput.value.trim() || `موزیک سفارشی ${tracks.length + 1}`;
        const url = urlInput.value.trim();

        if (!url) {
            showToast('⚠️ لطفاً لینک مستقیم فایل صوتی (MP3) را وارد کنید');
            return;
        }

        const newTrack = {
            id: 'custom_' + Date.now(),
            title: `🎵 ${title}`,
            type: 'url',
            url: url
        };

        tracks.push(newTrack);
        currentTrackIdx = tracks.length - 1;
        titleInput.value = '';
        urlInput.value = '';

        syncGramophoneState(true);
        CafeNetwork.sendEvent({
            type: 'gramophone',
            playing: true,
            trackIdx: currentTrackIdx,
            customTrack: newTrack
        });
        showToast('✨ موزیک دلخواه به گرامافون اضافه و برای یارتان همگام شد!');
    }

    function addLocalFileTrack(event) {
        const file = event.target.files[0];
        if (!file) return;

        const localUrl = URL.createObjectURL(file);
        const newTrack = {
            id: 'local_' + Date.now(),
            title: `📂 ${file.name.replace(/\.[^/.]+$/, '')}`,
            type: 'url',
            url: localUrl
        };

        tracks.push(newTrack);
        currentTrackIdx = tracks.length - 1;
        syncGramophoneState(true);
        showToast('🎵 فایل صوتی شما در گرامافون بارگذاری شد');
    }

    function toggleChatPanel(forceHide) {
        const sanctuary = document.getElementById('main-sanctuary');
        chatMinimized = typeof forceHide === 'boolean' ? forceHide : !chatMinimized;
        sanctuary.classList.toggle('chat-minimized', chatMinimized);
    }

    function addSystemLog(text) {
        const listEl = document.getElementById('messages-list');
        if (!listEl) return;
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
        if (!t) return;
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
        addCustomUrlTrack,
        addLocalFileTrack,
        toggleChatPanel,
        copyRoomCode
    };
})();
