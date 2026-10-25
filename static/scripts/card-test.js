const baseUrl = "/api/quotes";

const container = document.querySelector('.qbody')
let quoteList = []


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