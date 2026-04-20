function toggleExtraOptions() {
    const type = document.getElementById('query-type').value;
    const rb = document.getElementById('region-details-block');
    const db = document.getElementById('dynamics-details-block');
    if (rb) rb.style.display = (type === 'regions' ? 'block' : 'none');
    if (db) db.style.display = (type === 'dynamics' ? 'block' : 'none');
}

let lastAnalysisResults = null; // Буфер для Excel

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

document.addEventListener('DOMContentLoaded', function() {
    const queryTypeSelect = document.getElementById('query-type');
    // ВАЖНО: Проверь, что в HTML у тебя именно эти ID для блоков
    const regionBlock = document.getElementById('region-details-block');
    const dynamicsBlock = document.getElementById('dynamics-details-block');

    if (queryTypeSelect) {
        queryTypeSelect.addEventListener('change', function() {
            const val = this.value;
            console.log("Выбран тип:", val); // Добавь это для проверки в консоли
            
            if (regionBlock) regionBlock.style.display = (val === 'regions') ? 'block' : 'none';
            if (dynamicsBlock) dynamicsBlock.style.display = (val === 'dynamics') ? 'block' : 'none';
        });
    }
});


function updateDateConstraints() {
    const periodType = document.getElementById('period-type-select').value;
    const dateFromInput = document.getElementById('date-from');
    const dateToInput = document.getElementById('date-to');

    // Сброс обработчиков
    dateFromInput.onchange = null;
    dateToInput.onchange = null;

    if (periodType === 'weekly') {
        // Когда меняем дату "ОТ"
        dateFromInput.onchange = function() {
            let d = new Date(this.value);
            if (isNaN(d)) return;
            
            // Если выбрали не понедельник — двигаем на ближайший Пн назад
            let day = d.getDay();
            let diff = d.getDate() - day + (day === 0 ? -6 : 1);
            let monday = new Date(d.setDate(diff));
            this.value = monday.toISOString().split('T')[0];
            
            // Устанавливаем минимальную дату для "ДО" (минимум 1 неделя)
            let minSunday = new Date(monday);
            minSunday.setDate(monday.getDate() + 6);
            dateToInput.min = minSunday.toISOString().split('T')[0];
            
            // Если текущая дата "ДО" меньше нового минимума — обновляем её
            if (!dateToInput.value || new Date(dateToInput.value) < minSunday) {
                dateToInput.value = minSunday.toISOString().split('T')[0];
            }
        };

        // Когда меняем дату "ДО"
        dateToInput.onchange = function() {
            let d = new Date(this.value);
            if (isNaN(d)) return;

            // Если выбрали не воскресенье — двигаем на ближайшее Вс вперед
            let day = d.getDay();
            let diff = (day === 0) ? 0 : (7 - day);
            let sunday = new Date(d.setDate(d.getDate() + diff));
            this.value = sunday.toISOString().split('T')[0];
        };
    } 
    else if (periodType === 'daily') {
        dateFromInput.onchange = function() {
            let start = new Date(this.value);
            if (isNaN(start)) return;
            
            let maxEnd = new Date(start);
            maxEnd.setDate(start.getDate() + 10); // Лимит 10 дней
            
            dateToInput.min = this.value;
            dateToInput.max = maxEnd.toISOString().split('T')[0];
            
            if (new Date(dateToInput.value) > maxEnd) {
                dateToInput.value = maxEnd.toISOString().split('T')[0];
            }
        };
    } else {
        // Для месяцев убираем ограничения
        dateFromInput.onchange = null;
        dateToInput.min = "";
        dateToInput.max = "";
    }
}

async function runAnalysis() {
    try {
        const phraseInput = document.getElementById('query-input');
        const phrase = phraseInput.value.trim();
        const typeSelect = document.getElementById('query-type');
        const type = typeSelect.value;

        if (!phrase) {
            alert("Введите запрос!");
            return;
        }

        // 1. СОБИРАЕМ РЕГИОНЫ (ID из чекбоксов)
        const selectedRegions = Array.from(document.querySelectorAll('.region-checkbox:checked'))
            .map(cb => parseInt(cb.value));

        // 2. СОБИРАЕМ УСТРОЙСТВА (Конвертируем текст чипов в ID для бэкенда)
        // 1: Desktop, 2: Mobile, 3: Tablet, 4: All
        const deviceMap = { 'десктоп': 1, 'телефоны': 2, 'планшеты': 3, 'все': 4 };
        const selectedDevices = Array.from(document.querySelectorAll('.device-chip.active'))
            .map(chip => deviceMap[chip.innerText.toLowerCase()])
            .filter(id => id !== undefined);

        // Очистка контейнера и лоадер
        const container = document.getElementById('results-container');
        if (container) container.innerHTML = '<div style="text-align:center; padding:40px;"><div class="loader-simple">Загрузка данных...</div></div>';

        if (type === 'top') {
            await getTopRequests(phrase, selectedRegions, selectedDevices);

        } else if (type === 'dynamics') {
            const periodType = document.getElementById('period-type-select').value;
            const dateFrom = document.getElementById('date-from').value;
            const dateTo = document.getElementById('date-to').value;

            if (!dateFrom || !dateTo) {
                alert("Выберите период (Даты От и До)!");
                return;
            }

            await getDynamicsAnalysis(phrase, periodType, dateFrom, dateTo, selectedRegions, selectedDevices);

        } else if (type === 'regions') {
            const regionTypeSelect = document.getElementById('region-type-select');
            const regionType = regionTypeSelect ? regionTypeSelect.value : 'all';

            await getRegionsAnalysis(phrase, regionType, selectedDevices);
        }

    } catch (error) {
        console.error("Ошибка при выполнении анализа:", error);
        alert("Произошла ошибка. Проверьте консоль браузера (F12).");
    }
}
function showPage(pageId) {
    // 1. Прячем все страницы
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    
    // 2. Показываем нужную
    const target = document.getElementById(pageId);
    if (target) {
        target.classList.add('active');
        
        // 3. Если перешли в "Историю" (в HTML это id="cabinet")
        if (pageId === 'cabinet') {
            loadHistory();
        }
    }
}

// Функция загрузки истории из БД
async function loadHistory() {
    const tbody = document.getElementById('history-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Загрузка...</td></tr>';

    try {
        const token = localStorage.getItem('token');
        
        // ИСПРАВЛЕНО: Добавлен правильный префикс /wordstat вместо /api
        const response = await fetch('/wordstat/history', { 
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) throw new Error("Авторизуйтесь, чтобы увидеть историю");
            if (response.status === 404) throw new Error("Эндпоинт /wordstat/history не найден на сервере");
            throw new Error("Ошибка сервера при загрузке");
        }

        const historyData = await response.json();

        if (!historyData || historyData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">История пуста. Пора что-нибудь проанализировать!</td></tr>';
            return;
        }

        tbody.innerHTML = historyData.map(item => {
            // Если дата приходит строкой '2026-04-15 15:30', создаем объект даты
            const dateObj = new Date(item.created_at);
            const dateStr = isNaN(dateObj) ? item.created_at : dateObj.toLocaleDateString('ru-RU');
            
            return `
                <tr>
                    <td style="color: #666; white-space: nowrap;">${dateStr}</td>
                    <td><span class="badge">${item.type}</span></td>
                    <td style="width: 100%;"><strong>${item.phrase}</strong></td>
                    <td style="text-align: right;">
                        <button class="btn secondary btn-sm" onclick="downloadFromHistory('${item.id}', '${item.type}')">
                            📥 Excel
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error("History Load Error:", error);
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red; padding: 20px;">${error.message}</td></tr>`;
    }
}

async function downloadFromHistory(id, type) {
    const token = localStorage.getItem('token');
    
    try {
        // Делаем запрос на получение файла
        const response = await fetch(`/wordstat/history/download/${id}?type=${encodeURIComponent(type)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error("Не удалось скачать файл");

        // Превращаем ответ в "blob" (бинарный объект файла)
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        // Создаем невидимую ссылку и кликаем по ней для скачивания
        const a = document.createElement('a');
        a.href = url;
        a.download = `report_${type}_${id}.xlsx`;
        document.body.appendChild(a);
        a.click();
        
        // Очистка
        window.URL.revokeObjectURL(url);
        a.remove();

    } catch (error) {
        console.error("Download error:", error);
        alert("Ошибка при скачивании файла: " + error.message);
    }
}
async function getDynamicsAnalysis(inputPhrase, periodType, dateFrom, dateTo, regions, devices) {
    const token = localStorage.getItem('token');
    // Поддержка нескольких фраз через запятую
    const phrases = inputPhrase.split(',').map(p => p.trim()).filter(p => p);
    let allResults = {};

    for (const p of phrases) {
        try {
            const response = await fetch('/wordstat/dynamics', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    phrase: p,
                    period: periodType,
                    from_date: dateFrom,
                    to_date: dateTo,
                    regions: regions, // Массив ID: [1, 225, ...]
                    devices: devices  // Массив ID: [1, 2]
                })
            });

            const result = await response.json();

            if (response.ok) {
                // Предполагаем, что бэкенд возвращает данные в result.data
                allResults[p] = {
                    dynamics: result.data.dynamics || result.data.points || [],
                    period: periodType
                };
            } else {
                console.error(`Ошибка API для "${p}":`, result);
                alert(`Ошибка для фразы "${p}": ${result.detail || 'Проверьте параметры запроса'}`);
            }
        } catch (err) {
            console.error(`Сетевая ошибка для фразы "${p}":`, err);
        }
    }

    // Если получили хотя бы один результат — рендерим
    if (Object.keys(allResults).length > 0) {
        if (typeof renderMultipleResults === 'function') {
            renderMultipleResults(allResults, 'dynamics');
            showPage('results');
        } else {
            console.error("Функция renderMultipleResults не найдена!");
        }
    } else {
        const container = document.getElementById('results-container');
        if (container) container.innerHTML = '<p style="text-align:center; padding:20px;">Данные не найдены или произошла ошибка.</p>';
    }
}

// Глобальная переменная для хранения всех графиков (чтобы потом удалять/обновлять)
let activeCharts = [];

// Функция для периодов "30 марта – 5 апреля" (как на твоем фото)
function formatWeekPeriod(startDateStr) {
    if (!startDateStr) return '---';
    const start = new Date(startDateStr);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const opt = { day: 'numeric', month: 'short' };
    return `${start.toLocaleDateString('ru-RU', opt)} – ${end.toLocaleDateString('ru-RU', opt)} 2026`;
}

// Вспомогательная функция для пакетной динамики

async function renderMultipleResults(results, type) {
    const container = document.getElementById('results-container');
    if (!container) return;
    container.innerHTML = '';
    lastAnalysisResults = results;

    if (window.activeCharts) {
        window.activeCharts.forEach(c => c && c.destroy());
    }
    window.activeCharts = [];

    Object.entries(results).forEach(([phrase, response], index) => {
        const content = response.data || response;
        const items = content.dynamics || content.points || content.regions || content.items || content.topRequests || [];
        
        const section = document.createElement('div');
        section.className = 'phrase-result-block';
        section.innerHTML = `<h2>Результаты: ${phrase}</h2>`;

        if (type === 'dynamics') {
            const chartWrapper = document.createElement('div');
            chartWrapper.className = 'chart-wrapper'; // Используем класс из CSS
            chartWrapper.innerHTML = `<canvas id="chart-${index}"></canvas>`;
            section.appendChild(chartWrapper);
        }

        const table = document.createElement('table');
        table.className = 'results-table';
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');

        if (type === 'top') {
            thead.innerHTML = `<tr><th>Фраза</th><th>Запросы</th></tr>`;
            tbody.innerHTML = items.slice(0, 50).map(i => `<tr><td>${i.phrase || '---'}</td><td>${(i.count || 0).toLocaleString()}</td></tr>`).join('');
        } 
        else if (type === 'dynamics') {
            thead.innerHTML = `<tr><th>Период</th><th>Запросы</th><th>Доля %</th></tr>`;
            tbody.innerHTML = items.map(i => {
                const rawDate = i.date || i.point_date;
                const periodLabel = (response.period === 'weekly') ? formatWeekPeriod(rawDate) : rawDate;
                return `<tr><td>${periodLabel}</td><td>${(i.count || 0).toLocaleString()}</td><td>${((i.share || 0) * 100).toFixed(4)}%</td></tr>`;
            }).join('');
            
            // Отрисовка графика с ОВАЛАМИ и ПРЯМОЙ ЛИНИЕЙ
            setTimeout(() => {
                const ctx = document.getElementById(`chart-${index}`).getContext('2d');
                const chart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: items.map(i => i.date || i.point_date),
                        datasets: [
                            { 
                                label: 'Запросы', 
                                data: items.map(i => i.count), 
                                borderColor: '#4e73df', 
                                backgroundColor: '#4e73df',
                                yAxisID: 'y', 
                                tension: 0.3,
                                pointStyle: 'rectRounded', // Овалы
                                pointRadius: 5
                            },
                            { 
                                label: 'Доля %', 
                                data: items.map(i => (parseFloat(i.share) || 0) * 100), 
                                borderColor: '#1cc88a', 
                                backgroundColor: '#1cc88a',
                                borderDash: [], // Прямая линия (убрали пунктир)
                                yAxisID: 'y1', 
                                tension: 0.3,
                                pointStyle: 'rectRounded', // Овалы
                                pointRadius: 5
                            }
                        ]
                    },
                    options: { 
                        responsive: true, 
                        maintainAspectRatio: false, 
                        plugins: {
                            legend: {
                                labels: { usePointStyle: true } // Овалы в легенде сверху
                            }
                        },
                        scales: { 
                            y: { type: 'linear', position: 'left', title: { display: true, text: 'Запросы' } }, 
                            y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Доля %' } } 
                        } 
                    }
                });
                window.activeCharts.push(chart);
            }, 100);
        }
        else if (type === 'regions') {
            container.innerHTML = `
                    <table class="results-table">
                        <thead>
                            <tr>
                                <th>Регион/Город</th>
                                <th>Запросы</th>
                                <th>Доля %</th>
                                <th>Affinity</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(i => `
                                <tr>
                                    <td>${i.regionName || 'Регион ' + i.regionId}</td>
                                    <td>${(i.count || 0).toLocaleString()}</td>
                                    <td>${((i.share || 0) * 100).toFixed(2)}%</td>
                                    <td>${(i.affinityIndex || 0).toFixed(0)}%</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
        }

        table.appendChild(thead); table.appendChild(tbody);
        section.appendChild(table);
        container.appendChild(section);
    });
}

function renderSingleDynamicsChart(canvasId, items) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: items.map(i => i.date || i.period),
            datasets: [{
                label: 'Запросы',
                data: items.map(i => i.count || i.value),
                borderColor: '#3a86ff',
                fill: true,
                backgroundColor: 'rgba(58, 134, 255, 0.1)'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
    activeCharts.push(chart);
}

// Вспомогательная функция для пакетных пузырьков
function renderSingleBubbleChart(canvasId, items) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    // ... логика группировки интентов (как мы писали выше) ...
    // Создаем новый Chart и пушим в activeCharts
}

function renderDoubleChart(canvasId, items, label) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    const labels = items.map(i => i.point_date || i.date);
    const counts = items.map(i => i.count || 0);
    const shares = items.map(i => (i.share || 0) * 100);

    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Запросы (шт)',
                    data: counts,
                    borderColor: '#4e73df',
                    backgroundColor: 'rgba(78, 115, 223, 0.1)',
                    yAxisID: 'y',
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'Доля (%)',
                    data: shares,
                    borderColor: '#1cc88a',
                    borderDash: [5, 5], // Пунктир
                    yAxisID: 'y1',
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { type: 'linear', position: 'left', title: { display: true, text: 'Штук' } },
                y1: { type: 'linear', position: 'right', title: { display: true, text: 'Процент (%)' }, grid: { drawOnChartArea: false } }
            }
        }
    });
    window.activeCharts.push(chart);
}

async function getTopRequests(inputPhrase, regions, devices) {
    const token = localStorage.getItem('token');
    const phrases = inputPhrase.split(',').map(p => p.trim()).filter(p => p);
    let allResults = {};

    for (const p of phrases) {
        try {
            const response = await fetch('/wordstat/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    phrase: p,
                    regions: regions,
                    devices: devices
                })
            });

            const result = await response.json();

            if (response.ok) {
                // ВАЖНО: сохраняем результат целиком в объект под ключом фразы
                // Твоя renderMultipleResults ожидает именно такой формат
                allResults[p] = result;
            } else {
                console.error(`Ошибка для фразы "${p}":`, result.detail);
            }
        } catch (err) {
            console.error(`Сетевая ошибка на фразе "${p}":`, err);
        }
    }

    if (Object.keys(allResults).length > 0) {
        renderMultipleResults(allResults, 'top');
        showPage('results');
    } else {
        alert("Не удалось получить данные. Проверьте параметры запроса.");
    }
}

async function getRegionsAnalysis(inputPhrase, regionType, devices) {
    const token = localStorage.getItem('token');
    const phrases = inputPhrase.split(',').map(p => p.trim()).filter(p => p);
    let allResults = {};

    for (const p of phrases) {
        try {
            const response = await fetch('/wordstat/regions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    phrase: p,
                    region_type: regionType,
                    devices: devices
                })
            });
            const result = await response.json();
            if (response.ok) { allResults[p] = result.data; }
        } catch (err) { console.error(err); }
    }
    renderMultipleResults(allResults, 'regions');
    showPage('results');
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
        const response = await fetch('/auth/login', {
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
            document.getElementById('login-email').value = '';
            document.getElementById('login-password').value = '';
            showPage('tool');

        } else {
            alert("Ошибка входа: " + (data.detail || "неверные данные"));
        }
    } catch (error) {
        console.error("Критическая ошибка при входе:", error);
        alert("Не удалось связаться с сервером. Проверь, запущен ли Docker.");
    }
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
        const response = await fetch('/auth/register', {
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


function downloadExcel() {
    if (!lastAnalysisResults || Object.keys(lastAnalysisResults).length === 0) {
        return alert("Нет данных для выгрузки");
    }

    const wb = XLSX.utils.book_new();

    Object.entries(lastAnalysisResults).forEach(([phrase, response]) => {
        // Учитываем вложенность (иногда данные приходят в response.data, иногда сразу в response)
        const content = response.data || response;
        
        // Автоматически определяем массив данных по существующим ключам
        const items = content.dynamics || content.points || content.regions || content.items || content.topRequests || [];
        
        if (items.length === 0) return;

        // ОПРЕДЕЛЯЕМ ТИП НА ОСНОВЕ СОДЕРЖИМОГО (авто-шаблон)
        const firstItem = items[0];
        let dataRows = [];

        if (firstItem.date || firstItem.point_date) {
            // ШАБЛОН ДИНАМИКИ
            dataRows = items.map(i => ({
                "Запрос": phrase,
                "Период": i.date || i.point_date,
                "Число запросов": i.count,
                "Доля %": (parseFloat(i.share || 0) * 100).toFixed(5)
            }));
        } 
        else if (firstItem.regionId || firstItem.region_id || firstItem.region) {
            // ШАБЛОН РЕГИОНОВ
            dataRows = items.map(i => ({
                "Запрос": phrase,
                "Регион": i.region?.label || i.label || `ID ${i.regionId || i.region_id}`,
                "Число запросов": i.count,
                "Доля %": (parseFloat(i.share || 0) * 100).toFixed(4),
                "Affinity Index": (i.affinity_index || i.affinityIndex || 0).toFixed(0) + "%"
            }));
        } 
        else {
            // ШАБЛОН ТОП ЗАПРОСОВ (по умолчанию)
            dataRows = items.map(i => ({
                "Основной запрос": phrase,
                "Похожая фраза": i.phrase || "---",
                "Число запросов": i.count
            }));
        }

        const ws = XLSX.utils.json_to_sheet(dataRows);
        
        // Настройка ширины колонок для красоты
        const colWidths = Object.keys(dataRows[0]).map(() => ({ wch: 20 }));
        ws['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, phrase.substring(0, 31));
    });

    const fileName = `Wordstat_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
}

async function downloadFromHistory(phrase, type) {
    // 1. Подменяем значение в инпуте, чтобы функции знали что искать
    const input = document.getElementById('query-input');
    if (input) input.value = phrase;

    // 2. Эмулируем загрузку данных (без смены экрана на "Результаты")
    try {
        if (type === 'top') {
            await getTopRequests(phrase);
        } else if (type === 'regions') {
            await getRegionsAnalysis(phrase, 'country'); // По умолчанию страны
        } else if (type === 'dynamics') {
            // Берем последние 3 месяца для примера
            const to = new Date().toISOString().split('T')[0];
            const from = new Date();
            from.setMonth(from.getMonth() - 3);
            await getDynamicsAnalysis(phrase, 'monthly', from.toISOString().split('T')[0], to);
        }

        // 3. Вызываем твой готовый экспорт (он возьмет данные из lastAnalysisResults)
        downloadExcel();
    } catch (e) {
        alert("Не удалось восстановить данные для скачивания.");
    }
}

// Вспомогательная функция для отрисовки пузырьков в пакетном режиме
function renderSingleBubbleChart(canvasId, allPhrases) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // 1. ГРУППИРУЕМ ДАННЫЕ
    const groups = {
        "Коммерческий": { x: 1, y: 0, count: 0 },
        "Информационный": { x: 2, y: 0, count: 0 },
        "Навигационный": { x: 3, y: 0, count: 0 },
        "Прочий": { x: 4, y: 0, count: 0 }
    };

    allPhrases.forEach(item => {
        // Проверка интента (приводим к эталону из объекта groups)
        const intent = item.intent || "Прочий";
        if (groups[intent]) {
            groups[intent].y += (item.count || item.value || 0);
            groups[intent].count += 1;
        } else {
            groups["Прочий"].y += (item.count || item.value || 0);
            groups["Прочий"].count += 1;
        }
    });

    // 2. ФОРМИРУЕМ ДАННЫЕ ДЛЯ CHART.JS
    const chartData = Object.keys(groups).map(intent => ({
        label: intent,
        data: [{
            x: groups[intent].x, 
            y: groups[intent].y,
            // Размер пузырька зависит от кол-ва фраз
            r: Math.min(Math.max(groups[intent].count / 5, 8), 40) 
        }]
    }));

    const colors = {
        "Коммерческий": 'rgba(58, 134, 255, 0.7)',
        "Информационный": 'rgba(96, 125, 139, 0.7)',
        "Навигационный": 'rgba(255, 193, 7, 0.7)',
        "Прочий": 'rgba(200, 200, 200, 0.7)'
    };

    // 3. ИНИЦИАЛИЗИРУЕМ ЧАРТ
    const newChart = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: chartData.map(d => ({
                ...d,
                backgroundColor: colors[d.label] || colors["Прочий"],
                borderColor: (colors[d.label] || colors["Прочий"]).replace('0.7', '1'),
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
                        callback: (val) => ['', 'Коммерческий', 'Инфо', 'Навигатор', 'Прочее', ''][val] || '',
                        stepSize: 1
                    },
                    min: 0, max: 5
                },
                y: {
                    ticks: { callback: v => v.toLocaleString() },
                    title: { display: true, text: 'Общая частотность' }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const g = groups[ctx.dataset.label];
                            return `${ctx.dataset.label}: ${g.count} фраз, Сумма: ${g.y.toLocaleString()}`;
                        }
                    }
                }
            }
        }
    });

    // Сохраняем в массив для очистки при новом поиске
    if (typeof activeCharts !== 'undefined') {
        activeCharts.push(newChart);
    }
}

// 1. Функция открытия/закрытия
function toggleRegions() {
    const list = document.getElementById('regions-list');
    list.classList.toggle('show');
}

// Закрытие при клике мимо
window.addEventListener('click', function(e) {
    if (!document.getElementById('region-dropdown').contains(e.target)) {
        document.getElementById('regions-list').classList.remove('show');
    }
});

// 2. Загрузка регионов и вставка в список
async function initializeRegions() {
    const container = document.getElementById('regions-list');
    const label = document.getElementById('selected-regions-label');

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/wordstat/regions/dict', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const regions = await response.json();

        if (regions.length > 0) {
            container.innerHTML = regions.map(reg => `
                <div class="region-option" onclick="handleRegionClick(event, this)">
                    <input type="checkbox" value="${reg.id}" class="region-checkbox" onchange="updateRegionsLabel()">
                    <span>${reg.label}</span>
                </div>
            `).join('');
        }
    } catch (err) {
        container.innerHTML = '<div style="padding:20px;">Ошибка загрузки</div>';
    }
}

// 3. Чтобы можно было кликнуть на всю строку, а не только на квадратик чекбокса
function handleRegionClick(event, element) {
    // Если кликнули не на сам чекбокс (чтобы не было двойного срабатывания)
    if (event.target.type !== 'checkbox') {
        const cb = element.querySelector('.region-checkbox');
        cb.checked = !cb.checked;
        updateRegionsLabel();
    }
}

// 4. Обновление текста (сколько выбрано)
function updateRegionsLabel() {
    const checked = document.querySelectorAll('.region-checkbox:checked');
    const label = document.getElementById('selected-regions-label');

    if (checked.length === 0) {
        label.innerText = "Все регионы";
    } else if (checked.length === 1) {
        label.innerText = checked[0].parentElement.innerText.trim();
    } else {
        label.innerText = `Выбрано: ${checked.length}`;
    }
}

document.addEventListener('DOMContentLoaded', initializeRegions);