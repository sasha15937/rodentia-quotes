const baseUrl = "/api/quotes";

const container = document.querySelector('.qbody')
let quoteList = []

const norm = (s) => String(s).toLowerCase().replace(/ё/g, "е");
const slug = (s) => norm(s).trim().replace(/\s+/g, "-");

const matches = (q, query) => {
    const terms = norm(query)
        .split(/\s+/)
        .filter((t) => t && t !== "#" && t !== "@");
    if (!terms.length) return true;

    const tags = q.tags.map(slug);
    const authors = q.lines.map((l) => slug(l.author)).filter(Boolean);
    const text = q.lines.map((l) => `${l.author} ${l.text}`).map(norm).join(" ");

    return terms.every((term) => {
        if (term.startsWith("#")) return tags.includes(term.slice(1));
        if (term.startsWith("@")) return authors.includes(term.slice(1));
        return text.includes(term) || tags.some((t) => t.includes(term));
    });
};

let query = new URLSearchParams(location.search).get("q") ?? "";

let searchTimer;

document.addEventListener("input", (e) => {
    if (e.target.id !== "search") return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        query = e.target.value;
        render();
    }, 200);
});

// на главной фильтруем сразу, перезагрузка по Enter не нужна
document.addEventListener("submit", (e) => {
    if (e.target.id === "search-form") e.preventDefault();
});
document.addEventListener("reactions-changed", (e) => {
    const q = quoteList.find((x) => x.id === e.detail.id);
    if (q) {
        q.reactions = e.detail.reactions;
        q.mine = e.detail.mine;
    }
});

const render = () => {
    const list = quoteList.filter((q) => matches(q, query));
    container.innerHTML = list.length
        ? list.map(createCard).join("")
        : `<p class="empty">${quoteList.length ? "Ничего не найдено" : "Пока нет цитат"}</p>`;
};

const loadData = async () => {
    try {
        const res = await fetch(baseUrl);
        const data = await res.json();
        quoteList = data
        // console.log(quoteList)
        render();
    } catch (error) {
        console.error(error);
    }
};

loadData();