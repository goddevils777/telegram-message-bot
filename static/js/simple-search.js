// Простой поиск сообщений - чистая версия
let groups = [];
let selectedGroups = [];
let keywords = [];

// Показать группы

// Показать группы

// Показать группы
function showGroups() {
    console.log('🔍 Показываю группы только на вкладке поиска...');
    
    // Ищем контейнер только на вкладке поиска
    const searchTab = document.getElementById('search-tab');
    if (!searchTab) {
        console.log('❌ Вкладка поиска не найдена');
        return;
    }
    
    const container = searchTab.querySelector('.groups-container');
    if (!container) {
        console.log('❌ Контейнер групп на вкладке поиска не найден');
        return;
    }
    
    container.innerHTML = groups.map(group => `
        <div class="group-item">
            <input type="checkbox" class="group-checkbox" id="group_${group.id}" onchange="toggleGroup('${group.id}', '${group.title}')">
            <label for="group_${group.id}" class="group-label">
                <div class="group-title">${group.title}</div>
                <div class="group-members">${group.members_count || 0} участников</div>
            </label>
        </div>
    `).join('');
    
    console.log('✅ Группы записаны ТОЛЬКО в контейнер поиска');
}

// Загрузка групп
function loadGroups() {
    console.log('📂 Загружаю группы...');
    
    fetch('/get_groups')
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            groups = data.groups;
            console.log('✅ Группы загружены:', groups.length);
            showGroups();
        }
    });
}



// Выбор/отмена группы
function toggleGroup(groupId, groupTitle) {
    console.log('📂 Клик по группе:', groupTitle);
    
    const checkbox = document.getElementById(`group_${groupId}`);
    
    // НЕ переключаем принудительно - используем реальное состояние
    console.log('🔍 Реальное состояние чекбокса:', checkbox.checked);
    
    if (checkbox.checked) {
        // Добавляем группу если её нет
        if (!selectedGroups.find(g => g.id === groupId)) {
            selectedGroups.push({id: groupId, title: groupTitle});
            console.log('✅ Группа добавлена:', groupTitle);
        }
    } else {
        // Убираем группу
        selectedGroups = selectedGroups.filter(g => g.id !== groupId);
        console.log('❌ Группа убрана:', groupTitle);
    }
    
    console.log('📊 Всего выбрано групп:', selectedGroups.length);
    // Прямое обновление счетчика вместо вызова функции
    console.log('🔢 ПРЯМОЕ обновление счетчика...');
    const counter = document.getElementById('selectedCount');
    console.log('🎯 Элемент selectedCount:', counter);

    if (counter) {
        counter.textContent = `Выбрано: ${selectedGroups.length} групп`;
        console.log('✅ Счетчик обновлен напрямую');
    } else {
        console.log('❌ selectedCount не найден');
    }
}

// Добавление ключевого слова
function addKeyword() {
    const input = document.getElementById('wordInput');
    if (!input) {
        console.log('❌ Поле ввода слов не найдено');
        return;
    }
    
    const word = input.value.trim();
    if (!word) {
        console.log('❌ Введите ключевое слово');
        return;
    }
    
    if (keywords.includes(word)) {
        console.log('❌ Слово уже добавлено:', word);
        return;
    }
    
    keywords.push(word);
    input.value = '';
    
    console.log('✅ Добавлено слово:', word);
    console.log('📝 Всего слов:', keywords.length);
    
    showKeywords();
}

// Показать список ключевых слов
// Показать список ключевых слов
function showKeywords() {
    const container = document.getElementById('keywordsDisplay');
    if (!container) {
        console.log('❌ Контейнер для слов не найден');
        return;
    }
    
    container.innerHTML = keywords.map(word => `
        <span style="background: #007bff; color: white; padding: 5px 10px; margin: 3px; border-radius: 15px; display: inline-block;">
            ${word}
            <button onclick="removeKeyword('${word}')" style="background: none; border: none; color: white; margin-left: 5px; cursor: pointer;">×</button>
        </span>
    `).join('');
    
    console.log('✅ Показано слов:', keywords.length);
}

// Удаление слова
function removeKeyword(word) {
    keywords = keywords.filter(k => k !== word);
    console.log('❌ Удалено слово:', word);
    showKeywords();
}

// Запуск поиска
function startSearch() {
    let progressInterval;
    console.log('🔍 Запуск поиска...');
    
    // Проверяем есть ли выбранные группы
    if (selectedGroups.length === 0) {
        console.log('❌ Не выбраны группы');
        alert('Выберите хотя бы одну группу');
        return;
    }
    
    // Проверяем есть ли ключевые слова
    if (keywords.length === 0) {
        console.log('❌ Не добавлены ключевые слова');
        alert('Добавьте хотя бы одно ключевое слово');
        return;
    }
    
    console.log('📊 Начинаю поиск...');
    console.log('📂 Групп:', selectedGroups.length);
    console.log('📝 Слов:', keywords.length);
    // Показываем начальный прогресс
    showSearchProgress(0, selectedGroups.length, 'Подготовка...');
    
    // Отправляем запрос на поиск
    const searchData = {
        groups: selectedGroups.map(g => g.id),
        keywords: keywords,
        limit: 1000 // количество сообщений на группу
    };
    
    // Отправляем запрос на поиск
    fetch('/parallel_search', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            keyword: keywords.join(' '),
            selected_groups: selectedGroups.map(g => g.id),
            search_depth: getSearchDepth()
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log('📡 Результат поиска:', data);
        if (data.success) {
            console.log('✅ Поиск завершен успешно');
            console.log('📈 Найдено сообщений:', data.total || 0);
            showSearchResults(data.results);
        } else {
            console.log('❌ Ошибка поиска:', data.error);
            alert('Ошибка поиска: ' + data.error);
        }
   
        const progressInterval = setInterval(() => {
            checkSearchProgress();
        }, 2000);
    });
}

function checkSearchProgress() {
    console.log('🔍 Проверяю прогресс поиска...');
    
    fetch('/search_progress')
    .then(response => response.json())
    .then(data => {
        console.log('📊 Данные прогресса:', data);
        
        if (data.current && data.total) {
            showSearchProgress(data.current, data.total, data.current_group || 'Поиск...');
        }
        
        if (data.finished) {
            console.log('✅ Поиск завершен, останавливаю проверку');
            clearInterval(progressInterval);
        }
    })
    .catch(error => {
        console.log('❌ Ошибка получения прогресса:', error);
    });
}



// Получить количество сообщений для поиска
function getSearchDepth() {
    const depthInput = document.getElementById('searchDepth') || 
                      document.getElementById('messagesLimit') || 
                      document.getElementById('messageCount');
    
    if (depthInput) {
        const value = parseInt(depthInput.value) || 1000;
        console.log('📊 Глубина поиска из поля:', value);
        return value;
    }
    
    console.log('📊 Поле глубины не найдено, используем 1000');
    return 1000;
}

// Переключение вкладок
// Переключение вкладок
function switchTab(tabName) {
    console.log('🔄 Переключаюсь на вкладку:', tabName);
    
    // Убираем активные классы со всех вкладок
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Скрываем все содержимое вкладок
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });
    
    // Показываем нужную вкладку

    const targetTab = document.getElementById(tabName + '-tab');
    if (targetTab) {
        targetTab.style.display = 'block';
        console.log('✅ Показана вкладка:', tabName);
        
        // Загружаем данные для конкретных вкладок
        if (tabName === 'accounts') {
            loadAccounts();
        } else if (tabName === 'search') {
            loadGroups(); // Группы загружаем только на вкладке поиска
        }
    }
    
    // Активируем кнопку вкладки
    event.target.classList.add('active');
}

// Показать аккаунты
function showAccounts(accounts) {
    const container = document.getElementById('accountsStats');
    if (!container) {
        console.log('❌ Контейнер accountsStats не найден');
        return;
    }
    
    console.log('📋 Показываю аккаунты в контейнере');
    
    // Автоматически активируем все аккаунты
    accounts.forEach(account => {
        activateAccountAuto(account.account_name);
    });
    
    container.innerHTML = accounts.map(account => `
        <div style="background: white; padding: 15px; border-radius: 10px; border: 2px solid #e1e8ed; margin-bottom: 10px;">
            <input type="checkbox" id="acc_${account.account_name}" style="margin-right: 10px;" checked onchange="toggleAccount('${account.account_name}')">
            <label for="acc_${account.account_name}" style="font-weight: bold;">
                ${account.user_info.first_name} ${account.user_info.last_name}
            </label>
            <div style="font-size: 12px; color: #666; margin-top: 5px;">
                📱 ${account.user_info.phone}
            </div>
        </div>
    `).join('');
    
console.log('✅ Аккаунты отображены и активированы');

// Прямое обновление информации в шапке
console.log('📊 ПРЯМОЕ обновление информации об аккаунтах');

const accountInfo = document.getElementById('accountInfo');
if (accountInfo) {
    accountInfo.textContent = `👤 Активно: ${accounts.length} аккаунтов`;
    console.log('✅ Обновлен accountInfo в шапке');
}

const searchAccountInfo = document.getElementById('searchAccountInfo');
if (searchAccountInfo) {
    const accountNames = accounts.map(acc => acc.user_info.first_name).join(', ');
    searchAccountInfo.textContent = `Активные аккаунты: ${accountNames}`;
    console.log('✅ Обновлен searchAccountInfo:', accountNames);
} else {
    console.log('❌ Элемент searchAccountInfo не найден');
}
    
}


// Обновление информации в шапке
function updateHeaderAccountInfo(accounts) {
    console.log('📊 Обновляю информацию об аккаунтах в шапке');
    
    // Обновляем элемент "👤 Загружаю аккаунт..." в шапке
    const accountInfo = document.getElementById('accountInfo');
    if (accountInfo) {
        accountInfo.textContent = `👤 Активно: ${accounts.length} аккаунтов`;
        console.log('✅ Обновлен accountInfo в шапке');
    }
    
    // Обновляем плашку на вкладке поиска
    const searchAccountInfo = document.getElementById('searchAccountInfo');
    if (searchAccountInfo) {
        const accountNames = accounts.map(acc => acc.user_info.first_name).join(', ');
        searchAccountInfo.textContent = `Активные аккаунты: ${accountNames}`;
        console.log('✅ Обновлен searchAccountInfo:', accountNames);
    } else {
        console.log('❌ Элемент searchAccountInfo не найден');
    }
}

// Автоактивация аккаунта
function activateAccountAuto(accountName) {
    fetch('/toggle_account', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            account_name: accountName,
            active: true
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log(`✅ Аккаунт ${accountName} автоактивирован`);
        }
    });
}

// Обновление информации в шапке
function updateHeaderAccountInfo(accounts) {
    // Обновляем элемент "👤 Загружаю аккаунт..."
    const accountInfo = document.getElementById('accountInfo');
    if (accountInfo) {
        accountInfo.textContent = `👤 Активно: ${accounts.length} аккаунтов`;
    }
    
    // Обновляем "Поиск выполняется от аккаунта:"
    const searchAccountInfo = document.getElementById('autoSearchAccountInfo');
    if (searchAccountInfo) {
        const accountNames = accounts.map(acc => acc.user_info.first_name).join(', ');
        searchAccountInfo.textContent = `Активные аккаунты: ${accountNames}`;
    }
}

// Загрузка аккаунтов (ВТОРОЙ)
function loadAccounts() {
    console.log('👥 Загружаю аккаунты...');
    
    fetch('/get_available_sessions')
    .then(response => response.json())
    .then(data => {
        console.log('📡 Ответ аккаунтов:', data);
        if (data.success) {
            console.log('✅ Аккаунты загружены:', data.sessions.length);
            showAccounts(data.sessions);
        }
    });
}

// Загрузка аккаунтов
function loadAccounts() {
    console.log('👥 Загружаю аккаунты...');
    
    fetch('/get_available_sessions')
    .then(response => response.json())
    .then(data => {
        console.log('📡 Ответ аккаунтов:', data);
        if (data.success) {
            console.log('✅ Аккаунты загружены:', data.sessions.length);
            showAccounts(data.sessions);  // ← ЭТА СТРОКА ДОЛЖНА БЫТЬ!
        }
    });
}

// Активация/деактивация аккаунта
function toggleAccount(accountName) {
    console.log('👤 Переключаю аккаунт:', accountName);
    
    const checkbox = document.getElementById(`acc_${accountName}`);
    
    fetch('/toggle_account', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            account_name: accountName,
            active: checkbox.checked
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log('📡 Полный ответ сервера:', data);
        console.log('📊 Детали ответа:');
        console.log('  - success:', data.success);
        console.log('  - total:', data.total);
        console.log('  - results длина:', data.results?.length);
        console.log('  - results тип:', typeof data.results);
        console.log('  - первые 3 результата:', data.results?.slice(0, 3));
        
        if (data.success) {
            console.log('✅ Поиск завершен успешно');
            console.log('📈 Найдено сообщений:', data.total || 0);
            
            if (data.results && data.results.length > 0) {
                showSearchResults(data.results);
            } else {
                console.log('❌ Массив результатов пуст или отсутствует');
            }
        } else {
            console.log('❌ Ошибка поиска:', data.error);
            alert('Ошибка поиска: ' + data.error);
        }
    });
}

// Показать результаты поиска
// Показать результаты поиска
function showSearchResults(messages) {
    console.log('📋 Показываю результаты поиска:', messages.length);
    console.log('📋 Первое сообщение:', messages[0]);
    
    // Ищем контейнер для результатов
    let resultsContainer = document.querySelector('.results');
    console.log('📦 Контейнер results найден:', !!resultsContainer);
    
    if (!resultsContainer) {
        console.log('❌ Создаю свой контейнер результатов');
        
        // Создаем свой контейнер если не найден
        resultsContainer = document.createElement('div');
        resultsContainer.style.cssText = 'border: 3px solid green; padding: 20px; margin: 20px; background: white;';
        
        const mainContent = document.querySelector('.container') || document.body;
        mainContent.appendChild(resultsContainer);
    } else {
        // Принудительно показываем найденный контейнер
        resultsContainer.style.display = 'block';
        resultsContainer.style.visibility = 'visible';
        resultsContainer.style.opacity = '1';
        resultsContainer.style.height = 'auto';
        console.log('✅ Контейнер принудительно показан');
    }
    
    resultsContainer.innerHTML = `
        <h3 style="color: green;">🔥 НАЙДЕННЫЕ СООБЩЕНИЯ (${messages.length})</h3>
        ${messages.map(msg => `
            <div style="padding: 20px; border: 1px solid #ccc; margin: 10px 0; background: #f9f9f9;">
                <div style="color: #333; margin-bottom: 10px;">${msg.text}</div>
                <div style="font-size: 14px; color: #666;">
                    👤 ${msg.author} | 💬 ${msg.chat} | 📅 ${msg.date}
                </div>
            </div>
        `).join('')}
    `;

    console.log('📝 HTML записан в контейнер:', resultsContainer.innerHTML.length, 'символов');
    console.log('📏 Размеры контейнера:', resultsContainer.offsetWidth, 'x', resultsContainer.offsetHeight);
    console.log('📍 Позиция контейнера:', resultsContainer.offsetTop, resultsContainer.offsetLeft);
    console.log('🎯 Контейнер:', resultsContainer);
}

// Выбрать все группы
function selectAllAutoGroups() {
    console.log('✅ Выбираю все группы');
    
    selectedGroups = [];
    
    // Проходим по всем чекбоксам групп
    document.querySelectorAll('.group-checkbox').forEach(checkbox => {
        checkbox.checked = true;
        
        // Извлекаем ID группы из ID чекбокса
        const groupId = checkbox.id.replace('group_', '');
        const groupTitle = checkbox.nextElementSibling.querySelector('.group-title').textContent;
        
        selectedGroups.push({id: groupId, title: groupTitle});
    });
    
    updateGroupsCounter();
    console.log('✅ Выбрано групп:', selectedGroups.length);
    // Обновляем счетчик
    const counter = document.getElementById('selectedCount');
    if (counter) {
        counter.textContent = `Выбрано: ${selectedGroups.length} групп`;
        console.log('✅ Счетчик обновлен при выборе всех');
    }
}

function deselectAllAutoGroups() {
    console.log('🚨 ВЫЗВАНА deselectAllAutoGroups - убираю все группы');
    console.log('🔢 Было выбрано групп:', selectedGroups.length);
    
    selectedGroups = [];
    
    // Снимаем все чекбоксы
    document.querySelectorAll('.group-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });

    console.log('❌ Снято выделение со всех групп');
    console.log('🔢 Стало выбрано групп:', selectedGroups.length);

    // Обновляем счетчик
    const counter = document.getElementById('selectedCount');
    if (counter) {
        counter.textContent = `Выбрано: ${selectedGroups.length} групп`;
        console.log('✅ Счетчик обновлен при снятии всех');
    }
}

// Обновить список групп
function forceReloadGroups() {
    console.log('🔄 Обновляю список групп...');
    loadGroups();
}

// Обновить счетчик групп
function updateGroupsCounter() {
    console.log('🔢 Ищу элемент selectedCount...');
    
    const counter = document.getElementById('selectedCount');
    console.log('🎯 Элемент selectedCount:', counter);
    
    if (counter) {
        const oldText = counter.textContent;
        counter.textContent = `Выбрано: ${selectedGroups.length} групп`;
        console.log('✅ Счетчик обновлен:');
        console.log('  - Было:', oldText);
        console.log('  - Стало:', counter.textContent);
        console.log('  - Элемент:', counter);
    } else {
        console.log('❌ Элемент selectedCount НЕ НАЙДЕН');
        
        // Ищем все элементы с похожими ID
        const allElements = document.querySelectorAll('[id*="ount"], [id*="elect"]');
        console.log('🔍 Элементы с count/elect в ID:', allElements);
        
        allElements.forEach(el => {
            console.log(`  - ID: ${el.id}, текст: "${el.textContent}"`);
        });
    }
}

// Также добавь функции для обычного поиска
function selectAllGroups() {
    console.log('✅ Выбираю все группы');
    
    selectedGroups = [];
    
    document.querySelectorAll('.group-checkbox').forEach(checkbox => {
        checkbox.checked = true;
        
        const groupId = checkbox.id.replace('group_', '');
        const groupTitle = checkbox.nextElementSibling.querySelector('.group-title').textContent;
        
        selectedGroups.push({id: groupId, title: groupTitle});
    });
    
    updateGroupsCounter();
    console.log('✅ Выбрано групп:', selectedGroups.length);
}
function clearAllGroups() {
    console.log('🚨 ВЫЗВАНА clearAllGroups - убираю все группы');
    console.log('🔢 Было выбрано групп:', selectedGroups.length);
    
    selectedGroups = [];
    
    document.querySelectorAll('.group-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });

    console.log('❌ Снято выделение со всех групп');
    console.log('🔢 Стало выбрано групп:', selectedGroups.length);

    // Обновляем счетчик
    const counter = document.getElementById('selectedCount');
    if (counter) {
        counter.textContent = `Выбрано: ${selectedGroups.length} групп`;
        console.log('✅ Счетчик обновлен при снятии всех');
    }
}

function refreshGroups() {
    console.log('🔄 Обновляю список групп...');
    loadGroups();
}

function updateGroupsCounter() {
    const counter = document.getElementById('selectedGroupsCount');
    if (counter) {
        counter.textContent = `Выбрано: ${selectedGroups.length} групп`;
    }
}

// Показ прогресса поиска
function showSearchProgress(current, total, groupName) {
    console.log(`📊 Прогресс: ${current}/${total} - ${groupName}`);
    
    let progressDiv = document.getElementById('searchProgress');
    if (!progressDiv) {
        progressDiv = document.createElement('div');
        progressDiv.id = 'searchProgress';
        progressDiv.style.cssText = 'margin: 20px 0;';
        
        const container = document.querySelector('.container');
        container.appendChild(progressDiv);
    }
    
    const percent = Math.round((current / total) * 100);
    
    progressDiv.innerHTML = `
        <div style="background: #e3f2fd; padding: 15px; border-radius: 10px; border-left: 4px solid #2196f3;">
            <div style="font-weight: bold; margin-bottom: 5px;">🔍 Поиск в процессе...</div>
            <div>Группа ${current} из ${total}: ${groupName}</div>
            <div style="background: #ddd; height: 8px; border-radius: 4px; margin-top: 10px;">
                <div style="background: #2196f3; height: 8px; border-radius: 4px; width: ${percent}%;"></div>
            </div>
            <div style="text-align: center; margin-top: 5px; font-size: 12px;">${percent}%</div>
        </div>
    `;
}

// Делаем все функции глобальными
window.selectAllAutoGroups = selectAllAutoGroups;
window.deselectAllAutoGroups = deselectAllAutoGroups;
window.forceReloadGroups = forceReloadGroups;
window.selectAllGroups = selectAllGroups;
window.clearAllGroups = clearAllGroups;
window.refreshGroups = refreshGroups;

// Запуск при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔍 Запуск простого поиска');
    loadGroups();
    loadAccounts(); // Автоматически загружаем аккаунты
});