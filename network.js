const CafeNetwork = (() => {
    // ترتیب قطعی سرورها (همه کاربران ابتدا روی سرور اول EMQX همگام می‌شوند)
    const BROKERS = [
        'wss://broker.emqx.io:8084/mqtt',
        'wss://broker.hivemq.com:8884/mqtt'
    ];

    let client = null;
    let brokerIdx = 0;
    let myClientId = 'khalvat_u_' + Math.random().toString(36).substring(2, 10);
    let roomTopic = '';
    let presenceTopic = '';
    let heartbeatTimer = null;
    let fallbackTimer = null;
    let callbacks = {};
    let currentUser = null;

    function connect(roomCode, userData, eventCallbacks) {
        const cleanRoom = String(roomCode).trim();
        currentUser = userData;
        callbacks = eventCallbacks || {};

        roomTopic = `khalvat_cafe_v201_room/${cleanRoom}`;
        presenceTopic = `khalvat_cafe_v201_room/${cleanRoom}/presence/${userData.char}`;

        brokerIdx = 0;
        connectToCurrentBroker();
    }

    function connectToCurrentBroker() {
        cleanup();

        const brokerUrl = BROKERS[brokerIdx];
        try {
            client = mqtt.connect(brokerUrl, {
                clientId: myClientId + '_' + Math.random().toString(36).substring(2, 5),
                keepalive: 30,
                reconnectPeriod: 3000,
                connectTimeout: 7000
            });
        } catch (err) {
            tryNextBroker();
            return;
        }

        fallbackTimer = setTimeout(() => {
            if (!client || !client.connected) {
                tryNextBroker();
            }
        }, 7500);

        client.on('connect', () => {
            if (fallbackTimer) clearTimeout(fallbackTimer);
            if (callbacks.onConnected) callbacks.onConnected(brokerUrl);

            const presenceWildcard = `${roomTopic}/presence/+`;
            client.subscribe([roomTopic, presenceWildcard], { qos: 0 }, (err) => {
                if (!err) {
                    // اعلام حضور فوری + ذخیره در حافظه اتاق برای نفر دوم
                    announcePresence(currentUser, 'join');
                }
            });
        });

        client.on('message', (topic, payloadBuffer) => {
            let data;
            try {
                data = JSON.parse(payloadBuffer.toString());
            } catch (e) {
                return;
            }
            if (!data || data.id === myClientId) return;
            if (callbacks.onMessage) callbacks.onMessage(data);
        });

        client.on('close', () => {
            if (callbacks.onDisconnected) callbacks.onDisconnected();
        });

        if (heartbeatTimer) clearInterval(heartbeatTimer);
        heartbeatTimer = setInterval(() => {
            if (client && client.connected && currentUser) {
                announcePresence(currentUser, 'heartbeat');
            }
        }, 5000);
    }

    function tryNextBroker() {
        brokerIdx = (brokerIdx + 1) % BROKERS.length;
        connectToCurrentBroker();
    }

    function announcePresence(userData, eventType = 'heartbeat') {
        if (!client || !client.connected) return;
        const payload = JSON.stringify({
            type: eventType,
            sender: userData.name,
            char: userData.char,
            id: myClientId,
            ts: Date.now()
        });
        // ارسال روی کانال حضور با Retain و ارسال همزمان روی کانال اصلی اتاق
        client.publish(presenceTopic, payload, { qos: 0, retain: true });
        client.publish(roomTopic, payload, { qos: 0, retain: false });
    }

    function sendEvent(payloadObj) {
        if (!client || !client.connected) return false;
        const fullPayload = {
            ...payloadObj,
            id: myClientId,
            ts: Date.now()
        };
        client.publish(roomTopic, JSON.stringify(fullPayload), { qos: 0, retain: false });
        return true;
    }

    function cleanup() {
        if (fallbackTimer) clearTimeout(fallbackTimer);
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (client) {
            try { client.end(true); } catch (e) {}
            client = null;
        }
    }

    return { connect, sendEvent, announcePresence };
})();
