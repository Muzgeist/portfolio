// ==========================================================================
// Portfolio — Felipe Shedler
// ==========================================================================

const GITHUB_USERNAME = "Muzgeist";
const PROJECTS_CACHE_KEY = "gh_repos_cache_v1";
const CACHE_DURATION_MS = 1000 * 60 * 30; // 30 minutos

const LANGUAGES_CACHE_KEY = "gh_lang_cache_v1";
const LANGUAGES_CACHE_DURATION_MS = 1000 * 60 * 60 * 24; // 24 horas

const languageMemoryCache = new Map(); // full_name -> { linguagem: bytes }
const reposById = new Map();           // repo.id -> repo (liga card do carrossel ao modal)
let lastFocusedTrigger = null;

const LANGUAGE_COLORS = {
    JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5",
    HTML: "#e34c26", CSS: "#563d7c", Java: "#b07219", "C#": "#178600",
    C: "#555555", "C++": "#f34b7d", PHP: "#4F5D95", Go: "#00ADD8",
    Rust: "#dea584", Shell: "#89e051", Vue: "#41b883", Dockerfile: "#384d54"
};

/* ---------- Idade dinâmica ---------- */
function idade() {
    const atual = new Date();
    const nascimento = new Date(2006, 6, 23);

    let idade = atual.getFullYear() - nascimento.getFullYear();
    const mesAtual = atual.getMonth();
    const diaAtual = atual.getDate();
    const mesNascimento = nascimento.getMonth();
    const diaNascimento = nascimento.getDate();

    if (mesAtual < mesNascimento || (mesAtual === mesNascimento && diaAtual < diaNascimento)) {
        idade--;
    }

    const pidade = document.getElementById("idade");
    if (pidade) pidade.textContent = idade;
}

/* ---------- Período atual do curso de ADS ----------
   Referência: 2º semestre de 2026 = 2º período. A cada semestre que passa
   (virada em janeiro e em julho) o período avança um número automaticamente. */
function periodoADS() {
    const REF_ANO = 2026;
    const REF_SEMESTRE = 2; // 1 = jan-jun, 2 = jul-dez
    const REF_PERIODO = 2;

    const agora = new Date();
    const ano = agora.getFullYear();
    const semestre = agora.getMonth() < 6 ? 1 : 2;

    const semestresDesdeRef = (ano - REF_ANO) * 2 + (semestre - REF_SEMESTRE);
    const periodo = REF_PERIODO + semestresDesdeRef;

    const pperiodo = document.getElementById("periodo-ads");
    if (pperiodo) pperiodo.textContent = periodo;
}

/* ---------- Sincronização automática de projetos (GitHub API) ---------- */
async function carregarProjetos() {
    const container = document.getElementById("projetos-track");
    if (!container) return;

    // tenta usar cache local para evitar limite de requisições da API pública
    const cache = getCache();
    if (cache) {
        renderizarCarrossel(cache);
        updateSyncNote(getCacheTimestamp());
        return;
    }

    try {
        const resp = await fetch(
            `https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=100`,
            { headers: { Accept: "application/vnd.github+json" } }
        );

        if (!resp.ok) throw new Error(`GitHub respondeu ${resp.status}`);

        const repos = await resp.json();

        // remove forks e ordena por última atualização
        const filtrados = repos
            .filter(r => !r.fork)
            .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));

        setCache(filtrados);
        renderizarCarrossel(filtrados);
        updateSyncNote(Date.now());
    } catch (erro) {
        console.error("Erro ao buscar repositórios do GitHub:", erro);
        container.innerHTML = `
            <div class="projects-error">
                Não foi possível carregar os projetos do GitHub agora.
                <br>Veja diretamente em
                <a href="https://github.com/${GITHUB_USERNAME}" target="_blank" rel="noopener">
                    github.com/${GITHUB_USERNAME}
                </a>.
            </div>`;
    }
}

function getCache() {
    try {
        const raw = localStorage.getItem(PROJECTS_CACHE_KEY);
        if (!raw) return null;
        const { timestamp, data } = JSON.parse(raw);
        if (Date.now() - timestamp > CACHE_DURATION_MS) return null;
        return data;
    } catch {
        return null;
    }
}

function setCache(data) {
    try {
        localStorage.setItem(
            PROJECTS_CACHE_KEY,
            JSON.stringify({ timestamp: Date.now(), data })
        );
    } catch {
        /* localStorage indisponível — segue sem cache */
    }
}

function getCacheTimestamp() {
    try {
        const raw = localStorage.getItem(PROJECTS_CACHE_KEY);
        if (!raw) return null;
        const { timestamp } = JSON.parse(raw);
        return timestamp || null;
    } catch {
        return null;
    }
}

let syncNoteInterval = null;

function updateSyncNote(timestamp) {
    const textEl = document.getElementById("sync-note-text");
    if (!textEl || !timestamp) return;

    function render() {
        const minutos = Math.floor((Date.now() - timestamp) / 60000);
        textEl.textContent = minutos < 1
            ? "sincronizado agora com o GitHub"
            : `sincronizado há ${minutos} min com o GitHub`;
    }

    render();
    clearInterval(syncNoteInterval);
    syncNoteInterval = setInterval(render, 30000);
}

/* ---------- Carrossel de projetos ---------- */
function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function renderizarCarrossel(repos) {
    const carousel = document.getElementById("projetos-carousel");
    const track = document.getElementById("projetos-track");
    if (!track || !carousel) return;

    reposById.clear();

    if (!repos || repos.length === 0) {
        track.innerHTML = `<div class="projects-error">Nenhum repositório público encontrado.</div>`;
        return;
    }

    repos.forEach(repo => reposById.set(repo.id, repo));
    atualizarDestaqueRepositorios(repos);

    const reduzido = prefersReducedMotion();
    carousel.classList.toggle("projects-carousel--static", reduzido);

    const cardsHTML = repos.map((repo, i) => buildCardHTML(repo, false, i)).join("");

    if (reduzido) {
        track.style.removeProperty("--marquee-duration");
        track.innerHTML = cardsHTML;
        return;
    }

    const clonesHTML = repos.map(repo => buildCardHTML(repo, true)).join("");
    track.innerHTML = cardsHTML + clonesHTML;

    requestAnimationFrame(() => applyMarqueeDuration(track));
}

function atualizarDestaqueRepositorios(repos) {
    const maisRecente = repos[0];
    const nowBuilding = document.getElementById("now-building");
    const nowBuildingLink = document.getElementById("now-building-link");
    if (maisRecente && nowBuilding && nowBuildingLink) {
        nowBuildingLink.textContent = maisRecente.name;
        nowBuildingLink.href = maisRecente.html_url;
        nowBuilding.hidden = false;
    }

    const stats = document.getElementById("repo-stats");
    const statCount = document.getElementById("repo-stat-count");
    const statStars = document.getElementById("repo-stat-stars");
    if (stats && statCount && statStars) {
        const totalEstrelas = repos.reduce((soma, r) => soma + (r.stargazers_count || 0), 0);
        statCount.textContent = repos.length;
        statStars.textContent = totalEstrelas;
        stats.hidden = false;
    }
}

function buildCardHTML(repo, isClone, index) {
    const nome = escapeHTML(repo.name);
    const resumo = repo.description
        ? escapeHTML(repo.description)
        : "Sem descrição cadastrada no GitHub para este projeto.";
    const linguagem = repo.language || null;
    const corLinguagem = linguagem ? getLanguageColor(linguagem) : "transparent";
    const recente = (Date.now() - new Date(repo.pushed_at).getTime()) < 24 * 60 * 60 * 1000;

    const classeCard = isClone ? "project-card" : "project-card card-enter";
    const atributosExtra = isClone
        ? `aria-hidden="true" tabindex="-1"`
        : `style="--enter-delay:${(index || 0) * 60}ms" tabindex="0" role="button" aria-haspopup="dialog" aria-label="Ver detalhes de ${nome}"`;

    return `
        <article class="${classeCard}" data-repo-id="${repo.id}" ${atributosExtra}>
            <div class="project-card-head">
                <h3>${nome}</h3>
                <div class="project-card-head-langs">
                    ${recente ? `<span class="recent-pulse" title="Atualizado nas últimas 24h"></span>` : ""}
                    ${linguagem ? `<span class="project-lang-dot" style="background:${corLinguagem}; color:${corLinguagem};" title="${escapeHTML(linguagem)}"></span>` : ""}
                </div>
            </div>
            <p class="project-desc">${resumo}</p>
            <div class="project-foot">
                <span class="project-lang-tag">${linguagem ? escapeHTML(linguagem) : "—"}</span>
                <span>★ ${repo.stargazers_count}</span>
            </div>
        </article>`;
}

function applyMarqueeDuration(track) {
    const velocidade = window.matchMedia("(max-width: 800px)").matches ? 28 : 45; // px/s
    const larguraUmSet = track.scrollWidth / 2;
    const duracao = Math.max(larguraUmSet / velocidade, 8);
    track.style.setProperty("--marquee-duration", `${duracao}s`);
}

let resizeTimeout = null;
window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const track = document.getElementById("projetos-track");
        if (track && !prefersReducedMotion() && reposById.size > 0) {
            applyMarqueeDuration(track);
        }
    }, 200);
});

/* ---------- Linguagens de um repositório (sob demanda, cacheado) ---------- */
function getLanguageColor(lang) {
    if (LANGUAGE_COLORS[lang]) return LANGUAGE_COLORS[lang];
    let hash = 0;
    for (let i = 0; i < lang.length; i++) hash = (hash << 5) - hash + lang.charCodeAt(i);
    let hue = Math.abs(hash) % 360;
    // evita a faixa de matiz verde-lima reservada ao acento --lime
    if (hue > 70 && hue < 150) hue = (hue + 110) % 360;
    // saturação/luminosidade fixas em uma faixa que garante contraste >= 3:1
    // contra o fundo escuro do site (--bg/--bg-elev), em qualquer matiz.
    return `hsl(${hue}, 55%, 64%)`;
}

function getLanguagesCache(key) {
    try {
        const raw = localStorage.getItem(LANGUAGES_CACHE_KEY);
        if (!raw) return null;
        const store = JSON.parse(raw);
        const entrada = store[key];
        if (!entrada || Date.now() - entrada.timestamp > LANGUAGES_CACHE_DURATION_MS) return null;
        return entrada.data;
    } catch {
        return null;
    }
}

function setLanguagesCache(key, data) {
    try {
        const raw = localStorage.getItem(LANGUAGES_CACHE_KEY);
        const store = raw ? JSON.parse(raw) : {};
        store[key] = { timestamp: Date.now(), data };
        localStorage.setItem(LANGUAGES_CACHE_KEY, JSON.stringify(store));
    } catch {
        /* localStorage indisponível — segue sem cache */
    }
}

async function fetchLanguages(repo) {
    const key = repo.full_name;

    if (languageMemoryCache.has(key)) return languageMemoryCache.get(key);

    const persistido = getLanguagesCache(key);
    if (persistido) {
        languageMemoryCache.set(key, persistido);
        return persistido;
    }

    const resp = await fetch(repo.languages_url, { headers: { Accept: "application/vnd.github+json" } });
    if (!resp.ok) throw new Error(`GitHub respondeu ${resp.status}`);

    const data = await resp.json();
    languageMemoryCache.set(key, data);
    setLanguagesCache(key, data);
    return data;
}

/* ---------- Modal de destaque do projeto ---------- */
function openModal(repo) {
    const backdrop = document.getElementById("project-modal-backdrop");
    const modal = document.getElementById("project-modal");
    if (!backdrop || !modal) return;

    lastFocusedTrigger = document.activeElement;

    document.getElementById("project-modal-title").textContent = repo.name;
    document.getElementById("project-modal-desc").textContent =
        repo.description || "Sem descrição cadastrada no GitHub para este projeto.";

    const atualizadoEm = new Date(repo.pushed_at).toLocaleDateString("pt-BR", {
        day: "2-digit", month: "short", year: "numeric"
    });
    const statsExtras = [
        typeof repo.open_issues_count === "number"
            ? `<span>${repo.open_issues_count} issue${repo.open_issues_count === 1 ? "" : "s"} aberta${repo.open_issues_count === 1 ? "" : "s"}</span>`
            : "",
        repo.default_branch ? `<span>branch ${escapeHTML(repo.default_branch)}</span>` : "",
        repo.license && repo.license.name ? `<span>${escapeHTML(repo.license.name)}</span>` : ""
    ].join("");
    document.getElementById("project-modal-stats").innerHTML = `
        <span>★ ${repo.stargazers_count} estrela${repo.stargazers_count === 1 ? "" : "s"}</span>
        <span>Atualizado em ${atualizadoEm}</span>
        ${statsExtras}`;

    const link = document.getElementById("project-modal-link");
    link.href = repo.html_url;

    const langBar = document.getElementById("project-modal-langbar");
    const langLegend = document.getElementById("project-modal-langlegend");
    langBar.className = "lang-bar is-loading";
    langBar.innerHTML = "";
    langLegend.innerHTML = "";

    backdrop.hidden = false;
    const main = document.querySelector("main");
    const nav = document.querySelector(".nav");
    if (main) main.inert = true;
    if (nav) nav.inert = true;

    // força reflow para garantir que a transição de entrada dispare
    void backdrop.offsetWidth;
    requestAnimationFrame(() => backdrop.classList.add("is-open"));

    modal.focus();

    fetchLanguages(repo)
        .then(renderLanguageBreakdown)
        .catch(() => renderLanguageFallback(repo));
}

function closeModal() {
    const backdrop = document.getElementById("project-modal-backdrop");
    if (!backdrop || backdrop.hidden) return;

    const finalizarFechamento = () => {
        backdrop.hidden = true;
        const main = document.querySelector("main");
        const nav = document.querySelector(".nav");
        if (main) main.inert = false;
        if (nav) nav.inert = false;

        if (lastFocusedTrigger && typeof lastFocusedTrigger.focus === "function") {
            lastFocusedTrigger.focus();
        }
        lastFocusedTrigger = null;
    };

    backdrop.classList.remove("is-open");

    if (prefersReducedMotion()) {
        finalizarFechamento();
    } else {
        backdrop.addEventListener("transitionend", finalizarFechamento, { once: true });
    }
}

function renderLanguageBreakdown(linguagens) {
    const langBar = document.getElementById("project-modal-langbar");
    const langLegend = document.getElementById("project-modal-langlegend");

    const entradas = Object.entries(linguagens).sort((a, b) => b[1] - a[1]);
    const total = entradas.reduce((soma, [, bytes]) => soma + bytes, 0);

    if (!entradas.length || total === 0) {
        renderLanguageFallback({ language: null });
        return;
    }

    langBar.className = "lang-bar";
    langBar.innerHTML = entradas.map(([lang, bytes]) => {
        const pct = (bytes / total) * 100;
        const cor = getLanguageColor(lang);
        return `<span style="width:${pct}%; background:${cor};" title="${escapeHTML(lang)}"></span>`;
    }).join("");

    langLegend.innerHTML = entradas.map(([lang, bytes]) => {
        const pct = ((bytes / total) * 100).toFixed(1);
        const cor = getLanguageColor(lang);
        return `<li><span class="swatch" style="background:${cor};"></span>${escapeHTML(lang)} — ${pct}%</li>`;
    }).join("");
}

function renderLanguageFallback(repo) {
    const langBar = document.getElementById("project-modal-langbar");
    const langLegend = document.getElementById("project-modal-langlegend");

    langBar.className = "lang-bar";
    langBar.innerHTML = "";

    if (repo.language) {
        const cor = getLanguageColor(repo.language);
        langBar.innerHTML = `<span style="width:100%; background:${cor};"></span>`;
        langLegend.innerHTML = `
            <li><span class="swatch" style="background:${cor};"></span>${escapeHTML(repo.language)}</li>
            <li class="lang-legend-note">Não foi possível carregar o detalhamento completo de linguagens agora.</li>`;
    } else {
        langLegend.innerHTML = `<li class="lang-legend-note">Não foi possível carregar as linguagens deste projeto agora.</li>`;
    }
}

function handleModalKeydown(e) {
    if (e.key === "Escape") {
        closeModal();
        return;
    }
    if (e.key !== "Tab") return;

    const closeBtn = document.getElementById("project-modal-close");
    const link = document.getElementById("project-modal-link");
    const focusaveis = [closeBtn, link];
    const atual = document.activeElement;
    const indiceAtual = focusaveis.indexOf(atual);

    if (e.shiftKey) {
        if (indiceAtual <= 0) {
            e.preventDefault();
            focusaveis[focusaveis.length - 1].focus();
        }
    } else {
        if (indiceAtual === focusaveis.length - 1 || indiceAtual === -1) {
            e.preventDefault();
            focusaveis[0].focus();
        }
    }
}

/* ---------- Navegação manual (setas) ---------- */
function getCurrentTranslateX(track) {
    const transform = getComputedStyle(track).transform;
    if (!transform || transform === "none") return 0;
    const match = transform.match(/matrix\(([^)]+)\)/);
    if (!match) return 0;
    const valores = match[1].split(",").map(parseFloat);
    return valores[4] || 0;
}

function entrarEmModoManual(track) {
    if (track.classList.contains("projects-track--manual")) return;
    const x = getCurrentTranslateX(track);
    track.style.transition = "none";
    track.style.transform = `translateX(${x}px)`;
    track.classList.add("projects-track--manual");
    // força reflow antes de reativar a transição suave
    void track.offsetWidth;
    track.style.transition = "transform .45s ease";
}

function navegarCarrossel(track, direcao) {
    if (prefersReducedMotion()) return;
    entrarEmModoManual(track);

    const card = track.querySelector(".project-card");
    if (!card) return;
    const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 20;
    const passo = card.getBoundingClientRect().width + gap;
    const larguraUmSet = track.scrollWidth / 2;

    let x = getCurrentTranslateX(track) + (direcao === "next" ? -passo : passo);
    if (x <= -larguraUmSet) x += larguraUmSet;
    if (x > 0) x -= larguraUmSet;

    track.style.transform = `translateX(${x}px)`;
}

function retomarMarqueeAutomatico(track) {
    if (!track.classList.contains("projects-track--manual")) return;

    const duracao = parseFloat(getComputedStyle(track).getPropertyValue("--marquee-duration")) ||
        parseFloat(getComputedStyle(track).animationDuration) || 36;
    const larguraUmSet = track.scrollWidth / 2;
    const x = getCurrentTranslateX(track);
    const decorrido = (-x / larguraUmSet) * duracao;

    track.style.transition = "";
    track.style.transform = "";
    track.classList.remove("projects-track--manual");
    track.style.animationDelay = `-${decorrido}s`;
}

function initCarouselInteractions() {
    const track = document.getElementById("projetos-track");
    const carousel = document.getElementById("projetos-carousel");
    const backdrop = document.getElementById("project-modal-backdrop");
    const closeBtn = document.getElementById("project-modal-close");
    const prevBtn = document.getElementById("carousel-prev");
    const nextBtn = document.getElementById("carousel-next");

    if (track && carousel) {
        if (prevBtn) prevBtn.addEventListener("click", () => navegarCarrossel(track, "prev"));
        if (nextBtn) nextBtn.addEventListener("click", () => navegarCarrossel(track, "next"));

        carousel.addEventListener("mouseleave", () => retomarMarqueeAutomatico(track));

        // pausa ao tocar (mobile não dispara :hover)
        carousel.addEventListener("touchstart", () => {
            if (!track.classList.contains("projects-track--manual")) {
                track.style.animationPlayState = "paused";
            }
        }, { passive: true });
        carousel.addEventListener("touchend", () => {
            setTimeout(() => {
                if (!track.classList.contains("projects-track--manual")) {
                    track.style.animationPlayState = "";
                }
            }, 1500);
        }, { passive: true });
    }

    if (track) {
        track.addEventListener("click", e => {
            const card = e.target.closest(".project-card");
            if (!card || card.getAttribute("aria-hidden") === "true") return;
            const repo = reposById.get(Number(card.dataset.repoId));
            if (repo) openModal(repo);
        });

        track.addEventListener("keydown", e => {
            if (e.key !== "Enter" && e.key !== " ") return;
            const card = e.target.closest(".project-card");
            if (!card || card.getAttribute("aria-hidden") === "true") return;
            e.preventDefault();
            const repo = reposById.get(Number(card.dataset.repoId));
            if (repo) openModal(repo);
        });
    }

    if (backdrop) {
        backdrop.addEventListener("click", e => {
            if (e.target === backdrop) closeModal();
        });
        backdrop.addEventListener("keydown", handleModalKeydown);
    }

    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }
}

function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

/* ---------- Espinha ramificada (galho/raiz + runas) ---------- */
let spineResizeTimeout = null;

function initBranchSpine() {
    const spine = document.getElementById("branch-spine");
    const path = spine && spine.querySelector(".spine-path");
    const progress = spine && spine.querySelector(".spine-progress");
    const hero = document.querySelector(".hero");
    const competencias = document.getElementById("competencias");
    if (!spine || !path || !hero || !competencias) return;

    let spineTopPx = 0;
    let spineHeightPx = 0;

    function sizeSpine() {
        const heroTop = hero.getBoundingClientRect().top + window.scrollY;
        const compBottom = competencias.getBoundingClientRect().bottom + window.scrollY;
        spineTopPx = heroTop + 40;
        spineHeightPx = Math.max(compBottom - heroTop - 40, 0);
        spine.style.top = `${spineTopPx}px`;
        spine.style.height = `${spineHeightPx}px`;
    }

    sizeSpine();
    window.addEventListener("load", sizeSpine);
    window.addEventListener("resize", () => {
        clearTimeout(spineResizeTimeout);
        spineResizeTimeout = setTimeout(sizeSpine, 200);
    });

    if (progress) {
        const progressLength = progress.getTotalLength();
        progress.style.strokeDasharray = `${progressLength}`;
        progress.style.strokeDashoffset = `${progressLength}`;

        let progressTicking = false;
        function updateProgress() {
            progressTicking = false;
            if (spineHeightPx <= 0) return;
            const fracao = Math.min(1, Math.max(0, (window.scrollY - spineTopPx + window.innerHeight * 0.5) / spineHeightPx));
            progress.style.strokeDashoffset = `${progressLength * (1 - fracao)}`;
        }
        updateProgress();
        window.addEventListener("scroll", () => {
            if (!progressTicking) {
                progressTicking = true;
                requestAnimationFrame(updateProgress);
            }
        }, { passive: true });
        window.addEventListener("resize", () => {
            if (!progressTicking) {
                progressTicking = true;
                requestAnimationFrame(updateProgress);
            }
        });
    }

    if (prefersReducedMotion()) {
        document.querySelectorAll(".spine-node").forEach(n => n.classList.add("is-lit"));
        return;
    }

    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;
    spine.classList.add("spine--drawing");

    requestAnimationFrame(() => {
        path.classList.add("spine-path--draw");
        path.style.strokeDashoffset = "0";
    });
    path.addEventListener("transitionend", () => spine.classList.remove("spine--drawing"), { once: true });

    initSpineNodeObserver();
}

function initSpineNodeObserver() {
    const nodes = document.querySelectorAll(".spine-node");
    if (!("IntersectionObserver" in window) || !nodes.length) {
        nodes.forEach(n => n.classList.add("is-lit"));
        return;
    }
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-lit");
                observer.unobserve(entry.target);
            }
        });
    }, { rootMargin: "0px 0px -35% 0px", threshold: 0 });
    nodes.forEach(n => observer.observe(n));
}

/* ---------- Partículas de ember/esporo ---------- */
const EMBER_COUNT_DESKTOP = 28;
const EMBER_COUNT_MOBILE = 14;
let emberParticles = [];
let emberRAF = null;
let emberRunning = false;

function initEmberParticles() {
    if (prefersReducedMotion()) return;

    const spine = document.getElementById("branch-spine");
    const canvas = document.getElementById("ember-canvas");
    if (!spine || !canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const count = window.matchMedia("(max-width: 800px)").matches ? EMBER_COUNT_MOBILE : EMBER_COUNT_DESKTOP;
    let isSpineInView = true;
    let resizeTimeoutEmber = null;

    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawnParticle(h) {
        return {
            x: Math.random() * canvas.clientWidth,
            y: h !== undefined ? Math.random() * h : 0,
            r: 1.2 + Math.random() * 1.8,
            speed: 8 + Math.random() * 14,
            sway: 6 + Math.random() * 10,
            freq: 0.4 + Math.random() * 0.6,
            phase: Math.random() * Math.PI * 2,
            baseOpacity: 0.3 + Math.random() * 0.5
        };
    }

    resizeCanvas();
    emberParticles = Array.from({ length: count }, () => spawnParticle(canvas.clientHeight));

    // ---- rastro de partículas seguindo o cursor, só dentro da faixa da espinha ----
    let cursorTrailParticles = [];
    let lastTrailSpawn = 0;

    function spawnTrailParticle(x, y) {
        cursorTrailParticles.push({
            x, y,
            r: 1 + Math.random() * 1.4,
            vy: -(10 + Math.random() * 12),
            sway: 4 + Math.random() * 6,
            freq: 0.6 + Math.random() * 0.8,
            phase: Math.random() * Math.PI * 2,
            baseOpacity: 0.4 + Math.random() * 0.4,
            born: performance.now(),
            life: 700 + Math.random() * 500
        });
    }

    document.addEventListener("mousemove", e => {
        if (!emberRunning) return;
        const now = performance.now();
        if (now - lastTrailSpawn < 60) return;
        const rect = spine.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
        lastTrailSpawn = now;
        spawnTrailParticle(e.clientX - rect.left, e.clientY - rect.top);
    });

    let last = performance.now();
    function step(now) {
        if (!emberRunning) return;
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        const h = canvas.clientHeight;
        ctx.clearRect(0, 0, canvas.clientWidth, h);

        emberParticles.forEach(p => {
            p.y -= p.speed * dt;
            if (p.y < -10) Object.assign(p, spawnParticle(), { y: h + 10 });

            const x = p.x + Math.sin(now / 1000 * p.freq + p.phase) * p.sway;
            const fadeZone = 40;
            const fadeTop = Math.min(1, Math.max(0, p.y / fadeZone));
            const fadeBottom = Math.min(1, Math.max(0, (h - p.y) / fadeZone));
            const opacity = p.baseOpacity * Math.min(fadeTop, fadeBottom);

            ctx.beginPath();
            ctx.arc(x, p.y, p.r, 0, Math.PI * 2);
            ctx.shadowColor = "rgba(198,250,110,0.8)";
            ctx.shadowBlur = 6;
            ctx.fillStyle = `rgba(198,250,110,${opacity.toFixed(3)})`;
            ctx.fill();
        });

        if (cursorTrailParticles.length) {
            cursorTrailParticles = cursorTrailParticles.filter(p => (now - p.born) < p.life);
            cursorTrailParticles.forEach(p => {
                const age = now - p.born;
                p.y += p.vy * dt;
                const x = p.x + Math.sin(now / 1000 * p.freq + p.phase) * p.sway;
                const opacity = p.baseOpacity * (1 - age / p.life);

                ctx.beginPath();
                ctx.arc(x, p.y, p.r, 0, Math.PI * 2);
                ctx.shadowColor = "rgba(198,250,110,0.9)";
                ctx.shadowBlur = 7;
                ctx.fillStyle = `rgba(198,250,110,${Math.max(opacity, 0).toFixed(3)})`;
                ctx.fill();
            });
        }

        emberRAF = requestAnimationFrame(step);
    }

    function startLoop() {
        if (emberRunning) return;
        emberRunning = true;
        last = performance.now();
        emberRAF = requestAnimationFrame(step);
    }
    function stopLoop() {
        emberRunning = false;
        if (emberRAF) cancelAnimationFrame(emberRAF);
    }

    window.addEventListener("resize", () => {
        clearTimeout(resizeTimeoutEmber);
        resizeTimeoutEmber = setTimeout(resizeCanvas, 200);
    });
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) stopLoop(); else if (isSpineInView) startLoop();
    });

    if ("IntersectionObserver" in window) {
        new IntersectionObserver(entries => {
            entries.forEach(entry => {
                isSpineInView = entry.isIntersecting;
                if (isSpineInView && !document.hidden) startLoop(); else stopLoop();
            });
        }, { threshold: 0 }).observe(spine);
    } else {
        startLoop();
    }
}

/* ---------- Pulsos de energia (raios) ---------- */
function initSpinePulse() {
    if (prefersReducedMotion()) return;

    const trunk = document.querySelector(".spine-path");
    const pulse = document.querySelector(".spine-pulse");
    if (!trunk || !pulse) return;

    const total = trunk.getTotalLength();
    const pulseLen = total * 0.06;
    pulse.style.strokeDasharray = `${pulseLen} ${total - pulseLen}`;

    const nodes = Array.from(document.querySelectorAll(".spine-node"));
    const nodeFractions = [0.08, 0.38, 0.66, 0.94];

    function runPulse() {
        pulse.classList.add("is-active");
        const duration = 900 + Math.random() * 500;

        const anim = pulse.animate(
            [{ strokeDashoffset: total }, { strokeDashoffset: -pulseLen }],
            { duration, easing: "cubic-bezier(.3,0,.6,1)", fill: "forwards" }
        );

        nodes.forEach((node, i) => {
            const frac = nodeFractions[i];
            if (frac === undefined) return;
            setTimeout(() => flashNode(node), duration * frac);
        });

        anim.onfinish = () => {
            pulse.classList.remove("is-active");
            const isDouble = Math.random() < 0.18;
            const nextDelay = isDouble ? 260 + Math.random() * 180 : 4000 + Math.random() * 5000;
            setTimeout(runPulse, nextDelay);
        };
    }

    setTimeout(runPulse, 1800 + Math.random() * 1200);
}

function flashNode(node) {
    node.classList.add("is-struck");
    setTimeout(() => node.classList.remove("is-struck"), 350);
}

document.addEventListener("DOMContentLoaded", () => {
    idade();
    periodoADS();
    carregarProjetos();
    initCarouselInteractions();
    initBranchSpine();
    initEmberParticles();
    initSpinePulse();
});
