function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    const target = document.getElementById(pageId);
    if (target) {
        target.classList.add('active');
        window.scrollTo(0, 0);
    }
}

function toggleDevice(element) {
    const allChips = document.querySelectorAll('.device-chip');
    const isAllBtn = element.innerText === 'Все';

    if (isAllBtn) {
        // Если нажали "Все", снимаем выделение с остальных и оставляем только "Все"
        allChips.forEach(chip => chip.classList.remove('active'));
        element.classList.add('active');
    } else {
        // Если нажали конкретное устройство
        const allBtn = Array.from(allChips).find(c => c.innerText === 'Все');
        allBtn.classList.remove('active'); // Убираем актив с кнопки "Все"
        
        element.classList.toggle('active');

        // Если вдруг все устройства отжаты, возвращаем "Все" по умолчанию
        const anyActive = Array.from(allChips).some(c => c.classList.contains('active'));
        if (!anyActive) {
            allBtn.classList.add('active');
        }
    }
}

async function runAnalysis() {
    const query = document.getElementById('query-input').value;
    const type = document.getElementById('query-type').value; // 'top', 'history' или 'regions'
    
    if (!query) {
        alert("Сначала введите запрос!");
        return;
    }

    // Собираем устройства (чипсы)
    // const activeDevices = Array.from(document.querySelectorAll('.device-chip.active'))
    //                            .map(chip => chip.dataset.device);

    try {
        if (type === 'top') {
            // ВАРИАНТ 1: ТОП ЗАПРОСОВ
            console.log("Запускаем поиск топа запросов...");
            await getTopRequests(query); // Передаем фразу в функцию
            
        } 

    } catch (error) {
        console.error("Ошибка при выполнении анализа:", error);
    }
}

async function getTopRequests(phrase) {
    const token = localStorage.getItem('token');
    if (!token) {
        alert("Сначала войдите в систему!");
        showPage('login');
        return;
    }

    const url = 'http://localhost:8000/wordstat/search';

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                phrase: phrase,
                regions: [1]
            })
        });

        const result = await response.json();

        // Проверяем статус, который мы прописали в Python
        if (result.status === "success") {
            const allItems = result.data.topRequests;

            // 1. Рисуем пузырьки по ВСЕМ данным (их может быть 2000)
            renderBubbleChart(allItems);

            // 2. Рисуем таблицу по первым 20
            renderTable(allItems.slice(0, 20));

            // 3. Переключаем страницу
            showPage('results');
        } else {
            console.error("Ошибка бэкенда:", result.error);
            alert("Ошибка: " + result.error);
        }
    } catch (error) {
        console.error("Критическая ошибка:", error);
    }
}

function renderTable(items) {
    const tableBody = document.querySelector('#wordstat-table tbody');
    tableBody.innerHTML = ''; 

    // Берем только первые 20 элементов из массива
    const top20 = items.slice(0, 20);

    top20.forEach(item => {
        const row = `
            <tr>
                <td>${item.phrase}</td>
                <td>${item.count.toLocaleString()}</td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', row);
    });
}

// Вспомогательная функция для цветов
function getIntentColor(intent) {
    const colors = {
        "Инфо": 'rgba(58, 134, 255, 0.6)',
        "Коммерц": 'rgba(96, 125, 139, 0.6)',
        "Транзакц": 'rgba(142, 202, 230, 0.6)'
    };
    return colors[intent] || 'rgba(200, 200, 200, 0.6)';
}

async function loginUser() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        alert("Заполните все поля!");
        return;
    }

    // Формат x-www-form-urlencoded требует URLSearchParams
    const formData = new URLSearchParams();
    formData.append('username', email); // FastAPI OAuth2 ждет 'username'
    formData.append('password', password);

    try {
        const response = await fetch('http://localhost:8000/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            // Сохраняем токен
            localStorage.setItem('token', data.access_token);
            console.log("Успешный вход, токен сохранен");
            
            // Переключаем страницу на инструмент
            showPage('tool');
        } else {
            alert("Ошибка входа: " + (data.detail || "неверные данные"));
        }
    } catch (error) {
        console.error("Критическая ошибка при входе:", error);
        alert("Не удалось связаться с сервером. Проверь, запущен ли Docker.");
    }
}

function downloadExcel() {
    // 1. Находим таблицу
    const table = document.getElementById("wordstat-table");
    
    // 2. Превращаем HTML-таблицу в рабочую книгу Excel
    const wb = XLSX.utils.table_to_book(table, { sheet: "Top Requests" });
    
    // 3. Генерируем имя файла с текущей датой
    const date = new Date().toISOString().slice(0, 10);
    const fileName = `wordstat_export_${date}.xlsx`;
    
    // 4. Инициируем скачивание
    XLSX.writeFile(wb, fileName);
}

// Переменная для хранения инстанса чарта (чтобы удалять старый при новом поиске)
let bubbleChartInstance = null;

function renderBubbleChart(allPhrases) {
    const ctx = document.getElementById('intentBubbleChart').getContext('2d');
    
    // 1. УДАЛЯЕМ СТАРЫЙ ЧАРТ (CORS/Авторизация заработала, данные летят, старые чарты нужно чистить!)
    if (bubbleChartInstance) {
        bubbleChartInstance.destroy();
    }

    // 2. ГРУППИРУЕМ ДАННЫЕ (Агрегируем 2000 фраз в 4 интента)
    const groups = {
        "Коммерческий": { x: 1, y: 0, r: 0, count: 0, phrases: [] },
        "Информационный": { x: 2, y: 0, r: 0, count: 0, phrases: [] },
        "Навигационный": { x: 3, y: 0, r: 0, count: 0, phrases: [] },
        "Прочий": { x: 4, y: 0, r: 0, count: 0, phrases: [] }
    };

    allPhrases.forEach(item => {
        if (groups[item.intent]) {
            groups[item.intent].y += item.count; // Накапливаем частотность (Ось Y)
            groups[item.intent].count += 1;      // Считаем количество фраз (для размера R)
            groups[item.intent].phrases.push(item);
        }
    });

    // 3. ФОРМИРУЕМ ДАННЫЕ ДЛЯ CHART.JS
    // Размер пузырька (R) делаем пропорциональным количеству фраз, но с ограничением
    const chartData = Object.keys(groups).map(intent => {
        const group = groups[intent];
        return {
            label: intent,
            data: [{
                x: group.x, 
                y: group.y,
                r: Math.min(Math.max(group.count / 10, 10), 80) // Ограничиваем размер пузырька
            }]
        };
    });

    // 4. ОПРЕДЕЛЯЕМ ЦВЕТА
    const colors = {
        "Коммерческий": 'rgba(58, 134, 255, 0.7)',  // Синий
        "Информационный": 'rgba(96, 125, 139, 0.7)', // Серый
        "Навигационный": 'rgba(255, 193, 7, 0.7)',   // Желтый
        "Прочий": 'rgba(200, 200, 200, 0.7)'       // Светло-серый
    };

    // 5. ИНИЦИАЛИЗИРУЕМ ЧАРТ
    bubbleChartInstance = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: chartData.map(d => ({
                ...d,
                backgroundColor: colors[d.label],
                borderColor: colors[d.label].replace('0.7', '1'),
                borderWidth: 1
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    ticks: {
                        callback: function(value) {
                            const labels = ['', 'Коммерческий', 'Инфо', 'Навигационный', 'Прочий'];
                            return labels[value] || '';
                        },
                        stepSize: 1
                    },
                    min: 0,
                    max: 5,
                    title: { display: true, text: 'Тип намерения' }
                },
                y: {
                    title: { display: true, text: 'Суммарная частотность (count)' },
                    ticks: { callback: value => value.toLocaleString() }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const intent = context.dataset.label;
                            const freq = context.raw.y.toLocaleString();
                            const phrasesCount = groups[intent].count;
                            return `${intent}: ${phrasesCount} фраз, Частотность: ${freq}`;
                        }
                    }
                },
                legend: { display: false } // Легенда не нужна, подписи на осях
            }
        }
    });
}