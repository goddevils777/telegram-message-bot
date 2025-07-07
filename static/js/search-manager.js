// ===============================
// УПРАВЛЕНИЕ ПОИСКОМ СООБЩЕНИЙ
// static/js/search-manager.js
// ===============================

window.SearchManager = {
    
    /**
     * Добавление ключевого слова
     */
    addKeyword: function() {
        const input = document.getElementById('wordInput');
        const word = input.value.trim().toLowerCase();
        
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
        input.value = '';
        this.updateKeywordsDisplay();
        
        console.log(`➕ Добавлено ключевое слово: ${word}`);
    },
    
    /**
     * Удаление ключевого слова
     * @param {string} word - Слово для удаления
     */
    removeKeyword: function(word) {
        window.MessageHunter.keywords = window.MessageHunter.keywords.filter(k => k !== word);
        this.updateKeywordsDisplay();
        console.log(`➖ Удалено ключевое слово: ${word}`);
    },
    
    /**
     * Обновление отображения ключевых слов
     */
    updateKeywordsDisplay: function() {
        const display = document.getElementById('keywordsDisplay');
        if (!display) return;
        
        const keywords = window.MessageHunter.keywords;
        
        if (keywords.length === 0) {
            display.innerHTML = '<span style="color: #666; font-style: italic;">Добавьте слова для поиска...</span>';
        } else {
            display.innerHTML = keywords.map(word => 
                `<span class="keyword-tag">
                    ${word}
                    <span class="remove-btn" onclick="window.SearchManager.removeKeyword('${word}')">×</span>
                </span>`
            ).join('');
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
        
        // Получаем группы для текущей вкладки
        const groupsToUse = window.GroupsManager.getSelectedGroupsForCurrentTab();
        
        console.log(`🔍 Проверяем группы для поиска:`, {
            activeTab: window.TabManager.getActiveTab(),
            selectedGroups: window.MessageHunter.selectedGroups.length,
            autoSearchGroups: window.MessageHunter.autoSearchGroups.length,
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
     * Запуск поиска
     * @param {Array} groupsToUse - Массив ID групп для поиска
     */
    startSearch: function(groupsToUse) {
        window.MessageHunter.searchAbortController = new AbortController();
        
        // Обновляем интерфейс
        this.updateSearchUI(true);
        
        // Запускаем симуляцию прогресса
        this.simulateSearchProgress(groupsToUse);
        
        console.log(`🔍 Запуск поиска с ${groupsToUse.length} группами`);
        
        fetch('/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                keyword: window.MessageHunter.keywords.join(' '),
                selected_groups: groupsToUse,
                search_depth: this.getSearchDepth()
            }),
            signal: window.MessageHunter.searchAbortController.signal
        })
        .then(response => response.json())
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
        clearInterval(window.progressInterval);
        this.updateSearchUI(false);
        
        if (data.error) {
            window.UIUtils.showError(data.error);
        } else {
            // Сохраняем результаты
            window.MessageHunter.lastSearchResults = {
                keywords: window.MessageHunter.keywords.slice(),
                results: data.results,
                groups_count: groupsToUse.length
            };
            
            // Отображаем результаты
            this.showResults(data.results, window.MessageHunter.keywords.join(', '));
            
            // Показываем кнопки действий
            window.UIUtils.safeToggleElement('saveBtn', true);
            window.UIUtils.safeToggleElement('analyzeBtn', true);
            window.UIUtils.safeToggleElement('clearBtn', true);
            
            // Сохраняем результаты в localStorage
            window.DataManager.SearchResults.save(
                data.results, 
                window.MessageHunter.keywords, 
                groupsToUse.length
            );
            
            window.UIUtils.showSuccess(`✅ Найдено ${data.results.length} сообщений`);
        }
    },
    
    /**
     * Обработка ошибки поиска
     * @param {Error} error - Объект ошибки
     */
    handleSearchError: function(error) {
        clearInterval(window.progressInterval);
        this.updateSearchUI(false);
        
        if (error.name === 'AbortError') {
            window.UIUtils.showWarning('Поиск остановлен пользователем');
        } else {
            window.UIUtils.showError('Произошла ошибка при поиске');
            console.error('Search Error:', error);
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
            fetch('/stop_search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    window.UIUtils.showWarning('🛑 Поиск остановлен');
                }
            })
            .catch(error => {
                console.error('Ошибка отправки сигнала остановки:', error);
            });
            
            this.updateSearchUI(false);
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
            if (searchBtn) searchBtn.disabled = true;
            if (stopBtn) stopBtn.style.display = 'inline-block';
        } else {
            if (loadingEl) loadingEl.style.display = 'none';
            if (searchBtn) searchBtn.disabled = false;
            if (stopBtn) stopBtn.style.display = 'none';
        }
    },
    
    /**
     * Получение глубины поиска
     */
    getSearchDepth: function() {
        const depthInput = document.getElementById('searchDepth');
        const value = parseInt(depthInput.value);
        
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
        
        if (window.progressInterval) {
            clearInterval(window.progressInterval);
        }
        
        window.progressInterval = setInterval(() => {
            if (currentGroup < totalGroups) {
                if (processedMessages < messagesPerGroup) {
                    processedMessages += Math.min(200, messagesPerGroup - processedMessages);
                    foundMessages += Math.floor(Math.random() * 3);
                    
                    const groupName = window.MessageHunter.allGroups.find(g => g.id === groupsToUse[currentGroup])?.title || `Группа ${currentGroup + 1}`;
                    
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
                        const nextGroupName = window.MessageHunter.allGroups.find(g => g.id === groupsToUse[currentGroup])?.title || `Группа ${currentGroup + 1}`;
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
            if (window.progressInterval) {
                clearInterval(window.progressInterval);
            }
        }, 300000);
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
        console.log('🔍 showResults вызвана с результатами:', results.length);
        
        window.MessageHunter.allSearchResults = results;
        window.MessageHunter.displayedResults = 0;
        
        const resultsDiv = document.getElementById('results');
        const messagesDiv = document.getElementById('messages');
        const countDiv = document.getElementById('resultsCount');
        
        if (!resultsDiv || !messagesDiv || !countDiv) {
            console.error('❌ Не найдены элементы для отображения результатов');