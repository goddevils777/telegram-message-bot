// ===============================
// УПРАВЛЕНИЕ АВТОПОИСКОМ
// static/js/autosearch-manager.js
// ===============================

window.AutoSearchManager = {
    
    // Состояние автопоиска
    isActive: false,
    pollInterval: null,
    POLL_INTERVAL: 20000, // 20 секунд
    
    /**
     * Загрузка групп для автопоиска
     */
    loadGroups: function() {
        console.log('🔄 Загружаем группы для автопоиска...');
        
        if (window.MessageHunter.allGroups.length === 0) {
            console.log('⚠️ Группы не загружены, запускаем загрузку...');
            if (window.GroupsManager) {
                window.GroupsManager.loadGroups();
            }
            return;
        }
        
        // Загружаем сохраненные выборы
        window.MessageHunter.autoSearchGroups = window.DataManager.SelectedGroups.load('autosearch');
        
        const autoContainer = document.getElementById('autoSearchGroupsContainer');
        if (autoContainer) {
            const autoHTML = window.MessageHunter.allGroups.map(group => `
                <div class="group-item">
                    <input type="checkbox" 
                        class="group-checkbox" 
                        name="autosearch-groups"
                        value="${group.id}"
                        id="auto_group_${group.id}"
                        ${window.MessageHunter.autoSearchGroups.includes(group.id) ? 'checked' : ''}
                        onchange="window.GroupsManager.toggleAutoSearchGroup('${group.id}')">
                    <label for="auto_group_${group.id}" class="group-info">
                        <div class="group-title">${group.title}</div>
                        <div class="group-type">👥 ${group.members_count || 0} участников</div>
                    </label>
                </div>
            `).join('');
            autoContainer.innerHTML = autoHTML;
            
            window.UIUtils.updateCounter('autosearch', window.MessageHunter.autoSearchGroups.length, window.MessageHunter.allGroups.length);
            console.log('✅ Группы автопоиска отображены');
        }
    },
    
    /**
     * Обновление групп автопоиска
     */
    refreshGroups: function() {
        console.log('🔄 Обновляем группы автопоиска...');
        
        const container = document.getElementById('autoSearchGroupsContainer');
        if (container) {
            container.innerHTML = window.UIUtils.createLoadingElement('Обновление групп...').outerHTML;
        }
        
        setTimeout(() => {
            this.loadGroups();
            window.UIUtils.showSuccess('✅ Список групп обновлен');
        }, 500);
    },
    
    /**
     * Добавление ключевого слова для автопоиска
     */
    addKeyword: function() {
        const input = document.getElementById('autoKeywordInput');
        const word = input ? input.value.trim().toLowerCase() : '';
        
        if (!word) {
            window.UIUtils.showError('Введите слово для добавления');
            return;
        }
        
        if (word.includes(' ')) {
            window.UIUtils.showError('Можно добавлять только одно слово за раз');
            return;
        }
        
        if (window.MessageHunter.autoSearchKeywords.includes(word)) {
            window.UIUtils.showError('Это слово уже добавлено');
            return;
        }
        
        window.MessageHunter.autoSearchKeywords.push(word);
        if (input) input.value = '';
        
        this.updateKeywordsDisplay();
        this.saveKeywords();
        
        console.log(`➕ Добавлено ключевое слово автопоиска: ${word}`);
    },
    
    /**
     * Удаление ключевого слова автопоиска
     * @param {string} word - Слово для удаления
     */
    removeKeyword: function(word) {
        window.MessageHunter.autoSearchKeywords = window.MessageHunter.autoSearchKeywords.filter(k => k !== word);
        this.updateKeywordsDisplay();
        this.saveKeywords();
        console.log(`➖ Удалено ключевое слово автопоиска: ${word}`);
    },
    
    /**
     * Обновление отображения ключевых слов
     */
    updateKeywordsDisplay: function() {
        const display = document.getElementById('autoKeywordsDisplay');
        if (!display) return;
        
        const keywords = window.MessageHunter.autoSearchKeywords;
        
        if (keywords.length === 0) {
            display.innerHTML = '<span style="color: #666; font-style: italic;">Добавьте слова для мониторинга...</span>';
        } else {
            display.innerHTML = keywords.map(word => 
                `<span class="keyword-tag">
                    ${word}
                    <span class="remove-btn" onclick="window.AutoSearchManager.removeKeyword('${word}')">×</span>
                </span>`
            ).join('');
        }
    },
    
    /**
     * Сохранение ключевых слов
     */
    saveKeywords: function() {
        window.DataManager.save(
            window.DataManager.STORAGE_KEYS.AUTOSEARCH_KEYWORDS, 
            window.MessageHunter.autoSearchKeywords,
            7 * 24 * 60 * 60 * 1000 // 7 дней
        );
    },
    
    /**
     * Загрузка сохраненных ключевых слов
     */
    loadKeywords: function() {
        const saved = window.DataManager.load(window.DataManager.STORAGE_KEYS.AUTOSEARCH_KEYWORDS);
        if (saved && Array.isArray(saved)) {
            window.MessageHunter.autoSearchKeywords = saved;
            this.updateKeywordsDisplay();
        }
    },
    
    /**
     * Запуск автопоиска
     */
    startAutoSearch: function() {
        if (window.MessageHunter.autoSearchKeywords.length === 0) {
            window.UIUtils.showError('Добавьте ключевые слова для мониторинга');
            return;
        }
        
        if (window.MessageHunter.autoSearchGroups.length === 0) {
            window.UIUtils.showError('Выберите группы для мониторинга');
            return;
        }
        
        console.log('⚡ Запускаем автопоиск...');
        
        fetch('/start_auto_search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                keywords: window.MessageHunter.autoSearchKeywords,
                groups: window.MessageHunter.autoSearchGroups
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.isActive = true;
                window.MessageHunter.autoSearchActive = true;
                this.updateUI();
                this.startPolling();
                window.UIUtils.showSuccess('✅ Автопоиск запущен!');
                
                // Сохраняем состояние
                this.saveState();
            } else {
                window.UIUtils.showError('❌ Ошибка запуска: ' + (data.error || 'Неизвестная ошибка'));
            }
        })
        .catch(error => {
            window.UIUtils.showError('❌ Ошибка соединения');
            console.error('AutoSearch start error:', error);
        });
    },
    
    /**
     * Остановка автопоиска
     */
    stopAutoSearch: function() {
        console.log('⏹️ Останавливаем автопоиск...');
        
        fetch('/stop_auto_search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.isActive = false;
                window.MessageHunter.autoSearchActive = false;
                this.updateUI();
                this.stopPolling();
                window.UIUtils.showSuccess('⏹️ Автопоиск остановлен');
                
                // Сохраняем состояние
                this.saveState();
            } else {
                window.UIUtils.showError('❌ Ошибка остановки: ' + (data.error || 'Неизвестная ошибка'));
            }
        })
        .catch(error => {
            window.UIUtils.showError('❌ Ошибка соединения');
            console.error('AutoSearch stop error:', error);
        });
    },
    
    /**
     * Обновление интерфейса автопоиска
     */
    updateUI: function() {
        const startBtn = document.getElementById('startAutoSearchBtn');
        const stopBtn = document.getElementById('stopAutoSearchBtn');
        const statusInfo = document.getElementById('autoSearchStatusInfo');
        const resultsDiv = document.getElementById('autoSearchResults');
        
        if (this.isActive) {
            if (startBtn) startBtn.style.display = 'none';
            if (stopBtn) stopBtn.style.display = 'block';
            
            if (statusInfo) {
                statusInfo.innerHTML = `
                    <div style="font-weight: 600; color: #28a745;">📊 Статус: ⚡ Мониторинг активен</div>
                    <div style="font-size: 14px; color: #28a745; margin-top: 5px;">
                        👁️ Отслеживаем ${window.MessageHunter.autoSearchGroups.length} групп по ${window.MessageHunter.autoSearchKeywords.length} словам<br>
                        🔄 Глубокая проверка каждые 30 сек | 📊 Ловим ВСЕ новые сообщения
                    </div>
                `;
                statusInfo.style.background = '#d4edda';
                statusInfo.style.borderLeft = '4px solid #28a745';
            }
            
            if (resultsDiv) resultsDiv.style.display = 'block';
            
        } else {
            if (startBtn) startBtn.style.display = 'block';
            if (stopBtn) stopBtn.style.display = 'none';
            
            if (statusInfo) {
                statusInfo.innerHTML = `
                    <div style="font-weight: 600; color: #495057;">📊 Статус: ⏹️ Остановлен</div>
                    <div style="font-size: 14px; color: #6c757d; margin-top: 5px;">
                        Настройте группы и ключевые слова, затем запустите мониторинг
                    </div>
                `;
                statusInfo.style.background = '#e9ecef';
                statusInfo.style.borderLeft = 'none';
            }
        }
    },
    
    /**
     * Запуск опроса результатов
     */
    startPolling: function() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
        
        this.pollInterval = setInterval(() => {
            if (this.isActive) {
                this.fetchResults();
            }
        }, this.POLL_INTERVAL);
        
        console.log(`🔄 Запущен опрос результатов автопоиска (каждые ${this.POLL_INTERVAL/1000} сек)`);
    },
    
    /**
     * Остановка опроса результатов
     */
    stopPolling: function() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        console.log('⏹️ Остановлен опрос результатов автопоиска');
    },
    
    /**
     * Получение новых результатов с сервера
     */
    fetchResults: function() {
        fetch('/get_auto_search_results')
        .then(response => response.json())
        .then(data => {
            if (data.success && data.new_messages && data.new_messages.length > 0) {
                this.addNewResults(data.new_messages);
                this.updateResultsCount();
                
                // Уведомление о новых находках
                this.showNotification(data.new_messages.length);
            }
            
            // Обновляем статус если изменился
            if (data.active !== this.isActive) {
                this.isActive = data.active;
                window.MessageHunter.autoSearchActive = data.active;
                this.updateUI();
                if (!this.isActive) {
                    this.stopPolling();
                }
            }
        })
        .catch(error => {
            console.error('Ошибка получения результатов автопоиска:', error);
        });
    },
    
    /**
     * Добавление новых результатов в интерфейс
     * @param {Array} newMessages - Новые сообщения
     */
    addNewResults: function(newMessages) {
        console.log(`🔥 Получено ${newMessages.length} новых сообщений для автопоиска`);
        
        const messagesContainer = document.getElementById('autoMessages');
        if (!messagesContainer) return;
        
        // Если это первые результаты, очищаем заглушку
        if (window.MessageHunter.autoFoundMessages.length === 0) {
            messagesContainer.innerHTML = '';
        }
        
        // Добавляем новые сообщения в начало массива
        newMessages.forEach(msg => {
            window.MessageHunter.autoFoundMessages.unshift(msg);
            
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message';
            messageDiv.style.borderLeft = '4px solid #28a745';
            messageDiv.style.animation = 'fadeIn 0.5s ease-in';
            messageDiv.style.marginBottom = '15px';
            
            const messageDate = new Date(msg.timestamp);
            const now = new Date();
            const diffSeconds = Math.floor((now - messageDate) / 1000);
            
            let freshnessIndicator = '🔥 Только что';
            if (diffSeconds > 60) {
                const minutes = Math.floor(diffSeconds / 60);
                freshnessIndicator = `⚡ ${minutes} мин назад`;
            }
            
            messageDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <span style="color: #28a745; font-weight: 600; font-size: 14px;">
                        ${freshnessIndicator}
                    </span>
                    <div style="text-align: right; font-size: 12px; color: #666;">
                        <div>👤 ${msg.author}</div>
                        <div>📂 ${msg.chat}</div>
                    </div>
                </div>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 10px;">
                    ${msg.text}
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div class="matched-words">
                        🎯 Найдено: ${msg.matched_words.map(word => `<span style="background: #fff3cd; padding: 2px 6px; border-radius: 8px; font-size: 12px; margin: 0 2px;">${word}</span>`).join('')}
                    </div>
                    <a href="${this.generateMessageLink(msg)}" target="_blank" class="btn-link">
                        🔗 Открыть в Telegram
                    </a>
                </div>
            `;
            
            messagesContainer.insertBefore(messageDiv, messagesContainer.firstChild);
        });
        
        // Сохраняем результаты
        this.saveResults();
    },
    
    /**
     * Генерация ссылки на сообщение
     * @param {Object} msg - Объект сообщения
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
     * Показ уведомления о новых находках
     * @param {number} count - Количество новых сообщений
     */
    showNotification: function(count) {
        // Создаем уведомление
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(40, 167, 69, 0.3);
            z-index: 9999;
            font-weight: 600;
            animation: slideInRight 0.3s ease-out;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 20px;">🎯</span>
                <div>
                    <div>Новые находки!</div>
                    <div style="font-size: 12px; opacity: 0.9;">Найдено ${count} сообщений</div>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Проигрываем звук
        this.playNotificationSound();
        
        // Убираем через 4 секунды
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => notification.remove(), 300);
            }
        }, 4000);
    },
    
    /**
     * Проигрывание звука уведомления
     */
    playNotificationSound: function() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
        } catch (e) {
            // Звук не критичен, игнорируем ошибки
        }
    },
    
    /**
     * Обновление счетчика результатов
     */
    updateResultsCount: function() {
        const countEl = document.getElementById('autoResultsCount');
        if (countEl) {
            countEl.textContent = `Найдено: ${window.MessageHunter.autoFoundMessages.length} сообщений`;
        }
    },
    
    /**
     * Очистка результатов автопоиска
     */
    clearResults: function() {
        if (window.MessageHunter.autoFoundMessages.length === 0) {
            window.UIUtils.showError('❌ Нет результатов для очистки');
            return;
        }
        
        if (!window.UIUtils.showConfirm('Очистить все результаты автопоиска?')) return;
        
        window.MessageHunter.autoFoundMessages = [];
        const messagesContainer = document.getElementById('autoMessages');
        if (messagesContainer) {
            messagesContainer.innerHTML = `
                <div style="text-align: center; padding: 30px; color: #666;">
                    <div style="font-size: 48px; margin-bottom: 15px;">🗑️</div>
                    <h3>Результаты очищены</h3>
                    <p>Новые найденные сообщения будут появляться здесь</p>
                </div>
            `;
        }
        
        // Удаляем из сохранения
        window.DataManager.AutoSearchResults.clear();
        this.updateResultsCount();
        window.UIUtils.showSuccess('✅ Результаты автопоиска очищены');
    },
    
    /**
     * Сохранение результатов автопоиска
     */
    saveResults: function() {
        window.DataManager.AutoSearchResults.save(
            window.MessageHunter.autoFoundMessages,
            window.MessageHunter.autoSearchKeywords
        );
    },
    
    /**
     * Загрузка сохраненных результатов
     */
    loadSavedResults: function() {
        const savedData = window.DataManager.AutoSearchResults.load();
        if (!savedData) return;
        
        console.log('🔄 Восстанавливаю результаты автопоиска...');
        
        if (savedData.messages && Array.isArray(savedData.messages)) {
            window.MessageHunter.autoFoundMessages = savedData.messages.slice();
            this.displaySavedResults();
        }
        
        if (savedData.keywords && Array.isArray(savedData.keywords)) {
            window.MessageHunter.autoSearchKeywords = savedData.keywords.slice();
            this.updateKeywordsDisplay();
        }
        
        console.log(`✅ Восстановлено результатов автопоиска: ${window.MessageHunter.autoFoundMessages.length}`);
    },
    
    /**
     * Отображение сохраненных результатов
     */
    displaySavedResults: function() {
        const messagesContainer = document.getElementById('autoMessages');
        if (!messagesContainer || window.MessageHunter.autoFoundMessages.length === 0) return;
        
        messagesContainer.innerHTML = '';
        
        window.MessageHunter.autoFoundMessages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message';
            messageDiv.style.borderLeft = '4px solid #28a745';
            messageDiv.style.marginBottom = '15px';
            
            const messageDate = new Date(msg.timestamp);
            
            messageDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span style="color: #28a745; font-weight: 600;">
                        📅 ${messageDate.toLocaleDateString()} ${messageDate.toLocaleTimeString()}
                    </span>
                    <div style="text-align: right; font-size: 12px; color: #666;">
                        <div>👤 ${msg.author}</div>
                        <div>📂 ${msg.chat}</div>
                    </div>
                </div>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 10px;">
                    ${msg.text}
                </div>
                
                <div class="matched-words">
                    🎯 Найдено: ${msg.matched_words.map(word => `<span style="background: #fff3cd; padding: 2px 6px; border-radius: 8px; font-size: 12px; margin: 0 2px;">${word}</span>`).join(' ')}
                </div>
            `;
            
            messagesContainer.appendChild(messageDiv);
        });
        
        this.updateResultsCount();
    },
    
    /**
     * Обновление информации об аккаунте
     */
    updateAccountInfo: function() {
        if (window.AccountManager) {
            window.AccountManager.updateAccountDisplay();
        }
    },
    
    /**
     * Проверка статуса автопоиска
     */
    checkStatus: function() {
        fetch('/get_auto_search_status')
        .then(response => response.json())
        .then(data => {
            if (data.success && data.active) {
                this.isActive = data.active;
                window.MessageHunter.autoSearchActive = data.active;
                
                if (data.keywords && Array.isArray(data.keywords)) {
                    window.MessageHunter.autoSearchKeywords = data.keywords;
                }
                
                console.log('🔄 Восстановлено состояние автопоиска: активен');
                
                this.updateKeywordsDisplay();
                this.updateUI();
                this.startPolling();
            }
        })
        .catch(error => {
            console.log('Не удалось проверить статус автопоиска:', error);
        });
    },
    
    /**
     * Сохранение состояния автопоиска
     */
    saveState: function() {
        const state = {
            isActive: this.isActive,
            keywords: window.MessageHunter.autoSearchKeywords,
            groups: window.MessageHunter.autoSearchGroups,
            timestamp: Date.now()
        };
        
        window.DataManager.save('autosearch_state', state, 24 * 60 * 60 * 1000);
    },
    
    /**
     * Загрузка состояния автопоиска
     */
    loadState: function() {
        const state = window.DataManager.load('autosearch_state');
        if (state) {
            this.isActive = state.isActive || false;
            window.MessageHunter.autoSearchActive = this.isActive;
            
            if (state.keywords) {
                window.MessageHunter.autoSearchKeywords = state.keywords;
            }
            
            if (state.groups) {
                window.MessageHunter.autoSearchGroups = state.groups;
            }
            
            this.updateUI();
            this.updateKeywordsDisplay();
            
            if (this.isActive) {
                this.startPolling();
            }
        }
    }
};

// Глобальные функции для обратной совместимости
window.addAutoKeyword = window.AutoSearchManager.addKeyword.bind(window.AutoSearchManager);
window.removeAutoKeyword = window.AutoSearchManager.removeKeyword.bind(window.AutoSearchManager);
window.startAutoSearch = window.AutoSearchManager.startAutoSearch.bind(window.AutoSearchManager);
window.stopAutoSearch = window.AutoSearchManager.stopAutoSearch.bind(window.AutoSearchManager);
window.clearAutoResults = window.AutoSearchManager.clearResults.bind(window.AutoSearchManager);
window.refreshAutoSearchGroups = window.AutoSearchManager.refreshGroups.bind(window.AutoSearchManager);

console.log('✅ AutoSearchManager модуль загружен');