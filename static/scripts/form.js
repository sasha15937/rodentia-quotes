const form = document.querySelector(".quote-form");
const toggle = form.querySelector(".quote-form__dialog-toggle");
const linesBox = form.querySelector(".quote-form__lines");
const addLineBtn = form.querySelector(".quote-form__add-line");
const tagInput = form.querySelector(".quote-form__tag-input");
const tagAddBtn = form.querySelector(".quote-form__tag-add");
const tagsBox = form.querySelector(".quote-form__tags");
const errorBox = form.querySelector(".quote-form__error");

let tags = [];

const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));

const getRows = () => [...linesBox.querySelectorAll(".quote-form__line")];

const updateRemoveButtons = () => {
    const canRemove = toggle.checked && getRows().length > 2;
    getRows().forEach((row) => {
        row.querySelector(".quote-form__remove-line").hidden = !canRemove;
    });
};

const addLine = () => {
    linesBox.insertAdjacentHTML("beforeend", `
        <div class="quote-form__line">
            <input class="quote-form__author" placeholder="Автор" maxlength="40">
            <textarea class="quote-form__text" placeholder="Цитата" maxlength="1000"></textarea>
            <button type="button" class="quote-form__remove-line" title="Убрать реплику">×</button>
        </div>
    `);
    updateRemoveButtons();
};

linesBox.addEventListener("click", (e) => {
    const btn = e.target.closest(".quote-form__remove-line");
    if (!btn || getRows().length <= 2) return;
    btn.closest(".quote-form__line").remove();
    updateRemoveButtons();
});

addLineBtn.addEventListener("click", addLine);

toggle.addEventListener("change", () => {
    form.classList.toggle("quote-form--dialog", toggle.checked);
    if (toggle.checked) {
        while (getRows().length < 2) addLine();
    } else {
        getRows().slice(1).forEach((row) => row.remove());
    }
    updateRemoveButtons();   // ← новая строка
});

const renderTags = () => {
    tagsBox.innerHTML = tags.map((t, i) => `
    <span class="tag">${esc(t)}
      <button type="button" data-index="${i}">×</button>
    </span>
  `).join("");
};

const addTag = () => {
    const tag = tagInput.value.trim().toLowerCase().replace(/^#/, "");
    tagInput.value = "";
    if (!tag || tag.length > 20 || tags.includes(tag) || tags.length >= 5) return;
    tags.push(tag);
    renderTags();
};

tagAddBtn.addEventListener("click", addTag);
tagInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        addTag();
    }
});

tagsBox.addEventListener("click", (e) => {
    const index = e.target.dataset.index;
    if (index === undefined) return;
    tags.splice(Number(index), 1);
    renderTags();
});

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.textContent = "";

    const isDialog = toggle.checked;
    const lines = getRows().map((row) => ({
        author: row.querySelector(".quote-form__author").value.trim(),
        text: row.querySelector(".quote-form__text").value.trim(),
    }));

    if (lines.some((l) => !l.text)) {
        errorBox.textContent = "Заполните текст всех реплик";
        return;
    }
    if (!isDialog && !lines[0].author) {
        errorBox.textContent = "Укажите, кто сказал";
        return;
    }
    if (isDialog && lines.every((l) => !l.author)) {
        errorBox.textContent = "Укажите автора хотя бы у одной реплики";
        return;
    }

    const quote = { type: isDialog ? "dialog" : "single", lines, tags };

    try {
        const res = await fetch("/api/quotes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(quote),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            errorBox.textContent = data.details?.join(", ") || data.error || "Не удалось отправить";
            return;
        }

        // успех: очистить форму
        form.reset();
        linesBox.innerHTML = "";
        tags = [];
        renderTags();
        form.classList.remove("quote-form--dialog");
        addLine();
        errorBox.textContent = "Отправлено на проверку";
    } catch {
        errorBox.textContent = "Нет связи с сервером";
    }

    // когда будет сервер:
    // const res = await fetch("/api/quotes", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify(quote),
    // });
    // if (!res.ok) { errorBox.textContent = "Не удалось отправить"; return; }
});

addLine(); // на старте одна пустая реплика