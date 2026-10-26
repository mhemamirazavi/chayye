const CafeNetwork = (() => {
    const BROKERS = [
        'wss://broker.emqx.io:8084/mqtt',
        'wss://broker.hivemq.com:8884/mqtt',
        'wss://test.mosquitto.org:8081/mqtt'
    ];

    let activeClient = null;
    let poolClients = [];
    let myClientId = 'khalvat_v2_' + Math.random().toString(36).substring(2, 10);
    let baseTopic = '';
    let presenceTopic = '';
    let heartbeatTimer = null;
    let callbacks = {};

    function connect(roomCode, userData, eventCallbacks) {
        callbacks = eventCallbacks;
        baseTopic = `khalvat_cafe_v2/${roomCode}/events`;
        presenceTopic = `khalvat_cafe_v2/${roomCode}/presence/${userData.char}`;

        cleanupPool();

        // اتصال موازی (Race) به همه سرورها برای عبور قطعی از اختلالات اینترنت
        BROKERS.forEach((brokerUrl) => {
            try {
                const client = mqtt.connect(brokerUrl, {
                    clientId: myClientId + '_' + Math.random().toString(36).substring(2, 5),
                    keepalive: 25,
                    reconnectPeriod: 3000,
                    connectTimeout: 8000,
                    will: {
                        topic: presenceTopic,
                        payload: JSON.stringify({ type: 'leave', sender: userData.name, char: userData.char, id: myClientId }),
                        qos: 0,
                        retain: true
                    }
                });

                poolClients.push(client);

                client.on('connect', () => {
                    if (!activeClient) {
                        activeClient = client;
                        // بستن بقیه کلاینت‌های اضافی بعد از پیدا کردن اولین سرور سالم
                        poolClients.forEach(c => {
                            if (c !== activeClient) {
                                try { c.end(true); } catch (e) {}
                            }
                        });
                        poolClients = [activeClient];
                        setupActiveClient(userData);
                    }
                });
            } catch (err) {}
        });
    }

    function setupActiveClient(userData) {
        if (callbacks.onConnected) callbacks.onConnected();

        // سابسکرایب به کانال رویدادها و کانال حضور هر دو کاراکتر
        const roomPresenceWildcard = baseTopic.replace('/events', '/presence/+');
        activeClient.subscribe([baseTopic, roomPresenceWildcard], { qos: 0 }, (err) => {
            if (!err) {
                announcePresence(userData, 'join');
            }
        });

        activeClient.on('message', (topic, payloadBuffer) => {
            let data;
            try {
                data = JSON.parse(payloadBuffer.toString());
            } catch (e) {
                return;
            }
            if (!data || data.id === myClientId) return;

            if (callbacks.onMessage) callbacks.onMessage(data);
        });

        activeClient.on('close', () => {
            if (callbacks.onDisconnected) callbacks.onDisconnected();
        });

        if (heartbeatTimer) clearInterval(heartbeatTimer);
        heartbeatTimer = setInterval(() => {
            announcePresence(userData, 'heartbeat');
        }, 6000);
    }

    function announcePresence(userData, eventType = 'heartbeat') {
        if (!activeClient || !activeClient.connected) return;
        const payload = JSON.stringify({
            type: eventType,
            sender: userData.name,
            char: userData.char,
            id: myClientId,
            ts: Date.now()
        });
        // ذخیره وضعیت حضور به صورت Retained تا نفر دوم بلافاصله ببیند
        activeClient.publish(presenceTopic, payload, { qos: 0, retain: true });
        if (eventType === 'join') {
            activeClient.publish(baseTopic, payload, { qos: 0, retain: false });
        }
    }

    function sendEvent(payloadObj) {
        if (!activeClient || !activeClient.connected) return false;
        const fullPayload = { ...payloadObj, id: myClientId, ts: Date.now() };
        activeClient.publish(baseTopic, JSON.stringify(fullPayload), { qos: 0, retain: false });
        return true;
    }

    function cleanupPool() {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        poolClients.forEach(c => {
            try { c.end(true); } catch (e) {}
        });
        poolClients = [];
        activeClient = null;
    }

    return { connect, sendEvent, announcePresence };
})();