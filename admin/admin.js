const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));

let quotes = [];
let editingId = null;

const card = (q) => `
  <article data-id="${q.id}" style="border:1px solid #888; padding:12px; margin:8px 0">
    ${q.lines.map((l) => `<p><b>${esc(l.author)}</b> ${esc(l.text)}</p>`).join("")}
    <small>${q.type} · ${esc(q.date)} · ${q.tags.map((t) => "#" + esc(t)).join(" ")}</small>
    <div>
      ${q.status === "pending" ? `<button data-action="approve">Одобрить</button>` : ""}
      <button data-action="edit">Править</button>
      <button data-action="delete">Удалить</button>
    </div>
  </article>
`;

const lineRow = (l) => `
  <div class="e-line">
    <input class="e-author" placeholder="Автор" value="${esc(l.author)}">
    <textarea class="e-text" placeholder="Текст">${esc(l.text)}</textarea>
    <button data-action="remove-line">×</button>
  </div>
`;

const editForm = (q) => `
  <article data-id="${q.id}" style="border:2px solid #c80; padding:12px; margin:8px 0">
    <label>Тип:
      <select class="e-type">
        <option value="single" ${q.type === "single" ? "selected" : ""}>одиночная</option>
        <option value="dialog" ${q.type === "dialog" ? "selected" : ""}>диалог</option>
      </select>
    </label>
    <div class="e-lines">${q.lines.map(lineRow).join("")}</div>
    <button data-action="add-line">+ реплика</button>
    <p><label>Теги через запятую:
      <input class="e-tags" value="${esc(q.tags.join(", "))}">
    </label></p>
    <button data-action="save">Сохранить</button>
    <button data-action="cancel">Отмена</button>
  </article>
`;

const render = () => {
    const show = (status) =>
        quotes
            .filter((q) => q.status === status)
            .map((q) => (q.id === editingId ? editForm(q) : card(q)))
            .join("") || "<p>Пусто</p>";
    document.getElementById("pending").innerHTML = show("pending");
    document.getElementById("approved").innerHTML = show("approved");
};

const load = async () => {
    const res = await fetch("/admin/api/quotes");
    quotes = await res.json();
    render();
};

const send = (url, method, body) =>
    fetch(url, {
        method,
        headers: {
            "X-Requested-With": "admin",
            ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });

document.body.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const article = btn.closest("article");
    const id = Number(article.dataset.id);

    switch (btn.dataset.action) {
        case "approve":
            await send(`/admin/api/quotes/${id}/approve`, "POST");
            return load();

        case "delete":
            if (!confirm("Удалить цитату насовсем?")) return;
            await send(`/admin/api/quotes/${id}`, "DELETE");
            return load();

        case "edit":
            editingId = id;
            return render();

        case "cancel":
            editingId = null;
            return render();

        case "add-line":
            article.querySelector(".e-lines").insertAdjacentHTML("beforeend", lineRow({ author: "", text: "" }));
            return;

        case "remove-line":
            btn.closest(".e-line").remove();
            return;

        case "save": {
            const body = {
                type: article.querySelector(".e-type").value,
                lines: [...article.querySelectorAll(".e-line")].map((row) => ({
                    author: row.querySelector(".e-author").value.trim(),
                    text: row.querySelector(".e-text").value.trim(),
                })),
                tags: article
                    .querySelector(".e-tags")
                    .value.split(",")
                    .map((t) => t.trim().replace(/^#/, ""))
                    .filter(Boolean),
            };
            const res = await send(`/admin/api/quotes/${id}`, "PUT", body);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                alert((data.details ?? ["Не удалось сохранить"]).join("\n"));
                return;
            }
            editingId = null;
            return load();
        }
    }
});

load();