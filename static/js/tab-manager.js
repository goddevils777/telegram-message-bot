// ===============================
// УПРАВЛЕНИЕ ВКЛАДКАМИ
// static/js/tab-manager.js
// ===============================

window.TabManager = {
    
    /**
     * Переключение между вкладками
     * @param {string} tabName - Имя вкладки для активации
     */
    switchTab: function(tabName) {
        console.log(`🔄 Переключаемся на вкладку: ${tabName}`);
        
        // Убираем активные классы
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Сохраняем активную вкладку
        localStorage.setItem('activeTab', tabName);
        
        // Обработка скрытой вкладки автопоиска
        if (tabName === 'autosearch') {
            const targetContent = document.getElementById('autosearch-tab');
            if (!targetContent) {
                console.error(`❌ Не найдена вкладка autosearch-tab`);
                return;
            }
            targetContent.classList.add('active');
            
            setTimeout(() => {
                this.initAutoSearchTab();
            }, 100);
            
            console.log(`✅ Активирована скрытая вкладка: autosearch`);
            return;
        }
        
        // Обычные вкладки
        const targetTab = document.querySelector(`[onclick="switchTab('${tabName}')"]`);
        const targetContent = document.getElementById(`${tabName}-tab`);
        
        if (!targetContent) {
            console.error(`❌ Не найдена вкладка с ID: ${tabName}-tab`);
            return;
        }
        
        // Добавляем активные классы
        if (targetTab) {
            targetTab.classList.add('active');
        }
        targetContent.classList.add('active');
        
        // Инициализация данных для конкретных вкладок
        this.initTabData(tabName);
        
        console.log(`✅ Переключились на вкладку: ${tabName}`);
    },
    
    /**
     * Инициализация данных для вкладки
     * @param {string} tabName - Имя вкладки
     */
    initTabData: function(tabName) {
        switch(tabName) {
            case 'search':
                this.initSearchTab();
                break;
            case 'broadcast':
                this.initBroadcastTab();
                break;
            case 'accounts':
                this.initAccountsTab();
                break;
            case 'history':
                this.initHistoryTab();
                break;
        }
    },
    
    /**
     * Инициализация вкладки поиска
     */
    initSearchTab: function() {
        console.log('🔍 Инициализация вкладки поиска');
        
        if (window.AccountManager) {
            window.AccountManager.updateAccountDisplay();
        }
        
        // Восстанавливаем выбранные группы
        if (window.GroupsManager) {
            window.GroupsManager.restoreSelections('search');
        }
        
        // Восстанавливаем сохраненные результаты поиска
        this.restoreSavedSearchResults();
    },
    
    /**
     * Инициализация вкладки рассылки
     */
    initBroadcastTab: function() {
        console.log('📤 Инициализация вкладки рассылки');
        
        if (window.MessageHunter.allGroups.length > 0) {
            if (window.BroadcastManager) {
                window.BroadcastManager.displayGroups();
                window.BroadcastManager.setDefaultDateTime();
                window.BroadcastManager.loadTasks();
            }
        }
        
        if (window.AccountManager) {
            window.AccountManager.updateAccountDisplay();
        }
    },
    
    /**
     * Инициализация вкладки аккаунтов
     */
    initAccountsTab: function() {
        console.log('👥 Инициализация вкладки аккаунтов');
        
        if (window.AccountManager) {
            window.AccountManager.loadMultiAccounts();
        }
    },
    
    /**
     * Инициализация вкладки истории
     */
    initHistoryTab: function() {
        console.log('📋 Инициализация вкладки истории');
        
        if (window.HistoryManager) {
            window.HistoryManager.loadHistory();
        }
    },
    
    /**
     * Инициализация вкладки автопоиска
     */
    initAutoSearchTab: function() {
        console.log('⚡ Инициализация вкладки автопоиска');
        
        if (window.AutoSearchManager) {
            window.AutoSearchManager.loadGroups();
            window.AutoSearchManager.loadSavedResults();
            window.AutoSearchManager.updateAccountInfo();
            window.AutoSearchManager.checkStatus();
        }
    },
    
    /**
     * Открытие вкладки автопоиска (специальная функция)
     */
    openAutoSearchTab: function() {
        console.log('⚡ Открываем вкладку автопоиска');
        localStorage.setItem('activeTab', 'autosearch');
        this.switchTab('autosearch');
    },
    
    /**
     * Получение активной вкладки
     */
    getActiveTab: function() {
        return localStorage.getItem('activeTab') || 'search';
    },
    
    /**
     * Проверка является ли вкладка активной
     * @param {string} tabName - Имя вкладки
     */
    isTabActive: function(tabName) {
        return this.getActiveTab() === tabName;
    },
    
    /**
     * Восстановление сохраненных результатов поиска
     */
    restoreSavedSearchResults: function() {
        if (!window.DataManager) return;
        
        const savedData = window.DataManager.SearchResults.load();
        if (!savedData) return;
        
        console.log('🔄 Восстанавливаю сохраненные результаты поиска...');
        
        // Восстанавливаем ключевые слова
        if (savedData.keywords && window.SearchManager) {
            window.MessageHunter.keywords = savedData.keywords.slice();
            window.SearchManager.updateKeywordsDisplay();
        }
        
        // Восстанавливаем результаты поиска
        if (savedData.results && savedData.results.length > 0) {
            window.MessageHunter.lastSearchResults = {
                keywords: savedData.keywords,
                results: savedData.results,
                groups_count: savedData.groups_count
            };
            
            if (window.SearchManager) {
                window.SearchManager.showResults(savedData.results, savedData.keywords.join(', '));
                
                // Показываем кнопки
                window.UIUtils.safeToggleElement('saveBtn', true);
                window.UIUtils.safeToggleElement('analyzeBtn', true);
                window.UIUtils.safeToggleElement('clearBtn', true);
            }
        }
        
        // Восстанавливаем AI результаты
        if (savedData.ai_results && window.SearchManager) {
            window.SearchManager.showAIResults(
                savedData.ai_results.potential_clients, 
                savedData.ai_results.analyzed_count
            );
        }
        
        console.log('✅ Результаты поиска восстановлены');
    },
    
    /**
     * Обработка событий для вкладок
     */
    initEventHandlers: function() {
        // Обработчик для кликов по вкладкам
        document.addEventListener('click', (e) => {
            const tab = e.target.closest('.tab');
            if (tab && tab.onclick) {
                // Получаем имя вкладки из onclick
                const onclickStr = tab.onclick.toString();
                const match = onclickStr.match(/switchTab\(['"]([^'"]+)['"]\)/);
                if (match) {
                    const tabName = match[1];
                    this.switchTab(tabName);
                }
            }
        });
        
        console.log('✅ Обработчики вкладок инициализированы');
    },
    
    /**
     * Проверка существования всех необходимых вкладок
     */
    validateTabs: function() {
        const requiredTabs = [
            'search-tab', 
            'broadcast-tab', 
            'history-tab', 
            'autosearch-tab',
            'accounts-tab'
        ];
        
        const missingTabs = [];
        
        requiredTabs.forEach(tabId => {
            const tab = document.getElementById(tabId);
            if (!tab) {
                console.error(`❌ Отсутствует вкладка: ${tabId}`);
                missingTabs.push(tabId);
            } else {
                console.log(`✅ Найдена вкладка: ${tabId}`);
            }
        });
        
        if (missingTabs.length > 0) {
            console.error(`❌ Отсутствуют вкладки: ${missingTabs.join(', ')}`);
            return false;
        }
        
        console.log('✅ Все вкладки найдены');
        return true;
    }
};

// Глобальные функции для обратной совместимости
window.switchTab = window.TabManager.switchTab.bind(window.TabManager);
window.openAutoSearchTab = window.TabManager.openAutoSearchTab.bind(window.TabManager);

// Инициализация обработчиков при загрузке
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        window.TabManager.initEventHandlers();
        window.TabManager.validateTabs();
    }, 100);
});

console.log('✅ TabManager модуль загружен');