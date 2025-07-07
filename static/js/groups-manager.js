// ===============================
// УПРАВЛЕНИЕ ГРУППАМИ
// static/js/groups-manager.js
// ===============================

window.GroupsManager = {
    
    /**
     * Загрузка групп с сервера или из кэша
     */
    loadGroups: async function() {
        console.log('📋 Загружаю группы...');
        
        try {
            // Сначала проверяем кэш
            const cached = window.DataManager.GroupsCache.load();
            if (cached && cached.length > 0) {
                console.log('📋 Найден валидный кэш групп');
                window.MessageHunter.allGroups = cached;
                this.displayGroups(cached);
                console.log(`✅ Группы загружены из кэша: ${cached.length}`);
                
                setTimeout(() => {
                    this.restoreAllSelections();
                }, 500);
                return;
            }
            
            console.log('🔄 Загружаю группы с сервера...');
            window.UIUtils.showGroupsLoading(true);
            
            const response = await fetch('/get_groups');
            const data = await response.json();
            
            if (data.success) {
                console.log(`✅ Загружено ${data.groups.length} групп`);
                
                // Сохраняем в кэш
                window.DataManager.GroupsCache.save(data.groups);
                
                window.MessageHunter.allGroups = data.groups;
                this.displayGroups(data.groups);
                console.log(`✅ Группы загружены и отображены: ${data.groups.length}`);
                
                setTimeout(() => {
                    this.restoreAllSelections();
                }, 500);
                
            } else {
                throw new Error(data.error || 'Неизвестная ошибка');
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки групп:', error);
            window.UIUtils.showToast(`❌ Ошибка: ${error.message}`, 'error');
        } finally {
            window.UIUtils.showGroupsLoading(false);
        }
    },
    
    /**
     * Отображение групп во всех контейнерах
     * @param {Array} groups - Массив групп для отображения
     */
    displayGroups: function(groups) {
        console.log(`📋 Отображаем ${groups.length} групп`);
        
        window.MessageHunter.allGroups = groups;
        
        // Отображаем в контейнере автопоиска
        this.displayGroupsInContainer('autoSearchGroupsContainer', groups, 'autosearch-groups', 'toggleAutoSearchGroup');
        
        // Отображаем в контейнере основного поиска
        this.displayGroupsInContainer('groupsContainer', groups, 'groups', 'toggleGroup');
        
        // Отображаем в контейнере рассылки
        this.displayGroupsInContainer('broadcastGroupsContainer', groups, 'broadcast-groups', 'toggleBroadcastGroup');
    },
    
    /**
     * Отображение групп в конкретном контейнере
     * @param {string} containerId - ID контейнера
     * @param {Array} groups - Массив групп
     * @param {string} inputName - Имя для input элементов
     * @param {string} onchangeFunc - Функция для onchange
     */
    displayGroupsInContainer: function(containerId, groups, inputName, onchangeFunc) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const html = groups.map(group => `
            <div class="group-item">
                <input type="checkbox" 
                    class="group-checkbox" 
                    name="${inputName}"
                    value="${group.id}"
                    id="${inputName}_${group.id}"
                    onchange="${onchangeFunc}('${group.id}')">
                <label for="${inputName}_${group.id}" class="group-info">
                    <div class="group-title">${group.title}</div>
                    <div class="group-type">👥 ${group.members_count || 0} участников</div>
                </label>
            </div>
        `).join('');
        
        container.innerHTML = html;
        console.log(`✅ Отображены группы в ${containerId}: ${groups.length}`);
    },
    
    /**
     * Принудительное обновление групп
     */
    forceReloadGroups: async function() {
        console.log('🔄 Принудительное обновление групп...');
        
        try {
            // Очищаем кэш
            window.DataManager.GroupsCache.clear();
            
            // Очищаем переменные
            window.MessageHunter.allGroups = [];
            window.MessageHunter.selectedGroups = [];
            window.MessageHunter.autoSearchGroups = [];
            window.MessageHunter.selectedBroadcastGroups = [];
            
            window.UIUtils.showToast('🔄 Обновляем список групп...', 'info');
            
            // Загружаем заново
            await this.loadGroups();
            
            window.UIUtils.showToast('✅ Группы успешно обновлены!', 'success');
            
        } catch (error) {
            console.error('❌ Ошибка обновления групп:', error);
            window.UIUtils.showToast('❌ Ошибка обновления групп', 'error');
        }
    },
    
    /**
     * Переключение выбора группы для основного поиска
     * @param {string} groupId - ID группы
     */
    toggleGroup: function(groupId) {
        const groups = window.MessageHunter.selectedGroups;
        
        if (groups.includes(groupId)) {
            window.MessageHunter.selectedGroups = groups.filter(id => id !== groupId);
            console.log(`➖ Убрал группу ${groupId}`);
        } else {
            window.MessageHunter.selectedGroups.push(groupId);
            console.log(`➕ Добавил группу ${groupId}`);
        }
        
        // Сохраняем и обновляем счетчик
        this.saveSelections('search');
        this.updateCounter('search');
    },
    
    /**
     * Переключение выбора группы для автопоиска
     * @param {string} groupId - ID группы
     */
    toggleAutoSearchGroup: function(groupId) {
        console.log(`🔄 Переключаем группу автопоиска: ${groupId}`);
        
        const groups = window.MessageHunter.autoSearchGroups;
        
        if (groups.includes(groupId)) {
            window.MessageHunter.autoSearchGroups = groups.filter(id => id !== groupId);
        } else {
            window.MessageHunter.autoSearchGroups.push(groupId);
        }
        
        this.saveSelections('autosearch');
        this.updateCounter('autosearch');
    },
    
    /**
     * Переключение выбора группы для рассылки
     * @param {string} groupId - ID группы
     */
    toggleBroadcastGroup: function(groupId) {
        const groups = window.MessageHunter.selectedBroadcastGroups;
        
        if (groups.includes(groupId)) {
            window.MessageHunter.selectedBroadcastGroups = groups.filter(id => id !== groupId);
        } else {
            window.MessageHunter.selectedBroadcastGroups.push(groupId);
        }
        
        this.saveSelections('broadcast');
        this.updateCounter('broadcast');
    },
    
    /**
     * Выбор всех групп для указанного типа
     * @param {string} type - Тип: 'search', 'autosearch', 'broadcast'
     */
    selectAll: function(type) {
        const allIds = window.MessageHunter.allGroups.map(g => g.id);
        
        switch(type) {
            case 'search':
                window.MessageHunter.selectedGroups = allIds.slice();
                this.updateCheckboxes('groups', true);
                break;
            case 'autosearch':
                window.MessageHunter.autoSearchGroups = allIds.slice();
                this.updateCheckboxes('autosearch-groups', true);
                break;
            case 'broadcast':
                window.MessageHunter.selectedBroadcastGroups = allIds.slice();
                this.updateCheckboxes('broadcast-groups', true);
                break;
        }
        
        this.saveSelections(type);
        this.updateCounter(type);
        console.log(`✅ Выбраны все группы для ${type}`);
    },
    
    /**
     * Снятие выбора всех групп для указанного типа
     * @param {string} type - Тип: 'search', 'autosearch', 'broadcast'
     */
    deselectAll: function(type) {
        switch(type) {
            case 'search':
                window.MessageHunter.selectedGroups = [];
                this.updateCheckboxes('groups', false);
                break;
            case 'autosearch':
                window.MessageHunter.autoSearchGroups = [];
                this.updateCheckboxes('autosearch-groups', false);
                break;
            case 'broadcast':
                window.MessageHunter.selectedBroadcastGroups = [];
                this.updateCheckboxes('broadcast-groups', false);
                break;
        }
        
        this.saveSelections(type);
        this.updateCounter(type);
        console.log(`❌ Убраны все группы для ${type}`);
    },
    
    /**
     * Обновление состояния чекбоксов
     * @param {string} inputName - Имя input элементов
     * @param {boolean} checked - Состояние
     */
    updateCheckboxes: function(inputName, checked) {
        document.querySelectorAll(`input[name="${inputName}"]`).forEach(cb => {
            cb.checked = checked;
        });
    },
    
    /**
     * Сохранение выбранных групп
     * @param {string} type - Тип групп
     */
    saveSelections: function(type) {
        let groups;
        
        switch(type) {
            case 'search':
                groups = window.MessageHunter.selectedGroups;
                break;
            case 'autosearch':
                groups = window.MessageHunter.autoSearchGroups;
                break;
            case 'broadcast':
                groups = window.MessageHunter.selectedBroadcastGroups;
                break;
            default:
                console.error('❌ Неизвестный тип групп:', type);
                return;
        }
        
        window.DataManager.SelectedGroups.save(groups, type);
        console.log(`💾 Сохранены группы ${type}: ${groups.length}`);
    },
    
    /**
     * Загрузка сохраненных выборов
     * @param {string} type - Тип групп
     */
    loadSelections: function(type) {
        const groups = window.DataManager.SelectedGroups.load(type);
        
        switch(type) {
            case 'search':
                window.MessageHunter.selectedGroups = groups;
                break;
            case 'autosearch':
                window.MessageHunter.autoSearchGroups = groups;
                break;
            case 'broadcast':
                window.MessageHunter.selectedBroadcastGroups = groups;
                break;
        }
        
        console.log(`📂 Загружены группы ${type}: ${groups.length}`);
    },
    
    /**
     * Восстановление всех выборов групп
     */
    restoreAllSelections: function() {
        console.log('🔄 Восстанавливаем все выборы групп...');
        
        setTimeout(() => {
            // Загружаем сохраненные выборы
            this.loadSelections('search');
            this.loadSelections('autosearch');
            this.loadSelections('broadcast');
            
            // Восстанавливаем состояние чекбоксов
            this.restoreCheckboxes('search', 'groups');
            this.restoreCheckboxes('autosearch', 'autosearch-groups');
            this.restoreCheckboxes('broadcast', 'broadcast-groups');
            
            // Обновляем счетчики
            this.updateCounter('search');
            this.updateCounter('autosearch');
            this.updateCounter('broadcast');
            
            console.log('✅ Все выборы групп восстановлены');
        }, 300);
    },
    
    /**
     * Восстановление состояния чекбоксов
     * @param {string} type - Тип групп
     * @param {string} inputName - Имя input элементов
     */
    restoreCheckboxes: function(type, inputName) {
        let groups;
        
        switch(type) {
            case 'search':
                groups = window.MessageHunter.selectedGroups;
                break;
            case 'autosearch':
                groups = window.MessageHunter.autoSearchGroups;
                break;
            case 'broadcast':
                groups = window.MessageHunter.selectedBroadcastGroups;
                break;
            default:
                return;
        }
        
        groups.forEach(groupId => {
            const checkbox = document.querySelector(`input[name="${inputName}"][value="${groupId}"]`);
            if (checkbox) {
                checkbox.checked = true;
            }
        });
        
        console.log(`✅ Восстановлены чекбоксы ${type}: ${groups.length}`);
    },
    
    /**
     * Обновление счетчика выбранных групп
     * @param {string} type - Тип групп
     */
    updateCounter: function(type) {
        let selectedCount;
        
        switch(type) {
            case 'search':
                selectedCount = window.MessageHunter.selectedGroups.length;
                break;
            case 'autosearch':
                selectedCount = window.MessageHunter.autoSearchGroups.length;
                break;
            case 'broadcast':
                selectedCount = window.MessageHunter.selectedBroadcastGroups.length;
                break;
            default:
                return;
        }
        
        const totalCount = window.MessageHunter.allGroups.length;
        window.UIUtils.updateCounter(type, selectedCount, totalCount);
    },
    
    /**
     * Получение выбранных групп для текущей вкладки
     */
    getSelectedGroupsForCurrentTab: function() {
        const activeTab = window.TabManager.getActiveTab();
        
        if (activeTab === 'autosearch') {
            return window.MessageHunter.autoSearchGroups;
        }
        
        return window.MessageHunter.selectedGroups;
    }
};

// Глобальные функции для обратной совместимости
window.toggleGroup = window.GroupsManager.toggleGroup.bind(window.GroupsManager);
window.toggleAutoSearchGroup = window.GroupsManager.toggleAutoSearchGroup.bind(window.GroupsManager);
window.toggleBroadcastGroup = window.GroupsManager.toggleBroadcastGroup.bind(window.GroupsManager);
window.forceReloadGroups = window.GroupsManager.forceReloadGroups.bind(window.GroupsManager);
window.selectAllGroups = () => window.GroupsManager.selectAll('search');
window.deselectAllGroups = () => window.GroupsManager.deselectAll('search');
window.selectAllAutoGroups = () => window.GroupsManager.selectAll('autosearch');
window.deselectAllAutoGroups = () => window.GroupsManager.deselectAll('autosearch');
window.selectAllBroadcastGroups = () => window.GroupsManager.selectAll('broadcast');
window.deselectAllBroadcastGroups = () => window.GroupsManager.deselectAll('broadcast');

console.log('✅ GroupsManager модуль загружен');