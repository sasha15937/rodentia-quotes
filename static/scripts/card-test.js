const baseUrl = "/api/quotes";

const container = document.querySelector('.qbody')
let quoteList = []

const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));

const createTags = (tags) =>
    tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("");

const createSingle = (q) => {
    const line = q.lines[0];
    return `
        <div class="quote single">
            <img src="styles/image/quote-breck.svg" class="quote-breck">
            <div class="block-quote">${esc(line.text)}</div>
            <div class="about-quote">
                <div class="author-quote"><span>${esc(line.author)}</span></div>
                <div class="tags-quote">${createTags(q.tags)}</div>
            </div>
            <img src="styles/image/quote-breck-back.svg" class="quote-breck-back">
        </div>
    `;
};

const createDialogLine = (l) => `
    <div class="dialog-line">
        <div class="author-quote">${l.author ? `<span>${esc(l.author)}</span>` : ""}</div>
        <div class="text-quote">${l.author ? "<span>&#8212; </span>" : ""}${esc(l.text)}</div>
    </div>
`;

const createDialog = (q) => `
    <div class="quote dialog">
        <img src="styles/image/quote-breck.svg" class="quote-breck">
        <div class="block-quote">
            ${q.lines.map(createDialogLine).join("")}
        </div>
        <div class="about-quote">
            <div class="tags-quote">${createTags(q.tags)}</div>
        </div>
        <img src="styles/image/quote-breck-back.svg" class="quote-breck-back">
    </div>
`;

const createCard = (q) => (q.type === "dialog" ? createDialog(q) : createSingle(q));

const render = () => {
    container.innerHTML = quoteList.map(createCard).join("");
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