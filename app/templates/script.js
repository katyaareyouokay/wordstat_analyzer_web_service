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
    const type = document.getElementById('query-type').value; // Считываем тип (top или history)
    
    // Собираем данные из активных чипсов (устройств)
    const activeDevices = Array.from(document.querySelectorAll('.device-chip.active'))
                               .map(chip => chip.dataset.device);

    try {
        const response = await fetch('http://localhost:8000/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                keyword: query,
                request_type: type, // Отправляем бэкхенду тип запроса
                devices: activeDevices
            })
        });

        const result = await response.json();
        
        // Логика переключения страниц и отрисовки
        showPage('results');
        
                // Внутри функции runAnalysis
        const type = document.getElementById('query-type').value;

        if (type === 'top') {
            // Отрисовываем пузырьки
            renderBubbleChart(result.bubbleData); 
            // Заполняем таблицу со списком фраз
            fillPhrasesTable(result.phrases);
            document.getElementById('results-title').innerText = "Карта намерений пользователей";
        } else {
            // Отрисовываем обычную динамику (линейный график)
            renderLineChart(result.historyData);
            document.getElementById('results-title').innerText = "Динамика популярности";
        }
        
        fillTables(result.tableData);

    } catch (error) {
        console.error("Ошибка:", error);
    }
}

function renderChart() {
    const ctx = document.getElementById('statChart').getContext('2d');
    
    // Если график уже был, удаляем его перед перерисовкой
    if (window.myChart) window.myChart.destroy();

    window.myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн'],
            datasets: [{
                label: 'Популярность запроса',
                data: [12000, 19000, 15000, 25000, 22000, 30000],
                borderColor: '#3a86ff',           // Твой новый основной голубой
                backgroundColor: 'rgba(58, 134, 255, 0.1)', // Прозрачный голубой для заливки
                fill: true,
                tension: 0.4,                     // Делает линию плавной
                borderWidth: 4,
                pointBackgroundColor: '#3a86ff',
                pointBorderColor: '#ffffff',
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, grid: { display: false } },
                x: { grid: { display: false } }
            }
        }
    });
}

function fillTables() {
    const mainBody = document.getElementById('main-results-body');
    const similarBody = document.getElementById('similar-results-body');

    // Очищаем
    mainBody.innerHTML = '';
    similarBody.innerHTML = '';

    // Данные для примера
    const data = [
        {q: 'купить кроссовки', v: '150 234'},
        {q: 'белые кроссовки', v: '89 120'},
        {q: 'кроссовки nike', v: '45 000'}
    ];

    data.forEach(item => {
        mainBody.innerHTML += `<tr><td>${item.q}</td><td>${item.v}</td></tr>`;
        similarBody.innerHTML += `<tr><td>кеды модные</td><td>${item.v}</td></tr>`;
    });
}

let myChart = null; // Глобальная переменная для графика

function renderBubbleChart(data) {
    const ctx = document.getElementById('mainChart').getContext('2d');
    
    // Удаляем старый график, если он есть
    if (myChart) myChart.destroy();

    // Карта интентов для оси X
    const intentMapping = { "Инфо": 1, "Коммерц": 2, "Транзакц": 3, "Брендовый": 4 };
    const labels = Object.keys(intentMapping);

    myChart = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: data.map(group => ({
                label: group.intentName,
                data: [{
                    x: intentMapping[group.intentName] || 0,
                    y: group.avgFrequency, // Частотность
                    r: group.phraseCount * 0.5 // Размер пузырька зависит от кол-ва фраз
                }],
                backgroundColor: getIntentColor(group.intentName),
                hoverBackgroundColor: '#3a86ff'
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    title: { display: true, text: 'Частотность (ср. значение)' },
                    beginAtZero: true
                },
                x: {
                    title: { display: true, text: 'Тип намерения' },
                    ticks: {
                        callback: function(value) { return labels[value - 1]; }
                    },
                    min: 0,
                    max: 5
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const p = context.raw;
                            return ` Фраз: ${context.dataset.data[0].r * 2}, Частотность: ${p.y}`;
                        }
                    }
                }
            }
        }
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