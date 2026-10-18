async function loadComponent(id, file) {
    const response = await fetch(file);
    const html = await response.text();
    document.getElementById(id).innerHTML = html;
}

loadComponent('header-part', '../header.html');
loadComponent('footer-part', '../footer.html');

