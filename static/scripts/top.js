const topBox = document.querySelector("#top");

if (!topBox) {
    throw new Error("На странице нет элемента #top");
}

const tabs = document.querySelectorAll("[data-period]");

const loadTop = async (period) => {
    try {
        const res = await fetch(`/api/top?period=${period}`);
        const list = await res.json();

        topBox.innerHTML = list.length
            ? list.map((q, i) => `
          <div class="top-item">
            <span class="top-rank">#${i + 1} · ${q.score}</span>
            ${createCard(q)}
          </div>
        `).join("")
            : "<p>Пока никто не ставил реакции</p>";

        tabs.forEach((t) => t.classList.toggle("active", t.dataset.period === period));
    } catch (error) {
        console.error(error);
        topBox.innerHTML = "<p>Не удалось загрузить топ</p>";
    }
};

tabs.forEach((t) => t.addEventListener("click", () => loadTop(t.dataset.period)));

loadTop("month");