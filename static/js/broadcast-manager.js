// ===============================
// УПРАВЛЕНИЕ РАССЫЛКОЙ
// static/js/broadcast-manager.js
// ===============================

window.BroadcastManager = {
    
    /**
     * Отображение групп для рассылки
     */
    displayGroups: function() {
        console.log('📤 Отображение групп рассылки');
        const container = document.getElementById('broadcastGroupsContainer');
        
        if (!container) {
            console.error('❌ Контейнер broadcastGroupsContainer не найден');
            return;
        }
        
        if (window.MessageHunter.allGroups.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Группы не найдены</div>';
            return;
        }
        
        container.innerHTML = window.MessageHunter.allGroups.map(group => `
            <div class="group-item">
                <input type="checkbox" 
                    class="group-checkbox" 
                    name="broadcast-groups"
                    value="${group.id}"
                    id="broadcast_group_${group.id}"
                    ${window.MessageHunter.selectedBroadcastGroups.includes(group.id) ? 'checked' : ''}
                    onchange="window.GroupsManager.toggleBroadcastGroup('${group.id}')">
                <label for="broadcast_group_${group.id}" class="group-info">
                    <div class="group-title">${group.title}</div>
                    <div class="group-type">👥 ${group.members_count || 0} участников</div>
                </label>
            </div>
        `).join('');
        
        window.UIUtils.updateCounter('broadcast', window.MessageHunter.selectedBroadcastGroups.length, window.MessageHunter.allGroups.length);
    },
    
    /**
     * Обновление групп для рассылки
     */
    refreshGroups: function() {
        console.log('🔄 Обновляем группы для рассылки...');
        
        const container = document.getElementById('broadcastGroupsContainer');
        if (container) {
            container.innerHTML = window.UIUtils.createLoadingElement('Обновление групп...').outerHTML;
        }
        
        // Очищаем кэш и переменные
        window.DataManager.GroupsCache.clear();
        window.MessageHunter.allGroups = [];
        window.MessageHunter.selectedBroadcastGroups = [];
        
        window.UIUtils.showToast('🔄 Обновляем список групп...', 'info');
        
        // Принудительно загружаем группы
        fetch('/get_groups')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.MessageHunter.allGroups = data.groups;
                
                // Сохраняем в кэш
                window.DataManager.GroupsCache.save(window.MessageHunter.allGroups);
                
                // Обновляем отображение для рассылки
                this.displayGroups();
                
                window.UIUtils.showSuccess('✅ Группы успешно обновлены!');
                console.log(`✅ Обновлено ${window.MessageHunter.allGroups.length} групп для рассылки`);
            } else {
                window.UIUtils.showError('❌ Ошибка обновления групп');
                if (container) {
                    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #dc3545;">Ошибка загрузки групп</div>';
                }
            }
        })
        .catch(error => {
            console.error('❌ Ошибка обновления групп:', error);
            window.UIUtils.showError('❌ Ошибка соединения при обновлении');
            if (container) {
                container.innerHTML = '<div style="text-align: center; padding: 20px; color: #dc3545;">Ошибка соединения</div>';
            }
        });
    },
    
    /**
     * Установка времени по умолчанию
     */
    setDefaultDateTime: function() {
        console.log('📅 Установка времени по умолчанию');
        const now = new Date();
        
        const dateInput = document.getElementById('broadcastDate');
        if (dateInput) {
            const today = now.toISOString().split('T')[0];
            dateInput.value = today;
        }
        
        const timeInput = document.getElementById('broadcastTime');
        if (timeInput) {
            now.setMinutes(now.getMinutes() + 10);
            const timeString = now.toTimeString().slice(0, 5);
            timeInput.value = timeString;
        }
    },
    
    /**
     * Планирование рассылки
     */
    scheduleBroadcast: function() {
        const now = Date.now();
        if (window.lastScheduleCall && (now - window.lastScheduleCall) < 3000) {
            console.log('⚠️ Слишком частые вызовы, игнорируем');
            return;
        }
        window.lastScheduleCall = now;
        
        console.log('📤 Начинаем планирование рассылки');
        
        const broadcastBtn = event.target;
        if (broadcastBtn.disabled) {
            console.log('⚠️ Кнопка уже заблокирована');
            return;
        }
        
        // Получаем данные формы
        const formData = this.getFormData();
        
        // Валидация
        const validationResult = this.validateFormData(formData);
        if (!validationResult.isValid) {
            window.UIUtils.showError(validationResult.error);
            return;
        }
        
        // Блокируем кнопку
        broadcastBtn.disabled = true;
        broadcastBtn.textContent = '📤 Планируем...';
        
        console.log('✅ Все проверки пройдены, отправляем запрос');
        
        fetch('/schedule_broadcast', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: formData.message,
                groups: window.MessageHunter.selectedBroadcastGroups,
                date: formData.date,
                time: formData.time,
                repeat: formData.repeat,
                delay_minutes: parseInt(formData.delay),
                random_sending: formData.randomSending
            })
        })
        .then(response => response.json())
        .then(data => {
            console.log('📨 Получен ответ сервера:', data);
            
            if (data.success) {
                this.showBroadcastSuccess(data.task_info);
                
                // Очищаем форму
                this.clearForm();
                
                // Обновляем список задач
                setTimeout(() => {
                    this.loadTasks();
                }, 1000);
            } else {
                window.UIUtils.showError(data.error || 'Ошибка планирования рассылки');
            }
        })
        .catch(error => {
            window.UIUtils.showError('Ошибка соединения');
            console.error('Error:', error);
        })
        .finally(() => {
            broadcastBtn.disabled = false;
            broadcastBtn.textContent = '📤 Поставить задачу на рассылку';
        });
    },
    
    /**
     * Получение данных из формы
     */
    getFormData: function() {
        const messageInput = document.getElementById('broadcastMessage');
        const dateInput = document.getElementById('broadcastDate');
        const timeInput = document.getElementById('broadcastTime');
        const repeatInput = document.getElementById('broadcastRepeat');
        const delayInput = document.getElementById('broadcastDelay');
        const randomInput = document.getElementById('randomSending');
        
        return {
            message: messageInput ? messageInput.value.trim() : '',
            date: dateInput ? dateInput.value : '',
            time: timeInput ? timeInput.value : '',
            repeat: repeatInput ? repeatInput.value : 'once',
            delay: delayInput ? delayInput.value : '15',
            randomSending: randomInput ? randomInput.checked : false
        };
    },
    
    /**
     * Валидация данных формы
     * @param {Object} formData - Данные формы
     */
    validateFormData: function(formData) {
        if (!formData.message) {
            return { isValid: false, error: '✏️ Введите текст сообщения для рассылки' };
        }
        
        if (formData.message.length < 3) {
            return { isValid: false, error: '✏️ Сообщение слишком короткое (минимум 3 символа)' };
        }
        
        if (formData.message.length > 4000) {
            return { isValid: false, error: '✏️ Сообщение слишком длинное (максимум 4000 символов)' };
        }
        
        if (window.MessageHunter.selectedBroadcastGroups.length === 0) {
            return { isValid: false, error: '📂 Выберите группы для рассылки' };
        }
        
        if (!formData.date) {
            return { isValid: false, error: '📅 Выберите дату отправки' };
        }
        
        if (!formData.time) {
            return { isValid: false, error: '🕐 Выберите время отправки' };
        }
        
        // Проверяем время
        const selectedDateTime = new Date(`${formData.date}T${formData.time}`);
        const currentTime = new Date();
        
        if (selectedDateTime <= currentTime) {
            return { isValid: false, error: '⏰ Время отправки должно быть в будущем' };
        }
        
        const maxDate = new Date();
        maxDate.setFullYear(maxDate.getFullYear() + 1);
        
        if (selectedDateTime > maxDate) {
            return { isValid: false, error: '📅 Время отправки не может быть больше чем через год' };
        }
        
        return { isValid: true };
    },
    
    /**
     * Очистка формы
     */
    clearForm: function() {
        const messageInput = document.getElementById('broadcastMessage');
        if (messageInput) messageInput.value = '';
        
        this.setDefaultDateTime();
        
        // Сбрасываем счетчик символов
        const lengthEl = document.getElementById('messageLength');
        if (lengthEl) lengthEl.textContent = '0 символов';
    },
    
    /**
     * Показ успешного планирования рассылки
     * @param {Object} taskInfo - Информация о задаче
     */
    showBroadcastSuccess: function(taskInfo) {
        const successDiv = document.createElement('div');
        successDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            z-index: 1000;
            max-width: 450px;
            text-align: center;
        `;
        
        const randomInfo = taskInfo.random_sending ? 
            `<p style="background: #fff3cd; padding: 8px; border-radius: 6px; color: #856404; font-size: 13px; margin: 10px 0;">
                🎲 <strong>Рандомная отправка:</strong> в течение 24 часов
            </p>` : '';
        
        successDiv.innerHTML = `
            <h3 style="color: #28a745; margin-bottom: 15px;">✅ Рассылка запланирована!</h3>
            <p><strong>👤 Аккаунт:</strong> ${taskInfo.account_info || 'Основной'}</p>
            <p><strong>⏰ Время:</strong> ${taskInfo.scheduled_time}</p>
            <p><strong>📂 Групп:</strong> ${taskInfo.groups_count}</p>
            <p><strong>🔄 Повтор:</strong> ${taskInfo.repeat_text}</p>
            ${taskInfo.random_sending ? 
                '<p><strong>🎲 Режим:</strong> Рандомная отправка (24 часа)</p>' : 
                `<p><strong>⏱️ Задержка:</strong> ${taskInfo.delay_minutes} мин между группами</p>`
            }
            ${randomInfo}
            <p style="font-size: 12px; color: #666; margin-top: 10px;">
                ${taskInfo.random_sending ? 
                    '⏱️ Сообщения будут отправлены в случайное время' : 
                    `⏱️ Примерное время рассылки: ~${(taskInfo.groups_count - 1) * taskInfo.delay_minutes} минут`
                }
            </p>
            <button onclick="this.parentElement.remove()" 
                    style="margin-top: 15px; padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 10px; cursor: pointer;">
                Понятно
            </button>
        `;
        
        document.body.appendChild(successDiv);
        
        setTimeout(() => {
            if (successDiv.parentElement) {
                successDiv.remove();
            }
        }, 10000);
    },
    
    /**
     * Переключение режима рандомной отправки
     */
    toggleRandomSending: function() {
        const randomCheckbox = document.getElementById('randomSending');
        const normalSection = document.getElementById('normalDelaySection');
        const randomInfo = document.getElementById('randomDelayInfo');
        
        if (!randomCheckbox) return;
        
        if (randomCheckbox.checked) {
            if (normalSection) normalSection.style.display = 'none';
            if (randomInfo) randomInfo.style.display = 'block';
            console.log('🎲 Включен режим рандомной отправки');
        } else {
            if (normalSection) normalSection.style.display = 'block';
            if (randomInfo) randomInfo.style.display = 'none';
            console.log('⏰ Включен режим обычной отправки');
        }
    },
    
    /**
     * Загрузка задач рассылки
     */
    loadTasks: function() {
        console.log('📋 Загрузка задач рассылки');
        const container = document.getElementById('broadcastTasksContainer');
        const tasksCountEl = document.getElementById('tasksCount');
        
        if (container) {
            container.innerHTML = window.UIUtils.createLoadingElement('Загружаем задачи...').outerHTML;
        }
        
        if (tasksCountEl) {
            tasksCountEl.textContent = 'Загрузка...';
        }
        
        fetch('/get_broadcast_tasks')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log(`📊 Получено задач: ${data.tasks.length}`);
                this.displayTasks(data.tasks);
            } else {
                if (container) {
                    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #dc3545;">❌ Ошибка загрузки задач</div>';
                }
                if (tasksCountEl) {
                    tasksCountEl.textContent = 'Ошибка загрузки';
                }
                window.UIUtils.showError('Ошибка загрузки задач');
            }
        })
        .catch(error => {
            console.error('Error loading tasks:', error);
            if (container) {
                container.innerHTML = '<div style="text-align: center; padding: 20px; color: #dc3545;">❌ Ошибка соединения</div>';
            }
            if (tasksCountEl) {
                tasksCountEl.textContent = 'Ошибка соединения';
            }
            window.UIUtils.showError('Ошибка соединения');
        });
    },
    
    /**
     * Отображение списка задач рассылки
     * @param {Array} tasks - Массив задач
     */
    displayTasks: function(tasks) {
        const container = document.getElementById('broadcastTasksContainer');
        const tasksCountEl = document.getElementById('tasksCount');
        
        console.log(`📊 Отображаем задачи: ${tasks.length} шт.`);
        
        // Обновляем счетчик
        if (tasksCountEl) {
            if (tasks.length === 0) {
                tasksCountEl.textContent = 'Нет задач';
            } else {
                const scheduledCount = tasks.filter(t => t.status === 'scheduled').length;
                const executingCount = tasks.filter(t => t.status === 'executing').length;
                const completedCount = tasks.filter(t => t.status === 'completed').length;
                const failedCount = tasks.filter(t => t.status === 'failed').length;
                
                tasksCountEl.innerHTML = `
                    Всего: ${tasks.length} | 
                    ⏳ Запланировано: ${scheduledCount} | 
                    📤 Выполняется: ${executingCount} | 
                    ✅ Завершено: ${completedCount} | 
                    ❌ Ошибок: ${failedCount}
                `;
            }
        }
        
        if (!container) return;
        
        if (tasks.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <div style="font-size: 48px; margin-bottom: 15px;">📭</div>
                    <h3 style="color: #999; margin-bottom: 10px;">Нет запланированных задач</h3>
                    <p style="color: #999; font-size: 14px;">Создайте первую рассылку на вкладке "📤 Рассылка сообщений"</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = tasks.map(task => {
            return this.renderTaskItem(task);
        }).join('');
    },
    
    /**
     * Отрисовка элемента задачи
     * @param {Object} task - Объект задачи
     */
    renderTaskItem: function(task) {
        let statusIcon = '⏳';
        let statusColor = '#0088cc';
        let statusText = task.status;
        
        if (task.status === 'completed') {
            statusIcon = '✅';
            statusColor = '#28a745';
            statusText = `Выполнено (${task.sent_count}/${task.groups_count})`;
        } else if (task.status === 'failed') {
            statusIcon = '❌';
            statusColor = '#dc3545';
            statusText = 'Ошибка';
        } else if (task.status === 'executing') {
            statusIcon = '📤';
            statusColor = '#ff6b35';
            statusText = 'Отправляем...';
        }
        
        const timeInfo = this.getTimeToExecution(task.scheduled_time);
        
        return `
            <div style="
                border: 1px solid #e1e8ed; 
                border-radius: 10px; 
                padding: 20px; 
                margin-bottom: 15px; 
                background: white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                transition: box-shadow 0.3s;
            " onmouseover="this.style.boxShadow='0 4px 15px rgba(0,0,0,0.15)'" 
            onmouseout="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #333; margin-bottom: 5px;">
                            ${statusIcon} ${task.message_preview || 'Задача рассылки'}
                        </div>
                        <div style="font-size: 12px; color: #666;">
                            ID: ${task.id} • Создано: ${task.created_at}
                        </div>
                    </div>
                    <div style="text-align: right; display: flex; gap: 10px; align-items: center;">
                        <div style="background: ${statusColor}; color: white; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">
                            ${statusText}
                        </div>
                        <button onclick="window.BroadcastManager.deleteTask('${task.id}')" 
                                style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 8px; font-size: 10px; cursor: pointer;"
                                title="Удалить задачу">
                            🗑️
                        </button>
                    </div>
                </div>
                
                <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; font-size: 13px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px;">
                        <div><strong>👤 Аккаунт:</strong> ${task.account_display || task.account_name || 'Основной'}</div>
                        <div><strong>📂 Группы:</strong> ${task.groups_count} групп</div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px;">
                        <div><strong>⏰ Отправка:</strong> ${task.scheduled_time}</div>
                        <div><strong>⏱️ Задержка:</strong> ${task.delay_minutes} мин</div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div><strong>🔄 Повтор:</strong> ${task.repeat}</div>
                        <div style="font-weight: 600; color: ${timeInfo.color};">
                            ⏳ ${timeInfo.text}
                        </div>
                    </div>

                    ${task.random_sending ? `
                        <div style="margin-top: 8px; padding: 8px; background: #fff3cd; border-radius: 6px; border-left: 3px solid #ffc107;">
                            <strong style="color: #856404;">🎲 Рандомная отправка:</strong>
                            <span style="color: #856404; font-size: 12px;">Сообщения отправляются в случайное время в течение 24 часов</span>
                        </div>
                    ` : ''}
                    
                    ${task.status === 'failed' ? `
                        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #dee2e6; color: #dc3545;">
                            <strong>❌ Ошибка:</strong> ${task.error || 'Неизвестная ошибка'}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },
    
    /**
     * Удаление задачи
     * @param {string} taskId - ID задачи
     */
    deleteTask: function(taskId) {
        if (!window.UIUtils.showConfirm(`Удалить задачу ${taskId}? Действие нельзя отменить.`)) {
            return;
        }
        
        console.log(`🗑️ Удаляем задачу: ${taskId}`);
        
        const deleteBtn = event.target;
        const originalText = deleteBtn.textContent;
        deleteBtn.disabled = true;
        deleteBtn.textContent = '⏳';
        
        fetch('/delete_broadcast_task', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ task_id: taskId })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.UIUtils.showSuccess('✅ Задача удалена');
                this.loadTasks();
            } else {
                window.UIUtils.showError('❌ Ошибка удаления: ' + (data.error || 'Неизвестная ошибка'));
            }
        })
        .catch(error => {
            window.UIUtils.showError('❌ Ошибка соединения');
            console.error('Error:', error);
        })
        .finally(() => {
            deleteBtn.disabled = false;
            deleteBtn.textContent = originalText;
        });
    },
    
    /**
     * Вычисление времени до выполнения задачи
     * @param {string} scheduledTime - Запланированное время
     */
    getTimeToExecution: function(scheduledTime) {
        const now = new Date();
        const scheduled = new Date(scheduledTime);
        const diffMs = scheduled.getTime() - now.getTime();
        
        if (diffMs <= 0) {
            return {
                text: 'Время пришло!',
                color: '#dc3545'
            };
        }
        
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
        
        let timeText = '';
        
        if (days > 0) {
            timeText = `${days} д ${hours} ч ${minutes} мин`;
        } else if (hours > 0) {
            timeText = `${hours} ч ${minutes} мин ${seconds} сек`;
        } else if (minutes > 0) {
            timeText = `${minutes} мин ${seconds} сек`;
        } else {
            timeText = `${seconds} сек`;
        }
        
        return {
            text: `До отправки: ${timeText}`,
            color: diffMs < 300000 ? '#ff6b35' : '#0088cc' // Красный если меньше 5 минут
        };
    },
    
    /**
     * Инициализация счетчика символов
     */
    initCharacterCounter: function() {
        const messageTextarea = document.getElementById('broadcastMessage');
        if (messageTextarea) {
            messageTextarea.addEventListener('input', function() {
                const length = this.value.length;
                const lengthEl = document.getElementById('messageLength');
                if (lengthEl) {
                    lengthEl.textContent = `${length} символов`;
                    if (length > 4000) {
                        lengthEl.style.color = '#dc3545';
                    } else {
                        lengthEl.style.color = '#666';
                    }
                }
            });
            
            // Инициализируем счетчик
            const lengthEl = document.getElementById('messageLength');
            if (lengthEl) {
                lengthEl.textContent = '0 символов';
            }
        }
    }
};

// Глобальные функции для обратной совместимости
window.scheduleBroadcast = window.BroadcastManager.scheduleBroadcast.bind(window.BroadcastManager);
window.refreshBroadcastGroups = window.BroadcastManager.refreshGroups.bind(window.BroadcastManager);
window.loadBroadcastTasks = window.BroadcastManager.loadTasks.bind(window.BroadcastManager);
window.deleteTask = window.BroadcastManager.deleteTask.bind(window.BroadcastManager);
window.toggleRandomSending = window.BroadcastManager.toggleRandomSending.bind(window.BroadcastManager);

// Инициализация счетчика символов при загрузке
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        window.BroadcastManager.initCharacterCounter();
    }, 1000);
});

console.log('✅ BroadcastManager модуль загружен');