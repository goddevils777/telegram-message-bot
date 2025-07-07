// ===============================
// УПРАВЛЕНИЕ ДАННЫМИ И ЛОКАЛЬНЫМ ХРАНИЛИЩЕМ
// static/js/data-manager.js
// ===============================

window.DataManager = {
    
    // Ключи для localStorage
    STORAGE_KEYS: {
        GROUPS_CACHE: 'message_hunter_groups_cache',
        SELECTED_GROUPS: 'message_hunter_selected_groups',
        AUTOSEARCH_GROUPS: 'message_hunter_autosearch_groups',
        AUTOSEARCH_RESULTS: 'message_hunter_autosearch_results',
        AUTOSEARCH_KEYWORDS: 'message_hunter_autosearch_keywords',
        BROADCAST_GROUPS: 'message_hunter_broadcast_groups',
        SEARCH_RESULTS: 'message_hunter_search_results',
        ACTIVE_TAB: 'activeTab'
    },
    
    /**
     * Очистка поврежденных данных из localStorage
     */
    cleanupCorruptedData: function() {
        console.log('🧹 Очищаем поврежденные данные...');
        
        const keysToCheck = Object.values(this.STORAGE_KEYS);
        
        keysToCheck.forEach(key => {
            try {
                const data = localStorage.getItem(key);
                if (data) {
                    JSON.parse(data); // Проверяем валидность JSON
                    console.log(`✅ ${key} - данные валидны`);
                }
            } catch (e) {
                console.log(`🗑️ Удаляем поврежденные данные: ${key}`);
                localStorage.removeItem(key);
            }
        });
    },
    
    /**
     * Сохранение данных в localStorage с временной меткой
     * @param {string} key - Ключ для сохранения
     * @param {any} data - Данные для сохранения
     * @param {number} ttl - Время жизни в миллисекундах (опционально)
     */
    save: function(key, data, ttl = null) {
        try {
            const item = {
                data: data,
                timestamp: Date.now(),
                expires_at: ttl ? Date.now() + ttl : null
            };
            
            localStorage.setItem(key, JSON.stringify(item));
            console.log(`💾 Сохранено в ${key}:`, typeof data === 'object' ? Object.keys(data).length : data);
            return true;
        } catch (e) {
            console.error(`❌ Ошибка сохранения ${key}:`, e);
            return false;
        }
    },
    
    /**
     * Загрузка данных из localStorage с проверкой срока действия
     * @param {string} key - Ключ для загрузки
     */
    load: function(key) {
        try {
            const stored = localStorage.getItem(key);
            if (!stored) return null;
            
            const item = JSON.parse(stored);
            
            // Проверяем срок действия
            if (item.expires_at && Date.now() > item.expires_at) {
                console.log(`⏰ Данные ${key} истекли`);
                localStorage.removeItem(key);
                return null;
            }
            
            console.log(`📂 Загружено из ${key}`);
            return item.data;
        } catch (e) {
            console.error(`❌ Ошибка загрузки ${key}:`, e);
            localStorage.removeItem(key);
            return null;
        }
    },
    
    /**
     * Управление кэшем групп
     */
    GroupsCache: {
        save: function(groups) {
            const ttl = 24 * 60 * 60 * 1000; // 24 часа
            return window.DataManager.save(
                window.DataManager.STORAGE_KEYS.GROUPS_CACHE, 
                { groups: groups }, 
                ttl
            );
        },
        
        load: function() {
            const cached = window.DataManager.load(window.DataManager.STORAGE_KEYS.GROUPS_CACHE);
            return cached ? cached.groups : null;
        },
        
        clear: function() {
            localStorage.removeItem(window.DataManager.STORAGE_KEYS.GROUPS_CACHE);
            console.log('🗑️ Кэш групп очищен');
        }
    },
    
    /**
     * Управление выбранными группами
     */
    SelectedGroups: {
        save: function(groups, type = 'search') {
            const keyMap = {
                search: window.DataManager.STORAGE_KEYS.SELECTED_GROUPS,
                autosearch: window.DataManager.STORAGE_KEYS.AUTOSEARCH_GROUPS,
                broadcast: window.DataManager.STORAGE_KEYS.BROADCAST_GROUPS
            };
            
            const key = keyMap[type];
            if (!key) {
                console.error('❌ Неизвестный тип групп:', type);
                return false;
            }
            
            const ttl = 7 * 24 * 60 * 60 * 1000; // 7 дней
            return window.DataManager.save(key, { groups: groups }, ttl);
        },
        
        load: function(type = 'search') {
            const keyMap = {
                search: window.DataManager.STORAGE_KEYS.SELECTED_GROUPS,
                autosearch: window.DataManager.STORAGE_KEYS.AUTOSEARCH_GROUPS,
                broadcast: window.DataManager.STORAGE_KEYS.BROADCAST_GROUPS
            };
            
            const key = keyMap[type];
            if (!key) {
                console.error('❌ Неизвестный тип групп:', type);
                return [];
            }
            
            const data = window.DataManager.load(key);
            return data ? data.groups : [];
        }
    },
    
    /**
     * Управление результатами автопоиска
     */
    AutoSearchResults: {
        save: function(messages, keywords = []) {
            const data = {
                messages: messages,
                keywords: keywords,
                total: messages.length
            };
            
            const ttl = 24 * 60 * 60 * 1000; // 24 часа
            return window.DataManager.save(
                window.DataManager.STORAGE_KEYS.AUTOSEARCH_RESULTS, 
                data, 
                ttl
            );
        },
        
        load: function() {
            return window.DataManager.load(window.DataManager.STORAGE_KEYS.AUTOSEARCH_RESULTS);
        },
        
        clear: function() {
            localStorage.removeItem(window.DataManager.STORAGE_KEYS.AUTOSEARCH_RESULTS);
            console.log('🗑️ Результаты автопоиска очищены');
        }
    },
    
    /**
     * Управление результатами поиска
     */
    SearchResults: {
        save: function(results, keywords, groupsCount, aiResults = null) {
            const data = {
                results: results,
                keywords: keywords,
                groups_count: groupsCount,
                ai_results: aiResults
            };
            
            const ttl = 24 * 60 * 60 * 1000; // 24 часа
            return window.DataManager.save(
                window.DataManager.STORAGE_KEYS.SEARCH_RESULTS, 
                data, 
                ttl
            );
        },
        
        load: function() {
            return window.DataManager.load(window.DataManager.STORAGE_KEYS.SEARCH_RESULTS);
        },
        
        clear: function() {
            localStorage.removeItem(window.DataManager.STORAGE_KEYS.SEARCH_RESULTS);
            console.log('🗑️ Результаты поиска очищены');
        }
    },
    
    /**
     * Получить информацию о размере хранилища
     */
    getStorageInfo: function() {
        let totalSize = 0;
        const items = {};
        
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                const size = localStorage[key].length;
                totalSize += size;
                items[key] = {
                    size: size,
                    sizeKB: Math.round(size / 1024 * 100) / 100
                };
            }
        }
        
        return {
            totalSize: totalSize,
            totalSizeKB: Math.round(totalSize / 1024 * 100) / 100,
            totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
            items: items,
            itemsCount: Object.keys(items).length
        };
    },
    
    /**
     * Очистка старых данных
     */
    cleanup: function() {
        console.log('🧹 Запуск очистки старых данных...');
        
        const keysToCleanup = Object.values(this.STORAGE_KEYS);
        let cleanedCount = 0;
        
        keysToCleanup.forEach(key => {
            try {
                const stored = localStorage.getItem(key);
                if (stored) {
                    const item = JSON.parse(stored);
                    
                    // Проверяем срок действия
                    if (item.expires_at && Date.now() > item.expires_at) {
                        localStorage.removeItem(key);
                        cleanedCount++;
                        console.log(`🗑️ Удален устаревший ключ: ${key}`);
                    }
                }
            } catch (e) {
                localStorage.removeItem(key);
                cleanedCount++;
                console.log(`🗑️ Удален поврежденный ключ: ${key}`);
            }
        });
        
        console.log(`✅ Очистка завершена, удалено ${cleanedCount} ключей`);
        return cleanedCount;
    },
    
    /**
     * Экспорт всех данных приложения
     */
    exportData: function() {
        const data = {};
        const keys = Object.values(this.STORAGE_KEYS);
        
        keys.forEach(key => {
            const value = this.load(key);
            if (value !== null) {
                data[key] = value;
            }
        });
        
        return {
            exported_at: new Date().toISOString(),
            version: '1.0',
            data: data
        };
    },
    
    /**
     * Импорт данных приложения
     */
    importData: function(importedData) {
        if (!importedData.data) {
            console.error('❌ Неверный формат данных для импорта');
            return false;
        }
        
        let importedCount = 0;
        
        Object.entries(importedData.data).forEach(([key, value]) => {
            if (Object.values(this.STORAGE_KEYS).includes(key)) {
                if (this.save(key, value)) {
                    importedCount++;
                }
            }
        });
        
        console.log(`✅ Импортировано ${importedCount} элементов`);
        return importedCount;
    }
};

console.log('✅ DataManager модуль загружен');