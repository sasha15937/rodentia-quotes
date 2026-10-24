const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));

const card = (q) => `
  <article data-id="${q.id}" style="border:1px solid #888; padding:12px; margin:8px 0">
    ${q.lines.map((l) => `<p><b>${esc(l.author)}</b> ${esc(l.text)}</p>`).join("")}
    <small>${q.type} · ${esc(q.date)} · ${q.tags.map((t) => "#" + esc(t)).join(" ")}</small>
    <div>
      ${q.status === "pending" ? `<button data-action="approve">Одобрить</button>` : ""}
      <button data-action="delete">Удалить</button>
    </div>
  </article>
`;

const load = async () => {
    const res = await fetch("/admin/api/quotes");
    const quotes = await res.json();
    document.getElementById("pending").innerHTML =
        quotes.filter((q) => q.status === "pending").map(card).join("") || "<p>Пусто</p>";
    document.getElementById("approved").innerHTML =
        quotes.filter((q) => q.status === "approved").map(card).join("") || "<p>Пусто</p>";
};

document.body.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.closest("article").dataset.id;

    if (btn.dataset.action === "approve") {
        await fetch(`/admin/api/quotes/${id}/approve`, {
            method: "POST",
            headers: { "X-Requested-With": "admin" },
        });
    } else if (btn.dataset.action === "delete") {
        if (!confirm("Удалить цитату насовсем?")) return;
        await fetch(`/admin/api/quotes/${id}`, {
            method: "DELETE",
            headers: { "X-Requested-With": "admin" },
        });
    }
    load();
});

load();