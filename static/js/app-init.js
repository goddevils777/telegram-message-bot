// ===============================
// ГЛАВНАЯ ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// static/js/app-init.js
// ===============================

// Глобальные переменные состояния приложения
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
    lastNotificationCount: 0
};

// Основная функция инициализации приложения
async function initializeApp() {
    console.log('🚀 Инициализация Message Hunter...');
    
    try {
        // 1. Очистка поврежденных данных
        if (window.DataManager) {
            window.DataManager.cleanupCorruptedData();
        }
        
        // 2. Проверка смены аккаунта
        const urlParams = new URLSearchParams(window.location.search);
        const needRefresh = urlParams.get('refresh_groups') === 'true';
        
        if (needRefresh) {
            console.log('🔄 Обнаружена смена аккаунта');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        
        // 3. Восстановление активной вкладки
        const savedTab = localStorage.getItem('activeTab') || 'search';
        console.log(`🔄 Восстанавливаем вкладку: ${savedTab}`);
        
        // Убираем все активные классы
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // 4. Переключение на нужную вкладку
        if (window.TabManager) {
            window.TabManager.switchTab(savedTab);
        }
        
        // 5. Проверка API ключей и загрузка групп
        const apiResponse = await fetch('/check_api_keys');
        const apiData = await apiResponse.json();
        
        if (apiData.has_keys) {
            const modal = document.getElementById('apiKeysModal');
            if (modal) modal.style.display = 'none';
            
            if (!needRefresh && window.GroupsManager) {
                await window.GroupsManager.loadGroups();
            }
            
            if (window.HistoryManager) {
                window.HistoryManager.loadHistory();
            }
        } else {
            const modal = document.getElementById('apiKeysModal');
            if (modal) modal.style.display = 'block';
        }
        
        // 6. Дополнительная инициализация
        if (window.AccountManager) {
            window.AccountManager.loadAccountInfo();
            window.AccountManager.updateAccountDisplay();
        }
        
        if (window.AutoSearchManager) {
            window.AutoSearchManager.checkStatus();
        }
        
        console.log('✅ Инициализация завершена успешно');
        
    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
        if (window.UIUtils) {
            window.UIUtils.showToast('❌ Ошибка инициализации приложения', 'error');
        }
    }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM загружен, ожидаем загрузки модулей...');
    
    // Ждем загрузки всех модулей перед инициализацией
    setTimeout(() => {
        console.log('🔄 Запускаем инициализацию приложения...');
        initializeApp();
    }, 500);
});

// Остановка поиска при обновлении страницы
window.addEventListener('beforeunload', function() {
    if (window.MessageHunter.searchAbortController) {
        window.MessageHunter.searchAbortController.abort();
    }
});

// Экспорт главной функции инициализации
window.initializeApp = initializeApp;