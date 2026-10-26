const CafeEngine = (() => {
    let canvas, ctx;
    let cafeBgImg = new Image();
    let bgLoaded = false;

    let state = {
        myName: 'شما',
        myChar: 'male',
        peerOnline: false,
        peerName: 'منتظر یار...',
        weather: 'rain',
        gramophonePlaying: false,
        tick: 0
    };

    const particles = [];
    const steamParticles = [
        { x: 575, y: 525, offset: 0 },
        { x: 642, y: 538, offset: 1.5 }
    ];

    function init() {
        canvas = document.getElementById('cafe-canvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');

        cafeBgImg.src = 'Gramophone Glow in a Cozy Café.png';
        cafeBgImg.onload = () => { bgLoaded = true; };

        initWeatherParticles();
        requestAnimationFrame(renderLoop);
    }

    function initWeatherParticles() {
        particles.length = 0;
        for (let i = 0; i < 48; i++) {
            particles.push({
                x: 555 + Math.random() * 290,
                y: 175 + Math.random() * 410,
                speedY: 2.6 + Math.random() * 2.2,
                speedX: -0.5,
                size: 2 + Math.random() * 2.5
            });
        }
    }

    function updateState(newState) {
        state = { ...state, ...newState };
    }

    function renderLoop() {
        state.tick += 0.035;
        ctx.clearRect(0, 0, 1024, 1024);

        if (bgLoaded) {
            ctx.drawImage(cafeBgImg, 0, 0, 1024, 1024);
        } else {
            ctx.fillStyle = '#161018';
            ctx.fillRect(0, 0, 1024, 1024);
        }

        drawWindowWeatherMasked();
        drawDynamicLighting();
        drawCoffeeSteam();

        if (state.gramophonePlaying) {
            drawGramophoneNotes();
        }

        drawCharacterLabels();
        requestAnimationFrame(renderLoop);
    }

    function drawWindowWeatherMasked() {
        ctx.save();

        // ماسک چندضلعی هوشمند: فقط شیشه پنجره را شامل می‌شود و دور سر کاراکتر خانم و گلدان را برش می‌زند
        ctx.beginPath();
        ctx.moveTo(554, 178); // گوشه بالا چپ پنجره
        ctx.lineTo(846, 332); // گوشه بالا راست پنجره
        ctx.lineTo(846, 595); // گوشه پایین راست پنجره
        ctx.lineTo(748, 542); // لب پنجره سمت راست کاراکتر خانم
        // دور زدن کامل سر و حجاب گل‌دار کاراکتر خانم (Exclude Silhouette)
        ctx.lineTo(748, 458);
        ctx.lineTo(715, 432);
        ctx.lineTo(662, 432);
        ctx.lineTo(645, 478);
        // دور زدن گلدان روی میز و برگشت به لبه چپ پنجره
        ctx.lineTo(605, 462);
        ctx.lineTo(554, 435);
        ctx.closePath();
        ctx.clip();

        particles.forEach(p => {
            if (state.weather === 'rain') {
                ctx.strokeStyle = 'rgba(185, 220, 255, 0.58)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x - 3, p.y + 13);
                ctx.stroke();
                p.y += p.speedY * 2.2;
                p.x += p.speedX;
            } else if (state.weather === 'snow') {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.fillRect(p.x, p.y, p.size * 1.4, p.size * 1.4);
                p.y += p.speedY * 0.55;
                p.x += Math.sin(state.tick + p.y * 0.02) * 0.75;
            } else if (state.weather === 'autumn') {
                ctx.fillStyle = 'rgba(240, 140, 48, 0.78)';
                ctx.fillRect(p.x, p.y, p.size * 1.9, p.size * 1.2);
                p.y += p.speedY * 0.75;
                p.x += Math.cos(state.tick + p.y * 0.02) * 0.95;
            }

            if (p.y > 595) {
                p.y = 175;
                p.x = 555 + Math.random() * 288;
            }
        });

        ctx.restore();
    }

    function drawDynamicLighting() {
        const pulse = 0.88 + Math.sin(state.tick * 1.8) * 0.12;
        drawWarmGlow(638, 412, 120 * pulse, 0.22);
        drawWarmGlow(168, 395, 92 * pulse, 0.19);
        drawWarmGlow(310, 345, 82 * pulse, 0.17);
        drawWarmGlow(608, 522, 40 * pulse, 0.34);
    }

    function drawWarmGlow(x, y, radius, maxAlpha) {
        const grad = ctx.createRadialGradient(x, y, 2, x, y, radius);
        grad.addColorStop(0, `rgba(255, 210, 125, ${maxAlpha})`);
        grad.addColorStop(1, 'rgba(240, 157, 56, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawCoffeeSteam() {
        steamParticles.forEach(sp => {
            const progress = ((state.tick * 0.55 + sp.offset) % 1);
            const yOffset = progress * 24;
            const xSway = Math.sin(progress * Math.PI * 2) * 3.5;
            const alpha = (1 - progress) * 0.65;

            ctx.fillStyle = `rgba(246, 233, 215, ${alpha})`;
            ctx.fillRect(sp.x + xSway, sp.y - yOffset, 4, 8);
        });
    }

    function drawGramophoneNotes() {
        const progress = (state.tick * 0.45) % 1;
        const noteX = 875 - progress * 25;
        const noteY = 545 - progress * 55;
        const alpha = 1 - progress;

        ctx.save();
        ctx.font = 'bold 24px RooyinBold, Vazirmatn, sans-serif';
        ctx.fillStyle = `rgba(255, 208, 123, ${alpha})`;
        ctx.fillText('♪', noteX, noteY);
        ctx.restore();
    }

    function drawCharacterLabels() {
        const maleLabel = state.myChar === 'male'
            ? `${state.myName} (شما)`
            : (state.peerOnline ? state.peerName : 'منتظر یار...');

        const femaleLabel = state.myChar === 'female'
            ? `${state.myName} (شما)`
            : (state.peerOnline ? state.peerName : 'منتظر یار...');

        drawPixelBadge(452, 438, maleLabel, '#f6e9d7');
        drawPixelBadge(705, 422, femaleLabel, '#ffd07b');
    }

    function drawPixelBadge(x, y, text, color) {
        ctx.save();
        ctx.font = 'bold 19px RooyinBold, Vazirmatn, Tahoma, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const metrics = ctx.measureText(text);
        const padX = 12;
        const boxW = metrics.width + padX * 2;
        const boxH = 30;

        ctx.fillStyle = 'rgba(18, 10, 8, 0.78)';
        ctx.strokeStyle = 'rgba(240, 157, 56, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x - boxW / 2, y - boxH / 2, boxW, boxH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.fillText(text, x, y + 1);
        ctx.restore();
    }

    return { init, updateState };
})();