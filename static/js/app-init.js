// ===============================
// ГЛАВНАЯ ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// static/js/app-init.js
// ===============================

/**
 * Глобальное состояние приложения Message Hunter
 */
window.MessageHunter = {
    // Состояние поиска
    keywords: [],
    searchAbortController: null,
    selectedGroups: [],
    allGroups: [],
    lastSearchResults: null,
    allSearchResults: [],
    displayedResults: 0,
    resultsPerPage: 50,
    isLoadingMore: false,
    
    // Состояние автопоиска
    autoSearchGroups: [],
    autoSearchKeywords: [],
    autoFoundMessages: [],
    autoSearchActive: false,
    autoSearchInterval: null,
    AUTO_SEARCH_INTERVAL: 15000,
    
    // Состояние рассылки
    selectedBroadcastGroups: [],
    broadcastTasks: [],
    
    // Состояние пользователя
    userStats: null,
    telegramUserInfo: null,
    groupsLoaded: false,
    
    // Уведомления
    lastNotificationCount: 0,
    
    // Версия приложения
    version: '2.0.0',
    buildDate: '2024-01-15'
};

/**
 * Конфигурация инициализации
 */
const INIT_CONFIG = {
    // Таймауты
    MODULE_LOAD_TIMEOUT: 1000,
    API_CHECK_TIMEOUT: 5000,
    
    // Порядок загрузки модулей
    REQUIRED_MODULES: [
        'Utils',
        'UIUtils', 
        'DataManager',
        'APIClient',
        'TabManager',
        'GroupsManager',
        'SearchManager',
        'AccountManager'
    ],
    
    // Опциональные модули
    OPTIONAL_MODULES: [
        'AutoSearchManager',
        'BroadcastManager', 
        'HistoryManager',
        'AIManager'
    ],
    
    // Флаги состояния
    INIT_FLAGS: {
        modulesLoaded: false,
        apiKeysChecked: false,
        groupsLoaded: false,
        accountLoaded: false,
        ready: false
    }
};

/**
 * Основная функция инициализации приложения
 */
async function initializeApp() {
    console.log('🚀 Запуск инициализации Message Hunter v' + window.MessageHunter.version);
    
    try {
        // Показываем индикатор загрузки
        showInitializationProgress('Инициализация приложения...', 0);
        
        // 1. Проверка загрузки модулей
        await checkModulesLoaded();
        showInitializationProgress('Модули загружены', 10);
        
        // 2. Очистка поврежденных данных
        cleanupCorruptedData();
        showInitializationProgress('Данные очищены', 20);
        
        // 3. Проверка параметров URL
        handleUrlParameters();
        showInitializationProgress('Параметры обработаны', 30);
        
        // 4. Восстановление состояния вкладок
        await restoreTabState();
        showInitializationProgress('Состояние восстановлено', 40);
        
        // 5. Проверка API ключей
        const apiStatus = await checkApiKeys();
        showInitializationProgress('API ключи проверены', 50);
        
        // 6. Загрузка групп (если есть API ключи)
        if (apiStatus.hasKeys) {
            await loadGroups();
            showInitializationProgress('Группы загружены', 70);
        }
        
        // 7. Инициализация модулей
        await initializeModules();
        showInitializationProgress('Модули инициализированы', 80);
        
        // 8. Загрузка пользовательских данных
        await loadUserData();
        showInitializationProgress('Данные пользователя загружены', 90);
        
        // 9. Финализация
        finalizeInitialization();
        showInitializationProgress('Инициализация завершена', 100);
        
        // Скрываем индикатор загрузки
        hideInitializationProgress();
        
        console.log('✅ Message Hunter успешно инициализирован');
        
        // Показываем приветственное сообщение
        showWelcomeMessage();
        
    } catch (error) {
        console.error('❌ Критическая ошибка инициализации:', error);
        handleInitializationError(error);
    }
}

/**
 * Проверка загрузки всех необходимых модулей
 */
async function checkModulesLoaded() {
    console.log('🔍 Проверяем загрузку модулей...');
    
    const missingModules = [];
    
    // Проверяем обязательные модули
    INIT_CONFIG.REQUIRED_MODULES.forEach(moduleName => {
        if (!window[moduleName]) {
            missingModules.push(moduleName);
        }
    });
    
    if (missingModules.length > 0) {
        throw new Error(`Отсутствуют критичные модули: ${missingModules.join(', ')}`);
    }
    
    // Проверяем опциональные модули
    const loadedOptional = [];
    INIT_CONFIG.OPTIONAL_MODULES.forEach(moduleName => {
        if (window[moduleName]) {
            loadedOptional.push(moduleName);
        }
    });
    
    console.log(`✅ Загружены модули: ${INIT_CONFIG.REQUIRED_MODULES.length} обязательных, ${loadedOptional.length} дополнительных`);
    INIT_CONFIG.INIT_FLAGS.modulesLoaded = true;
}

/**
 * Очистка поврежденных данных
 */
function cleanupCorruptedData() {
    console.log('🧹 Очищаем поврежденные данные...');
    
    if (window.DataManager && window.DataManager.cleanupCorruptedData) {
        window.DataManager.cleanupCorruptedData();
    }
    
    // Дополнительная очистка специфичных ключей
    const keysToCheck = [
        'message_hunter_temp_data',
        'message_hunter_debug_info',
        'message_hunter_old_version_data'
    ];
    
    keysToCheck.forEach(key => {
        try {
            const data = localStorage.getItem(key);
            if (data) {
                localStorage.removeItem(key);
                console.log(`🗑️ Удален устаревший ключ: ${key}`);
            }
        } catch (e) {
            // Игнорируем ошибки
        }
    });
}

/**
 * Обработка параметров URL
 */
function handleUrlParameters() {
    console.log('🔗 Обрабатываем параметры URL...');
    
    const urlParams = new URLSearchParams(window.location.search);
    
    // Проверка смены аккаунта
    if (urlParams.get('refresh_groups') === 'true') {
        console.log('🔄 Обнаружена смена аккаунта, потребуется обновление групп');
        
        // Очищаем кэш групп
        if (window.DataManager && window.DataManager.GroupsCache) {
            window.DataManager.GroupsCache.clear();
        }
        
        // Очищаем URL от параметра
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Проверка режима отладки
    if (urlParams.get('debug') === 'true') {
        window.DEBUG_MODE = true;
        console.log('🐛 Активирован режим отладки');
    }
    
    // Проверка принудительного обновления
    if (urlParams.get('force_refresh') === 'true') {
        localStorage.clear();
        console.log('🔄 Выполнена принудительная очистка данных');
        window.location.href = window.location.pathname;
        return;
    }
}

/**
 * Восстановление состояния вкладок
 */
async function restoreTabState() {
    console.log('📑 Восстанавливаем состояние вкладок...');
    
    const savedTab = localStorage.getItem('activeTab') || 'search';
    console.log(`🔄 Восстанавливаем вкладку: ${savedTab}`);
    
    // Убираем все активные классы
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Переключаемся на сохраненную вкладку
    if (window.TabManager && window.TabManager.switchTab) {
        // Небольшая задержка для корректного отображения
        setTimeout(() => {
            window.TabManager.switchTab(savedTab);
        }, 100);
    }
}

/**
 * Проверка API ключей
 */
async function checkApiKeys() {
    console.log('🔑 Проверяем API ключи...');
    
    try {
        const response = await fetch('/check_api_keys');
        const data = await response.json();
        
        if (data.has_keys) {
            console.log('✅ API ключи найдены');
            
            // Скрываем модальное окно настроек
            const modal = document.getElementById('apiKeysModal');
            if (modal) {
                modal.style.display = 'none';
            }
            
            INIT_CONFIG.INIT_FLAGS.apiKeysChecked = true;
            return { hasKeys: true, data };
        } else {
            console.log('⚠️ API ключи не найдены');
            
            // Показываем модальное окно настроек
            const modal = document.getElementById('apiKeysModal');
            if (modal) {
                modal.style.display = 'block';
            }
            
            return { hasKeys: false, data };
        }
    } catch (error) {
        console.error('❌ Ошибка проверки API ключей:', error);
        return { hasKeys: false, error };
    }
}

/**
 * Загрузка групп
 */
async function loadGroups() {
    console.log('📋 Загружаем группы...');
    
    try {
        if (window.GroupsManager && window.GroupsManager.loadGroups) {
            await window.GroupsManager.loadGroups();
            INIT_CONFIG.INIT_FLAGS.groupsLoaded = true;
            console.log('✅ Группы успешно загружены');
        } else {
            console.warn('⚠️ GroupsManager не доступен');
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки групп:', error);
        if (window.UIUtils && window.UIUtils.showToast) {
            window.UIUtils.showToast('⚠️ Не удалось загрузить группы', 'warning');
        }
    }
}

/**
 * Инициализация всех модулей
 */
async function initializeModules() {
    console.log('🔧 Инициализируем модули...');
    
    const moduleInitOrder = [
        'APIClient',
        'SearchManager',
        'AutoSearchManager',
        'BroadcastManager',
        'HistoryManager',
        'AIManager',
        'AccountManager'
    ];
    
    for (const moduleName of moduleInitOrder) {
        try {
            const module = window[moduleName];
            if (module && typeof module.init === 'function') {
                console.log(`🔧 Инициализируем ${moduleName}...`);
                await module.init();
                console.log(`✅ ${moduleName} инициализирован`);
            } else {
                console.log(`⚪ ${moduleName} не найден или не требует инициализации`);
            }
        } catch (error) {
            console.error(`❌ Ошибка инициализации ${moduleName}:`, error);
        }
    }
}

/**
 * Загрузка пользовательских данных
 */
async function loadUserData() {
    console.log('👤 Загружаем данные пользователя...');
    
    try {
        // Загружаем информацию об аккаунте
        if (window.AccountManager) {
            if (window.AccountManager.loadAccountInfo) {
                await window.AccountManager.loadAccountInfo();
            }
            if (window.AccountManager.updateAccountDisplay) {
                window.AccountManager.updateAccountDisplay();
            }
        }
        
        // Загружаем историю поиска
        if (window.HistoryManager && window.HistoryManager.loadHistory) {
            window.HistoryManager.loadHistory();
        }
        
        // Проверяем статус автопоиска
        if (window.AutoSearchManager && window.AutoSearchManager.checkServerStatus) {
            window.AutoSearchManager.checkServerStatus();
        }
        
        INIT_CONFIG.INIT_FLAGS.accountLoaded = true;
        console.log('✅ Данные пользователя загружены');
        
    } catch (error) {
        console.error('❌ Ошибка загрузки данных пользователя:', error);
    }
}

/**
 * Финализация инициализации
 */
function finalizeInitialization() {
    console.log('🎯 Финализируем инициализацию...');
    
    // Устанавливаем глобальные обработчики событий
    setupGlobalEventHandlers();
    
    // Запускаем периодические задачи
    startPeriodicTasks();
    
    // Проверяем обновления
    checkForUpdates();
    
    // Отмечаем приложение как готовое
    INIT_CONFIG.INIT_FLAGS.ready = true;
    window.MessageHunter.ready = true;
    
    // Диспатчим событие готовности
    window.dispatchEvent(new CustomEvent('messageHunterReady', {
        detail: {
            version: window.MessageHunter.version,
            buildDate: window.MessageHunter.buildDate,
            modules: INIT_CONFIG.REQUIRED_MODULES.concat(INIT_CONFIG.OPTIONAL_MODULES).filter(m => window[m])
        }
    }));
    
    console.log('🎉 Message Hunter готов к работе!');
}

/**
 * Настройка глобальных обработчиков событий
 */
function setupGlobalEventHandlers() {
    console.log('🎯 Настраиваем глобальные обработчики...');
    
    // Обработчик закрытия страницы
    window.addEventListener('beforeunload', function(e) {
        console.log('🚪 Приложение закрывается...');
        
        // Останавливаем активные поиски
        if (window.MessageHunter.searchAbortController) {
            window.MessageHunter.searchAbortController.abort();
        }
        
        // Останавливаем автопоиск
        if (window.AutoSearchManager && window.AutoSearchManager.stopPolling) {
            window.AutoSearchManager.stopPolling();
        }
        
        // Отменяем активные API запросы
        if (window.APIClient && window.APIClient.cancelAllRequests) {
            window.APIClient.cancelAllRequests();
        }
    });
    
    // Обработчик ошибок JavaScript
    window.addEventListener('error', function(e) {
        console.error('💥 Глобальная ошибка JavaScript:', e.error);
        
        if (window.UIUtils && window.UIUtils.showToast) {
            window.UIUtils.showToast('⚠️ Произошла ошибка в приложении', 'error');
        }
    });
    
    // Обработчик необработанных Promise
    window.addEventListener('unhandledrejection', function(e) {
        console.error('💥 Необработанный Promise rejection:', e.reason);
        e.preventDefault(); // Предотвращаем вывод в консоль браузера
    });
    
    // Обработчик изменения состояния сети
    window.addEventListener('online', function() {
        console.log('🌐 Соединение восстановлено');
        if (window.UIUtils && window.UIUtils.showToast) {
            window.UIUtils.showToast('🌐 Соединение восстановлено', 'success');
        }
    });
    
    window.addEventListener('offline', function() {
        console.log('📵 Соединение потеряно');
        if (window.UIUtils && window.UIUtils.showToast) {
            window.UIUtils.showToast('📵 Нет соединения с интернетом', 'warning');
        }
    });
    
    // Обработчик изменения видимости вкладки
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            console.log('👁️ Вкладка скрыта');
        } else {
            console.log('👁️ Вкладка показана');
            // Проверяем статус при возвращении на вкладку
            if (window.AutoSearchManager && window.AutoSearchManager.checkServerStatus) {
                window.AutoSearchManager.checkServerStatus();
            }
        }
    });
}

/**
 * Запуск периодических задач
 */
function startPeriodicTasks() {
    console.log('⏰ Запускаем периодические задачи...');
    
    // Очистка кэша каждые 30 минут
    setInterval(() => {
        if (window.APIClient && window.APIClient.Cache && window.APIClient.Cache.clear) {
            const stats = window.APIClient.Cache.stats();
            if (stats.expired > 0) {
                console.log(`🧹 Очищаем ${stats.expired} устаревших записей кэша`);
                window.APIClient.Cache.clear();
            }
        }
    }, 30 * 60 * 1000);
    
    // Проверка соединения каждые 5 минут
    setInterval(() => {
        if (window.APIClient && window.APIClient.checkConnection) {
            window.APIClient.checkConnection().then(online => {
                if (!online) {
                    console.warn('⚠️ Проблемы с соединением с сервером');
                }
            });
        }
    }, 5 * 60 * 1000);
    
    // Сохранение состояния каждые 10 минут
    setInterval(() => {
        try {
            // Сохраняем ключевые слова поиска
            if (window.SearchManager && window.SearchManager.saveKeywords) {
                window.SearchManager.saveKeywords();
            }
            
            // Сохраняем состояние автопоиска
            if (window.AutoSearchManager && window.AutoSearchManager.saveState) {
                window.AutoSearchManager.saveState();
            }
            
            console.log('💾 Состояние приложения сохранено');
        } catch (error) {
            console.error('❌ Ошибка сохранения состояния:', error);
        }
    }, 10 * 60 * 1000);
}

/**
 * Проверка обновлений приложения
 */
function checkForUpdates() {
    console.log('🔄 Проверяем обновления...');
    
    // Проверяем версию на сервере
    fetch('/get_app_version', { 
        method: 'GET',
        cache: 'no-cache'
    })
    .then(response => response.json())
    .then(data => {
        if (data.version && data.version !== window.MessageHunter.version) {
            console.log(`🆕 Доступно обновление: ${data.version}`);
            
            if (window.UIUtils && window.UIUtils.showToast) {
                window.UIUtils.showToast(
                    `🆕 Доступна новая версия: ${data.version}. Обновите страницу.`, 
                    'info'
                );
            }
        }
    })
    .catch(error => {
        // Игнорируем ошибки проверки обновлений
        console.log('ℹ️ Не удалось проверить обновления');
    });
}

/**
 * Показ индикатора инициализации
 */
function showInitializationProgress(message, progress) {
    let progressBar = document.getElementById('initProgressBar');
    let progressText = document.getElementById('initProgressText');
    
    if (!progressBar) {
        // Создаем индикатор если его нет
        const overlay = document.createElement('div');
        overlay.id = 'initOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.95);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        overlay.innerHTML = `
            <div style="text-align: center; max-width: 400px; padding: 40px;">
                <div style="font-size: 48px; margin-bottom: 20px;">🚀</div>
                <h2 style="color: #333; margin-bottom: 10px;">Message Hunter</h2>
                <p id="initProgressText" style="color: #666; margin-bottom: 20px;">${message}</p>
                <div style="width: 300px; height: 6px; background: #f0f0f0; border-radius: 3px; overflow: hidden;">
                    <div id="initProgressBar" style="height: 100%; background: linear-gradient(90deg, #007bff, #28a745); width: ${progress}%; transition: width 0.3s ease;"></div>
                </div>
                <div style="margin-top: 10px; font-size: 12px; color: #999;">v${window.MessageHunter.version}</div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        progressBar = document.getElementById('initProgressBar');
        progressText = document.getElementById('initProgressText');
    }
    
    if (progressBar) {
        progressBar.style.width = progress + '%';
    }
    
    if (progressText) {
        progressText.textContent = message;
    }
}

/**
 * Скрытие индикатора инициализации
 */
function hideInitializationProgress() {
    const overlay = document.getElementById('initOverlay');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.remove();
        }, 300);
    }
}

/**
 * Показ приветственного сообщения
 */
function showWelcomeMessage() {
    // Проверяем, первый ли это запуск
    const isFirstRun = !localStorage.getItem('message_hunter_first_run');
    
    if (isFirstRun) {
        localStorage.setItem('message_hunter_first_run', 'false');
        
        setTimeout(() => {
            if (window.UIUtils && window.UIUtils.showToast) {
                window.UIUtils.showToast(
                    '🎉 Добро пожаловать в Message Hunter! Начните с настройки API ключей.',
                    'success'
                );
            }
        }, 1000);
    }
}

/**
 * Обработка ошибок инициализации
 */
function handleInitializationError(error) {
    console.error('💥 Критическая ошибка инициализации:', error);
    
    // Скрываем индикатор загрузки
    hideInitializationProgress();
    
    // Показываем экран ошибки
    const errorScreen = document.createElement('div');
    errorScreen.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #fff;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 10001;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    errorScreen.innerHTML = `
        <div style="text-align: center; max-width: 500px; padding: 40px;">
            <div style="font-size: 64px; margin-bottom: 20px;">💥</div>
            <h2 style="color: #dc3545; margin-bottom: 15px;">Ошибка инициализации</h2>
            <p style="color: #666; margin-bottom: 20px; line-height: 1.5;">
                Произошла критическая ошибка при загрузке приложения. 
                Попробуйте обновить страницу или очистить данные браузера.
            </p>
            <details style="text-align: left; margin-bottom: 20px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                <summary style="cursor: pointer; font-weight: bold;">Техническая информация</summary>
                <pre style="margin-top: 10px; font-size: 12px; color: #dc3545;">${error.message}\n\n${error.stack}</pre>
            </details>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button onclick="window.location.reload()" style="
                    background: #007bff; 
                    color: white; 
                    border: none; 
                    padding: 10px 20px; 
                    border-radius: 5px; 
                    cursor: pointer;
                ">
                    🔄 Обновить страницу
                </button>
                <button onclick="localStorage.clear(); window.location.reload()" style="
                    background: #dc3545; 
                    color: white; 
                    border: none; 
                    padding: 10px 20px; 
                    border-radius: 5px; 
                    cursor: pointer;
                ">
                    🗑️ Очистить данные
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(errorScreen);
}

/**
 * Получение информации о состоянии приложения
 */
function getAppStatus() {
    return {
        ready: INIT_CONFIG.INIT_FLAGS.ready,
        version: window.MessageHunter.version,
        buildDate: window.MessageHunter.buildDate,
        flags: INIT_CONFIG.INIT_FLAGS,
        modules: {
            loaded: INIT_CONFIG.REQUIRED_MODULES.concat(INIT_CONFIG.OPTIONAL_MODULES)
                .filter(m => window[m]).length,
            total: INIT_CONFIG.REQUIRED_MODULES.length + INIT_CONFIG.OPTIONAL_MODULES.length
        },
        performance: {
            groups: window.MessageHunter.allGroups.length,
            keywords: window.MessageHunter.keywords.length,
            results: window.MessageHunter.allSearchResults.length
        }
    };
}

// Экспорт функций в глобальную область
window.initializeApp = initializeApp;
window.getAppStatus = getAppStatus;

// Автоматическая инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM загружен, ожидаем загрузки модулей...');
    
    // Ждем загрузки всех модулей перед инициализацией
    setTimeout(() => {
        console.log('🔄 Запускаем инициализацию приложения...');
        initializeApp();
    }, INIT_CONFIG.MODULE_LOAD_TIMEOUT);
});

// Дополнительные глобальные утилиты
window.DEBUG_MODE = false;

console.log('✅ AppInit модуль загружен и готов к инициализации');