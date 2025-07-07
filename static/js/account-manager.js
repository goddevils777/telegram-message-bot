// ===============================
// УПРАВЛЕНИЕ АККАУНТАМИ
// static/js/account-manager.js
// ===============================

window.AccountManager = {
    
    /**
     * Загрузка информации об аккаунте
     */
    loadAccountInfo: function() {
        fetch('/get_account_info')
        .then(response => response.json())
        .then(data => {
            const accountInfoEl = document.getElementById('accountInfo');
            if (accountInfoEl && data.success) {
                accountInfoEl.innerHTML = `👤 ${data.account_name}<br>📱 ${data.phone || 'Локальный'}`;
            }
        })
        .catch(error => {
            console.log('Не удалось загрузить информацию об аккаунте');
        });
    },
    
    /**
     * Обновление отображения аккаунта во всех местах
     */
    updateAccountDisplay: function() {
        fetch('/get_account_info')
        .then(response => response.json())
        .then(data => {
            let accountText = 'Не определен';
            
            if (data.success) {
                accountText = `${data.account_name} | 📱 ${data.phone}`;
            }
            
            // Обновляем все элементы с информацией об аккаунте
            const elements = [
                'searchAccountInfo',
                'broadcastAccountInfo', 
                'autoSearchAccountInfo'
            ];
            
            elements.forEach(elementId => {
                const element = document.getElementById(elementId);
                if (element) {
                    element.textContent = accountText;
                }
            });
            
            console.log('✅ Информация об аккаунте обновлена');
        })
        .catch(error => {
            console.log('Не удалось загрузить информацию об аккаунте');
        });
    },
    
    /**
     * Смена аккаунта
     */
    switchAccount: function() {
        if (!window.UIUtils.showConfirm('Сменить текущий аккаунт?')) return;
        
        fetch('/switch_account')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.location.href = '/';
            } else {
                window.UIUtils.showError('Ошибка смены аккаунта');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            window.UIUtils.showError('Ошибка соединения');
        });
    },
    
    /**
     * Загрузка списка множественных аккаунтов
     */
    loadMultiAccounts: function() {
        console.log('👥 Загрузка множественных аккаунтов');
        const container = document.getElementById('multiAccountsContainer');
        const statsContainer = document.getElementById('accountsStats');
        
        if (container) {
            container.innerHTML = window.UIUtils.createLoadingElement('Загрузка аккаунтов...').outerHTML;
        }
        
        fetch('/get_multi_accounts')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.displayMultiAccounts(data.accounts);
                this.updateAccountsStats(data.active_count || 0, data.accounts.length);
            } else {
                if (container) {
                    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #dc3545;">Ошибка загрузки аккаунтов</div>';
                }
                window.UIUtils.showError('Ошибка загрузки аккаунтов');
            }
        })
        .catch(error => {
            console.error('Error loading accounts:', error);
            if (container) {
                container.innerHTML = '<div style="text-align: center; padding: 20px; color: #dc3545;">Ошибка соединения</div>';
            }
            window.UIUtils.showError('Ошибка соединения');
        });
    },
    
    /**
     * Отображение списка множественных аккаунтов
     * @param {Array} accounts - Массив аккаунтов
     */
    displayMultiAccounts: function(accounts) {
        const container = document.getElementById('multiAccountsContainer');
        
        if (!container) return;
        
        if (accounts.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <div style="font-size: 48px; margin-bottom: 15px;">👤</div>
                    <h3 style="color: #999; margin-bottom: 10px;">Нет доступных аккаунтов</h3>
                    <p style="color: #999; font-size: 14px;">Добавьте новый аккаунт для начала работы</p>
                    <button onclick="window.AccountManager.addNewAccount()" 
                            style="margin-top: 15px; padding: 10px 20px; background: #0088cc; color: white; border: none; border-radius: 8px; cursor: pointer;">
                        ➕ Добавить аккаунт
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = accounts.map(account => {
            const userInfo = account.info?.user_info || {};
            const firstName = userInfo.first_name || '';
            const lastName = userInfo.last_name || '';
            const phone = userInfo.phone || 'Неизвестно';
            
            return `
                <div class="account-item" style="
                    display: flex; 
                    align-items: center; 
                    padding: 15px; 
                    border-bottom: 1px solid #f1f3f4; 
                    transition: all 0.2s;
                    ${!account.is_active ? 'opacity: 0.7;' : ''}
                " onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='white'">
                    <input type="checkbox" 
                        class="account-toggle" 
                        id="account_${account.account_name}"
                        ${account.is_active ? 'checked' : ''}
                        onchange="window.AccountManager.toggleAccount('${account.account_name}')"
                        style="margin-right: 15px; width: 20px; height: 20px; transform: scale(1.2); cursor: pointer;">
                    
                    <div class="account-info" style="flex: 1;">
                        <div class="account-name" style="font-weight: 600; color: #333; margin-bottom: 5px; display: flex; align-items: center; gap: 10px;">
                            ${account.account_name}
                            ${account.is_current ? '<span style="background: #007bff; color: white; padding: 2px 6px; border-radius: 8px; font-size: 10px;">ТЕКУЩИЙ</span>' : ''}
                        </div>
                        <div class="account-details" style="font-size: 12px; color: #666;">
                            👤 ${firstName} ${lastName} | 📱 ${phone}
                        </div>
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="account-status" style="
                            padding: 4px 8px; 
                            border-radius: 12px; 
                            font-size: 11px; 
                            font-weight: 600;
                            ${account.is_active ? 
                                'background: #d4edda; color: #155724;' : 
                                'background: #f8d7da; color: #721c24;'
                            }
                        ">
                            ${account.is_active ? '✅ Активен' : '⏸️ Неактивен'}
                        </div>
                        
                        <div style="display: flex; gap: 5px;">
                            ${!account.is_current ? `
                                <button onclick="window.AccountManager.switchToAccount('${account.account_name}')"
                                        style="background: #007bff; color: white; border: none; padding: 4px 8px; border-radius: 6px; font-size: 10px; cursor: pointer;"
                                        title="Переключиться на этот аккаунт">
                                    🔄
                                </button>
                            ` : ''}
                            
                            <button onclick="window.AccountManager.removeAccount('${account.account_name}')"
                                    style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 6px; font-size: 10px; cursor: pointer;"
                                    title="Удалить аккаунт">
                                🗑️
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        console.log(`✅ Отображено ${accounts.length} аккаунтов`);
    },
    
    /**
     * Обновление статистики аккаунтов
     * @param {number} activeCount - Количество активных аккаунтов
     * @param {number} totalCount - Общее количество аккаунтов
     */
    updateAccountsStats: function(activeCount, totalCount) {
        const container = document.getElementById('accountsStats');
        
        if (!container) return;
        
        const inactiveCount = totalCount - activeCount;
        
        container.innerHTML = `
            <div class="stats-card" style="
                background: white; 
                padding: 20px; 
                border-radius: 10px; 
                text-align: center; 
                border: 2px solid #e1e8ed;
                transition: transform 0.2s;
            " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                <div class="stats-number" style="font-size: 32px; font-weight: bold; color: #0088cc; margin-bottom: 5px;">${totalCount}</div>
                <div class="stats-label" style="font-size: 14px; color: #666;">Всего аккаунтов</div>
            </div>
            
            <div class="stats-card" style="
                background: white; 
                padding: 20px; 
                border-radius: 10px; 
                text-align: center; 
                border: 2px solid #e1e8ed;
                transition: transform 0.2s;
            " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                <div class="stats-number" style="font-size: 32px; font-weight: bold; color: #28a745; margin-bottom: 5px;">${activeCount}</div>
                <div class="stats-label" style="font-size: 14px; color: #666;">Активных</div>
            </div>
            
            <div class="stats-card" style="
                background: white; 
                padding: 20px; 
                border-radius: 10px; 
                text-align: center; 
                border: 2px solid #e1e8ed;
                transition: transform 0.2s;
            " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                <div class="stats-number" style="font-size: 32px; font-weight: bold; color: #dc3545; margin-bottom: 5px;">${inactiveCount}</div>
                <div class="stats-label" style="font-size: 14px; color: #666;">Неактивных</div>
            </div>
        `;
        
        console.log(`📊 Статистика аккаунтов: ${activeCount}/${totalCount} активных`);
    },
    
    /**
     * Переключение активности аккаунта
     * @param {string} accountName - Имя аккаунта
     */
    toggleAccount: async function(accountName) {
        const checkbox = document.getElementById(`account_${accountName}`);
        if (!checkbox) return;
        
        const action = checkbox.checked ? 'activate' : 'deactivate';
        const originalState = checkbox.checked;
        
        try {
            // Блокируем чекбокс на время запроса
            checkbox.disabled = true;
            
            const response = await fetch('/toggle_account', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    account_name: accountName,
                    action: action
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                console.log(`✅ ${data.message}`);
                window.UIUtils.showSuccess(`✅ ${data.message}`);
                
                // Обновляем список через секунду
                setTimeout(() => {
                    this.loadMultiAccounts();
                }, 1000);
            } else {
                // Возвращаем чекбокс в исходное состояние
                checkbox.checked = !originalState;
                window.UIUtils.showError(data.error || 'Ошибка изменения статуса аккаунта');
            }
        } catch (error) {
            // Возвращаем чекбокс в исходное состояние
            checkbox.checked = !originalState;
            window.UIUtils.showError('Ошибка соединения');
            console.error('Toggle account error:', error);
        } finally {
            checkbox.disabled = false;
        }
    },
    
    /**
     * Переключение на другой аккаунт
     * @param {string} accountName - Имя аккаунта для переключения
     */
    switchToAccount: function(accountName) {
        if (!window.UIUtils.showConfirm(`Переключиться на аккаунт "${accountName}"?`)) return;
        
        window.UIUtils.showToast('🔄 Переключаемся на другой аккаунт...', 'info');
        
        fetch('/switch_to_account', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ account_name: accountName })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.UIUtils.showSuccess('✅ Аккаунт успешно переключен');
                
                // Очищаем кэш групп
                if (window.DataManager) {
                    window.DataManager.GroupsCache.clear();
                }
                
                // Перезагружаем страницу через секунду
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } else {
                window.UIUtils.showError(data.error || 'Ошибка переключения аккаунта');
            }
        })
        .catch(error => {
            window.UIUtils.showError('Ошибка соединения');
            console.error('Switch account error:', error);
        });
    },
    
    /**
     * Удаление аккаунта
     * @param {string} accountName - Имя аккаунта для удаления
     */
    removeAccount: function(accountName) {
        if (!window.UIUtils.showConfirm(
            `Удалить аккаунт "${accountName}"?\n\nВНИМАНИЕ: Это действие нельзя отменить!`
        )) return;
        
        window.UIUtils.showToast('🗑️ Удаляем аккаунт...', 'warning');
        
        fetch('/remove_account', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ account_name: accountName })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.UIUtils.showSuccess('✅ Аккаунт успешно удален');
                
                // Обновляем список
                setTimeout(() => {
                    this.loadMultiAccounts();
                }, 500);
            } else {
                window.UIUtils.showError(data.error || 'Ошибка удаления аккаунта');
            }
        })
        .catch(error => {
            window.UIUtils.showError('Ошибка соединения');
            console.error('Remove account error:', error);
        });
    },
    
    /**
     * Добавление нового аккаунта
     */
    addNewAccount: function() {
        // Открываем страницу добавления аккаунта в новой вкладке
        const newWindow = window.open('/switch_account', '_blank');
        
        if (!newWindow) {
            window.UIUtils.showError('Не удалось открыть окно добавления аккаунта. Проверьте настройки блокировщика попапов.');
            return;
        }
        
        window.UIUtils.showToast('🔄 Открыта страница добавления аккаунта', 'info');
        
        // Обновляем список через некоторое время (если пользователь добавит аккаунт)
        const refreshInterval = setInterval(() => {
            if (newWindow.closed) {
                clearInterval(refreshInterval);
                setTimeout(() => {
                    this.loadMultiAccounts();
                }, 1000);
            }
        }, 1000);
        
        // Очищаем интервал через 5 минут в любом случае
        setTimeout(() => {
            clearInterval(refreshInterval);
        }, 300000);
    },
    
    /**
     * Экспорт данных аккаунта
     */
    exportAccountData: function() {
        if (!window.UIUtils.showConfirm('Экспортировать данные текущего аккаунта?')) return;
        
        window.UIUtils.showToast('📥 Подготавливаем данные для экспорта...', 'info');
        
        fetch('/export_account_data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Создаем и скачиваем файл
                const blob = new Blob([JSON.stringify(data.data, null, 2)], { 
                    type: 'application/json' 
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `message_hunter_export_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                window.UIUtils.showSuccess('✅ Данные экспортированы');
            } else {
                window.UIUtils.showError(data.error || 'Ошибка экспорта данных');
            }
        })
        .catch(error => {
            window.UIUtils.showError('Ошибка экспорта данных');
            console.error('Export error:', error);
        });
    },
    
    /**
     * Импорт данных аккаунта
     */
    importAccountData: function() {
        // Создаем элемент выбора файла
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const importData = JSON.parse(event.target.result);
                    this.processImportData(importData);
                } catch (error) {
                    window.UIUtils.showError('Ошибка чтения файла: неверный формат JSON');
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    },
    
    /**
     * Обработка импортированных данных
     * @param {Object} importData - Импортированные данные
     */
    processImportData: function(importData) {
        if (!importData.version || !importData.data) {
            window.UIUtils.showError('Неверный формат файла импорта');
            return;
        }
        
        if (!window.UIUtils.showConfirm(
            `Импортировать данные от ${importData.exported_at}?\n\nТекущие данные будут перезаписаны!`
        )) return;
        
        window.UIUtils.showToast('📤 Импортируем данные...', 'info');
        
        fetch('/import_account_data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(importData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.UIUtils.showSuccess('✅ Данные успешно импортированы');
                
                // Обновляем интерфейс
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } else {
                window.UIUtils.showError(data.error || 'Ошибка импорта данных');
            }
        })
        .catch(error => {
            window.UIUtils.showError('Ошибка импорта данных');
            console.error('Import error:', error);
        });
    }
};

// Глобальные функции для обратной совместимости
window.switchAccount = window.AccountManager.switchAccount.bind(window.AccountManager);

console.log('✅ AccountManager модуль загружен');