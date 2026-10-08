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

/* ---------- Sincronização automática de projetos (GitHub API) ---------- */
async function carregarProjetos() {
    const container = document.getElementById("projetos-track");
    if (!container) return;

    // tenta usar cache local para evitar limite de requisições da API pública
    const cache = getCache();
    if (cache) {
        renderizarCarrossel(cache);
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

    const reduzido = prefersReducedMotion();
    carousel.classList.toggle("projects-carousel--static", reduzido);

    const cardsHTML = repos.map(repo => buildCardHTML(repo, false)).join("");

    if (reduzido) {
        track.style.removeProperty("--marquee-duration");
        track.innerHTML = cardsHTML;
        return;
    }

    const clonesHTML = repos.map(repo => buildCardHTML(repo, true)).join("");
    track.innerHTML = cardsHTML + clonesHTML;

    requestAnimationFrame(() => applyMarqueeDuration(track));
}

function buildCardHTML(repo, isClone) {
    const nome = escapeHTML(repo.name);
    const resumo = repo.description
        ? escapeHTML(repo.description)
        : "Sem descrição cadastrada no GitHub para este projeto.";
    const linguagem = repo.language || null;
    const corLinguagem = linguagem ? getLanguageColor(linguagem) : "transparent";

    const atributosExtra = isClone
        ? `aria-hidden="true" tabindex="-1"`
        : `tabindex="0" role="button" aria-haspopup="dialog" aria-label="Ver detalhes de ${nome}"`;

    return `
        <article class="project-card" data-repo-id="${repo.id}" ${atributosExtra}>
            <div class="project-card-head">
                <h3>${nome}</h3>
                ${linguagem ? `<span class="project-lang-dot" style="background:${corLinguagem}; color:${corLinguagem};" title="${escapeHTML(linguagem)}"></span>` : ""}
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
    // saturação/luminosidade fixas em uma faixa que garante contraste >= 3:1
    // contra o fundo escuro do site (--bg-elev/--bg-card), em qualquer matiz.
    return `hsl(${Math.abs(hash) % 360}, 60%, 62%)`;
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

document.addEventListener("DOMContentLoaded", () => {
    idade();
    carregarProjetos();
    initCarouselInteractions();
});
