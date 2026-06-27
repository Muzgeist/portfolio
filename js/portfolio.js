// ==========================================================================
// Portfolio — Felipe Zulmiro
// ==========================================================================

const GITHUB_USERNAME = "Muzgeist";
const PROJECTS_CACHE_KEY = "gh_repos_cache_v1";
const CACHE_DURATION_MS = 1000 * 60 * 30; // 30 minutos

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
        const descricao = repo.description
            ? escapeHTML(repo.description)
            : "Sem descrição cadastrada no GitHub para este projeto.";

        const tecnologias = [repo.language, ...(repo.topics || [])]
            .filter(Boolean)
            .filter((v, i, arr) => arr.indexOf(v) === i)
            .slice(0, 5);

        const tagsHTML = tecnologias.length
            ? `<div class="project-tags">${tecnologias.map(t => `<span>${escapeHTML(t)}</span>`).join("")}</div>`
            : "";

        const atualizadoEm = new Date(repo.pushed_at).toLocaleDateString("pt-BR", {
            day: "2-digit", month: "short", year: "numeric"
        });

        return `
            <article class="project-card">
                <h3><a href="${link}" target="_blank" rel="noopener">${escapeHTML(nome)} ↗</a></h3>
                <p class="project-desc">${descricao}</p>
                ${tagsHTML}
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
