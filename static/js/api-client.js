// ===============================
// API КЛИЕНТ
// static/js/api-client.js
// ===============================

window.APIClient = {
    
    // Конфигурация
    config: {
        baseUrl: '',
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000
    },
    
    // Активные запросы
    activeRequests: new Map(),
    
    /**
     * Инициализация API клиента
     */
    init: function() {
        console.log('🌐 Инициализация APIClient...');
        
        // Устанавливаем базовый URL
        this.config.baseUrl = window.location.origin;
        
        console.log('✅ APIClient инициализирован');
    },
    
    /**
     * Базовый метод для выполнения HTTP запросов
     * @param {string} method - HTTP метод
     * @param {string} url - URL для запроса
     * @param {Object} options - Опции запроса
     * @returns {Promise} Promise с результатом запроса
     */
    request: async function(method, url, options = {}) {
        const {
            data = null,
            headers = {},
            timeout = this.config.timeout,
            retries = this.config.retryAttempts,
            signal = null
        } = options;
        
        // Создаем уникальный ID запроса
        const requestId = window.Utils.StringUtils.generateId();
        
        // Создаем AbortController если не передан
        const abortController = signal ? null : new AbortController();
        const requestSignal = signal || abortController.signal;
        
        // Настройки fetch
        const fetchOptions = {
            method: method.toUpperCase(),
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            signal: requestSignal
        };
        
        // Добавляем данные для POST/PUT/PATCH
        if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
            fetchOptions.body = JSON.stringify(data);
        }
        
        // Полный URL
        const fullUrl = url.startsWith('http') ? url : `${this.config.baseUrl}${url}`;
        
        // Логируем запрос
        console.log(`🌐 ${method.toUpperCase()} ${url}`, data ? data : '');
        
        // Сохраняем активный запрос
        this.activeRequests.set(requestId, {
            url: fullUrl,
            method,
            startTime: Date.now(),
            abortController
        });
        
        let lastError = null;
        
        // Попытки с повторами
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                // Таймаут для запроса
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Request timeout')), timeout);
                });
                
                // Выполняем запрос
                const response = await Promise.race([
                    fetch(fullUrl, fetchOptions),
                    timeoutPromise
                ]);
                
                // Удаляем из активных запросов
                this.activeRequests.delete(requestId);
                
                // Обрабатываем ответ
                const result = await this.handleResponse(response, url);
                
                // Логируем успешный результат
                const duration = Date.now() - this.activeRequests.get(requestId)?.startTime || 0;
                console.log(`✅ ${method.toUpperCase()} ${url} (${duration}ms)`);
                
                return result;
                
            } catch (error) {
                lastError = error;
                
                // Если это отмена запроса, не повторяем
                if (error.name === 'AbortError') {
                    console.log(`🚫 ${method.toUpperCase()} ${url} - запрос отменен`);
                    throw error;
                }
                
                // Если это последняя попытка, выбрасываем ошибку
                if (attempt === retries) {
                    console.error(`❌ ${method.toUpperCase()} ${url} - все попытки исчерпаны`, error);
                    break;
                }
                
                // Ждем перед повтором
                console.warn(`⚠️ ${method.toUpperCase()} ${url} - попытка ${attempt + 1}/${retries + 1} неудачна, повторяем...`);
                await window.Utils.PerformanceUtils.sleep(this.config.retryDelay * (attempt + 1));
            }
        }
        
        // Удаляем из активных запросов
        this.activeRequests.delete(requestId);
        
        // Выбрасываем последнюю ошибку
        throw lastError;
    },
    
    /**
     * Обработка ответа от сервера
     * @param {Response} response - Ответ от fetch
     * @param {string} url - URL запроса
     * @returns {Promise} Обработанный ответ
     */
    handleResponse: async function(response, url) {
        // Проверяем статус ответа
        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;
            
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorData.message || errorMessage;
            } catch {
                errorMessage = response.statusText || errorMessage;
            }
            
            throw new Error(errorMessage);
        }
        
        // Пытаемся распарсить JSON
        try {
            return await response.json();
        } catch {
            // Если не JSON, возвращаем как текст
            return await response.text();
        }
    },
    
    /**
     * GET запрос
     * @param {string} url - URL для запроса
     * @param {Object} options - Опции запроса
     * @returns {Promise} Promise с результатом
     */
    get: function(url, options = {}) {
        return this.request('GET', url, options);
    },
    
    /**
     * POST запрос
     * @param {string} url - URL для запроса
     * @param {Object} data - Данные для отправки
     * @param {Object} options - Опции запроса
     * @returns {Promise} Promise с результатом
     */
    post: function(url, data = null, options = {}) {
        return this.request('POST', url, { ...options, data });
    },
    
    /**
     * PUT запрос
     * @param {string} url - URL для запроса
     * @param {Object} data - Данные для отправки
     * @param {Object} options - Опции запроса
     * @returns {Promise} Promise с результатом
     */
    put: function(url, data = null, options = {}) {
        return this.request('PUT', url, { ...options, data });
    },
    
    /**
     * DELETE запрос
     * @param {string} url - URL для запроса
     * @param {Object} options - Опции запроса
     * @returns {Promise} Promise с результатом
     */
    delete: function(url, options = {}) {
        return this.request('DELETE', url, options);
    },
    
    /**
     * PATCH запрос
     * @param {string} url - URL для запроса
     * @param {Object} data - Данные для отправки
     * @param {Object} options - Опции запроса
     * @returns {Promise} Promise с результатом
     */
    patch: function(url, data = null, options = {}) {
        return this.request('PATCH', url, { ...options, data });
    },
    
    /**
     * Отмена всех активных запросов
     */
    cancelAllRequests: function() {
        console.log(`🚫 Отменяем ${this.activeRequests.size} активных запросов...`);
        
        this.activeRequests.forEach((request, id) => {
            if (request.abortController) {
                request.abortController.abort();
            }
        });
        
        this.activeRequests.clear();
        console.log('✅ Все активные запросы отменены');
    },
    
    /**
     * Отмена конкретного запроса по URL
     * @param {string} url - URL запроса для отмены
     */
    cancelRequestByUrl: function(url) {
        const foundRequests = [];
        
        this.activeRequests.forEach((request, id) => {
            if (request.url.includes(url)) {
                foundRequests.push({ id, request });
            }
        });
        
        foundRequests.forEach(({ id, request }) => {
            if (request.abortController) {
                request.abortController.abort();
            }
            this.activeRequests.delete(id);
        });
        
        console.log(`🚫 Отменено ${foundRequests.length} запросов для URL: ${url}`);
    },
    
    /**
     * Специфичные методы для API Message Hunter
     */
    MessageHunterAPI: {
        /**
         * Проверка API ключей
         * @returns {Promise} Результат проверки
         */
        checkApiKeys: function() {
            return window.APIClient.get('/check_api_keys');
        },
        
        /**
         * Сохранение API ключей
         * @param {Object} keys - Объект с ключами {api_id, api_hash}
         * @returns {Promise} Результат сохранения
         */
        saveApiKeys: function(keys) {
            return window.APIClient.post('/save_api_keys_local', keys);
        },
        
        /**
         * Получение списка групп
         * @returns {Promise} Список групп
         */
        getGroups: function() {
            return window.APIClient.get('/get_groups');
        },
        
        /**
         * Выполнение поиска
         * @param {Object} searchParams - Параметры поиска
         * @param {AbortSignal} signal - Сигнал отмены
         * @returns {Promise} Результаты поиска
         */
        search: function(searchParams, signal = null) {
            return window.APIClient.post('/search', searchParams, { signal });
        },
        
        /**
         * Остановка поиска
         * @returns {Promise} Результат остановки
         */
        stopSearch: function() {
            return window.APIClient.post('/stop_search');
        },
        
        /**
         * Запуск автопоиска
         * @param {Object} params - Параметры автопоиска
         * @returns {Promise} Результат запуска
         */
        startAutoSearch: function(params) {
            return window.APIClient.post('/start_auto_search', params);
        },
        
        /**
         * Остановка автопоиска
         * @returns {Promise} Результат остановки
         */
        stopAutoSearch: function() {
            return window.APIClient.post('/stop_auto_search');
        },
        
        /**
         * Получение результатов автопоиска
         * @returns {Promise} Новые результаты автопоиска
         */
        getAutoSearchResults: function() {
            return window.APIClient.get('/get_auto_search_results');
        },
        
        /**
         * Получение статуса автопоиска
         * @returns {Promise} Статус автопоиска
         */
        getAutoSearchStatus: function() {
            return window.APIClient.get('/get_auto_search_status');
        },
        
        /**
         * AI анализ сообщений
         * @param {Object} analysisParams - Параметры анализа
         * @returns {Promise} Результаты анализа
         */
        analyzeWithAI: function(analysisParams) {
            return window.APIClient.post('/analyze_with_ai', analysisParams);
        },
        
        /**
         * Получение информации об аккаунте
         * @returns {Promise} Информация об аккаунте
         */
        getAccountInfo: function() {
            return window.APIClient.get('/get_account_info');
        },
        
        /**
         * Смена аккаунта
         * @returns {Promise} Результат смены
         */
        switchAccount: function() {
            return window.APIClient.post('/switch_account');
        },
        
        /**
         * Получение истории поиска
         * @returns {Promise} История поиска
         */
        getHistory: function() {
            return window.APIClient.get('/get_history');
        },
        
        /**
         * Сохранение поиска в историю
         * @param {Object} searchData - Данные поиска
         * @returns {Promise} Результат сохранения
         */
        saveSearch: function(searchData) {
            return window.APIClient.post('/save_search', searchData);
        },
        
        /**
         * Удаление записи из истории
         * @param {number} searchId - ID поиска
         * @returns {Promise} Результат удаления
         */
        deleteSearch: function(searchId) {
            return window.APIClient.delete(`/delete_search/${searchId}`);
        },
        
        /**
         * Получение деталей поиска из истории
         * @param {number} searchId - ID поиска
         * @returns {Promise} Детали поиска
         */
        getSearchDetails: function(searchId) {
            return window.APIClient.get(`/get_search_details/${searchId}`);
        },
        
        /**
         * Получение результатов поиска из истории
         * @param {number} searchId - ID поиска
         * @returns {Promise} Результаты поиска
         */
        getSearchResults: function(searchId) {
            return window.APIClient.get(`/get_search_results/${searchId}`);
        },
        
        /**
         * Очистка всей истории
         * @returns {Promise} Результат очистки
         */
        clearHistory: function() {
            return window.APIClient.post('/clear_history');
        },
        
        /**
         * Экспорт истории
         * @returns {Promise} Файл истории
         */
        exportHistory: function() {
            return window.APIClient.get('/export_history');
        },
        
        /**
         * Получение статистики истории
         * @returns {Promise} Статистика истории
         */
        getHistoryStats: function() {
            return window.APIClient.get('/get_history_stats');
        },
        
        /**
         * Создание задачи рассылки
         * @param {Object} taskData - Данные задачи
         * @returns {Promise} Результат создания
         */
        createBroadcastTask: function(taskData) {
            return window.APIClient.post('/create_broadcast_task', taskData);
        },
        
        /**
         * Получение задач рассылки
         * @returns {Promise} Список задач
         */
        getBroadcastTasks: function() {
            return window.APIClient.get('/get_broadcast_tasks');
        },
        
        /**
         * Отмена задачи рассылки
         * @param {number} taskId - ID задачи
         * @returns {Promise} Результат отмены
         */
        cancelBroadcastTask: function(taskId) {
            return window.APIClient.post(`/cancel_broadcast_task/${taskId}`);
        },
        
        /**
         * Удаление задачи рассылки
         * @param {number} taskId - ID задачи
         * @returns {Promise} Результат удаления
         */
        deleteBroadcastTask: function(taskId) {
            return window.APIClient.delete(`/delete_broadcast_task/${taskId}`);
        },
        
        /**
         * Отправка тестового сообщения
         * @param {Object} messageData - Данные сообщения
         * @returns {Promise} Результат отправки
         */
        sendTestMessage: function(messageData) {
            return window.APIClient.post('/send_test_message', messageData);
        },
        
        /**
         * Получение статистики пользователя
         * @returns {Promise} Статистика пользователя
         */
        getUserStats: function() {
            return window.APIClient.get('/get_user_stats');
        },
        
        /**
         * Получение списка множественных аккаунтов
         * @returns {Promise} Список аккаунтов
         */
        getMultiAccounts: function() {
            return window.APIClient.get('/get_multi_accounts');
        },
        
        /**
         * Добавление нового аккаунта
         * @param {Object} accountData - Данные аккаунта
         * @returns {Promise} Результат добавления
         */
        addAccount: function(accountData) {
            return window.APIClient.post('/add_account', accountData);
        },
        
        /**
         * Удаление аккаунта
         * @param {string} accountId - ID аккаунта
         * @returns {Promise} Результат удаления
         */
        removeAccount: function(accountId) {
            return window.APIClient.delete(`/remove_account/${accountId}`);
        },
        
        /**
         * Активация аккаунта
         * @param {string} accountId - ID аккаунта
         * @returns {Promise} Результат активации
         */
        activateAccount: function(accountId) {
            return window.APIClient.post(`/activate_account/${accountId}`);
        }
    },
    
    /**
     * Batch API - выполнение множественных запросов
     */
    Batch: {
        /**
         * Выполнение множественных запросов параллельно
         * @param {Array} requests - Массив запросов
         * @param {Object} options - Опции выполнения
         * @returns {Promise} Результаты всех запросов
         */
        parallel: async function(requests, options = {}) {
            const {
                maxConcurrent = 5,
                continueOnError = true
            } = options;
            
            console.log(`🔄 Выполняем ${requests.length} запросов параллельно (макс. ${maxConcurrent})`);
            
            const results = [];
            const chunks = window.Utils.ArrayUtils.chunk(requests, maxConcurrent);
            
            for (const chunk of chunks) {
                const chunkPromises = chunk.map(async (request, index) => {
                    try {
                        const result = await window.APIClient.request(
                            request.method,
                            request.url,
                            request.options || {}
                        );
                        return { success: true, data: result, index };
                    } catch (error) {
                        if (!continueOnError) {
                            throw error;
                        }
                        return { success: false, error: error.message, index };
                    }
                });
                
                const chunkResults = await Promise.all(chunkPromises);
                results.push(...chunkResults);
            }
            
            console.log(`✅ Выполнено ${results.length} запросов`);
            return results;
        },
        
        /**
         * Выполнение множественных запросов последовательно
         * @param {Array} requests - Массив запросов
         * @param {Object} options - Опции выполнения
         * @returns {Promise} Результаты всех запросов
         */
        sequential: async function(requests, options = {}) {
            const {
                delay = 0,
                continueOnError = true
            } = options;
            
            console.log(`🔄 Выполняем ${requests.length} запросов последовательно`);
            
            const results = [];
            
            for (let i = 0; i < requests.length; i++) {
                const request = requests[i];
                
                try {
                    const result = await window.APIClient.request(
                        request.method,
                        request.url,
                        request.options || {}
                    );
                    results.push({ success: true, data: result, index: i });
                } catch (error) {
                    if (!continueOnError) {
                        throw error;
                    }
                    results.push({ success: false, error: error.message, index: i });
                }
                
                // Пауза между запросами
                if (delay > 0 && i < requests.length - 1) {
                    await window.Utils.PerformanceUtils.sleep(delay);
                }
            }
            
            console.log(`✅ Выполнено ${results.length} запросов последовательно`);
            return results;
        }
    },
    
    /**
     * Кэширование ответов API
     */
    Cache: {
        storage: new Map(),
        
        /**
         * Получение из кэша
         * @param {string} key - Ключ кэша
         * @returns {any} Данные из кэша или null
         */
        get: function(key) {
            const cached = this.storage.get(key);
            if (!cached) return null;
            
            // Проверяем TTL
            if (cached.expires && Date.now() > cached.expires) {
                this.storage.delete(key);
                return null;
            }
            
            console.log(`📦 Данные получены из кэша: ${key}`);
            return cached.data;
        },
        
        /**
         * Сохранение в кэш
         * @param {string} key - Ключ кэша
         * @param {any} data - Данные для сохранения
         * @param {number} ttl - Время жизни в миллисекундах
         */
        set: function(key, data, ttl = 5 * 60 * 1000) {
            this.storage.set(key, {
                data,
                expires: ttl > 0 ? Date.now() + ttl : null,
                created: Date.now()
            });
            console.log(`💾 Данные сохранены в кэш: ${key} (TTL: ${ttl}ms)`);
        },
        
        /**
         * Удаление из кэша
         * @param {string} key - Ключ кэша
         */
        delete: function(key) {
            this.storage.delete(key);
            console.log(`🗑️ Данные удалены из кэша: ${key}`);
        },
        
        /**
         * Очистка всего кэша
         */
        clear: function() {
            const size = this.storage.size;
            this.storage.clear();
            console.log(`🧹 Кэш очищен (удалено ${size} записей)`);
        },
        
        /**
         * Получение статистики кэша
         * @returns {Object} Статистика кэша
         */
        stats: function() {
            const entries = Array.from(this.storage.entries());
            const now = Date.now();
            
            return {
                total: entries.length,
                expired: entries.filter(([_, value]) => value.expires && now > value.expires).length,
                size: JSON.stringify(Object.fromEntries(this.storage)).length
            };
        }
    },
    
    /**
     * Создание запроса с кэшированием
     * @param {string} method - HTTP метод
     * @param {string} url - URL
     * @param {Object} options - Опции запроса
     * @returns {Promise} Результат запроса
     */
    cachedRequest: function(method, url, options = {}) {
        // Кэшируем только GET запросы
        if (method.toUpperCase() !== 'GET') {
            return this.request(method, url, options);
        }
        
        const cacheKey = `${method}:${url}:${JSON.stringify(options)}`;
        
        // Проверяем кэш
        const cached = this.Cache.get(cacheKey);
        if (cached) {
            return Promise.resolve(cached);
        }
        
        // Выполняем запрос и кэшируем результат
        return this.request(method, url, options).then(result => {
            const ttl = options.cacheTtl || 5 * 60 * 1000; // 5 минут по умолчанию
            this.Cache.set(cacheKey, result, ttl);
            return result;
        });
    },
    
    /**
     * Monitoring и статистика запросов
     */
    Stats: {
        requests: [],
        maxHistory: 1000,
        
        /**
         * Добавление статистики запроса
         * @param {Object} requestInfo - Информация о запросе
         */
        addRequest: function(requestInfo) {
            this.requests.push({
                ...requestInfo,
                timestamp: Date.now()
            });
            
            // Ограничиваем размер истории
            if (this.requests.length > this.maxHistory) {
                this.requests = this.requests.slice(-this.maxHistory);
            }
        },
        
        /**
         * Получение статистики
         * @returns {Object} Статистика запросов
         */
        getStats: function() {
            const now = Date.now();
            const lastHour = now - (60 * 60 * 1000);
            const recentRequests = this.requests.filter(r => r.timestamp > lastHour);
            
            const byMethod = window.Utils.ArrayUtils.groupBy(recentRequests, 'method');
            const byStatus = window.Utils.ArrayUtils.groupBy(recentRequests, 'status');
            
            return {
                total: this.requests.length,
                lastHour: recentRequests.length,
                byMethod: Object.keys(byMethod).reduce((acc, method) => {
                    acc[method] = byMethod[method].length;
                    return acc;
                }, {}),
                byStatus: Object.keys(byStatus).reduce((acc, status) => {
                    acc[status] = byStatus[status].length;
                    return acc;
                }, {}),
                averageResponseTime: recentRequests.length > 0 
                    ? recentRequests.reduce((sum, r) => sum + (r.duration || 0), 0) / recentRequests.length
                    : 0
            };
        },
        
        /**
         * Очистка статистики
         */
        clear: function() {
            this.requests = [];
            console.log('📊 Статистика API запросов очищена');
        }
    },
    
    /**
     * Получение информации об активных запросах
     * @returns {Array} Список активных запросов
     */
    getActiveRequests: function() {
        return Array.from(this.activeRequests.entries()).map(([id, request]) => ({
            id,
            url: request.url,
            method: request.method,
            duration: Date.now() - request.startTime
        }));
    },
    
    /**
     * Проверка состояния соединения
     * @returns {Promise<boolean>} Состояние соединения
     */
    checkConnection: async function() {
        try {
            const start = Date.now();
            await this.get('/health', { timeout: 5000 });
            const duration = Date.now() - start;
            console.log(`🌐 Соединение активно (${duration}ms)`);
            return true;
        } catch (error) {
            console.error('❌ Проблемы с соединением:', error.message);
            return false;
        }
    },
    
    /**
     * Установка глобальных заголовков
     * @param {Object} headers - Заголовки для всех запросов
     */
    setGlobalHeaders: function(headers) {
        this.globalHeaders = { ...this.globalHeaders, ...headers };
        console.log('🌐 Установлены глобальные заголовки:', headers);
    },
    
    /**
     * Включение режима отладки
     * @param {boolean} enabled - Включить/выключить отладку
     */
    setDebugMode: function(enabled) {
        this.debugMode = enabled;
        console.log(`🐛 Режим отладки API: ${enabled ? 'включен' : 'выключен'}`);
    }
};

// Глобальные алиасы для удобства
window.api = window.APIClient.MessageHunterAPI;
window.apiGet = window.APIClient.get.bind(window.APIClient);
window.apiPost = window.APIClient.post.bind(window.APIClient);

// Автоматическая инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    window.APIClient.init();
});

// Обработка закрытия страницы - отменяем все запросы
window.addEventListener('beforeunload', function() {
    window.APIClient.cancelAllRequests();
});

console.log('✅ APIClient модуль загружен и готов к работе');