// ===============================
// УПРАВЛЕНИЕ AI АНАЛИЗОМ
// static/js/ai-manager.js
// ===============================

window.AIManager = {
    
    // Состояние AI анализа
    isAnalyzing: false,
    lastResults: null,
    userStats: null,
    
    /**
     * Инициализация AI менеджера
     */
    init: function() {
        console.log('🤖 Инициализация AIManager...');
        
        // Загружаем статистику пользователя
        this.loadUserStats();
        
        // Настраиваем обработчики событий для модального окна
        this.setupEventHandlers();
        
        console.log('✅ AIManager инициализирован');
    },
    
    /**
     * Настройка обработчиков событий
     */
    setupEventHandlers: function() {
        // Обработчик для Enter в поле промпта
        document.addEventListener('DOMContentLoaded', () => {
            const promptInput = document.getElementById('aiPromptInput');
            if (promptInput) {
                promptInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        this.startAnalysisWithPrompt();
                    }
                });
            }
        });
    },
    
    /**
     * Открытие модального окна с промптом для AI анализа
     */
    openPromptModal: function() {
        if (!window.MessageHunter.lastSearchResults || !window.MessageHunter.lastSearchResults.results) {
            window.UIUtils.showError('❌ Нет результатов для анализа');
            return;
        }
        
        if (window.MessageHunter.lastSearchResults.results.length === 0) {
            window.UIUtils.showError('❌ Нет сообщений для анализа');
            return;
        }
        
        console.log('🤖 Открываем модальное окно AI промпта...');
        
        const modal = document.getElementById('aiPromptModal');
        if (modal) {
            modal.style.display = 'block';
            
            // Фокусируемся на поле ввода через небольшую задержку
            setTimeout(() => {
                const input = document.getElementById('aiPromptInput');
                if (input) {
                    input.focus();
                    input.select();
                }
            }, 100);
            
            console.log('✅ Модальное окно AI промпта открыто');
        } else {
            console.error('❌ Модальное окно aiPromptModal не найдено');
        }
    },
    
    /**
     * Закрытие модального окна с промптом
     */
    closePromptModal: function() {
        const modal = document.getElementById('aiPromptModal');
        if (modal) {
            modal.style.display = 'none';
            console.log('🚪 Модальное окно AI промпта закрыто');
        }
    },
    
    /**
     * Запуск AI анализа с пользовательским промптом
     */
    startAnalysisWithPrompt: function() {
        const promptInput = document.getElementById('aiPromptInput');
        const prompt = promptInput ? promptInput.value.trim() : '';
        
        if (!prompt) {
            window.UIUtils.showError('❌ Введите промпт для AI анализа');
            return;
        }
        
        // Закрываем модальное окно
        this.closePromptModal();
        
        // Запускаем анализ с кастомным промптом
        this.analyzeWithCustomPrompt(prompt);
    },
    
    /**
     * AI анализ с пользовательским промптом
     * @param {string} customPrompt - Пользовательский промпт для анализа
     */
    analyzeWithCustomPrompt: function(customPrompt) {
        if (!window.MessageHunter.lastSearchResults || !window.MessageHunter.lastSearchResults.results) {
            window.UIUtils.showError('❌ Нет результатов для анализа');
            return;
        }
        
        console.log('🎯 Запуск AI анализа с пользовательским промптом:', customPrompt);
        
        // Обновляем интерфейс
        this.updateAnalysisUI(true);
        
        const messagesToAnalyze = window.MessageHunter.lastSearchResults.results;
        
        // Используем APIClient для запроса
        window.APIClient.MessageHunterAPI.analyzeWithAI({
            messages: messagesToAnalyze,
            custom_prompt: customPrompt
        })
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            } else {
                this.lastResults = {
                    potential_clients: data.potential_clients,
                    analyzed_count: data.analyzed_count,
                    custom_prompt: customPrompt
                };
                
                this.showResults(
                    data.potential_clients, 
                    data.analyzed_count, 
                    customPrompt
                );
                
                // Обновляем статистику пользователя
                this.loadUserStats();
                
                console.log('✅ AI анализ завершен успешно');
            }
        })
        .catch(error => {
            window.UIUtils.showError('❌ Ошибка AI анализа: ' + error.message);
            console.error('❌ Ошибка AI анализа:', error);
        })
        .finally(() => {
            this.updateAnalysisUI(false);
        });
    },
    
    /**
     * Стандартный AI анализ для поиска потенциальных клиентов
     */
    analyzeForClients: function() {
        const defaultPrompt = 'Найди людей которые реально хотят что-то купить или заказать услугу за деньги';
        this.analyzeWithCustomPrompt(defaultPrompt);
    },
    
    /**
     * Обновление интерфейса во время анализа
     * @param {boolean} isAnalyzing - Состояние анализа
     */
    updateAnalysisUI: function(isAnalyzing) {
        this.isAnalyzing = isAnalyzing;
        
        const analyzeBtn = document.getElementById('analyzeBtn');
        if (analyzeBtn) {
            analyzeBtn.disabled = isAnalyzing;
            analyzeBtn.textContent = isAnalyzing ? '🤖 Анализирую...' : '🤖 Анализировать с AI';
        }
        
        // Скрываем предыдущие результаты AI во время нового анализа
        if (isAnalyzing) {
            const aiResults = document.getElementById('aiResults');
            if (aiResults) {
                aiResults.style.display = 'none';
            }
        }
    },
    
    /**
     * Отображение результатов AI анализа
     * @param {Array} potentialClients - Массив потенциальных клиентов
     * @param {number} analyzedCount - Количество проанализированных сообщений
     * @param {string} customPrompt - Использованный промпт
     */
    showResults: function(potentialClients, analyzedCount, customPrompt = '') {
        const aiResultsDiv = document.getElementById('aiResults');
        const aiMessagesDiv = document.getElementById('aiMessages');
        const aiCountDiv = document.getElementById('aiResultsCount');
        
        if (!aiResultsDiv || !aiMessagesDiv || !aiCountDiv) {
            console.error('❌ Элементы AI результатов не найдены');
            return;
        }
        
        // Обновляем заголовок с информацией о результатах
        aiCountDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div>
                    Найдено <strong>${potentialClients.length}</strong> потенциальных клиентов из <strong>${analyzedCount}</strong> проанализированных сообщений
                </div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="window.AIManager.exportResults()" class="export-btn" style="
                        background: #28a745;
                        color: white;
                        border: none;
                        padding: 6px 12px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 12px;
                    ">
                        📄 Экспорт
                    </button>
                    <button onclick="window.AIManager.clearResults()" class="clear-btn" style="
                        background: #dc3545;
                        color: white;
                        border: none;
                        padding: 6px 12px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 12px;
                    ">
                        🗑️ Очистить
                    </button>
                </div>
            </div>
            <div style="color: #666; font-size: 12px;">
                🎯 Промпт: "${customPrompt || 'стандартный анализ'}"
            </div>
        `;
        
        // Очищаем контейнер сообщений
        aiMessagesDiv.innerHTML = '';
        
        if (potentialClients.length === 0) {
            aiMessagesDiv.innerHTML = `
                <div style="padding: 40px; text-align: center; color: #666;">
                    <div style="font-size: 48px; margin-bottom: 15px;">🤖</div>
                    <h3>AI не нашел потенциальных клиентов</h3>
                    <p>Попробуйте изменить промпт или проанализировать другие результаты поиска</p>
                    <button onclick="window.AIManager.openPromptModal()" style="
                        background: #007bff;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        margin-top: 15px;
                    ">
                        🎯 Попробовать другой промпт
                    </button>
                </div>
            `;
        } else {
            // Отображаем найденных потенциальных клиентов
            potentialClients.forEach((client, index) => {
                const clientDiv = this.createClientElement(client, index + 1);
                aiMessagesDiv.appendChild(clientDiv);
            });
        }
        
        // Показываем блок результатов
        aiResultsDiv.style.display = 'block';
        
        // Прокручиваем к результатам
        aiResultsDiv.scrollIntoView({ behavior: 'smooth' });
        
        console.log(`✅ Отображены результаты AI анализа: ${potentialClients.length} клиентов`);
    },
    
    /**
     * Создание элемента потенциального клиента
     * @param {Object} client - Объект клиента
     * @param {number} index - Порядковый номер
     * @returns {HTMLElement} Элемент клиента
     */
    createClientElement: function(client, index) {
        const clientDiv = document.createElement('div');
        clientDiv.className = 'message ai-client';
        clientDiv.style.cssText = `
            border-left: 5px solid #6f42c1;
            background: white;
            margin-bottom: 15px;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            position: relative;
        `;
        
        // Генерируем ссылку на сообщение
        const messageLink = this.generateMessageLink(client);
        
        clientDiv.innerHTML = `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                <div style="font-weight: 600; color: #6f42c1; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <span>🎯 Потенциальный клиент #${index}</span>
                    <span style="font-size: 12px; color: #666;">Уверенность: ${client.confidence || 'не указана'}</span>
                </div>
                
                <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <strong>📝 Исходное сообщение:</strong><br>
                    <em style="color: #495057; line-height: 1.4;">"${client.original_message}"</em>
                </div>
                
                <div style="background: #fff3cd; padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                    <strong style="color: #856404;">💡 Выявленная потребность:</strong><br>
                    <span style="color: #856404;">${client.client_need}</span>
                </div>
                
                ${client.ai_reasoning ? `
                    <div style="background: #e3f2fd; padding: 12px; border-radius: 8px; margin-bottom: 10px; font-size: 13px;">
                        <strong style="color: #1976d2;">🧠 Анализ AI:</strong><br>
                        <span style="color: #1976d2;">${client.ai_reasoning}</span>
                    </div>
                ` : ''}
            </div>
            
            <div class="message-meta" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin-bottom: 15px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span>👤</span>
                    <span style="font-weight: 500;">${client.author}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span>💬</span>
                    <span>${client.group}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span>📅</span>
                    <span>${client.date}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span>🏷️</span>
                    <span style="color: #6f42c1; font-size: 12px;">AI клиент</span>
                </div>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; gap: 10px;">
                    <button onclick="window.AIManager.copyClientInfo(${index - 1})" class="client-action-btn" style="
                        background: #17a2b8;
                        color: white;
                        border: none;
                        padding: 6px 12px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 12px;
                    ">
                        📋 Копировать
                    </button>
                    <button onclick="window.AIManager.markAsContacted(${index - 1})" class="client-action-btn" style="
                        background: #ffc107;
                        color: #212529;
                        border: none;
                        padding: 6px 12px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 12px;
                    ">
                        ✅ Связался
                    </button>
                </div>
                <a href="${messageLink}" target="_blank" style="
                    color: #0088cc; 
                    text-decoration: none; 
                    font-size: 12px;
                    padding: 6px 12px;
                    border: 1px solid #0088cc;
                    border-radius: 5px;
                    transition: all 0.2s;
                " 
                onmouseover="this.style.background='#0088cc'; this.style.color='white';"
                onmouseout="this.style.background='transparent'; this.style.color='#0088cc';">
                    🔗 Открыть в Telegram
                </a>
            </div>
        `;
        
        return clientDiv;
    },
    
    /**
     * Генерация ссылки на сообщение
     * @param {Object} client - Объект клиента
     * @returns {string} Ссылка на сообщение
     */
    generateMessageLink: function(client) {
        if (!client.chat_id || !client.message_id) {
            return '#';
        }
        
        if (client.chat_username) {
            return `https://t.me/${client.chat_username}/${client.message_id}`;
        }
        
        const chatIdStr = client.chat_id.toString();
        const cleanChatId = chatIdStr.startsWith('-100') ? chatIdStr.slice(4) : chatIdStr.replace('-', '');
        
        return `https://t.me/c/${cleanChatId}/${client.message_id}`;
    },
    
    /**
     * Копирование информации о клиенте
     * @param {number} clientIndex - Индекс клиента в массиве
     */
    copyClientInfo: function(clientIndex) {
        if (!this.lastResults || !this.lastResults.potential_clients[clientIndex]) {
            window.UIUtils.showError('❌ Информация о клиенте не найдена');
            return;
        }
        
        const client = this.lastResults.potential_clients[clientIndex];
        
        const info = `🎯 Потенциальный клиент #${clientIndex + 1}

👤 Автор: ${client.author}
💬 Группа: ${client.group}
📅 Дата: ${client.date}

📝 Сообщение:
"${client.original_message}"

💡 Потребность:
${client.client_need}

🔗 Ссылка: ${this.generateMessageLink(client)}`;
        
        // Копируем в буфер обмена
        if (window.Utils && window.Utils.BrowserUtils && window.Utils.BrowserUtils.copyToClipboard) {
            window.Utils.BrowserUtils.copyToClipboard(info).then(success => {
                if (success) {
                    window.UIUtils.showToast('📋 Информация скопирована в буфер обмена', 'success');
                    console.log('📋 Информация о клиенте скопирована');
                } else {
                    this.fallbackCopyToClipboard(info);
                }
            });
        } else {
            this.fallbackCopyToClipboard(info);
        }
    },
    
    /**
     * Альтернативный способ копирования в буфер обмена
     * @param {string} text - Текст для копирования
     */
    fallbackCopyToClipboard: function(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            window.UIUtils.showToast('📋 Информация скопирована в буфер обмена', 'success');
            console.log('📋 Информация о клиенте скопирована (fallback)');
        } catch (err) {
            console.error('❌ Ошибка копирования:', err);
            window.UIUtils.showError('❌ Не удалось скопировать информацию');
        } finally {
            document.body.removeChild(textArea);
        }
    },
    
    /**
     * Пометка клиента как "связались"
     * @param {number} clientIndex - Индекс клиента в массиве
     */
    markAsContacted: function(clientIndex) {
        if (!this.lastResults || !this.lastResults.potential_clients[clientIndex]) {
            window.UIUtils.showError('❌ Клиент не найден');
            return;
        }
        
        const client = this.lastResults.potential_clients[clientIndex];
        
        // Находим элемент клиента в DOM
        const clientElements = document.querySelectorAll('.ai-client');
        if (clientElements[clientIndex]) {
            const element = clientElements[clientIndex];
            
            // Добавляем визуальную индикацию
            element.style.opacity = '0.7';
            element.style.borderLeftColor = '#28a745';
            
            // Добавляем метку "Связались"
            const statusBadge = document.createElement('div');
            statusBadge.style.cssText = `
                position: absolute;
                top: 10px;
                right: 10px;
                background: #28a745;
                color: white;
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 600;
                z-index: 10;
            `;
            statusBadge.textContent = '✅ Связались';
            
            element.appendChild(statusBadge);
            
            // Блокируем кнопку
            const contactBtn = element.querySelector(`button[onclick*="markAsContacted(${clientIndex})"]`);
            if (contactBtn) {
                contactBtn.disabled = true;
                contactBtn.textContent = '✅ Связались';
                contactBtn.style.background = '#6c757d';
            }
        }
        
        // Сохраняем статус в локальном хранилище
        this.saveContactedStatus(client, clientIndex);
        
        window.UIUtils.showToast('✅ Клиент помечен как "связались"', 'success');
        console.log('✅ Клиент помечен как связались:', client.author);
    },
    
    /**
     * Сохранение статуса связи с клиентом
     * @param {Object} client - Объект клиента
     * @param {number} index - Индекс клиента
     */
    saveContactedStatus: function(client, index) {
        try {
            const contacted = JSON.parse(localStorage.getItem('message_hunter_contacted_clients') || '[]');
            
            const contactRecord = {
                client_id: `${client.author}_${client.date}_${index}`,
                author: client.author,
                group: client.group,
                date: client.date,
                contacted_at: new Date().toISOString(),
                need: client.client_need
            };
            
            contacted.push(contactRecord);
            
            // Ограничиваем размер истории
            if (contacted.length > 1000) {
                contacted.splice(0, contacted.length - 1000);
            }
            
            localStorage.setItem('message_hunter_contacted_clients', JSON.stringify(contacted));
            console.log('💾 Статус связи сохранен');
        } catch (error) {
            console.error('❌ Ошибка сохранения статуса связи:', error);
        }
    },
    
    /**
     * Экспорт результатов AI анализа
     */
    exportResults: function() {
        if (!this.lastResults || !this.lastResults.potential_clients) {
            window.UIUtils.showError('❌ Нет результатов для экспорта');
            return;
        }
        
        console.log('📄 Экспорт результатов AI анализа...');
        
        const exportData = {
            exported_at: new Date().toISOString(),
            analysis_prompt: this.lastResults.custom_prompt || 'стандартный анализ',
            total_analyzed: this.lastResults.analyzed_count,
            clients_found: this.lastResults.potential_clients.length,
            clients: this.lastResults.potential_clients.map((client, index) => ({
                index: index + 1,
                author: client.author,
                group: client.group,
                date: client.date,
                message: client.original_message,
                need: client.client_need,
                confidence: client.confidence,
                telegram_link: this.generateMessageLink(client),
                ai_reasoning: client.ai_reasoning || null
            }))
        };
        
        // Используем Utils для скачивания файла
        if (window.Utils && window.Utils.FileUtils) {
            const filename = `ai_analysis_results_${new Date().toISOString().split('T')[0]}.json`;
            window.Utils.FileUtils.downloadAsFile(
                JSON.stringify(exportData, null, 2),
                filename,
                'application/json'
            );
        } else {
            // Fallback
            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ai_analysis_results_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }
        
        window.UIUtils.showToast('✅ Результаты экспортированы', 'success');
        console.log('✅ Результаты AI анализа экспортированы');
    },
    
    /**
     * Загрузка статистики пользователя
     */
    loadUserStats: function() {
        if (window.APIClient && window.APIClient.MessageHunterAPI) {
            window.APIClient.MessageHunterAPI.getUserStats()
            .then(data => {
                if (data.success) {
                    this.userStats = data.stats;
                    this.updateStatsDisplay();
                    console.log('📊 Статистика пользователя загружена');
                }
            })
            .catch(error => {
                console.error('❌ Ошибка загрузки статистики:', error);
            });
        }
    },
    
    /**
     * Обновление отображения статистики
     */
    updateStatsDisplay: function() {
        if (!this.userStats) return;
        
        const statsElements = {
            'totalSearches': this.userStats.total_searches || 0,
            'totalAnalyses': this.userStats.total_ai_analyses || 0,
            'clientsFound': this.userStats.total_clients_found || 0,
            'lastAnalysis': this.userStats.last_analysis_date || 'Никогда'
        };
        
        Object.entries(statsElements).forEach(([elementId, value]) => {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = value;
            }
        });
    },
    
    /**
     * Очистка результатов AI анализа
     */
    clearResults: function() {
        if (!this.lastResults) {
            window.UIUtils.showError('❌ Нет результатов для очистки');
            return;
        }
        
        if (!confirm('❓ Очистить результаты AI анализа?')) {
            return;
        }
        
        this.lastResults = null;
        
        const aiResults = document.getElementById('aiResults');
        if (aiResults) {
            aiResults.style.display = 'none';
        }
        
        window.UIUtils.showToast('✅ Результаты AI анализа очищены', 'success');
        console.log('🧹 Результаты AI анализа очищены');
    },
    
    /**
     * Показать историю связей с клиентами
     */
    showContactedHistory: function() {
        try {
            const contacted = JSON.parse(localStorage.getItem('message_hunter_contacted_clients') || '[]');
            
            if (contacted.length === 0) {
                window.UIUtils.showToast('📋 История связей пуста', 'info');
                return;
            }
            
            // Создаем модальное окно с историей
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
            `;
            
            const historyHTML = contacted.slice(-50).reverse().map((record, index) => `
                <div style="
                    background: #f8f9fa;
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 10px;
                    border-left: 4px solid #28a745;
                ">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <strong>👤 ${record.author}</strong>
                        <small style="color: #666;">${new Date(record.contacted_at).toLocaleString()}</small>
                    </div>
                    <div style="font-size: 13px; color: #666; margin-bottom: 5px;">
                        📂 ${record.group} | 📅 ${record.date}
                    </div>
                    <div style="font-size: 13px; color: #495057;">
                        💡 ${record.need}
                    </div>
                </div>
            `).join('');
            
            modal.innerHTML = `
                <div style="
                    background: white;
                    padding: 30px;
                    border-radius: 15px;
                    max-width: 600px;
                    max-height: 80vh;
                    overflow-y: auto;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                ">
                    <h3 style="margin: 0 0 20px 0; color: #333;">📋 История связей с клиентами</h3>
                    
                    <div style="margin-bottom: 15px; padding: 10px; background: #e3f2fd; border-radius: 8px;">
                        📊 Всего связей: <strong>${contacted.length}</strong> | Показано последних: <strong>${Math.min(50, contacted.length)}</strong>
                    </div>
                    
                    <div style="max-height: 400px; overflow-y: auto;">
                        ${historyHTML}
                    </div>
                    
                    <div style="text-align: right; margin-top: 20px;">
                        <button onclick="this.closest('.modal-overlay').remove()" 
                                style="
                                    background: #6c757d;
                                    color: white;
                                    border: none;
                                    padding: 10px 20px;
                                    border-radius: 5px;
                                    cursor: pointer;
                                ">
                            Закрыть
                        </button>
                    </div>
                </div>
            `;
            
            modal.className = 'modal-overlay';
            document.body.appendChild(modal);
            
            // Закрытие по клику вне модального окна
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
            
            console.log('📋 Показана история связей с клиентами');
            
        } catch (error) {
            console.error('❌ Ошибка загрузки истории связей:', error);
            window.UIUtils.showError('❌ Ошибка загрузки истории связей');
        }
    },
    
    /**
     * Получение предварительного просмотра анализа
     */
    getAnalysisPreview: function() {
        if (!window.MessageHunter.lastSearchResults || !window.MessageHunter.lastSearchResults.results) {
            window.UIUtils.showError('❌ Нет результатов для анализа');
            return;
        }
        
        const results = window.MessageHunter.lastSearchResults.results;
        const preview = {
            totalMessages: results.length,
            dateRange: this.getDateRange(results),
            topKeywords: this.getTopKeywords(results),
            messageTypes: this.analyzeMessageTypes(results)
        };
        
        return preview;
    },
    
    /**
     * Получение диапазона дат сообщений
     * @param {Array} results - Результаты поиска
     * @returns {Object} Диапазон дат
     */
    getDateRange: function(results) {
        if (results.length === 0) return null;
        
        const dates = results.map(r => window.Utils.DateUtils.parseMessageDate(r.date)).filter(d => d);
        if (dates.length === 0) return null;
        
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        
        return {
            from: window.Utils.DateUtils.formatDate(minDate),
            to: window.Utils.DateUtils.formatDate(maxDate),
            span: Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + ' дней'
        };
    },
    
    /**
     * Получение топ ключевых слов из сообщений
     * @param {Array} results - Результаты поиска
     * @returns {Array} Топ ключевых слов
     */
    getTopKeywords: function(results) {
        const wordCount = {};
        const stopWords = ['и', 'в', 'на', 'с', 'по', 'для', 'от', 'до', 'из', 'за', 'что', 'как', 'это', 'не', 'я', 'мы', 'вы', 'он', 'она', 'они'];
        
        results.forEach(result => {
            const words = result.text.toLowerCase()
                .replace(/[^\w\s]/g, ' ')
                .split(/\s+/)
                .filter(word => word.length > 2 && !stopWords.includes(word));
            
            words.forEach(word => {
                wordCount[word] = (wordCount[word] || 0) + 1;
            });
        });
        
        return Object.entries(wordCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([word, count]) => ({ word, count }));
    },
    
    /**
     * Анализ типов сообщений
     * @param {Array} results - Результаты поиска
     * @returns {Object} Статистика типов сообщений
     */
    analyzeMessageTypes: function(results) {
        const types = {
            questions: 0,
            offers: 0,
            requests: 0,
            discussions: 0
        };
        
        const patterns = {
            questions: /[?？]|как|что|где|когда|почему|зачем/i,
            offers: /продам|продаю|предлагаю|услуги|цена|стоимость/i,
            requests: /нужен|ищу|требуется|куплю|помогите/i
        };
        
        results.forEach(result => {
            let categorized = false;
            
            Object.entries(patterns).forEach(([type, pattern]) => {
                if (!categorized && pattern.test(result.text)) {
                    types[type]++;
                    categorized = true;
                }
            });
            
            if (!categorized) {
                types.discussions++;
            }
        });
        
        return types;
    },
    
    /**
     * Получение рекомендаций по промптам
     * @returns {Array} Массив рекомендованных промптов
     */
    getPromptSuggestions: function() {
        return [
            {
                title: "Поиск клиентов для услуг",
                prompt: "Найди людей которые ищут услуги: веб-дизайн, разработку сайтов, SEO продвижение, копирайтинг или маркетинг",
                category: "Услуги"
            },
            {
                title: "Поиск покупателей товаров", 
                prompt: "Найди людей которые хотят купить конкретные товары и готовы заплатить деньги",
                category: "Товары"
            },
            {
                title: "Поиск клиентов для обучения",
                prompt: "Найди людей которые ищут репетиторов, курсы, тренинги или образовательные услуги",
                category: "Образование"
            },
            {
                title: "Поиск B2B клиентов",
                prompt: "Найди представителей бизнеса которые ищут поставщиков, подрядчиков или деловое сотрудничество",
                category: "B2B"
            },
            {
                title: "Поиск клиентов для недвижимости",
                prompt: "Найди людей которые ищут квартиры, дома, офисы для покупки или аренды",
                category: "Недвижимость"
            },
            {
                title: "Поиск срочных заказов",
                prompt: "Найди людей которые срочно ищут решение своей проблемы и готовы заплатить за быстрое выполнение",
                category: "Срочно"
            }
        ];
    },
    
    /**
     * Показ рекомендаций по промптам
     */
    showPromptSuggestions: function() {
        const suggestions = this.getPromptSuggestions();
        
        // Создаем модальное окно с рекомендациями
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;
        
        const suggestionsHTML = suggestions.map(suggestion => `
            <div style="
                background: #f8f9fa;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 10px;
                border-left: 4px solid #007bff;
                cursor: pointer;
                transition: background 0.2s;
            " onclick="window.AIManager.usePromptSuggestion('${suggestion.prompt.replace(/'/g, "\\'")}'); this.closest('.modal-overlay').remove();"
               onmouseover="this.style.background='#e3f2fd'"
               onmouseout="this.style.background='#f8f9fa'">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <strong>${suggestion.title}</strong>
                    <small style="background: #007bff; color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px;">
                        ${suggestion.category}
                    </small>
                </div>
                <div style="font-size: 13px; color: #495057; line-height: 1.4;">
                    "${suggestion.prompt}"
                </div>
            </div>
        `).join('');
        
        modal.innerHTML = `
            <div style="
                background: white;
                padding: 30px;
                border-radius: 15px;
                max-width: 700px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            ">
                <h3 style="margin: 0 0 20px 0; color: #333;">💡 Рекомендации промптов для AI анализа</h3>
                
                <div style="margin-bottom: 15px; padding: 10px; background: #fff3cd; border-radius: 8px; font-size: 14px;">
                    <strong>💡 Совет:</strong> Нажмите на любой промпт чтобы использовать его для анализа
                </div>
                
                <div style="max-height: 400px; overflow-y: auto;">
                    ${suggestionsHTML}
                </div>
                
                <div style="text-align: right; margin-top: 20px;">
                    <button onclick="this.closest('.modal-overlay').remove()" 
                            style="
                                background: #6c757d;
                                color: white;
                                border: none;
                                padding: 10px 20px;
                                border-radius: 5px;
                                cursor: pointer;
                            ">
                        Закрыть
                    </button>
                </div>
            </div>
        `;
        
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
        
        // Закрытие по клику вне модального окна
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        console.log('💡 Показаны рекомендации промптов');
    },
    
    /**
     * Использование предложенного промпта
     * @param {string} prompt - Промпт для использования
     */
    usePromptSuggestion: function(prompt) {
        const promptInput = document.getElementById('aiPromptInput');
        if (promptInput) {
            promptInput.value = prompt;
        }
        
        // Сразу запускаем анализ
        this.analyzeWithCustomPrompt(prompt);
        
        console.log('💡 Использован предложенный промпт:', prompt);
    }
};

// Глобальные функции для обратной совместимости
window.openAiPromptModal = function() {
    window.AIManager.openPromptModal();
};

window.closeAiPromptModal = function() {
    window.AIManager.closePromptModal();
};

window.startAiAnalysisWithPrompt = function() {
    window.AIManager.startAnalysisWithPrompt();
};

window.analyzeWithCustomPrompt = function(prompt) {
    window.AIManager.analyzeWithCustomPrompt(prompt);
};

window.showAIResults = function(potentialClients, analyzedCount, customPrompt) {
    window.AIManager.showResults(potentialClients, analyzedCount, customPrompt);
};

window.loadUserStats = function() {
    window.AIManager.loadUserStats();
};

// Автоинициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    // Небольшая задержка чтобы другие модули успели загрузиться
    setTimeout(() => {
        window.AIManager.init();
    }, 500);
});

console.log('✅ AIManager модуль загружен');