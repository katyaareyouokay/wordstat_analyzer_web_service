
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
    try {
        // 1. Считываем значение в переменную 'phrase'
        const phrase = document.getElementById('query-input').value; 
        const type = document.getElementById('query-type').value;

        if (!phrase) {
            alert("Введите запрос!");
            return;
        }

        console.log(`Запуск: ${type} для ${phrase}`);

        if (type === 'top') {
            // 2. Передаем именно 'phrase'
            await getTopRequests(phrase); 
        } else if (type === 'regions') {
            const regionType = document.getElementById('region-type-select').value;
            // 3. И здесь 'phrase'
            await getRegionsAnalysis(phrase, regionType); 

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

        if (result.status === "success") {
            // 1. Берем Total Count напрямую из JSON
            const total = result.data.totalCount; 
            
            // 2. Показываем блок статистики
            const statsBlock = document.getElementById('stats-summary');
            const statsValue = document.getElementById('stats-value');
            if (statsBlock && statsValue) {
                statsValue.innerText = total.toLocaleString(); // Красивое число с пробелами
                statsBlock.style.display = 'block';
            }
            const allItems = result.data.topRequests;

            // 1. Управляем видимостью блоков
            document.getElementById('chart-section').style.display = 'block';
            
            // 2. Обновляем заголовки страницы
            document.getElementById('results-main-title').innerText = `Результаты поиска по запросу: "${phrase}"`;

            // 3. ПЕРЕРИСОВЫВАЕМ структуру таблицы под ТОП
            renderTopTableStructure(); 
            
            renderBubbleChart(allItems);
            renderTopTableData(allItems.slice(0, 20)); 
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

async function registerUser() {
    // 1. Собираем данные из инпутов
    const fullName = document.getElementById('reg-fullname').value;
    const login = document.getElementById('reg-login').value;
    const password = document.getElementById('reg-password').value;

    // Валидация на фронте
    if (!fullName || !login || !password) {
        alert("Пожалуйста, заполните все поля");
        return;
    }

    // 2. Формируем объект согласно твоей схеме
    const userData = {
        full_name: fullName,
        login: login,
        password: password,
        role_id: 1 // По умолчанию, как ты и просила
    };

    try {
        const response = await fetch('http://localhost:8000/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        const result = await response.json();

        if (response.ok) {
            alert("Регистрация успешна! Теперь войдите в аккаунт.");
            showPage('login'); // Перекидываем на страницу входа
        } else {
            // Выводим ошибку от FastAPI (например, если логин занят)
            alert("Ошибка регистрации: " + (result.detail || "что-то пошло не так"));
        }
    } catch (error) {
        console.error("Ошибка при регистрации:", error);
        alert("Не удалось связаться с сервером");
    }
}


// Показываем/скрываем настройки детализации
function toggleRegionSettings() {
    const type = document.getElementById('query-type').value;
    const container = document.getElementById('region-detail-container');
    container.style.display = (type === 'regions') ? 'block' : 'none';
}
async function getRegionsAnalysis(phrase, regionType) {
    const token = localStorage.getItem('token');
    const statsBlock = document.getElementById('stats-summary');
    if (statsBlock) statsBlock.style.display = 'none';
    // Сразу настраиваем внешний вид страницы результатов
    document.getElementById('chart-section').style.display = 'none';
    document.getElementById('results-main-title').innerText = `Результаты по запросу: "${phrase}" (${regionType})`;

    try {
        const response = await fetch('http://localhost:8000/wordstat/regions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                phrase: phrase,
                region_type: regionType // Берём то, что выбрали в начале
            })
        });

        const result = await response.json();

        if (response.ok && result.status === "success") {
            renderRegionsTableContent(result.data.regions.slice(0, 20));
            showPage('results');
        } else {
            alert("Ошибка: " + (result.detail || result.error));
        }
    } catch (error) {
        console.error("Ошибка:", error);
    }
}

function renderRegionsTableContent(regions) {
    const header = document.getElementById('table-header');
    const body = document.getElementById('table-body');

    header.innerHTML = `
        <tr>
            <th>ID Региона</th>
            <th>Количество</th>
            <th>Доля</th>
            <th>Affinity Index</th>
        </tr>
    `;

    body.innerHTML = regions.map(reg => `
        <tr>
            <td><strong>${reg.regionId}</strong></td>
            <td>${reg.count.toLocaleString()}</td>
            <td>${(reg.share * 100).toFixed(2)}%</td>
            <td>${reg.affinityIndex.toFixed(1)}</td>
        </tr>
    `).join('');
}

function renderTopTableData(items) {
    const body = document.getElementById('table-body');
    
    body.innerHTML = items.map(item => `
        <tr>
            <td>${item.phrase}</td>
            <td>${item.count.toLocaleString()}</td>
        </tr>
    `).join('');
}

// И не забудь поправить функцию заголовков (если она у тебя отдельная)
function renderTopTableStructure() {
    const header = document.getElementById('table-header');
    header.innerHTML = `
        <tr>
            <th>Запрос (Phrase)</th>
            <th>Количество (Count)</th>
        </tr>
    `;
}

document.addEventListener('DOMContentLoaded', function() {
    const queryTypeSelect = document.getElementById('query-type');
    const regionDetailsBlock = document.getElementById('region-details-block');

    if (queryTypeSelect && regionDetailsBlock) {
        queryTypeSelect.addEventListener('change', function() {
            // Если выбраны регионы — показываем блок, иначе скрываем
            if (this.value === 'regions') {
                regionDetailsBlock.style.display = 'block';
            } else {
                regionDetailsBlock.style.display = 'none';
            }
        });
    }
});