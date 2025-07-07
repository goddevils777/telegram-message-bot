// ===============================
// УПРАВЛЕНИЕ ПОИСКОМ СООБЩЕНИЙ
// static/js/search-manager.js
// ===============================

window.SearchManager = {
    
    // Состояние поиска
    isSearching: false,
    progressInterval: null,
    
    // Настройки пагинации результатов
    resultsPerPage: 50,
    displayedResults: 0,
    isLoadingMore: false,
    
    /**
     * Инициализация менеджера поиска
     */
    init: function() {
        console.log('🔍 Инициализация SearchManager...');
        
        // Настраиваем обработчики событий
        this.setupEventHandlers();
        
        // Загружаем сохраненные результаты
        this.loadSavedResults();
        
        console.log('✅ SearchManager инициализирован');
    },
    
    /**
     * Настройка обработчиков событий
     */
    setupEventHandlers: function() {
        document.addEventListener('DOMContentLoaded', () => {
            // Обработчик Enter для поля ввода ключевых слов
            const wordInput = document.getElementById('wordInput');
            if (wordInput) {
                wordInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.addKeyword();
                    }
                });
            }
            
            // Обработчик прокрутки для подгрузки результатов
            const messagesDiv = document.getElementById('messages');
            if (messagesDiv) {
                messagesDiv.addEventListener('scroll', (e) => {
                    this.handleScroll(e);
                });
            }
        });
    },
    
    /**
     * Добавление ключевого слова
     */
    addKeyword: function() {
        const input = document.getElementById('wordInput');
        const word = input ? input.value.trim().toLowerCase() : '';
        
        if (!word) {
            window.UIUtils.showError('Введите слово для добавления');
            return;
        }
        
        if (word.includes(' ')) {
            window.UIUtils.showError('Можно добавлять только одно слово за раз');
            return;
        }
        
        if (window.MessageHunter.keywords.includes(word)) {
            window.UIUtils.showError('Это слово уже добавлено');
            return;
        }
        
        window.MessageHunter.keywords.push(word);
        if (input) input.value = '';
        
        this.updateKeywordsDisplay();
        this.saveKeywords();
        
        console.log(`➕ Добавлено ключевое слово: ${word}`);
    },
    
    /**
     * Удаление ключевого слова
     * @param {string} word - Слово для удаления
     */
    removeKeyword: function(word) {
        window.MessageHunter.keywords = window.MessageHunter.keywords.filter(k => k !== word);
        this.updateKeywordsDisplay();
        this.saveKeywords();
        
        console.log(`➖ Удалено ключевое слово: ${word}`);
    },
    
    /**
     * Обновление отображения ключевых слов
     */
    updateKeywordsDisplay: function() {
        const display = document.getElementById('keywordsDisplay');
        if (!display) return;
        
        if (window.MessageHunter.keywords.length === 0) {
            display.innerHTML = '<span style="color: #666; font-style: italic;">Добавьте слова для поиска...</span>';
        } else {
            display.innerHTML = window.MessageHunter.keywords.map(word => 
                `<span class="keyword-tag" style="
                    background: #e3f2fd; 
                    color: #1976d2; 
                    padding: 6px 12px; 
                    border-radius: 20px; 
                    font-size: 13px; 
                    margin: 3px; 
                    display: inline-block;
                    cursor: pointer;
                ">
                    ${word}
                    <span class="remove-btn" onclick="window.SearchManager.removeKeyword('${word}')" style="
                        margin-left: 8px; 
                        color: #d32f2f; 
                        font-weight: bold;
                        cursor: pointer;
                    ">×</span>
                </span>`
            ).join('');
        }
    },
    
    /**
     * Сохранение ключевых слов
     */
    saveKeywords: function() {
        window.DataManager.save(
            'search_keywords',
            window.MessageHunter.keywords,
            24 * 60 * 60 * 1000 // 24 часа
        );
    },
    
    /**
     * Загрузка ключевых слов
     */
    loadKeywords: function() {
        const saved = window.DataManager.load('search_keywords');
        if (saved && Array.isArray(saved)) {
            window.MessageHunter.keywords = saved;
            this.updateKeywordsDisplay();
            console.log(`✅ Загружены ключевые слова: ${saved.length}`);
        }
    },
    
    /**
     * Выполнение поиска
     */
    performSearch: function() {
        if (window.MessageHunter.keywords.length === 0) {
            window.UIUtils.showError('Добавьте хотя бы одно слово для поиска');
            return;
        }
        
        // Получаем группы для поиска
        const groupsToUse = this.getSelectedGroups();
        
        console.log(`🔍 Проверяем группы для поиска:`, {
            selectedGroups: window.MessageHunter.selectedGroups.length,
            groupsToUse: groupsToUse.length
        });
        
        if (groupsToUse.length === 0) {
            window.UIUtils.showError('Выберите хотя бы одну группу для поиска');
            return;
        }
        
        // Начинаем поиск
        this.startSearch(groupsToUse);
    },
    
    /**
     * Получение выбранных групп для поиска
     * @returns {Array} Массив ID выбранных групп
     */
    getSelectedGroups: function() {
        return window.MessageHunter.selectedGroups || [];
    },
    
    /**
     * Запуск поиска
     * @param {Array} groupsToUse - Массив ID групп для поиска
     */
    startSearch: function(groupsToUse) {
        this.isSearching = true;
        window.MessageHunter.searchAbortController = new AbortController();
        
        // Обновляем интерфейс
        this.updateSearchUI(true);
        
        // Запускаем симуляцию прогресса
        this.simulateSearchProgress(groupsToUse);
        
        console.log(`🔍 Запуск поиска с ${groupsToUse.length} группами`);
        
        // Используем APIClient для запроса
        window.APIClient.MessageHunterAPI.search({
            keyword: window.MessageHunter.keywords.join(' '),
            selected_groups: groupsToUse,
            search_depth: this.getSearchDepth()
        }, window.MessageHunter.searchAbortController.signal)
        .then(data => {
            this.handleSearchResult(data, groupsToUse);
        })
        .catch(error => {
            this.handleSearchError(error);
        });
    },
    
    /**
     * Обработка результата поиска
     * @param {Object} data - Данные ответа от сервера
     * @param {Array} groupsToUse - Группы которые использовались для поиска
     */
    handleSearchResult: function(data, groupsToUse) {
        this.clearProgressInterval();
        this.updateSearchUI(false);
        this.isSearching = false;
        
        if (data.error) {
            window.UIUtils.showError(data.error);
            return;
        }
        
        // Сохраняем результаты
        window.MessageHunter.lastSearchResults = {
            keywords: window.MessageHunter.keywords.slice(),
            results: data.results || [],
            groups_count: groupsToUse.length
        };
        
        // Отображаем результаты
        this.showResults(
            data.results || [], 
            window.MessageHunter.keywords.join(', '),
            data.accounts_used || []
        );
        
        // Показываем кнопки действий
        this.showActionButtons(true);
        
        // Сохраняем результаты в localStorage
        window.DataManager.SearchResults.save(
            data.results || [], 
            window.MessageHunter.keywords, 
            groupsToUse.length
        );
        
        window.UIUtils.showSuccess(`✅ Найдено ${(data.results || []).length} сообщений`);
        console.log('✅ Поиск завершен успешно');
    },
    
    /**
     * Обработка ошибки поиска
     * @param {Error} error - Объект ошибки
     */
    handleSearchError: function(error) {
        this.clearProgressInterval();
        this.updateSearchUI(false);
        this.isSearching = false;
        
        if (error.name === 'AbortError') {
            window.UIUtils.showWarning('🛑 Поиск остановлен пользователем');
        } else {
            window.UIUtils.showError('❌ Произошла ошибка при поиске: ' + error.message);
            console.error('❌ Search Error:', error);
        }
    },
    
    /**
     * Остановка поиска
     */
    stopSearch: function() {
        if (window.MessageHunter.searchAbortController) {
            window.MessageHunter.searchAbortController.abort();
            window.MessageHunter.searchAbortController = null;
            
            // Отправляем сигнал серверу об остановке
            window.APIClient.MessageHunterAPI.stopSearch()
            .then(data => {
                if (data.success) {
                    window.UIUtils.showWarning('🛑 Поиск остановлен');
                }
            })
            .catch(error => {
                console.error('Ошибка отправки сигнала остановки:', error);
            });
            
            this.updateSearchUI(false);
            this.isSearching = false;
        }
    },
    
    /**
     * Обновление интерфейса поиска
     * @param {boolean} searching - Идет ли поиск в данный момент
     */
    updateSearchUI: function(searching) {
        const loadingEl = document.getElementById('loading');
        const resultsEl = document.getElementById('results');
        const errorEl = document.getElementById('error');
        const searchBtn = document.getElementById('searchBtn');
        const stopBtn = document.getElementById('stopBtn');
        
        if (searching) {
            if (loadingEl) loadingEl.style.display = 'block';
            if (resultsEl) resultsEl.style.display = 'none';
            if (errorEl) errorEl.style.display = 'none';
            if (searchBtn) {
                searchBtn.disabled = true;
                searchBtn.textContent = '🔍 Ищем...';
            }
            if (stopBtn) stopBtn.style.display = 'inline-block';
        } else {
            if (loadingEl) loadingEl.style.display = 'none';
            if (searchBtn) {
                searchBtn.disabled = false;
                searchBtn.textContent = '🔍 Искать';
            }
            if (stopBtn) stopBtn.style.display = 'none';
        }
    },
    
    /**
     * Показ/скрытие кнопок действий
     * @param {boolean} show - Показать или скрыть кнопки
     */
    showActionButtons: function(show) {
        const buttons = ['saveBtn', 'analyzeBtn', 'clearBtn'];
        buttons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.style.display = show ? 'inline-block' : 'none';
            }
        });
    },
    
    /**
     * Получение глубины поиска
     * @returns {number} Глубина поиска
     */
    getSearchDepth: function() {
        const depthInput = document.getElementById('searchDepth');
        const value = parseInt(depthInput ? depthInput.value : 500);
        
        if (value < 1) return 1;
        if (value > 10000) return 10000;
        return value || 500;
    },
    
    /**
     * Симуляция прогресса поиска
     * @param {Array} groupsToUse - Группы для поиска
     */
    simulateSearchProgress: function(groupsToUse) {
        let currentGroup = 0;
        let foundMessages = 0;
        let processedMessages = 0;
        const totalGroups = groupsToUse.length;
        const messagesPerGroup = this.getSearchDepth();
        
        this.clearProgressInterval();
        
        this.progressInterval = setInterval(() => {
            if (currentGroup < totalGroups) {
                if (processedMessages < messagesPerGroup) {
                    processedMessages += Math.min(200, messagesPerGroup - processedMessages);
                    foundMessages += Math.floor(Math.random() * 3);
                    
                    const group = window.MessageHunter.allGroups.find(g => g.id === groupsToUse[currentGroup]);
                    const groupName = group ? group.title : `Группа ${currentGroup + 1}`;
                    
                    this.updateSearchProgress(
                        `🔍 ${groupName}: ${processedMessages}/${messagesPerGroup} сообщений`,
                        currentGroup + 1,
                        totalGroups,
                        foundMessages
                    );
                } else {
                    currentGroup++;
                    processedMessages = 0;
                    
                    if (currentGroup < totalGroups) {
                        const nextGroup = window.MessageHunter.allGroups.find(g => g.id === groupsToUse[currentGroup]);
                        const nextGroupName = nextGroup ? nextGroup.title : `Группа ${currentGroup + 1}`;
                        this.updateSearchProgress(
                            `📂 Переходим к группе: ${nextGroupName}`,
                            currentGroup,
                            totalGroups,
                            foundMessages
                        );
                    }
                }
            } else {
                this.updateSearchProgress(
                    '🔄 Завершаем поиск и сортируем результаты...',
                    totalGroups,
                    totalGroups,
                    foundMessages
                );
            }
        }, 800);
        
        // Автоостановка через 5 минут
        setTimeout(() => {
            this.clearProgressInterval();
        }, 300000);
    },
    
    /**
     * Очистка интервала прогресса
     */
    clearProgressInterval: function() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    },
    
    /**
     * Обновление прогресса поиска
     * @param {string} text - Текст статуса
     * @param {number} current - Текущая группа
     * @param {number} total - Всего групп
     * @param {number} found - Найдено сообщений
     */
    updateSearchProgress: function(text, current, total, found) {
        const loadingText = document.getElementById('loadingText');
        const groupProgress = document.getElementById('groupProgress');
        const foundProgress = document.getElementById('foundProgress');
        
        if (loadingText) loadingText.textContent = text;
        if (groupProgress) groupProgress.textContent = `Обработано групп: ${current} из ${total}`;
        if (foundProgress) foundProgress.textContent = `Найдено сообщений: ${found}`;
    },
    
    /**
     * Отображение результатов поиска
     * @param {Array} results - Массив найденных сообщений
     * @param {string} keyword - Ключевые слова поиска
     * @param {Array} accountsUsed - Использованные аккаунты (опционально)
     */
    showResults: function(results, keyword, accountsUsed = []) {
        console.log('🔍 Отображаем результаты поиска:', results.length);
        
        window.MessageHunter.allSearchResults = results;
        this.displayedResults = 0;
        this.isLoadingMore = false;
        
        const resultsDiv = document.getElementById('results');
        const messagesDiv = document.getElementById('messages');
        const countDiv = document.getElementById('resultsCount');
        
        if (!resultsDiv || !messagesDiv || !countDiv) {
            console.error('❌ Не найдены элементы для отображения результатов');
            return;
        }
        
        // Формируем информацию об аккаунтах
        const accountsInfo = accountsUsed && accountsUsed.length > 1 
            ? `<br><small style="color: #666; font-size: 12px;">👥 Использовано аккаунтов: ${accountsUsed.join(', ')}</small>`
            : '';
        
        // Обновляем заголовок результатов
        countDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div>
                    Найдено <strong>${results.length}</strong> сообщений по словам: <strong>${keyword}</strong> в <strong>${window.MessageHunter.selectedGroups.length}</strong> группах
                </div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="window.SearchManager.exportResults()" class="export-btn" style="
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
                </div>
            </div>
            <small style="color: #666; font-size: 12px;">
                📅 Отсортированы по дате: сначала новые • Скролль для загрузки еще
            </small>
            ${accountsInfo}
        `;
        
        // Очищаем контейнер сообщений
        messagesDiv.innerHTML = '';
        
        if (results.length === 0) {
            messagesDiv.innerHTML = `
                <div style="padding: 40px; text-align: center; color: #666;">
                    <div style="font-size: 48px; margin-bottom: 15px;">🔍</div>
                    <h3>Ничего не найдено</h3>
                    <p>Попробуйте изменить ключевые слова или выбрать другие группы</p>
                </div>
            `;
        } else {
            // Загружаем первую порцию результатов
            this.loadMoreResults();
        }
        
        // Показываем блок результатов
        resultsDiv.style.display = 'block';
        
        // Прокручиваем к результатам
        resultsDiv.scrollIntoView({ behavior: 'smooth' });
        
        console.log(`✅ Отображены результаты поиска: ${results.length} сообщений`);
    },
    
    /**
     * Загрузка дополнительных результатов (пагинация)
     */
    loadMoreResults: function() {
        if (this.isLoadingMore || this.displayedResults >= window.MessageHunter.allSearchResults.length) {
            return;
        }
        
        this.isLoadingMore = true;
        
        const messagesDiv = document.getElementById('messages');
        const startIndex = this.displayedResults;
        const endIndex = Math.min(startIndex + this.resultsPerPage, window.MessageHunter.allSearchResults.length);
        
        console.log(`📄 Загружаем результаты ${startIndex + 1}-${endIndex} из ${window.MessageHunter.allSearchResults.length}`);
        
        // Показываем индикатор загрузки
        if (startIndex > 0) {
            const loadingDiv = document.createElement('div');
            loadingDiv.id = 'loadingMore';
            loadingDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">🔄 Загрузка...</div>';
            messagesDiv.appendChild(loadingDiv);
        }
        
        // Симулируем небольшую задержку для плавности
        setTimeout(() => {
            const loadingEl = document.getElementById('loadingMore');
            if (loadingEl) loadingEl.remove();
            
            // Добавляем новые сообщения
            for (let i = startIndex; i < endIndex; i++) {
                const msg = window.MessageHunter.allSearchResults[i];
                this.addMessageToDisplay(msg, i + 1);
            }
            
            this.displayedResults = endIndex;
            this.isLoadingMore = false;
            
            console.log(`✅ Показано ${this.displayedResults} из ${window.MessageHunter.allSearchResults.length} результатов`);
        }, 300);
    },
    
    /**
     * Добавление сообщения в отображение
     * @param {Object} msg - Объект сообщения
     * @param {number} index - Индекс сообщения
     */
    addMessageToDisplay: function(msg, index) {
        const messagesDiv = document.getElementById('messages');
        if (!messagesDiv) return;
        
        // Вычисляем относительное время
        const messageDate = window.Utils.DateUtils.parseMessageDate(msg.date);
        const freshnessIndicator = window.Utils.DateUtils.getRelativeTime(messageDate);
        
        // Создаем элемент сообщения
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        messageDiv.style.cssText = `
            background: white;
            border: 1px solid #ddd;
            border-radius: 10px;
            margin-bottom: 15px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            position: relative;
        `;
        
        // Генерируем ссылку на сообщение
        const messageLink = this.generateMessageLink(msg);
        
        messageDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div style="display: inline-block; background: #0088cc; color: white; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">
                    ${freshnessIndicator}
                </div>
                <div style="font-size: 12px; color: #999;">
                    #${index}
                </div>
            </div>
            
            <div class="message-text" style="margin-bottom: 15px; line-height: 1.5;">
                ${this.highlightKeywords(msg.text, window.MessageHunter.keywords)}
            </div>
            
            ${msg.matched_words && msg.matched_words.length > 0 ? `
                <div class="matched-words" style="margin-bottom: 15px;">
                    <strong>🎯 Найденные слова:</strong> 
                    ${msg.matched_words.map(word => 
                        `<span style="background: #fff3cd; padding: 2px 6px; border-radius: 8px; font-size: 12px; margin: 0 2px;">${word}</span>`
                    ).join('')}
                </div>
            ` : ''}
            
            <div class="message-meta" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin-bottom: 15px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span>👤</span>
                    <span style="font-weight: 500;">@${msg.author}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span>💬</span>
                    <span>${msg.chat}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span>📅</span>
                    <span>${msg.date}</span>
                </div>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; gap: 10px;">
                    <button onclick="window.SearchManager.copyMessage(${index - 1})" style="
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
        
        messagesDiv.appendChild(messageDiv);
    },
    
    /**
     * Выделение ключевых слов в тексте
     * @param {string} text - Исходный текст
     * @param {Array} keywords - Ключевые слова для выделения
     * @returns {string} Текст с выделенными словами
     */
    highlightKeywords: function(text, keywords) {
        if (!keywords || keywords.length === 0) return text;
        
        let highlightedText = text;
        keywords.forEach(keyword => {
            const regex = new RegExp(`(${keyword})`, 'gi');
            highlightedText = highlightedText.replace(regex, '<mark style="background: #ffeb3b; padding: 1px 3px; border-radius: 3px;">$1</mark>');
        });
        
        return highlightedText;
    },
    
    /**
     * Генерация ссылки на сообщение в Telegram
     * @param {Object} msg - Объект сообщения
     * @returns {string} Ссылка на сообщение
     */
    generateMessageLink: function(msg) {
        if (!msg.chat_id || !msg.message_id) {
            return '#';
        }
        
        if (msg.chat_username) {
            return `https://t.me/${msg.chat_username}/${msg.message_id}`;
        }
        
        const chatIdStr = msg.chat_id.toString();
        const cleanChatId = chatIdStr.startsWith('-100') ? chatIdStr.slice(4) : chatIdStr.replace('-', '');
        
        return `https://t.me/c/${cleanChatId}/${msg.message_id}`;
    },
    
    /**
     * Обработка прокрутки для подгрузки результатов
     * @param {Event} event - Событие прокрутки
     */
    handleScroll: function(event) {
        const messagesDiv = event.target;
        const scrollTop = messagesDiv.scrollTop;
        const scrollHeight = messagesDiv.scrollHeight;
        const clientHeight = messagesDiv.clientHeight;
        
        const nearBottom = scrollTop + clientHeight >= scrollHeight - 100;
        
        if (nearBottom && !this.isLoadingMore && this.displayedResults < window.MessageHunter.allSearchResults.length) {
            console.log('📜 Пользователь докрутил до конца, загружаем еще...');
            this.loadMoreResults();
        }
    },
    
    /**
     * Копирование сообщения
     * @param {number} messageIndex - Индекс сообщения
     */
    copyMessage: function(messageIndex) {
        if (!window.MessageHunter.allSearchResults || !window.MessageHunter.allSearchResults[messageIndex]) {
            window.UIUtils.showError('❌ Сообщение не найдено');
            return;
        }
        
        const msg = window.MessageHunter.allSearchResults[messageIndex];
        
        const text = `📝 Сообщение из поиска

👤 Автор: @${msg.author}
💬 Группа: ${msg.chat}
📅 Дата: ${msg.date}

Текст:
"${msg.text}"

🔗 Ссылка: ${this.generateMessageLink(msg)}`;
        
        // Используем Utils для копирования
        if (window.Utils && window.Utils.BrowserUtils && window.Utils.BrowserUtils.copyToClipboard) {
            window.Utils.BrowserUtils.copyToClipboard(text).then(success => {
                if (success) {
                    window.UIUtils.showToast('📋 Сообщение скопировано в буфер обмена', 'success');
                    console.log('📋 Сообщение скопировано');
                } else {
                    this.fallbackCopyToClipboard(text);
                }
            });
        } else {
            this.fallbackCopyToClipboard(text);
        }
    },
    
    /**
     * Альтернативный способ копирования
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
            window.UIUtils.showToast('📋 Сообщение скопировано в буфер обмена', 'success');
            console.log('📋 Сообщение скопировано (fallback)');
        } catch (err) {
            console.error('❌ Ошибка копирования:', err);
            window.UIUtils.showError('❌ Не удалось скопировать сообщение');
        } finally {
            document.body.removeChild(textArea);
        }
    },
    
    /**
     * Экспорт результатов поиска
     */
    exportResults: function() {
        if (!window.MessageHunter.allSearchResults || window.MessageHunter.allSearchResults.length === 0) {
            window.UIUtils.showError('❌ Нет результатов для экспорта');
            return;
        }
        
        console.log('📄 Экспорт результатов поиска...');
        
        const exportData = {
            exported_at: new Date().toISOString(),
            keywords: window.MessageHunter.keywords,
            total_results: window.MessageHunter.allSearchResults.length,
            groups_searched: window.MessageHunter.selectedGroups.length,
            messages: window.MessageHunter.allSearchResults.map((msg, index) => ({
                index: index + 1,
                author: msg.author,
                chat: msg.chat,
                date: msg.date,
                text: msg.text,
                matched_words: msg.matched_words || [],
                telegram_link: this.generateMessageLink(msg)
            }))
        };
        
        // Используем Utils для скачивания файла
        if (window.Utils && window.Utils.FileUtils) {
            const filename = `search_results_${new Date().toISOString().split('T')[0]}.json`;
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
            a.download = `search_results_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }
        
        window.UIUtils.showToast('✅ Результаты экспортированы', 'success');
        console.log('✅ Результаты поиска экспортированы');
    },
    
    /**
     * Очистка всех результатов поиска
     */
    clearAllResults: function() {
        if (!window.MessageHunter.lastSearchResults && window.MessageHunter.keywords.length === 0) {
            window.UIUtils.showError('❌ Нет данных для очистки');
            return;
        }
        
        if (!confirm('❓ Очистить все результаты поиска и ключевые слова?')) {
            return;
        }
        
        // Очищаем данные
        window.MessageHunter.keywords = [];
        window.MessageHunter.lastSearchResults = null;
        window.MessageHunter.allSearchResults = [];
        this.displayedResults = 0;
        
        // Обновляем интерфейс
        this.updateKeywordsDisplay();
        
        const resultsDiv = document.getElementById('results');
        const aiResultsDiv = document.getElementById('aiResults');
        
        if (resultsDiv) resultsDiv.style.display = 'none';
        if (aiResultsDiv) aiResultsDiv.style.display = 'none';
        
        // Скрываем кнопки действий
        this.showActionButtons(false);
        
        // Очищаем сохраненные данные
        localStorage.removeItem('search_keywords');
        window.DataManager.SearchResults.clear();
        
        window.UIUtils.showToast('✅ Все результаты очищены', 'success');
        console.log('🧹 Все результаты поиска очищены');
    },
    
    /**
     * Сохранение текущего поиска
     */
    saveCurrentSearch: function() {
        if (!window.MessageHunter.lastSearchResults) {
            window.UIUtils.showError('❌ Нет результатов для сохранения');
            return;
        }
        
        // Делегируем сохранение HistoryManager
        if (window.HistoryManager && window.HistoryManager.saveCurrentSearch) {
            window.HistoryManager.saveCurrentSearch();
        } else {
            window.UIUtils.showError('❌ HistoryManager не загружен');
        }
    },
    
    /**
     * Загрузка сохраненных результатов
     */
    loadSavedResults: function() {
        const savedData = window.DataManager.SearchResults.load();
        if (savedData && savedData.results && Array.isArray(savedData.results)) {
            console.log(`✅ Восстановлены результаты поиска: ${savedData.results.length}`);
            
            // Восстанавливаем данные
            window.MessageHunter.lastSearchResults = {
                keywords: savedData.keywords || [],
                results: savedData.results,
                groups_count: savedData.groups_count || 0
            };
            
            // Восстанавливаем ключевые слова
            if (savedData.keywords && Array.isArray(savedData.keywords)) {
                window.MessageHunter.keywords = savedData.keywords;
                this.updateKeywordsDisplay();
            }
            
            // Отображаем результаты если они есть
            if (savedData.results.length > 0) {
                this.showResults(
                    savedData.results,
                    savedData.keywords.join(', '),
                    []
                );
                
                // Скрываем кнопку сохранения (результаты уже сохранены)
                const saveBtn = document.getElementById('saveBtn');
                if (saveBtn) {
                    saveBtn.style.display = 'none';
                }
            }
        }
    },
    
    /**
     * Получение статистики поиска
     * @returns {Object} Статистика поиска
     */
    getSearchStats: function() {
        if (!window.MessageHunter.allSearchResults) {
            return null;
        }
        
        const results = window.MessageHunter.allSearchResults;
        
        // Группировка по авторам
        const authorStats = {};
        results.forEach(msg => {
            authorStats[msg.author] = (authorStats[msg.author] || 0) + 1;
        });
        
        // Группировка по чатам
        const chatStats = {};
        results.forEach(msg => {
            chatStats[msg.chat] = (chatStats[msg.chat] || 0) + 1;
        });
        
        // Анализ дат
        const dates = results.map(msg => window.Utils.DateUtils.parseMessageDate(msg.date));
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        
        return {
            total: results.length,
            topAuthors: Object.entries(authorStats)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5),
            topChats: Object.entries(chatStats)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5),
            dateRange: {
                from: window.Utils.DateUtils.formatDate(minDate),
                to: window.Utils.DateUtils.formatDate(maxDate),
                span: Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + ' дней'
            }
        };
    },
    
    /**
     * Показ статистики поиска
     */
    showSearchStats: function() {
        const stats = this.getSearchStats();
        if (!stats) {
            window.UIUtils.showError('❌ Нет данных для статистики');
            return;
        }
        
        // Создаем модальное окно со статистикой
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
                <h3 style="margin: 0 0 20px 0; color: #333;">📊 Статистика поиска</h3>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin-bottom: 20px;">
                    <div style="text-align: center; background: #f8f9fa; padding: 15px; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: #007bff;">${stats.total}</div>
                        <div style="font-size: 12px; color: #666;">Всего сообщений</div>
                    </div>
                    <div style="text-align: center; background: #f8f9fa; padding: 15px; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: #28a745;">${stats.topChats.length}</div>
                        <div style="font-size: 12px; color: #666;">Активных чатов</div>
                    </div>
                    <div style="text-align: center; background: #f8f9fa; padding: 15px; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: #6f42c1;">${stats.topAuthors.length}</div>
                        <div style="font-size: 12px; color: #666;">Уникальных авторов</div>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h4>📅 Период сообщений</h4>
                    <div style="background: #f8f9fa; padding: 10px; border-radius: 5px;">
                        С ${stats.dateRange.from} по ${stats.dateRange.to}<br>
                        <small>Охват: ${stats.dateRange.span}</small>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h4>👥 Топ авторов</h4>
                    ${stats.topAuthors.map(([author, count]) => `
                        <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee;">
                            <span>@${author}</span>
                            <span style="font-weight: bold;">${count}</span>
                        </div>
                    `).join('')}
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h4>💬 Топ чатов</h4>
                    ${stats.topChats.map(([chat, count]) => `
                        <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee;">
                            <span>${chat}</span>
                            <span style="font-weight: bold;">${count}</span>
                        </div>
                    `).join('')}
                </div>
                
                <div style="text-align: right;">
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
        
        console.log('📊 Показана статистика поиска');
    },
    
    /**
     * Фильтрация результатов по автору
     * @param {string} author - Имя автора для фильтрации
     */
    filterByAuthor: function(author) {
        if (!window.MessageHunter.allSearchResults) return;
        
        const filtered = window.MessageHunter.allSearchResults.filter(msg => msg.author === author);
        this.showResults(filtered, `автор: @${author}`, []);
        
        window.UIUtils.showToast(`Показано ${filtered.length} сообщений от @${author}`, 'info');
    },
    
    /**
     * Фильтрация результатов по чату
     * @param {string} chat - Название чата для фильтрации
     */
    filterByChat: function(chat) {
        if (!window.MessageHunter.allSearchResults) return;
        
        const filtered = window.MessageHunter.allSearchResults.filter(msg => msg.chat === chat);
        this.showResults(filtered, `чат: ${chat}`, []);
        
        window.UIUtils.showToast(`Показано ${filtered.length} сообщений из "${chat}"`, 'info');
    },
    
    /**
     * Сброс всех фильтров
     */
    resetFilters: function() {
        if (!window.MessageHunter.lastSearchResults) return;
        
        this.showResults(
            window.MessageHunter.lastSearchResults.results,
            window.MessageHunter.lastSearchResults.keywords.join(', '),
            []
        );
        
        window.UIUtils.showToast('Фильтры сброшены', 'info');
    }
};

// Глобальные функции для обратной совместимости
window.addKeyword = function() {
    window.SearchManager.addKeyword();
};

window.removeKeyword = function(word) {
    window.SearchManager.removeKeyword(word);
};

window.performSearch = function() {
    window.SearchManager.performSearch();
};

window.stopSearch = function() {
    window.SearchManager.stopSearch();
};

window.showResults = function(results, keyword, accountsUsed) {
    window.SearchManager.showResults(results, keyword, accountsUsed);
};

window.clearAllResults = function() {
    window.SearchManager.clearAllResults();
};

window.saveCurrentSearch = function() {
    window.SearchManager.saveCurrentSearch();
};

window.exportSearchResults = function() {
    window.SearchManager.exportResults();
};

window.showSearchStats = function() {
    window.SearchManager.showSearchStats();
};

// Автоинициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    // Небольшая задержка чтобы другие модули успели загрузиться
    setTimeout(() => {
        window.SearchManager.init();
        
        // Загружаем ключевые слова
        window.SearchManager.loadKeywords();
    }, 300);
});

console.log('✅ SearchManager модуль загружен');