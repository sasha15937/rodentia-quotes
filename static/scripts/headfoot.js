async function loadComponent(id, file) {
    const response = await fetch(file);
    const html = await response.text();
    document.getElementById(id).innerHTML = html;
}

loadComponent('header-part', '../head-foot/header.html');
loadComponent('footer-part', '../head-foot/footer.html');

