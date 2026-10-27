async function loadComponent(id, file) {
    const response = await fetch(file);
    const html = await response.text();
    document.getElementById(id).innerHTML = html;
}

loadComponent("header-part", "/head-foot/header.html").then(() => {
    const q = new URLSearchParams(location.search).get("q");
    const input = document.querySelector("#search");
    if (input && q) input.value = q;
});

loadComponent('footer-part', '../head-foot/footer.html');

