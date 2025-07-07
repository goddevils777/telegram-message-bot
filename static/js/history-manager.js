// ===============================
// УПРАВЛЕНИЕ ИСТОРИЕЙ ПОИСКА
// static/js/history-manager.js
// ===============================

window.HistoryManager = {
    
    /**
     * Загрузка истории поиска
     */
    loadHistory: function() {
        console.log('📚 Загружаем историю поиска...');
        
        const container = document.getElementById('historyContainer');
        if (!container) {
            console.warn('⚠️ Контейнер истории не найден');
            return;
        }
        
        // Показываем индикатор загрузки
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">🔄 Загрузка истории...</div>';
        
        fetch('/get_history')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.displayHistory(data.history);
                console.log(`✅ История загружена: ${data.history.length} записей`);
            } else {
                container.innerHTML = '<div style="text-align: center; padding: 20px; color: #dc3545;">❌ Ошибка загрузки истории</div>';
                console.error('❌ Ошибка загрузки истории:', data.error);
            }
        })
        .catch(error => {
            console.error('❌ Ошибка запроса истории:', error);
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: #dc3545;">❌ Ошибка загрузки истории</div>';
        });
    },
    
    /**
     * Отображение истории поиска
     * @param {Array} history - Массив записей истории
     */
    displayHistory: function(history) {
        console.log(`📋 Отображаем историю: ${history.length} записей`);
        
        const container = document.getElementById('historyContainer');
        if (!container) return;
        
        if (history.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <div style="font-size: 48px; margin-bottom: 15px;">📝</div>
                    <h3>История поиска пуста</h3>
                    <p>Выполните первый поиск, и результаты появятся здесь</p>
                </div>
            `;
            return;
        }
        
        // Создаем HTML для записей истории
        const historyHTML = history.map(item => this.createHistoryItemHTML(item)).join('');
        
        container.innerHTML = `
            <div style="margin-bottom: 20px; text-align: right;">
                <button class="back-btn" onclick="window.HistoryManager.clearHistory()" 
                        style="background: #dc3545; color: white;">
                    🗑️ Очистить всю историю
                </button>
            </div>
            ${historyHTML}
        `;
    },
    
    /**
     * Создание HTML для одной записи истории
     * @param {Object} item - Запись истории
     * @returns {string} HTML строка
     */
    createHistoryItemHTML: function(item) {
        return `
            <div class="history-item" style="
                background: white; 
                border: 1px solid #ddd; 
                border-radius: 10px; 
                margin-bottom: 15px; 
                padding: 20px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            ">
                <div class="history-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                    <div class="history-keywords">
                        ${item.keywords.map(keyword => 
                            `<span class="history-keyword" style="
                                background: #e3f2fd; 
                                color: #1976d2; 
                                padding: 4px 8px; 
                                border-radius: 15px; 
                                font-size: 12px; 
                                margin-right: 5px;
                                display: inline-block;
                                margin-bottom: 5px;
                            ">${keyword}</span>`
                        ).join('')}
                    </div>
                    <div class="history-date" style="color: #666; font-size: 12px; white-space: nowrap;">
                        📅 ${item.date}
                    </div>
                </div>
                
                <div class="history-stats" style="
                    background: #f8f9fa; 
                    padding: 10px; 
                    border-radius: 8px; 
                    margin-bottom: 15px;
                    font-size: 14px;
                    color: #495057;
                ">
                    📊 Найдено: <strong>${item.results_count}</strong> сообщений в <strong>${item.groups_count}</strong> группах
                </div>
                
                <div class="history-actions" style="display: flex; gap: 10px;">
                    <button class="history-btn repeat-btn" 
                            onclick="window.HistoryManager.repeatSearch(${item.id})"
                            style="
                                background: #28a745; 
                                color: white; 
                                border: none; 
                                padding: 8px 16px; 
                                border-radius: 5px; 
                                cursor: pointer;
                                font-size: 12px;
                                display: flex;
                                align-items: center;
                                gap: 5px;
                            ">
                        🔄 Повторить поиск
                    </button>
                    <button class="history-btn delete-btn" 
                            onclick="window.HistoryManager.deleteHistoryItem(${item.id})"
                            style="
                                background: #dc3545; 
                                color: white; 
                                border: none; 
                                padding: 8px 16px; 
                                border-radius: 5px; 
                                cursor: pointer;
                                font-size: 12px;
                                display: flex;
                                align-items: center;
                                gap: 5px;
                            ">
                        🗑️ Удалить
                    </button>
                    ${item.results_count > 0 ? `
                        <button class="history-btn view-btn" 
                                onclick="window.HistoryManager.viewHistoryResults(${item.id})"
                                style="
                                    background: #007bff; 
                                    color: white; 
                                    border: none; 
                                    padding: 8px 16px; 
                                    border-radius: 5px; 
                                    cursor: pointer;
                                    font-size: 12px;
                                    display: flex;
                                    align-items: center;
                                    gap: 5px;
                                ">
                            👁️ Просмотр
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    },
    
    /**
     * Сохранение текущего поиска в историю
     */
    saveCurrentSearch: function() {
        console.log('💾 Сохраняем текущий поиск в историю...');
        
        if (!window.MessageHunter.lastSearchResults) {
            window.UIUtils.showError('❌ Нет результатов для сохранения');
            return;
        }
        
        const searchData = {
            keywords: window.MessageHunter.lastSearchResults.keywords || [],
            results_count: window.MessageHunter.lastSearchResults.results?.length || 0,
            groups_count: window.MessageHunter.lastSearchResults.groups_count || 0,
            results: window.MessageHunter.lastSearchResults.results || []
        };
        
        // Валидация данных
        if (searchData.keywords.length === 0) {
            window.UIUtils.showError('❌ Отсутствуют ключевые слова для сохранения');
            return;
        }
        
        // Блокируем кнопку сохранения
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = '💾 Сохраняю...';
        }
        
        fetch('/save_search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(searchData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Скрываем кнопку сохранения
                if (saveBtn) {
                    saveBtn.style.display = 'none';
                }
                
                window.UIUtils.showToast('✅ Поиск сохранён в историю', 'success');
                console.log('✅ Поиск успешно сохранен в историю');
                
                // Обновляем историю если она открыта
                if (window.TabManager.getActiveTab() === 'history') {
                    setTimeout(() => {
                        this.loadHistory();
                    }, 500);
                }
            } else {
                throw new Error(data.error || 'Неизвестная ошибка сервера');
            }
        })
        .catch(error => {
            window.UIUtils.showError('❌ Ошибка сохранения: ' + error.message);
            console.error('❌ Ошибка сохранения в историю:', error);
        })
        .finally(() => {
            // Восстанавливаем кнопку
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = '💾 Сохранить поиск';
            }
        });
    },
    
    /**
     * Повторить поиск из истории
     * @param {number} searchId - ID поиска в истории
     */
    repeatSearch: function(searchId) {
        console.log(`🔄 Повторяем поиск ID: ${searchId}`);
        
        // Переключаемся на вкладку поиска
        window.TabManager.switchTab('search');
        
        // Показываем уведомление о том, что функция в разработке
        window.UIUtils.showToast('🚧 Функция повторного поиска в разработке', 'info');
        
        // TODO: Реализовать загрузку параметров поиска и его выполнение
        // fetch(`/get_search_details/${searchId}`)
        // .then(response => response.json())
        // .then(data => {
        //     if (data.success) {
        //         // Восстанавливаем ключевые слова
        //         window.MessageHunter.keywords = data.keywords;
        //         window.SearchManager.updateKeywordsDisplay();
        //         
        //         // Восстанавливаем выбранные группы
        //         window.MessageHunter.selectedGroups = data.selected_groups;
        //         window.GroupsManager.restoreSelections('search');
        //         
        //         // Запускаем поиск
        //         window.SearchManager.performSearch();
        //     }
        // });
    },
    
    /**
     * Удалить запись из истории
     * @param {number} searchId - ID поиска для удаления
     */
    deleteHistoryItem: function(searchId) {
        console.log(`🗑️ Удаляем запись истории ID: ${searchId}`);
        
        if (!confirm('❓ Удалить этот поиск из истории?')) {
            return;
        }
        
        fetch(`/delete_search/${searchId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.UIUtils.showToast('✅ Запись удалена из истории', 'success');
                console.log('✅ Запись успешно удалена');
                
                // Перезагружаем историю
                this.loadHistory();
            } else {
                throw new Error(data.error || 'Ошибка удаления');
            }
        })
        .catch(error => {
            window.UIUtils.showError('❌ Ошибка удаления: ' + error.message);
            console.error('❌ Ошибка удаления записи:', error);
        });
    },
    
    /**
     * Просмотр результатов из истории
     * @param {number} searchId - ID поиска для просмотра
     */
    viewHistoryResults: function(searchId) {
        console.log(`👁️ Просматриваем результаты поиска ID: ${searchId}`);
        
        // Переключаемся на вкладку поиска
        window.TabManager.switchTab('search');
        
        // Показываем индикатор загрузки
        const resultsDiv = document.getElementById('results');
        const messagesDiv = document.getElementById('messages');
        
        if (resultsDiv) {
            resultsDiv.style.display = 'block';
        }
        
        if (messagesDiv) {
            messagesDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">🔄 Загружаем результаты из истории...</div>';
        }
        
        fetch(`/get_search_results/${searchId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.results) {
                // Восстанавливаем результаты
                window.MessageHunter.lastSearchResults = {
                    keywords: data.keywords || [],
                    results: data.results,
                    groups_count: data.groups_count || 0
                };
                
                // Отображаем результаты
                window.SearchManager.showResults(
                    data.results, 
                    data.keywords.join(', '),
                    []
                );
                
                // Скрываем кнопку сохранения (результаты уже сохранены)
                const saveBtn = document.getElementById('saveBtn');
                if (saveBtn) {
                    saveBtn.style.display = 'none';
                }
                
                window.UIUtils.showToast('✅ Результаты загружены из истории', 'success');
                console.log('✅ Результаты успешно загружены из истории');
                
            } else {
                throw new Error(data.error || 'Результаты не найдены');
            }
        })
        .catch(error => {
            window.UIUtils.showError('❌ Ошибка загрузки результатов: ' + error.message);
            console.error('❌ Ошибка загрузки результатов из истории:', error);
            
            if (messagesDiv) {
                messagesDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #dc3545;">❌ Ошибка загрузки результатов</div>';
            }
        });
    },
    
    /**
     * Очистка всей истории поиска
     */
    clearHistory: function() {
        console.log('🗑️ Очищаем всю историю поиска...');
        
        if (!confirm('❓ Очистить всю историю поиска? Это действие нельзя отменить.')) {
            return;
        }
        
        const container = document.getElementById('historyContainer');
        if (container) {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">🔄 Очищаем историю...</div>';
        }
        
        fetch('/clear_history', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.UIUtils.showToast('✅ История поиска очищена', 'success');
                console.log('✅ История успешно очищена');
                
                // Показываем пустую историю
                this.displayHistory([]);
            } else {
                throw new Error(data.error || 'Ошибка очистки истории');
            }
        })
        .catch(error => {
            window.UIUtils.showError('❌ Ошибка очистки истории: ' + error.message);
            console.error('❌ Ошибка очистки истории:', error);
            
            // Перезагружаем историю
            this.loadHistory();
        });
    },
    
    /**
     * Экспорт истории в файл
     */
    exportHistory: function() {
        console.log('📄 Экспортируем историю поиска...');
        
        fetch('/export_history')
        .then(response => {
            if (response.ok) {
                return response.blob();
            } else {
                throw new Error('Ошибка экспорта истории');
            }
        })
        .then(blob => {
            // Создаем ссылку для скачивания
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `message_hunter_history_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            window.UIUtils.showToast('✅ История экспортирована', 'success');
            console.log('✅ История успешно экспортирована');
        })
        .catch(error => {
            window.UIUtils.showError('❌ Ошибка экспорта: ' + error.message);
            console.error('❌ Ошибка экспорта истории:', error);
        });
    },
    
    /**
     * Получение статистики истории
     */
    getHistoryStats: function() {
        console.log('📊 Получаем статистику истории...');
        
        fetch('/get_history_stats')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.displayHistoryStats(data.stats);
            } else {
                console.error('❌ Ошибка получения статистики:', data.error);
            }
        })
        .catch(error => {
            console.error('❌ Ошибка запроса статистики:', error);
        });
    },
    
    /**
     * Отображение статистики истории
     * @param {Object} stats - Статистика истории
     */
    displayHistoryStats: function(stats) {
        const statsHTML = `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0; color: #495057;">📊 Статистика истории</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
                    <div style="text-align: center;">
                        <div style="font-size: 24px; font-weight: bold; color: #007bff;">${stats.total_searches || 0}</div>
                        <div style="font-size: 12px; color: #666;">Всего поисков</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 24px; font-weight: bold; color: #28a745;">${stats.total_results || 0}</div>
                        <div style="font-size: 12px; color: #666;">Найдено сообщений</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 24px; font-weight: bold; color: #6f42c1;">${stats.unique_keywords || 0}</div>
                        <div style="font-size: 12px; color: #666;">Уникальных слов</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 24px; font-weight: bold; color: #fd7e14;">${stats.groups_searched || 0}</div>
                        <div style="font-size: 12px; color: #666;">Групп обработано</div>
                    </div>
                </div>
            </div>
        `;
        
        const container = document.getElementById('historyContainer');
        if (container) {
            container.insertAdjacentHTML('afterbegin', statsHTML);
        }
    }
};

// Глобальные функции для обратной совместимости
function saveCurrentSearch() {
    window.HistoryManager.saveCurrentSearch();
}

function repeatSearch(searchId) {
    window.HistoryManager.repeatSearch(searchId);
}

function deleteHistoryItem(searchId) {
    window.HistoryManager.deleteHistoryItem(searchId);
}

function clearHistory() {
    window.HistoryManager.clearHistory();
}

console.log('✅ HistoryManager загружен и готов к работе');