const dayBox = document.querySelector("#day");

const loadDay = async () => {
  try {
    const res = await fetch("/api/quote-of-the-day");
    if (!res.ok) {
      dayBox.innerHTML = "<p>Пока нет цитат</p>";
      return;
    }
    const q = await res.json();
    dayBox.innerHTML = createCard(q);
  } catch (error) {
    console.error(error);
    dayBox.innerHTML = "<p>Не удалось загрузить цитату</p>";
  }
};

loadDay();