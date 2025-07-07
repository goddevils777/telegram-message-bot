// ===============================
// УТИЛИТЫ ПОЛЬЗОВАТЕЛЬСКОГО ИНТЕРФЕЙСА
// static/js/ui-utils.js
// ===============================

window.UIUtils = {
    
    /**
     * Показать уведомление пользователю
     * @param {string} message - Текст сообщения
     * @param {string} type - Тип: 'info', 'success', 'error', 'warning'
     * @param {number} duration - Длительность показа в мс (по умолчанию 3000)
     */
    showToast: function(message, type = 'info', duration = 3000) {
        console.log(`📢 ${type.toUpperCase()}: ${message}`);
        
        // Определяем цвет по типу
        const colors = {
            info: '#007bff',
            success: '#28a745', 
            error: '#dc3545',
            warning: '#ffc107'
        };
        
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: ${type === 'warning' ? '#000' : '#fff'};
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10000;
            font-size: 14px;
            font-weight: 500;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideInRight 0.3s ease-out;
        `;
        
        toast.textContent = message;
        document.body.appendChild(toast);
        
        // Убираем через указанное время
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }
        }, duration);
    },
    
    /**
     * Показать ошибку (сокращение для showToast с типом error)
     * @param {string} message - Текст ошибки
     */
    showError: function(message) {
        this.showToast(message, 'error');
    },
    
    /**
     * Показать успешное сообщение
     * @param {string} message - Текст сообщения
     */
    showSuccess: function(message) {
        this.showToast(message, 'success');
    },
    
    /**
     * Показать предупреждение
     * @param {string} message - Текст предупреждения
     */
    showWarning: function(message) {
        this.showToast(message, 'warning');
    },
    
    /**
     * Показать/скрыть индикатор загрузки для групп
     * @param {boolean} show - Показать или скрыть
     */
    showGroupsLoading: function(show) {
        const containers = [
            'groupsContainer', 
            'autoSearchGroupsContainer', 
            'broadcastGroupsContainer'
        ];
        
        containers.forEach(containerId => {
            const container = document.getElementById(containerId);
            if (container && show) {
                container.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">🔄 Загружаем группы...</div>';
            }
        });
    },
    
    /**
     * Обновить счетчики выбранных элементов
     * @param {string} type - Тип счетчика: 'search', 'autosearch', 'broadcast'
     * @param {number} selected - Количество выбранных
     * @param {number} total - Общее количество
     */
    updateCounter: function(type, selected, total) {
        const counters = {
            search: 'selectedCount',
            autosearch: 'autoSelectedCount', 
            broadcast: 'selectedBroadcastCount'
        };
        
        const counterId = counters[type];
        const counterEl = document.getElementById(counterId);
        
        if (counterEl) {
            counterEl.textContent = `Выбрано: ${selected} из ${total} групп`;
            console.log(`📊 Обновлен счетчик ${type}: ${selected}/${total}`);
        }
    },
    
    /**
     * Показать модальное окно подтверждения
     * @param {string} message - Текст для подтверждения
     * @param {function} onConfirm - Функция при подтверждении
     * @param {function} onCancel - Функция при отмене (опционально)
     */
    showConfirm: function(message, onConfirm, onCancel = null) {
        const result = confirm(message);
        if (result && onConfirm) {
            onConfirm();
        } else if (!result && onCancel) {
            onCancel();
        }
        return result;
    },
    
    /**
     * Безопасно обновить содержимое элемента
     * @param {string} elementId - ID элемента
     * @param {string} content - HTML содержимое
     */
    safeUpdateElement: function(elementId, content) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = content;
            return true;
        } else {
            console.warn(`⚠️ Элемент ${elementId} не найден`);
            return false;
        }
    },
    
    /**
     * Безопасно показать/скрыть элемент
     * @param {string} elementId - ID элемента
     * @param {boolean} show - Показать или скрыть
     */
    safeToggleElement: function(elementId, show) {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.display = show ? 'block' : 'none';
            return true;
        } else {
            console.warn(`⚠️ Элемент ${elementId} не найден`);
            return false;
        }
    },
    
    /**
     * Добавить CSS анимации
     */
    addAnimations: function() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
            
            .loading-spinner {
                display: inline-block;
                width: 20px;
                height: 20px;
                border: 2px solid #f3f3f3;
                border-top: 2px solid #0088cc;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .btn-link {
                color: #0088cc;
                text-decoration: none;
                font-size: 12px;
                transition: color 0.2s;
            }
            
            .btn-link:hover {
                color: #006fa6;
                text-decoration: underline;
            }
        `;
        
        if (!document.getElementById('ui-utils-styles')) {
            style.id = 'ui-utils-styles';
            document.head.appendChild(style);
        }
    },
    
    /**
     * Создать элемент загрузки
     * @param {string} text - Текст рядом с индикатором
     */
    createLoadingElement: function(text = 'Загрузка...') {
        const div = document.createElement('div');
        div.style.cssText = 'text-align: center; padding: 20px; color: #666;';
        div.innerHTML = `
            <div class="loading-spinner" style="margin-right: 10px;"></div>
            ${text}
        `;
        return div;
    }
};

// Инициализируем CSS анимации при загрузке модуля
window.UIUtils.addAnimations();

// Создаем сокращения для частых функций
window.showToast = window.UIUtils.showToast.bind(window.UIUtils);
window.showError = window.UIUtils.showError.bind(window.UIUtils);
window.showSuccess = window.UIUtils.showSuccess.bind(window.UIUtils);

console.log('✅ UIUtils модуль загружен');