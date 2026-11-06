const box = document.getElementById("quote");
const id = new URLSearchParams(location.search).get("id");

async function load() {
    const res = await fetch(`/api/quotes/${encodeURIComponent(id)}`);
    if (!res.ok) {
        box.innerHTML = `<h1 style="font-size:8rem">404</h1><h2>Такой цитаты нет или она ещё на модерации.</h2>`;
        return;
    }
    box.innerHTML = createCard(await res.json());
}
load();