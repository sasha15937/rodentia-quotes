const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));

const createTags = (tags) =>
    tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("");

const REACTION_EMOJI = {
    fire: "🔥",
    heart: "❤️",
    heartfire: "\u2764\uFE0F\u200D\u{1F525}",
    arrowheart: "💘",
    cry: "😭",
};

const createReactions = (q) => {
    const mine = q.mine ?? [];
    const counts = q.reactions ?? {};
    return `
    <div class="reactions" data-id="${q.id}">
      ${Object.entries(REACTION_EMOJI).map(([kind, emoji]) => `
        <button type="button" class="reaction${mine.includes(kind) ? " reaction--mine" : ""}" data-kind="${kind}">
          ${emoji} <span class="reaction__count">${counts[kind] || ""}</span>
        </button>
      `).join("")}
    </div>
  `;
};

const createSingle = (q) => {
    const line = q.lines[0];
    return `
        <div class="quote single">
            <img src="styles/image/quote-breck.svg" class="quote-breck">
            <div class="block-quote">${esc(line.text)}</div>
            <div class="about-quote">
                <div class="author-quote"><span>${esc(line.author)}</span></div>
                ${createReactions(q)}
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
            ${createReactions(q)}
            <div class="tags-quote">${createTags(q.tags)}</div>
        </div>
        <img src="styles/image/quote-breck-back.svg" class="quote-breck-back">
    </div>
`;

const createCard = (q) => (q.type === "dialog" ? createDialog(q) : createSingle(q));

const updateReactions = (id, { reactions, mine }) => {
    document.querySelectorAll(`.reactions[data-id="${id}"]`).forEach((box) => {
        box.querySelectorAll(".reaction").forEach((btn) => {
            const kind = btn.dataset.kind;
            btn.querySelector(".reaction__count").textContent = reactions[kind] || "";
            btn.classList.toggle("reaction--mine", mine.includes(kind));
        });
    });
};

document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".reaction");
    if (!btn) return;

    const id = btn.closest(".reactions").dataset.id;
    btn.disabled = true;
    try {
        const res = await fetch(`/api/quotes/${id}/reactions/${btn.dataset.kind}`, { method: "POST" });
        if (res.status === 429) {
            alert("Слишком часто, подождите минуту");
            return;
        }
        if (!res.ok) return;
        updateReactions(id, await res.json());
    } finally {
        btn.disabled = false;
    }
});