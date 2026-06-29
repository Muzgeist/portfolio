// ==========================================================================
// Portfolio — Felipe Shedler
// ==========================================================================

const GITHUB_USERNAME = "Muzgeist";
const PROJECTS_CACHE_KEY = "gh_repos_cache_v1";
const CACHE_DURATION_MS = 1000 * 60 * 30; // 30 minutos

/* ---------- Detalhes manuais dos projetos ----------
   Complementa a descrição do GitHub com zonas estruturadas:
   tecnologias, resumo e fluxo de funcionamento. A chave é o
   nome exato do repositório (repo.name) no GitHub. */
const PROJECT_DETAILS = {
    "Yggdrasil": {
        tecnologias: ["Node.js", "Express", "MySQL", "JWT", "bcrypt", "HTML", "CSS", "JavaScript"],
        resumo: "Sistema de adoção de animais com login para ONGs e adotantes.",
        fluxo: "Usuário se cadastra ou faz login → navega pelos animais disponíveis filtrando por espécie/idade/status → visualiza o perfil do animal → demonstra interesse na adoção, registrado via API REST no backend."
    },
    "nexus_site": {
        tecnologias: ["HTML", "CSS", "JavaScript", "Node.js", "Express", "MySQL"],
        resumo: "E-commerce de hardware e periféricos importados (Nexus Imports), com tema dark neon purple/pink.",
        fluxo: "Usuário navega pela home e listagem de produtos com busca e carrosséis → adiciona itens ao carrinho → faz login/cadastro → finaliza a compra via Pix, cartão ou boleto → acompanha o pedido na tela de rastreio com mapa."
    },
    "app_desktop": {
        tecnologias: ["Python", "PySide6", "PyInstaller"],
        resumo: "Aplicação desktop com interface gráfica em Qt, empacotada como executável standalone.",
        fluxo: "A interface é construída em PySide6 (Qt) → a lógica da aplicação roda localmente, sem servidor → o PyInstaller empacota tudo em um executável único para distribuição."
    },
    "universidade": {
        tecnologias: ["Python", "Tkinter", "MySQL"],
        resumo: "Sistema de cadastro acadêmico de Alunos, Cursos e Turmas com interface desktop.",
        fluxo: "A secretaria cadastra um aluno pela tela (Tkinter) → os dados são validados e enviados ao módulo de banco (mysql.py) → são gravados/consultados nas tabelas MySQL → a listagem é atualizada na tela de visualização."
    },
    "noticias2": {
        tecnologias: ["HTML", "CSS", "JavaScript", "Node.js", "Express", "MySQL"],
        resumo: "Site de notícias com cadastro de matérias via formulário.",
        fluxo: "O frontend busca as últimas notícias via GET /noticias e renderiza os cards → o usuário pode cadastrar uma nova notícia em um formulário → um POST envia título, conteúdo, imagem e link, persistidos no banco."
    },
    "walpaper": {
        tecnologias: ["JavaScript", "WebGL", "HTML", "CSS", "Node.js", "Express"],
        resumo: "Carrossel de wallpapers dinâmico cujo tema de cores muda junto com a imagem atual.",
        fluxo: "O JS carrega a lista de wallpapers → ao trocar de imagem (manual ou autoplay) dispara uma animação de dissolução em WebGL → atualiza as variáveis CSS de tema com as cores da nova imagem → exibe um modal com detalhes (dimensões, cores) sob demanda."
    },
    "noticias": {
        tecnologias: ["HTML", "CSS", "JavaScript"],
        resumo: "Portfólio pessoal responsivo, sem dependência de backend.",
        fluxo: "Página única com seções de apresentação, habilidades, experiências e projetos → alternância de tema claro/escuro via JS → responsividade tratada via CSS."
    }
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
    const container = document.getElementById("projetos-grid");
    if (!container) return;

    // tenta usar cache local para evitar limite de requisições da API pública
    const cache = getCache();
    if (cache) {
        renderizarProjetos(cache);
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
        renderizarProjetos(filtrados);
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

function renderizarProjetos(repos) {
    const container = document.getElementById("projetos-grid");
    if (!container) return;

    if (!repos || repos.length === 0) {
        container.innerHTML = `<div class="projects-error">Nenhum repositório público encontrado.</div>`;
        return;
    }

    container.innerHTML = repos.map(repo => {
        const nome = repo.name;
        const link = repo.html_url;
        const detalhes = PROJECT_DETAILS[nome];

        // ── Zona: tecnologias (usa detalhe manual se existir; senão cai para language/topics do GitHub) ──
        const tecnologias = detalhes
            ? detalhes.tecnologias
            : [repo.language, ...(repo.topics || [])].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 5);

        const tagsHTML = tecnologias.length
            ? `<div class="project-tags">${tecnologias.map(t => `<span>${escapeHTML(t)}</span>`).join("")}</div>`
            : "";

        // ── Zona: resumo (descrição manual tem prioridade sobre a descrição crua do GitHub) ──
        const resumo = detalhes
            ? escapeHTML(detalhes.resumo)
            : (repo.description
                ? escapeHTML(repo.description)
                : "Sem descrição cadastrada no GitHub para este projeto.");

        // ── Zona: fluxo de funcionamento (só existe quando há detalhe manual cadastrado) ──
        const fluxoHTML = detalhes && detalhes.fluxo
            ? `<div class="project-flow">
                   <span class="project-flow-label">// fluxo</span>
                   <p>${escapeHTML(detalhes.fluxo)}</p>
               </div>`
            : "";

        const atualizadoEm = new Date(repo.pushed_at).toLocaleDateString("pt-BR", {
            day: "2-digit", month: "short", year: "numeric"
        });

        return `
            <article class="project-card">
                <h3><a href="${link}" target="_blank" rel="noopener">${escapeHTML(nome)} ↗</a></h3>
                <p class="project-desc">${resumo}</p>
                ${tagsHTML}
                ${fluxoHTML}
                <div class="project-foot">
                    <span>★ ${repo.stargazers_count}</span>
                    <span>Atualizado em ${atualizadoEm}</span>
                </div>
            </article>`;
    }).join("");
}

function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", () => {
    idade();
    carregarProjetos();
});
