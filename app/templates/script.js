function toggleExtraOptions() {
    const queryType = document.getElementById('query-type').value;
    
    const dynamicsBlock = document.getElementById('dynamics-details-block');
    const regionDetailsBlock = document.getElementById('region-details-block');
    const fullRegionSelectBlock = document.getElementById('full-region-select-block');

    // 1. Очищаем данные в Set
    if (typeof selectedRegionIds !== 'undefined') {
        selectedRegionIds.clear(); 
    }

    // 2. Сбрасываем текст на плашке
    const label = document.getElementById('selected-regions-label');
    if (label) {
        label.textContent = 'Все регионы';
    }

    // 3. Очищаем поле поиска
    const searchInput = document.getElementById('region-search');
    if (searchInput) {
        searchInput.value = '';
    }

    if (typeof renderRegions === 'function') {
        renderRegions();
    }

    if (queryType === 'dynamics') {
        if (dynamicsBlock) dynamicsBlock.style.display = 'block';
    } else {
        if (dynamicsBlock) dynamicsBlock.style.display = 'none';
    }

    if (queryType === 'regions') {
        if (regionDetailsBlock) regionDetailsBlock.style.display = 'block'; 
        if (fullRegionSelectBlock) fullRegionSelectBlock.style.display = 'none';
    } else {
        if (regionDetailsBlock) regionDetailsBlock.style.display = 'none';
        if (fullRegionSelectBlock) fullRegionSelectBlock.style.display = 'block';
    }
}

let lastAnalysisResults = null; // Буфер для Excel
let lastAnalysisType = null;    // Тип последнего анализа для корректной выгрузки
let lastAnalysisGroupId = null; // group_id последнего анализа

/** Показать в шапке «Вход» или «Выйти» в зависимости от localStorage (после F5 токен остаётся). */
function syncAuthNav() {
    const container = document.querySelector('.auth-buttons');
    if (!container) return;
    if (localStorage.getItem('token')) {
        container.innerHTML =
            '<button type="button" class="btn-outline" onclick="logoutUser()">Выйти</button>';
    } else {
        container.innerHTML =
            '<button type="button" class="btn-outline" onclick="showPage(\'login\')">Вход</button>' +
            '<button type="button" class="btn-primary" onclick="showPage(\'register\')">Регистрация</button>';
    }
}

function showPage(pageId) {
    const allInputs = document.querySelectorAll('input, textarea');
    allInputs.forEach(input => {
        if (input.type !== 'button' && input.type !== 'submit') {
            input.value = '';
        }
    });

    const loginInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-password');
    if (loginInput) loginInput.value = '';
    if (passInput) passInput.value = '';

    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    const target = document.getElementById(pageId);
    if (target) {
        target.classList.add('active');
        window.scrollTo(0, 0);

        if (pageId === 'cabinet') {
            loadHistory();
        } else if (pageId === 'admin-stats') {
            loadAdminStatistics();
        }
    }
}

function logoutUser() {
    localStorage.removeItem('token');
    syncAuthNav();
    showPage('home');
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
    syncAuthNav();

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
        lastAnalysisGroupId = null;
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
            .map(cb => Number.parseInt(cb.value, 10))
            .filter(Number.isInteger);

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


// Функция загрузки истории из БД
async function loadHistory() {
    const tbody = document.getElementById('history-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Загрузка...</td></tr>';

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/wordstat/history', { 
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error("Ошибка загрузки");
        const historyData = await response.json();

        if (!historyData || historyData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">История пуста.</td></tr>';
            return;
        }

        // --- УМНАЯ ГРУППИРОВКА ---
        const groups = {};

        historyData.forEach(item => {
            // 1. Пытаемся взять group_id от бэкенда
            // 2. Если бэкенд прислал мусор, используем время до минут
            // Добавляем тип (top/regions), чтобы не смешивать разные виды анализов
            const timeKey = item.created_at ? item.created_at.substring(0, 16) : 'no-date';
            const compositeKey = `${item.group_id}_${timeKey}_${item.type}`;
            
            if (!groups[compositeKey]) {
                groups[compositeKey] = {
                    group_id: item.group_id,
                    id: item.id,
                    created_at: item.created_at,
                    type: item.type,
                    phrases: []
                };
            }
            
            // Очищаем фразу от лишних пробелов и добавляем, если её нет
            const cleanPhrase = item.phrase.trim();
            if (cleanPhrase && !groups[compositeKey].phrases.includes(cleanPhrase)) {
                groups[compositeKey].phrases.push(cleanPhrase);
            }
        });

        // Сортируем группы по дате (новые сверху)
        const sortedGroups = Object.values(groups).sort((a, b) => 
            new Date(b.created_at) - new Date(a.created_at)
        );

        tbody.innerHTML = sortedGroups.map(group => {
            const dateObj = new Date(group.created_at);
            const dateStr = isNaN(dateObj) ? group.created_at : dateObj.toLocaleString('ru-RU', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });

            // Отображаем фразы списком через запятую
            const phraseList = group.phrases.join(', ');

            return `
                <tr>
                    <td style="color: #666; white-space: nowrap;">${dateStr}</td>
                    <td><span class="badge">${group.type}</span></td>
                    <td style="width: 100%;">
                        <div style="line-height: 1.4;">
                            <strong>${phraseList}</strong>
                        </div>
                    </td>
                    <td style="text-align: right;">
                        <button type="button" class="btn secondary btn-sm" onclick='downloadFromHistory(${JSON.stringify(group.group_id)}, ${JSON.stringify(group.type)})'>
                            📥 Excel
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error("History Error:", error);
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">${error.message}</td></tr>`;
    }
}

async function downloadFromHistory(groupId, type) {
    if (groupId == null || groupId === '') {
        alert('Нет group_id для выгрузки. Обновите страницу и откройте историю снова.');
        return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
        alert('Сначала войдите в аккаунт.');
        return;
    }

    const normalizedType = ({
        top: 'Топ запросов',
        dynamics: 'Динамика',
        regions: 'Регионы'
    })[String(type || '').toLowerCase()] || type;

    try {
        const response = await fetch(
            `/wordstat/history/group/${encodeURIComponent(groupId)}/download?type=${encodeURIComponent(normalizedType)}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            let detail = response.statusText;
            try {
                const errBody = await response.json();
                if (errBody && errBody.detail) detail = typeof errBody.detail === 'string' ? errBody.detail : JSON.stringify(errBody.detail);
            } catch (_) { /* не JSON */ }
            throw new Error(`${response.status}: ${detail}`);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `report_${String(normalizedType).replace(/\s+/g, '_')}_${groupId}.xlsx`;
        document.body.appendChild(a);
        a.click();

        window.URL.revokeObjectURL(url);
        a.remove();
    } catch (error) {
        console.error("Download error:", error);
        alert("Ошибка при скачивании файла: " + error.message);
    }
}
async function getDynamicsAnalysis(inputPhrase, periodType, dateFrom, dateTo, regions, devices) {
    const token = localStorage.getItem('token');
    const phrases = inputPhrase.split(',').map(p => p.trim()).filter(p => p);
    if (!phrases.length) {
        alert("Введите хотя бы одну фразу.");
        return;
    }
    let allResults = {};

    try {
        const response = await fetch('/wordstat/dynamics', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                phrases: phrases,
                phrase: phrases[0],
                period: periodType,
                from_date: dateFrom,
                to_date: dateTo,
                regions: regions,
                devices: devices
            })
        });

        const result = await response.json();

        if (response.ok) {
            lastAnalysisGroupId = result.group_id || null;
            const by = result.by_phrase || {};
            if (Object.keys(by).length === 0 && result.data && phrases.length === 1) {
                allResults[phrases[0]] = {
                    status: result.status,
                    group_id: result.group_id,
                    data: {
                        dynamics: result.data.dynamics || result.data.points || [],
                        period: periodType
                    }
                };
            } else {
                for (const p of phrases) {
                    const block = by[p];
                    if (block) {
                        allResults[p] = {
                            status: result.status,
                            group_id: result.group_id,
                            data: {
                                dynamics: block.dynamics || block.points || [],
                                period: periodType
                            }
                        };
                    }
                }
            }
        } else {
            console.error('Ошибка API динамики:', result);
            alert(result.detail ? JSON.stringify(result.detail) : 'Проверьте параметры запроса');
        }
    } catch (err) {
        console.error('Сетевая ошибка динамики:', err);
    }

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
    lastAnalysisType = type;
    if (!lastAnalysisGroupId) {
        const firstResponse = Object.values(results)[0];
        if (firstResponse && firstResponse.group_id) {
            lastAnalysisGroupId = firstResponse.group_id;
        }
    }

    // Очистка старых графиков, если они были
    if (window.activeCharts) {
        window.activeCharts.forEach(c => c && c.destroy());
    }
    window.activeCharts = [];

    Object.entries(results).forEach(([phrase, response], index) => {
        // Извлекаем данные: обрабатываем и массив, и объект с вложенными полями
        const content = response.data || response;
        let items = [];
        
        if (Array.isArray(content)) {
            items = content;
        } else {
            items = content.dynamics || content.points || content.regions || content.items || content.topRequests || [];
        }
        
        const section = document.createElement('div');
        section.className = 'phrase-result-block';
        section.innerHTML = `<h2>Результаты: ${phrase}</h2>`;

        if (type === 'top') {
            const chartWrapper = document.createElement('div');
            chartWrapper.className = 'chart-wrapper';
            chartWrapper.style.height = '300px';
            chartWrapper.style.marginBottom = '20px';
            chartWrapper.innerHTML = `<canvas id="bubble-chart-${index}"></canvas>`;
            section.appendChild(chartWrapper);
        }

        if (type === 'dynamics') {
            const chartWrapper = document.createElement('div');
            chartWrapper.className = 'chart-wrapper';
            chartWrapper.innerHTML = `<canvas id="chart-${index}"></canvas>`;
            section.appendChild(chartWrapper);
        }

        const table = document.createElement('table');
        table.className = 'results-table';
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');

        if (type === 'top') {
            thead.innerHTML = `<tr><th>Фраза</th><th>Запросы</th></tr>`;
            tbody.innerHTML = items.slice(0, 50).map(i => `
                <tr>
                    <td>${i.phrase || '---'}</td>
                    <td>${(i.count || 0).toLocaleString()}</td>
                </tr>`).join('');

            setTimeout(() => {
                renderSingleBubbleChart(`bubble-chart-${index}`, items);
            }, 100);
        }
        else if (type === 'dynamics') {
            thead.innerHTML = `<tr><th>Период</th><th>Запросы</th><th>Доля %</th></tr>`;
            tbody.innerHTML = items.map(i => {
                const rawDate = i.date || i.point_date;
                const periodLabel = (response.period === 'weekly') ? formatWeekPeriod(rawDate) : rawDate;
                return `<tr><td>${periodLabel}</td><td>${(i.count || 0).toLocaleString()}</td><td>${((i.share || 0) * 100).toFixed(4)}%</td></tr>`;
            }).join('');
            
            // Отрисовка графика динамики (твой исходный код)
            setTimeout(() => {
                const canvas = document.getElementById(`chart-${index}`);
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
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
                                pointStyle: 'rectRounded',
                                pointRadius: 5
                            },
                            { 
                                label: 'Доля %', 
                                data: items.map(i => (parseFloat(i.share) || 0) * 100), 
                                borderColor: '#1cc88a', 
                                backgroundColor: '#1cc88a',
                                yAxisID: 'y1', 
                                tension: 0.3,
                                pointStyle: 'rectRounded',
                                pointRadius: 5
                            }
                        ]
                    },
                    options: { 
                        responsive: true, 
                        maintainAspectRatio: false, 
                        plugins: { legend: { labels: { usePointStyle: true } } },
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
            const currentRegionType = (document.getElementById('region-type-select')?.value || '').toLowerCase();
            const responseRegionType = (response.region_type || '').toLowerCase();
            const isCityDetails = responseRegionType === 'cities' || currentRegionType === 'cities';
            if (!isCityDetails) {
                const mapWrapper = document.createElement('div');
                mapWrapper.id = `map-container-${index}`;
                mapWrapper.style.width = '100%';
                mapWrapper.style.height = '400px';
                mapWrapper.style.marginBottom = '20px';
                section.appendChild(mapWrapper);

                setTimeout(() => {
                    renderRegionHeatmap(`map-container-${index}`, items);
                }, 200);
            }

            thead.innerHTML = `
                <tr>
                    <th>${isCityDetails ? 'Город' : 'Регион/Город'}</th>
                    <th>Запросы</th>
                    <th>Доля %</th>
                    <th>Affinity</th>
                </tr>`;
            const sortedItems = [...items].sort((a, b) => (b.count || b.value || 0) - (a.count || a.value || 0));
            const top20 = sortedItems.slice(0, 20);
            tbody.innerHTML = top20.map(i => `
                <tr>
                    <td>${i.name || i.regionName || 'Регион ' + (i.regionId || '---')}</td>
                    <td>${(i.count || i.value || 0).toLocaleString()}</td>
                    <td>${((i.share || 0) * 100).toFixed(4)}%</td>
                    <td>${(i.affinityIndex || 0).toFixed(0)}%</td>
                </tr>
            `).join('');
        }

        table.appendChild(thead);
        table.appendChild(tbody);
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
    const canvas = document.getElementById(canvasId);
    if (!canvas || !items.length) return;
    const ctx = canvas.getContext('2d');

    // 1. Берем ТОП-20 фраз, чтобы не перегружать график
    const topItems = items.slice(0, 20);

    // 2. Формируем данные: каждый пузырек — это отдельная фраза
    const chartData = {
        datasets: [{
            label: 'Фразы',
            data: topItems.map((item, index) => ({
                x: index + 1, // Просто позиция по порядку
                y: item.count || 0,
                r: Math.min(Math.max(Math.sqrt(item.count || 0) / 2, 5), 35) // Масштаб радиуса
            })),
            backgroundColor: topItems.map((_, i) => `hsla(${200 + i * 10}, 70%, 60%, 0.6)`), // Разные оттенки
            borderColor: 'rgba(0,0,0,0.1)',
            borderWidth: 1
        }]
    };

    const newChart = new Chart(ctx, {
        type: 'bubble',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: false }, // Скрываем техническую ось X
                y: { 
                    beginAtZero: true,
                    title: { display: true, text: 'Количество запросов' }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const item = topItems[ctx.dataIndex];
                            return ` ${item.phrase}: ${item.count.toLocaleString()}`;
                        }
                    }
                }
            }
        }
    });

    if (window.activeCharts) window.activeCharts.push(newChart);
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
    if (!phrases.length) {
        alert("Введите хотя бы одну фразу.");
        return;
    }
    let allResults = {};

    try {
        const response = await fetch('/wordstat/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                phrases: phrases,
                phrase: phrases[0],
                regions: regions,
                devices: devices
            })
        });
        const result = await response.json();
        if (!response.ok) {
            const det = result.detail;
            const msg = typeof det === 'object' && det && det.phrase
                ? `Ошибка для «${det.phrase}»: ${JSON.stringify(det.yandex || det)}`
                : (typeof det === 'object' ? JSON.stringify(det) : (det || 'Ошибка запроса'));
            console.error(msg);
            alert(msg);
            return;
        }
        lastAnalysisGroupId = result.group_id || null;
        const by = result.by_phrase || {};
        if (Object.keys(by).length === 0 && result.data && phrases.length === 1) {
            allResults[phrases[0]] = {
                status: result.status,
                group_id: result.group_id,
                data: result.data
            };
        } else {
            for (const p of phrases) {
                if (by[p]) {
                    allResults[p] = {
                        status: result.status,
                        group_id: result.group_id,
                        data: by[p]
                    };
                }
            }
        }
    } catch (err) {
        console.error('Сетевая ошибка при запросе топа:', err);
        alert('Не удалось связаться с сервером.');
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
    if (!phrases.length) {
        alert("Введите хотя бы одну фразу.");
        return;
    }
    let allResults = {};

    try {
        const response = await fetch('/wordstat/regions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                phrases: phrases,
                phrase: phrases[0],
                region_type: regionType,
                devices: devices
            })
        });
        const result = await response.json();
        if (!response.ok) {
            alert(result.detail ? JSON.stringify(result.detail) : 'Ошибка регионов');
            return;
        }
        lastAnalysisGroupId = result.group_id || null;
        const by = result.by_phrase || {};
        if (Object.keys(by).length === 0 && result.data && phrases.length === 1) {
            allResults[phrases[0]] = {
                status: result.status,
                group_id: result.group_id,
                data: result.data
            };
        } else {
            for (const p of phrases) {
                if (by[p]) {
                    allResults[p] = {
                        status: result.status,
                        group_id: result.group_id,
                        data: by[p]
                    };
                }
            }
        }
    } catch (err) {
        console.error(err);
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

    const formData = new URLSearchParams();
    formData.append('username', email);
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
            // 1. Сохраняем токен и роль (бэкенд должен возвращать role в объекте data)
            localStorage.setItem('token', data.access_token);
            
            // 2. Проверяем роль и показываем кнопку админки
            const adminLink = document.getElementById('admin-link');
            if (data.role === 'Admin' || email === 'admin') {
                adminLink.style.display = 'block';
            } else if (adminLink) {
                adminLink.style.display = 'none'; // На случай перелогина обычным юзером
            }

            console.log("Успешный вход, роль:", data.role);
            
            document.getElementById('login-email').value = '';
            document.getElementById('login-password').value = '';
            syncAuthNav();
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

    // Для top/dynamics есть server-side Excel по group_id: это надежнее, чем client-side сборка.
    const firstEntry = Object.values(lastAnalysisResults)[0];
    const groupId = lastAnalysisGroupId || (firstEntry && firstEntry.group_id);
    if (groupId && (lastAnalysisType === 'top' || lastAnalysisType === 'dynamics' || lastAnalysisType === 'regions')) {
        downloadFromHistory(groupId, lastAnalysisType);
        return;
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
                "Регион": i.regionName || i.region?.label || i.label || `ID ${i.regionId || i.region_id}`,
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

// Блок связанный с чекбоксом regions
let allRegions = []; // все регионы
let selectedRegionIds = new Set(); // ID выбранных

// 1. Функция открытия/закрытия
function toggleRegions() {
    console.log("Кнопка нажата!");
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
    const container = document.getElementById('regions-options-container'); // рендерим теперь сюда
    const token = localStorage.getItem('token');

    try {
        const response = await fetch('/wordstat/regions/dict', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        allRegions = await response.json();
        
        renderRegions(); // Первая отрисовка
    } catch (err) {
        if (container) container.innerHTML = '<div style="padding:20px;">Ошибка загрузки</div>';
    }
}

function renderRegions() {
    const container = document.getElementById('regions-options-container');
    const searchTerm = document.getElementById('region-search').value.toLowerCase();

    // 1. Фильтруем: теперь только те, что НАЧИНАЮТСЯ с введённых букв
    let filtered = allRegions.filter(reg => 
        reg.label.toLowerCase().startsWith(searchTerm)
    );

    // 2. Сортируем: выбранные в начало (этот блок оставляем без изменений)
    filtered.sort((a, b) => {
        const aChecked = selectedRegionIds.has(String(a.id));
        const bChecked = selectedRegionIds.has(String(b.id));
        return bChecked - aChecked; 
    });

    // 3. Отрисовка (оставляем как было)
    container.innerHTML = filtered.map(reg => {
        const isChecked = selectedRegionIds.has(String(reg.id));
        return `
            <div class="region-option ${isChecked ? 'is-selected' : ''}" 
                 onclick="handleRegionClick(event, this, '${reg.id}')"
                 style="display: flex; align-items: center; padding: 8px 12px; cursor: pointer;">
                <input type="checkbox" value="${reg.id}" class="region-checkbox" 
                       ${isChecked ? 'checked' : ''} 
                       style="margin-right: 10px; pointer-events: none;">
                <span>${reg.label}</span>
            </div>
        `;
    }).join('');
}

function filterRegions() {
    renderRegions();
}

// Синхронизация набора выбранных ID
function syncSelection(id, isChecked) {
    if (isChecked) {
        selectedRegionIds.add(String(id));
    } else {
        selectedRegionIds.delete(String(id));
    }
    updateRegionsLabel();
}

function handleRegionClick(event, element, id) {
    event.stopPropagation();

    const checkbox = element.querySelector('.region-checkbox');
    const isNowChecked = !checkbox.checked;
    
    // Находим инпут поиска
    const searchInput = document.getElementById('region-search');

    if (isNowChecked) {
        selectedRegionIds.add(String(id));
    } else {
        selectedRegionIds.delete(String(id));
    }

    checkbox.checked = isNowChecked;
    
    if (searchInput) {
        searchInput.value = '';
    }

    updateRegionsLabel();

    renderRegions();
}

// 4. Обновление текста (сколько выбрано)
function updateRegionsLabel() {
    const label = document.getElementById('selected-regions-label');
    const count = selectedRegionIds.size;

    if (count === 0) {
        label.innerText = "Все регионы";
    } else if (count === 1) {
        const firstId = [...selectedRegionIds][0];
        const reg = allRegions.find(r => String(r.id) === firstId);
        label.innerText = reg ? reg.label : "Выбрано: 1";
    } else {
        label.innerText = `Выбрано: ${count}`;
    }
}

document.addEventListener('DOMContentLoaded', initializeRegions);


function renderRegionHeatmap(containerId, items) {
    google.charts.load('current', { 
        'packages': ['geochart'],
        'language': 'ru' 
    });
    
    google.charts.setOnLoadCallback(drawRegionsMap);

    function drawRegionsMap() {
        const data = new google.visualization.DataTable();
        data.addColumn('string', 'Region');
        data.addColumn('number', 'Affinity Index');
        data.addColumn({type: 'string', role: 'tooltip'});

        const regionFix = {
            // Федеральные города
            "Москва": "RU-MOS",
            "Санкт-Петербург": "RU-LEN",
            "Севастополь": "RU-SE",

            // Центральный ФО
            "Белгородская область": "RU-BEL",
            "Брянская область": "RU-BRY",
            "Владимирская область": "RU-VLA",
            "Воронежская область": "RU-VOR",
            "Ивановская область": "RU-IVA",
            "Калужская область": "RU-KLU",
            "Костромская область": "RU-KOS",
            "Курская область": "RU-KRS",
            "Липецкая область": "RU-LIP",
            "Московская область": "RU-MOS",
            "Орловская область": "RU-ORL",
            "Рязанская область": "RU-RYA",
            "Смоленская область": "RU-SMO",
            "Тамбовская область": "RU-TAM",
            "Тверская область": "RU-TVE",
            "Тульская область": "RU-TUL",
            "Ярославская область": "RU-YAR",

            // Северо-Западный ФО
            "Архангельская область": "RU-ARK",
            "Вологодская область": "RU-VLG",
            "Калининградская область": "RU-KGD",
            "Ленинградская область": "RU-LEN",
            "Мурманская область": "RU-MUR",
            "Новгородская область": "RU-NGR",
            "Псковская область": "RU-PSK",
            "Республика Карелия": "RU-KR",
            "Республика Коми": "RU-KO",

            // Южный + Северо-Кавказский ФО
            "Адыгея": "RU-AD",
            "Республика Адыгея": "RU-AD",
            "Дагестан": "RU-DA",
            "Республика Дагестан": "RU-DA",
            "Ингушетия": "RU-IN",
            "Кабардино-Балкария": "RU-KB",
            "Калмыкия": "RU-KL",
            "Карачаево-Черкесия": "RU-KC",
            "Краснодарский край": "RU-KDA",
            "Ростовская область": "RU-ROS",
            "Северная Осетия": "RU-SE",
            "Ставропольский край": "RU-STA",
            "Чечня": "RU-CE",
            "Чеченская Республика": "RU-CE",
            "Крым": "RU-CR",

            // Приволжский ФО
            "Башкортостан": "RU-BA",
            "Республика Башкортостан": "RU-BA",
            "Марий Эл": "RU-ME",
            "Мордовия": "RU-MO",
            "Татарстан": "RU-TA",
            "Удмуртия": "RU-UD",
            "Чувашия": "RU-CU",
            "Пермский край": "RU-PER",
            "Кировская область": "RU-KIR",
            "Нижегородская область": "RU-NIZ",
            "Оренбургская область": "RU-ORE",
            "Пензенская область": "RU-PNZ",
            "Самарская область": "RU-SAM",
            "Саратовская область": "RU-SAR",
            "Ульяновская область": "RU-ULY",

            // Уральский ФО
            "Курганская область": "RU-KGN",
            "Свердловская область": "RU-SVE",
            "Тюменская область": "RU-TYU",
            "Челябинская область": "RU-CHE",
            "Ханты-Мансийский АО": "RU-KHM",
            "Ямало-Ненецкий АО": "RU-YAN",

            // Сибирский ФО
            "Алтайский край": "RU-ALT",
            "Республика Алтай": "RU-AL",
            "Забайкальский край": "RU-ZAB",
            "Иркутская область": "RU-IRK",
            "Кемеровская область": "RU-KEM",
            "Красноярский край": "RU-KYA",
            "Новосибирская область": "RU-NVS",
            "Омская область": "RU-OMS",
            "Томская область": "RU-TOM",
            "Республика Бурятия": "RU-BU",
            "Республика Тыва": "RU-TY",
            "Республика Хакасия": "RU-KK",

            // Дальневосточный ФО
            "Амурская область": "RU-AMU",
            "Еврейская АО": "RU-YEV",
            "Камчатский край": "RU-KAM",
            "Магаданская область": "RU-MAG",
            "Приморский край": "RU-PRI",
            "Сахалинская область": "RU-SAK",
            "Хабаровский край": "RU-KHA",
            "Республика Саха (Якутия)": "RU-SA",
            "Якутия": "RU-SA",
            "Чукотский АО": "RU-CHU",

            // === ДОБАВЛЕНО ПО ТВОЕЙ ПРОСЬБЕ ===
            "Волгоградская область": "RU-VGG",
            "Волгоград": "RU-VGG",
            "Астраханская область": "RU-AST",
            "Астрахань": "RU-AST",
            "Ямало-Ненецкий автономный округ": "RU-YAN",
            "Ненецкий автономный округ": "RU-NEN",
            "Нарьян-Мар": "RU-NEN",
            "Чукотский автономный округ": "RU-CHU"
        };

        let errorCount = 0;
        const MAX_ERRORS = 100;

        items.forEach(item => {
            let name = (item['Регион'] || item.regionName || item.region || "").toString().trim();
            let searchName = name.toLowerCase();

            let rawAff = item['Affinity Index'] || item.affinityIndex || item.affinity || 0;
            let value = parseFloat(String(rawAff).replace('%', '').replace(',', '.')) || 0;

            let geoCode = null;

            // 1. Прямое совпадение
            if (regionFix[name]) {
                geoCode = regionFix[name];
            } 
            // 2. Поиск по ключевым словам
            else {
                for (let key in regionFix) {
                    if (searchName.includes(key.toLowerCase())) {
                        geoCode = regionFix[key];
                        break;
                    }
                }
            }

            // 3. Специальные правила
            if (!geoCode) {
                const lower = searchName.toLowerCase();
                
                if (lower.includes("москва")) geoCode = "RU-MOS";
                if (lower.includes("петербург") || lower.includes("ленинград")) geoCode = "RU-LEN";
                if (lower.includes("тюмен")) geoCode = "RU-TYU";
                if (lower.includes("хмао") || lower.includes("югра")) geoCode = "RU-KHM";
                if (lower.includes("янао") || lower.includes("ямало")) geoCode = "RU-YAN";
                if (lower.includes("ненец")) geoCode = "RU-NEN";
                if (lower.includes("чукот")) geoCode = "RU-CHU";
                if (lower.includes("волгоград")) geoCode = "RU-VGG";
                if (lower.includes("астрахан")) geoCode = "RU-AST";
                if (lower.includes("камчат")) geoCode = "RU-KAM";
                if (lower.includes("примор")) geoCode = "RU-PRI";
                if (lower.includes("хабаров")) geoCode = "RU-KHA";
                if (lower.includes("саха") || lower.includes("якут")) geoCode = "RU-SA";
                if (lower.includes("крым")) geoCode = "RU-CR";
            }

            // Округление процентов (до 1 знака после запятой)
            const roundedValue = Math.round(value * 10) / 10;

            if (geoCode) {
                data.addRow([geoCode, roundedValue, `${name}: ${roundedValue}%`]);
            } else if (errorCount < MAX_ERRORS) {
                data.addRow([name, roundedValue, `${name}: ${roundedValue}%`]);
                errorCount++;
            }
        });

        const options = {
            region: 'RU',
            displayMode: 'regions',
            resolution: 'provinces',
            colorAxis: {
                colors: ['#E0F2F1', '#26A69A', '#00897B', '#004D40']
            },
            backgroundColor: '#ffffff',
            datalessRegionColor: '#f0f0f0',
            defaultColor: '#f0f0f0',
            legend: {
                textStyle: { color: '#333', fontSize: 12 }
            },
            tooltip: { 
                textStyle: { fontSize: 13 },
                trigger: 'focus'
            }
        };

        const chart = new google.visualization.GeoChart(
            document.getElementById(containerId)
        );
        
        chart.draw(data, options);
    }
}

async function loadAdminStatistics() {
    const todayTbody = document.getElementById('today-stats-tbody');
    const allTimeTbody = document.getElementById('all-time-stats-tbody');
    const quotaLabel = document.getElementById('total-quota');
    const token = localStorage.getItem('token');

    if (!todayTbody || !allTimeTbody) return;

    todayTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Загрузка...</td></tr>';

    try {
        const [respToday, respAllTime] = await Promise.all([
            fetch('/statistics/today', { 
                headers: { 'Authorization': `Bearer ${token}` } 
            }),
            fetch('/statistics/all-time', { 
                headers: { 'Authorization': `Bearer ${token}` } 
            })
        ]);

        if (!respToday.ok || !respAllTime.ok) throw new Error("Ошибка доступа к статистике");

        const dataToday = await respToday.json();
        const dataAllTime = await respAllTime.json();

        // 1. Рендерим таблицы
        renderAdminRows('today-stats-tbody', dataToday.today_stat);
        renderAdminRows('all-time-stats-tbody', dataAllTime.all_time_stat);

        // 2. Считаем квоту за сегодня (сумма "голубых ячеек" из ТЗ)
        // Считаем сумму по всем пользователям: топ + динамика + регионы
        const totalQuota = dataToday.today_stat.reduce((sum, user) => {
            return sum + 
                   (user.top_requests_count || 0) + 
                   (user.dynamics_requests_count || 0) + 
                   (user.regions_requests_count || 0);
        }, 0);

        quotaLabel.innerText = totalQuota.toLocaleString();

    } catch (error) {
        console.error("Admin Load Error:", error);
        todayTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">${error.message}</td></tr>`;
    }
}

function renderAdminRows(tbodyId, statsList) {
    const tbody = document.getElementById(tbodyId);
    if (!statsList || statsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Данных пока нет</td></tr>';
        return;
    }

    tbody.innerHTML = statsList.map(user => `
        <tr>
            <td style="color: #666;">${user.user_id}</td>
            <td><strong>${user.login}</strong></td>
            <td class="blue-cell">${(user.top_requests_count || 0).toLocaleString()}</td>
            <td class="blue-cell">${(user.dynamics_requests_count || 0).toLocaleString()}</td>
            <td class="blue-cell">${(user.regions_requests_count || 0).toLocaleString()}</td>
        </tr>
    `).join('');
}
