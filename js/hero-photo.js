// ==========================================================================
// Hero — troca de foto: a imagem se desfaz em folhas e runas e a outra
// é reconstruída aos poucos num redemoinho. Clique de novo e volta.
// ==========================================================================
(function () {
    "use strict";

    const PHOTOS = [
        { src: "img/Felipe.jpg", alt: "Foto de perfil de Felipe",
          swapLabel: "Trocar foto de perfil: mostrar a ilustração anterior" },
        { src: "img/Nazuna.png", alt: "Ilustração de perfil anterior de Felipe",
          swapLabel: "Trocar foto de perfil: mostrar a foto atual" }
    ];

    const PAD = 170;                 // quanto o canvas sobra para fora da foto (px CSS)
    const LEAF_COLORS = ["#c6fa6e", "#a6e05a", "#7fc447", "#4f9a3e", "#2f6a3a", "#2a4530"];
    const TAU = Math.PI * 2;

    // Runas do Elder Futhark como traços vetoriais (caixa 1 x 2) — não dependem de fonte
    const RUNES = [
        [[[.2,0],[.2,2]], [[.2,.7],[.9,.2]], [[.2,1.2],[.9,.7]]],                       // ᚠ
        [[[.15,2],[.15,0],[.85,.6],[.85,2]]],                                            // ᚢ
        [[[.2,0],[.2,2]], [[.2,.5],[.85,1],[.2,1.5]]],                                   // ᚦ
        [[[.2,0],[.2,2]], [[.2,0],[.85,.55]], [[.2,.6],[.85,1.15]]],                     // ᚨ
        [[[.2,0],[.2,2]], [[.2,0],[.85,.5],[.2,1]], [[.2,1],[.85,2]]],                   // ᚱ
        [[[.8,.3],[.2,1],[.8,1.7]]],                                                     // ᚲ
        [[[.1,.1],[.9,1.9]], [[.9,.1],[.1,1.9]]],                                        // ᚷ
        [[[.2,0],[.2,2]], [[.8,0],[.8,2]], [[.2,.7],[.8,1.3]]],                          // ᚺ
        [[[.5,0],[.5,2]], [[.15,.6],[.85,1.3]]],                                         // ᚾ
        [[[.5,0],[.5,2]]],                                                               // ᛁ
        [[[.5,0],[.5,2]], [[.5,0],[.1,.6]], [[.5,0],[.9,.6]]],                           // ᛏ
        [[[.2,0],[.2,2]], [[.2,0],[.8,.45],[.2,1],[.8,1.5],[.2,2]]],                     // ᛒ
        [[[.5,0],[.5,2]], [[.5,1],[.05,.2]], [[.5,1],[.95,.2]]],                         // ᛉ
        [[[.15,0],[.15,2]], [[.85,0],[.85,2]], [[.15,0],[.85,1.2]], [[.85,0],[.15,1.2]]],// ᛗ
        [[[.5,.2],[.9,1],[.5,1.8],[.1,1],[.5,.2]]],                                      // ᛜ
        [[[.1,.1],[.1,1.9],[.9,.1],[.9,1.9],[.1,.1]]],                                   // ᛞ
        [[[.5,0],[.9,.5],[.5,1],[.1,.5],[.5,0]], [[.5,1],[.1,1.9]], [[.5,1],[.9,1.9]]]   // ᛟ
    ];

    const reduceMotion = () =>
        window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
    const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    document.addEventListener("DOMContentLoaded", init);

    function init() {
        const ring = document.getElementById("hero-photo");
        const img = document.getElementById("hero-photo-img");
        const canvas = document.getElementById("hero-photo-fx");
        if (!ring || !img || !canvas) return;

        const ctx = canvas.getContext("2d");
        const loaded = PHOTOS.map(() => null);   // HTMLImageElement já decodificado
        const atlases = {};                      // cache de recortes por tamanho
        let current = 0;
        let busy = false;
        let geo = null;
        let swapDir = 1;                         // alterna o sentido do vento a cada troca

        // pré-carrega as duas fotos assim que o navegador estiver ocioso
        const preload = () => PHOTOS.forEach((p, i) => loadPhoto(i).catch(() => {}));
        if ("requestIdleCallback" in window) requestIdleCallback(preload, { timeout: 1500 });
        else setTimeout(preload, 300);

        function loadPhoto(i) {
            if (loaded[i]) return Promise.resolve(loaded[i]);
            return new Promise((resolve, reject) => {
                const im = new Image();
                im.onload = () => { loaded[i] = im; resolve(im); };
                im.onerror = reject;
                im.src = PHOTOS[i].src;
            });
        }

        function updateTexts() {
            img.alt = PHOTOS[current].alt;
            ring.setAttribute("aria-label", PHOTOS[current].swapLabel);
        }

        function trigger() {
            if (busy) return;
            busy = true;
            ring.classList.add("is-swapping");
            const next = 1 - current;
            Promise.all([loadPhoto(current), loadPhoto(next)])
                .then(() => (reduceMotion() ? fadeSwap(next) : playTransition(current, next)))
                .catch(() => { // sem imagem carregada: só troca
                    img.src = PHOTOS[next].src;
                    current = next; updateTexts(); finish();
                });
        }

        function finish() {
            busy = false;
            ring.classList.remove("is-swapping");
        }

        ring.addEventListener("click", trigger);
        ring.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); trigger(); }
        });

        // ---------- movimento reduzido: só um fade ----------
        function fadeSwap(next) {
            img.style.transition = "opacity .3s ease";
            img.style.opacity = "0";
            setTimeout(() => {
                img.src = PHOTOS[next].src;
                current = next; updateTexts();
                img.style.opacity = "1";
                setTimeout(() => { img.style.transition = ""; finish(); }, 320);
            }, 320);
        }

        // ---------- geometria e recortes (atlas) ----------
        function getGeometry() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const S = img.clientWidth || 272;           // caixa da imagem
            const P = S - 8;                            // área visível da foto (borda de 4px)
            const mobile = window.matchMedia("(max-width: 800px)").matches;
            const N = Math.max(16, Math.round(P / (mobile ? 8 : 6)));
            const cT = P / N;                           // tamanho do tile em px CSS
            const c = Math.max(1, Math.round(cT * dpr));// tamanho do tile em px do dispositivo
            const C = S + PAD * 2;
            const Cdev = Math.round(C * dpr);
            return { dpr, S, P, N, cT, c, C, Cdev, R: P / 2,
                     key: [dpr, P, N, c].join("|") };
        }

        function leafPath(g, x, y, w, h) {              // folha pontuda horizontal
            g.beginPath();
            g.moveTo(x, y + h / 2);
            g.quadraticCurveTo(x + w / 2, y - h * 0.3, x + w, y + h / 2);
            g.quadraticCurveTo(x + w / 2, y + h * 1.3, x, y + h / 2);
            g.closePath();
        }

        function buildAtlas(im, G) {
            const side = G.N * G.c;
            const full = document.createElement("canvas");
            full.width = full.height = side;
            const g = full.getContext("2d");
            g.imageSmoothingQuality = "high";
            const k = Math.max(side / im.naturalWidth, side / im.naturalHeight);   // cover
            const dw = im.naturalWidth * k, dh = im.naturalHeight * k;
            g.drawImage(im, (side - dw) / 2, (side - dh) / 2, dw, dh);

            // versão "folha": cada tile recortado em formato de folha
            const mask = document.createElement("canvas");
            mask.width = mask.height = side;
            const mg = mask.getContext("2d");
            mg.fillStyle = "#fff";
            const pad = G.c * 0.04, w = G.c - pad * 2, h = G.c * 0.8, yo = G.c * 0.1;
            for (let iy = 0; iy < G.N; iy++) {
                for (let ix = 0; ix < G.N; ix++) {
                    leafPath(mg, ix * G.c + pad, iy * G.c + yo, w, h);
                    mg.fill();
                }
            }
            const leaf = document.createElement("canvas");
            leaf.width = leaf.height = side;
            const lg = leaf.getContext("2d");
            lg.drawImage(full, 0, 0);
            lg.globalCompositeOperation = "destination-in";
            lg.drawImage(mask, 0, 0);
            lg.globalCompositeOperation = "source-atop";
            lg.fillStyle = "rgba(150, 220, 80, 0.16)";   // leve tom de folha, pra casar com o site
            lg.fillRect(0, 0, side, side);
            return { full, leaf };
        }

        function getAtlas(i, G) {
            const key = i + "|" + G.key;
            if (!atlases[key]) atlases[key] = buildAtlas(loaded[i], G);
            return atlases[key];
        }

        // ---------- linha do tempo de uma troca ----------
        function buildTimeline(G, dir) {
            const wa = dir > 0 ? -0.5 : Math.PI + 0.5;   // vento p/ cima-direita ou cima-esquerda
            const wx = Math.cos(wa), wy = Math.sin(wa);
            const px = -wy, py = wx;
            const swirl = dir > 0 ? 1 : -1;
            const tiles = [];

            for (let iy = 0; iy < G.N; iy++) {
                for (let ix = 0; ix < G.N; ix++) {
                    const hx = (ix + 0.5) * G.cT - G.P / 2;
                    const hy = (iy + 0.5) * G.cT - G.P / 2;
                    const rad = Math.hypot(hx, hy);
                    if (rad > G.R + G.cT * 0.45) continue;
                    const u = clamp01(((hx * wx + hy * wy) / G.R + 1) / 2);
                    const ang = rad > 18 ? Math.atan2(hy, hx) : rnd(0, TAU);
                    const tsOut = 0.9 * u + rnd(0, 0.18);
                    const fdOut = rnd(0.85, 1.25);
                    const mix = 0.5 * (1 - u) + 0.5 * clamp01(rad / G.R);
                    const tsIn = Math.max(0.7 + mix * 1.0 + rnd(0, 0.15), tsOut + 0.45 * fdOut);
                    tiles.push({
                        ix, iy, hx, hy,
                        // saída
                        tsOut, fdOut,
                        dist: rnd(150, 360), sway: rnd(16, 44), freq: rnd(1.1, 2.3),
                        lift: rnd(20, 70), ph: rnd(0, TAU), rot0: rnd(-Math.PI, Math.PI),
                        spin: (Math.random() < 0.5 ? -1 : 1) * rnd(1.5, 4.5), flip: rnd(5, 11),
                        // entrada (redemoinho)
                        tsIn, fdIn: rnd(0.9, 1.25),
                        th0: swirl * rnd(1.0, 1.9), extra: rnd(90, 220),
                        angR: ang + rnd(-0.8, 0.8), rotIn: rnd(-Math.PI, Math.PI), ph2: rnd(0, TAU)
                    });
                }
            }

            // folhas e runas "de verdade" (verdes, brilhando) que acompanham a troca
            const parts = [];
            for (const t of tiles) {
                if (Math.random() < 0.065) {
                    parts.push({ out: true, rune: false, x: t.hx, y: t.hy, ts: t.tsOut + rnd(0, 0.1),
                                 dur: rnd(1.5, 2.6), dist: rnd(240, 520), size: rnd(7, 15),
                                 color: LEAF_COLORS[(Math.random() * LEAF_COLORS.length) | 0],
                                 sway: rnd(24, 60), freq: rnd(1.0, 2.2), lift: rnd(30, 110),
                                 ph: rnd(0, TAU), rot0: rnd(-Math.PI, Math.PI), spin: rnd(-3, 3) });
                } else if (Math.random() < 0.02) {
                    parts.push({ out: true, rune: true, x: t.hx, y: t.hy, ts: t.tsOut + rnd(0, 0.15),
                                 dur: rnd(1.6, 2.6), dist: rnd(200, 420), size: rnd(13, 22),
                                 glyph: RUNES[(Math.random() * RUNES.length) | 0],
                                 sway: rnd(14, 36), freq: rnd(0.8, 1.6), lift: rnd(30, 90),
                                 ph: rnd(0, TAU), rot0: rnd(-0.4, 0.4), spin: rnd(-0.5, 0.5) });
                }
            }
            for (let n = 0; n < 80; n++) {
                const t = tiles[(Math.random() * tiles.length) | 0];
                const rune = n % 3 === 0;
                const ang = rnd(0, TAU), r0 = rnd(190, 300);
                parts.push({ out: false, rune, x: t.hx, y: t.hy,
                             sx: Math.cos(ang) * r0, sy: Math.sin(ang) * r0,
                             ts: rnd(0.55, 2.0), dur: rnd(1.0, 1.7),
                             size: rune ? rnd(13, 22) : rnd(7, 15),
                             color: LEAF_COLORS[(Math.random() * LEAF_COLORS.length) | 0],
                             glyph: RUNES[(Math.random() * RUNES.length) | 0],
                             th0: swirl * rnd(1.2, 2.4), ph: rnd(0, TAU), rot0: rnd(-Math.PI, Math.PI) });
            }

            // círculo rúnico ao redor da foto
            const circle = [];
            const count = 18;
            for (let i = 0; i < count; i++) {
                circle.push({ a: (i / count) * TAU, glyph: RUNES[(i * 5 + 3) % RUNES.length],
                              ph: rnd(0, TAU) });
            }

            let end = 0;
            for (const t of tiles) end = Math.max(end, t.tsIn + t.fdIn);
            for (const p of parts) end = Math.max(end, p.ts + p.dur);
            return { tiles, parts, circle, wx, wy, px, py, duration: Math.max(end, 2.6) + 0.05, dir };
        }

        // ---------- desenho ----------
        function setT(a, G, x, y, rot, sc, fy) {
            const cs = Math.cos(rot) * sc * G.dpr, sn = Math.sin(rot) * sc * G.dpr;
            a.setTransform(cs, sn, -sn * fy, cs * fy, G.Cdev / 2 + x * G.dpr, G.Cdev / 2 + y * G.dpr);
        }

        function strokeRune(g, glyph, size, alpha) {
            if (alpha <= 0.01) return;
            const k = size / 2;
            g.lineCap = "round"; g.lineJoin = "round";
            for (let pass = 0; pass < 2; pass++) {
                g.lineWidth = pass === 0 ? 3.6 : 1.4;
                g.strokeStyle = pass === 0 ? "rgba(198,250,110," + (0.22 * alpha).toFixed(3) + ")"
                                           : "rgba(226,255,176," + alpha.toFixed(3) + ")";
                g.beginPath();
                for (const stroke of glyph) {
                    for (let i = 0; i < stroke.length; i++) {
                        const x = (stroke[i][0] - 0.5) * k, y = (stroke[i][1] - 1) * k;
                        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
                    }
                }
                g.stroke();
            }
        }

        function drawLeaf(g, size, color, alpha) {
            g.globalAlpha = alpha;
            g.fillStyle = color;
            leafPath(g, -size, -size * 0.42, size * 2, size * 0.84);
            g.fill();
            g.strokeStyle = "rgba(10,16,12,0.45)";
            g.lineWidth = 0.9;
            g.beginPath();
            g.moveTo(-size * 0.92, 0); g.lineTo(size * 0.85, 0);
            g.stroke();
            g.globalAlpha = 1;
        }

        function drawFrame(G, TL, A, B, t) {
            const dpr = G.dpr, cen = G.Cdev / 2;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, G.Cdev, G.Cdev);

            // intensidade do "feitiço" ao longo da troca (sobe, segura, desce)
            const env = Math.pow(Math.sin(Math.PI * clamp01(t / TL.duration)), 1.2);

            // disco de fundo (cobre a imagem de baixo) + brilho no meio
            ctx.fillStyle = G.bg;
            ctx.beginPath(); ctx.arc(cen, cen, (G.S / 2) * dpr, 0, TAU); ctx.fill();
            if (env > 0.01) {
                const gr = ctx.createRadialGradient(cen, cen, 0, cen, cen, G.R * dpr);
                gr.addColorStop(0, "rgba(198,250,110," + (0.16 * env).toFixed(3) + ")");
                gr.addColorStop(1, "rgba(198,250,110,0)");
                ctx.fillStyle = gr;
                ctx.beginPath(); ctx.arc(cen, cen, G.R * dpr, 0, TAU); ctx.fill();
            }

            // círculo de runas girando
            if (env > 0.02) {
                const rc = G.R + 34, rot = t * 0.55 * TL.dir;
                ctx.setTransform(dpr, 0, 0, dpr, cen, cen);
                ctx.strokeStyle = "rgba(198,250,110," + (0.28 * env).toFixed(3) + ")";
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 7]);
                ctx.beginPath(); ctx.arc(0, 0, rc - 15, 0, TAU); ctx.stroke();
                ctx.setLineDash([]);
                ctx.beginPath(); ctx.arc(0, 0, rc + 16, 0, TAU); ctx.stroke();
                for (const r of TL.circle) {
                    const a = r.a + rot;
                    const pulse = 0.55 + 0.45 * Math.sin(t * 3 + r.ph);
                    setT(ctx, G, Math.cos(a) * rc, Math.sin(a) * rc, a + Math.PI / 2, 1, 1);
                    strokeRune(ctx, r.glyph, 15, env * pulse);
                }
            }

            // tiles parados (cópia exata, pixel a pixel, recortada no círculo da foto)
            const ox = Math.round(cen - (G.N * G.c) / 2), oy = ox;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.save();
            ctx.beginPath(); ctx.arc(cen, cen, G.R * dpr, 0, TAU); ctx.clip();
            ctx.imageSmoothingEnabled = false;
            for (const k of TL.tiles) {
                const homeA = t <= k.tsOut;
                const settledB = t >= k.tsIn + k.fdIn;
                if (homeA) ctx.drawImage(A.full, k.ix * G.c, k.iy * G.c, G.c, G.c, ox + k.ix * G.c, oy + k.iy * G.c, G.c, G.c);
                else if (settledB) ctx.drawImage(B.full, k.ix * G.c, k.iy * G.c, G.c, G.c, ox + k.ix * G.c, oy + k.iy * G.c, G.c, G.c);
            }
            ctx.restore();
            ctx.imageSmoothingEnabled = true;

            // tiles em voo
            const cT = G.cT, c = G.c;
            for (const k of TL.tiles) {
                // saindo: foto antiga virando folhas ao vento
                let s = (t - k.tsOut) / k.fdOut;
                if (s > 0 && s < 1) {
                    const e = Math.pow(s, 1.7);
                    const swayV = Math.sin(k.ph + s * k.freq * TAU) * k.sway * s;
                    const rr = Math.hypot(k.hx, k.hy) / G.R;
                    const x = k.hx + TL.wx * k.dist * e + TL.px * swayV + (k.hx / G.R) * 30 * e * rr;
                    const y = k.hy + TL.wy * k.dist * e + TL.py * swayV - k.lift * e + (k.hy / G.R) * 30 * e * rr;
                    const sc = (1 + 0.8 * smooth(0, 0.2, s)) * (1 - 0.85 * smooth(0.5, 1, s));
                    const alpha = 1 - smooth(0.45, 1, s);
                    const kk = smooth(0, 0.22, s);
                    const flipAmp = 0.3 + 0.7 * Math.abs(Math.cos(k.ph + s * k.flip));
                    setT(ctx, G, x, y, k.rot0 * kk * 0.35 + k.spin * e, sc, 1 + (flipAmp - 1) * kk);
                    if (kk < 1) { ctx.globalAlpha = alpha * (1 - kk); ctx.drawImage(A.full, k.ix * c, k.iy * c, c, c, -cT / 2, -cT / 2, cT, cT); }
                    ctx.globalAlpha = alpha * kk;
                    if (kk > 0) ctx.drawImage(A.leaf, k.ix * c, k.iy * c, c, c, -cT / 2, -cT / 2, cT, cT);
                    ctx.globalAlpha = 1;
                }
                // entrando: foto nova se reconstruindo em redemoinho
                s = (t - k.tsIn) / k.fdIn;
                if (s > 0 && s < 1) {
                    const e = easeOutCubic(s), rem = 1 - e;
                    const vx = k.hx + Math.cos(k.angR) * k.extra * rem;
                    const vy = k.hy + Math.sin(k.angR) * k.extra * rem;
                    const th = k.th0 * rem * rem * 1.0 + k.th0 * rem * 0.35;
                    const ca = Math.cos(th), sa = Math.sin(th);
                    const fl = Math.sin(k.ph2 + s * 9) * 9 * rem;
                    const x = vx * ca - vy * sa + fl, y = vx * sa + vy * ca - fl * 0.6;
                    const sc = (0.45 + 0.55 * e) * (1 + 0.9 * rem);
                    const alpha = smooth(0, 0.22, s);
                    const kk = smooth(0.55, 1, s);                 // 0 = folha, 1 = tile inteiro
                    const fy = kk + (1 - kk) * (0.3 + 0.7 * Math.abs(Math.cos(k.ph2 + s * 8)));
                    setT(ctx, G, x, y, k.rotIn * rem, sc, fy);
                    if (kk < 1) { ctx.globalAlpha = alpha * (1 - kk); ctx.drawImage(B.leaf, k.ix * c, k.iy * c, c, c, -cT / 2, -cT / 2, cT, cT); }
                    ctx.globalAlpha = alpha * kk;
                    if (kk > 0) ctx.drawImage(B.full, k.ix * c, k.iy * c, c, c, -cT / 2, -cT / 2, cT, cT);
                    ctx.globalAlpha = 1;
                }
            }

            // folhas e runas brilhantes por cima
            for (const p of TL.parts) {
                const s = (t - p.ts) / p.dur;
                if (s <= 0 || s >= 1) continue;
                let x, y, rot, alpha;
                if (p.out) {
                    const e = Math.pow(s, 1.5);
                    const swayV = Math.sin(p.ph + s * p.freq * TAU) * p.sway * s;
                    x = p.x + TL.wx * p.dist * e + TL.px * swayV;
                    y = p.y + TL.wy * p.dist * e + TL.py * swayV - p.lift * e;
                    rot = p.rot0 + p.spin * e * 3;
                    alpha = smooth(0, 0.08, s) * (1 - smooth(0.55, 1, s));
                } else {
                    const e = easeOutCubic(s), rem = 1 - e;
                    const vx = p.x + (p.sx - p.x) * rem, vy = p.y + (p.sy - p.y) * rem;
                    const th = p.th0 * rem;
                    const ca = Math.cos(th), sa = Math.sin(th);
                    x = vx * ca - vy * sa; y = vx * sa + vy * ca;
                    rot = p.rot0 * rem;
                    alpha = smooth(0, 0.2, s) * (1 - smooth(0.82, 1, s));
                }
                if (p.rune) {
                    setT(ctx, G, x, y, rot * 0.35, 1, 1);
                    strokeRune(ctx, p.glyph, p.size, alpha);
                } else {
                    const flipY = 0.25 + 0.75 * Math.abs(Math.cos(p.ph + s * 9));
                    setT(ctx, G, x, y, rot, 1, flipY);
                    drawLeaf(ctx, p.size * (1 - 0.25 * s), p.color, alpha);
                }
            }
            ctx.setTransform(1, 0, 0, 1, 0, 0);
        }

        // ---------- execução ----------
        function playTransition(from, to) {
            const G = getGeometry();
            G.bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#0a100c";
            geo = G;
            const A = getAtlas(from, G), B = getAtlas(to, G);
            const dir = swapDir; swapDir = -swapDir;
            const TL = buildTimeline(G, dir);

            canvas.width = G.Cdev; canvas.height = G.Cdev;
            canvas.style.width = G.C + "px"; canvas.style.height = G.C + "px";
            canvas.classList.remove("is-fading");
            drawFrame(G, TL, A, B, 0);              // primeiro quadro = foto atual, sem salto
            canvas.classList.add("is-active");

            img.src = PHOTOS[to].src;                // já fica pronta por baixo do canvas
            const t0 = performance.now();

            function step(now) {
                const t = (now - t0) / 1000;
                if (t >= TL.duration) {
                    drawFrame(G, TL, A, B, TL.duration);
                    img.alt = PHOTOS[to].alt;
                    canvas.classList.add("is-fading"); // dissolve o canvas revelando a imagem nítida
                    setTimeout(() => {
                        canvas.classList.remove("is-active", "is-fading");
                        current = to; updateTexts(); finish();
                    }, 300);
                    return;
                }
                drawFrame(G, TL, A, B, t);
                requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        }

        updateTexts();
    }
})();
