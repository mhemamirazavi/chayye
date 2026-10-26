const CafeEngine = (() => {
    let canvas, ctx;
    let cafeBgImg = new Image();
    let bgLoaded = false;

    let state = {
        myName: 'شما',
        myChar: 'male',
        peerOnline: false,
        peerName: 'منتظر یار...',
        weather: 'rain', // rain, autumn, snow
        gramophonePlaying: false,
        tick: 0
    };

    // ذرات آب‌وهوا پشت پنجره ایزومتریک
    const particles = [];
    const steamParticles = [
        { x: 575, y: 525, offset: 0 },
        { x: 642, y: 538, offset: 1.5 }
    ];

    function init() {
        canvas = document.getElementById('cafe-canvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');

        // بارگذاری تصویر اصلی کافه ایزومتریک فاز دوم
        cafeBgImg.src = 'Gramophone Glow in a Cozy Café.png';
        cafeBgImg.onload = () => { bgLoaded = true; };

        initWeatherParticles();
        requestAnimationFrame(renderLoop);
    }

    function initWeatherParticles() {
        particles.length = 0;
        for (let i = 0; i < 45; i++) {
            particles.push({
                x: 550 + Math.random() * 300,
                y: 175 + Math.random() * 430,
                speedY: 2.5 + Math.random() * 2.5,
                speedX: -0.6,
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

        // ۱. رسم تصویر پس‌زمینه کافه ایزومتریک
        if (bgLoaded) {
            ctx.drawImage(cafeBgImg, 0, 0, 1024, 1024);
        } else {
            drawFallbackIsometricRoom();
        }

        // ۲. رندر افکت باران/برف/پاییز در قاب پنجره ایزومتریک
        drawWindowWeather();

        // ۳. رندر هاله نور گرم چراغ‌های آویز و شمع روی میز دو نفره
        drawDynamicLighting();

        // ۴. رندر بخار فنجان‌های قهوه روی میز
        drawCoffeeSteam();

        // ۵. رندر نت‌های موسیقی گرامافون در صورت روشن بودن
        if (state.gramophonePlaying) {
            drawGramophoneNotes();
        }

        // ۶. رندر برچسب نام کاراکترها بالای سرشان (مطابق اسکرین‌شات فاز دوم)
        drawCharacterLabels();

        requestAnimationFrame(renderLoop);
    }

    function drawWindowWeather() {
        ctx.save();
        // برش دقیق قاب پنجره ایزومتریک کافه
        ctx.beginPath();
        ctx.moveTo(552, 175);
        ctx.lineTo(848, 332);
        ctx.lineTo(848, 608);
        ctx.lineTo(552, 442);
        ctx.closePath();
        ctx.clip();

        particles.forEach(p => {
            if (state.weather === 'rain') {
                ctx.strokeStyle = 'rgba(185, 218, 255, 0.55)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x - 4, p.y + 14);
                ctx.stroke();
                p.y += p.speedY * 2.2;
                p.x += p.speedX;
            } else if (state.weather === 'snow') {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
                ctx.fillRect(p.x, p.y, p.size * 1.4, p.size * 1.4);
                p.y += p.speedY * 0.6;
                p.x += Math.sin(state.tick + p.y * 0.02) * 0.7;
            } else if (state.weather === 'autumn') {
                ctx.fillStyle = 'rgba(240, 135, 45, 0.75)';
                ctx.fillRect(p.x, p.y, p.size * 1.8, p.size * 1.2);
                p.y += p.speedY * 0.8;
                p.x += Math.cos(state.tick + p.y * 0.02) * 0.9;
            }

            if (p.y > 615) {
                p.y = 170;
                p.x = 552 + Math.random() * 295;
            }
        });

        ctx.restore();
    }

    function drawDynamicLighting() {
        const pulse = 0.88 + Math.sin(state.tick * 1.8) * 0.12;

        // هاله چراغ بالای میز دو نفره
        drawWarmGlow(638, 412, 125 * pulse, 0.24);
        // هاله چراغ بالای بار قهوه سمت چپ
        drawWarmGlow(168, 395, 95 * pulse, 0.2);
        drawWarmGlow(310, 345, 85 * pulse, 0.18);
        // شعله شمع روی میز دو نفره
        drawWarmGlow(608, 522, 42 * pulse, 0.35);
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
            const yOffset = progress * 26;
            const xSway = Math.sin(progress * Math.PI * 2) * 4;
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

        // برچسب کاراکتر آقا (سمت چپ میز)
        drawPixelBadge(452, 442, maleLabel, '#f6e9d7');
        // برچسب کاراکتر خانم (سمت راست میز)
        drawPixelBadge(712, 468, femaleLabel, '#ffd07b');
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

        // کادر نیمه‌شفاف تیره زیر نام برای خوانایی عالی روی پس‌زمینه کافه
        ctx.fillStyle = 'rgba(18, 10, 8, 0.72)';
        ctx.strokeStyle = 'rgba(240, 157, 56, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x - boxW / 2, y - boxH / 2, boxW, boxH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.fillText(text, x, y + 1);
        ctx.restore();
    }

    function drawFallbackIsometricRoom() {
        ctx.fillStyle = '#161018';
        ctx.fillRect(0, 0, 1024, 1024);
    }

    return { init, updateState };
})();