// ===============================
// ОБЩИЕ УТИЛИТЫ
// static/js/utils.js
// ===============================

window.Utils = {
    
    /**
     * Форматирование дат
     */
    DateUtils: {
        /**
         * Парсинг даты сообщения
         * @param {string} dateString - Строка даты в формате DD.MM.YYYY HH:MM
         * @returns {Date} Объект Date
         */
        parseMessageDate: function(dateString) {
            const [datePart, timePart] = dateString.split(' ');
            const [day, month, year] = datePart.split('.');
            const [hours, minutes] = timePart.split(':');
            
            return new Date(year, month - 1, day, hours, minutes);
        },
        
        /**
         * Получение относительного времени (например, "2 часа назад")
         * @param {Date|string} date - Дата для сравнения
         * @returns {string} Относительное время
         */
        getRelativeTime: function(date) {
            const now = new Date();
            const targetDate = typeof date === 'string' ? this.parseMessageDate(date) : date;
            const diffMs = now - targetDate;
            
            const seconds = Math.floor(diffMs / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);
            const months = Math.floor(days / 30);
            const years = Math.floor(days / 365);
            
            if (seconds < 60) return '🔥 Только что';
            if (minutes < 60) return `⚡ ${minutes} мин назад`;
            if (hours < 24) return `⚡ ${hours}ч назад`;
            if (days < 30) return `📅 ${days}д назад`;
            if (months < 12) {
                const remainingDays = days % 30;
                return remainingDays > 0 ? `📅 ${months}мес ${remainingDays}д назад` : `📅 ${months}мес назад`;
            }
            return `📅 ${years}г назад`;
        },
        
        /**
         * Форматирование даты для отображения
         * @param {Date|string} date - Дата для форматирования
         * @returns {string} Отформатированная дата
         */
        formatDate: function(date) {
            const targetDate = typeof date === 'string' ? new Date(date) : date;
            return targetDate.toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        },
        
        /**
         * Получение timestamp в миллисекундах
         * @returns {number} Текущий timestamp
         */
        now: function() {
            return Date.now();
        }
    },
    
    /**
     * Работа со строками
     */
    StringUtils: {
        /**
         * Очистка и нормализация строки
         * @param {string} str - Исходная строка
         * @returns {string} Очищенная строка
         */
        sanitize: function(str) {
            if (typeof str !== 'string') return '';
            return str.trim().replace(/\s+/g, ' ');
        },
        
        /**
         * Обрезка строки с добавлением "..."
         * @param {string} str - Исходная строка
         * @param {number} maxLength - Максимальная длина
         * @returns {string} Обрезанная строка
         */
        truncate: function(str, maxLength = 100) {
            if (!str || str.length <= maxLength) return str;
            return str.substring(0, maxLength - 3) + '...';
        },
        
        /**
         * Выделение ключевых слов в тексте
         * @param {string} text - Исходный текст
         * @param {Array} keywords - Массив ключевых слов
         * @param {string} className - CSS класс для выделения
         * @returns {string} HTML с выделенными словами
         */
        highlightKeywords: function(text, keywords, className = 'highlight') {
            if (!text || !keywords || keywords.length === 0) return text;
            
            let result = text;
            keywords.forEach(keyword => {
                const regex = new RegExp(`(${keyword})`, 'gi');
                result = result.replace(regex, `<span class="${className}">$1</span>`);
            });
            
            return result;
        },
        
        /**
         * Генерация случайного ID
         * @param {number} length - Длина ID
         * @returns {string} Случайный ID
         */
        generateId: function(length = 8) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let result = '';
            for (let i = 0; i < length; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        },
        
        /**
         * Валидация email
         * @param {string} email - Email для проверки
         * @returns {boolean} Результат валидации
         */
        isValidEmail: function(email) {
            const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return regex.test(email);
        },
        
        /**
         * Очистка HTML тегов
         * @param {string} html - HTML строка
         * @returns {string} Текст без HTML
         */
        stripHtml: function(html) {
            const tmp = document.createElement('div');
            tmp.innerHTML = html;
            return tmp.textContent || tmp.innerText || '';
        }
    },
    
    /**
     * Работа с массивами
     */
    ArrayUtils: {
        /**
         * Удаление дубликатов из массива
         * @param {Array} array - Исходный массив
         * @returns {Array} Массив без дубликатов
         */
        unique: function(array) {
            return [...new Set(array)];
        },
        
        /**
         * Разделение массива на части
         * @param {Array} array - Исходный массив
         * @param {number} chunkSize - Размер части
         * @returns {Array} Массив частей
         */
        chunk: function(array, chunkSize) {
            const chunks = [];
            for (let i = 0; i < array.length; i += chunkSize) {
                chunks.push(array.slice(i, i + chunkSize));
            }
            return chunks;
        },
        
        /**
         * Перемешивание массива
         * @param {Array} array - Исходный массив
         * @returns {Array} Перемешанный массив
         */
        shuffle: function(array) {
            const result = [...array];
            for (let i = result.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [result[i], result[j]] = [result[j], result[i]];
            }
            return result;
        },
        
        /**
         * Поиск пересечений между массивами
         * @param {Array} array1 - Первый массив
         * @param {Array} array2 - Второй массив
         * @returns {Array} Массив пересечений
         */
        intersection: function(array1, array2) {
            return array1.filter(value => array2.includes(value));
        },
        
        /**
         * Группировка элементов массива по ключу
         * @param {Array} array - Массив объектов
         * @param {string} key - Ключ для группировки
         * @returns {Object} Сгруппированные данные
         */
        groupBy: function(array, key) {
            return array.reduce((groups, item) => {
                const value = item[key];
                groups[value] = groups[value] || [];
                groups[value].push(item);
                return groups;
            }, {});
        }
    },
    
    /**
     * Работа с URL и ссылками
     */
    LinkUtils: {
        /**
         * Генерация ссылки на сообщение в Telegram
         * @param {Object} message - Объект сообщения
         * @returns {string} Ссылка на сообщение
         */
        generateTelegramLink: function(message) {
            if (!message.chat_id || !message.message_id) {
                return '#';
            }
            
            // Если есть username чата
            if (message.chat_username) {
                return `https://t.me/${message.chat_username}/${message.message_id}`;
            }
            
            // Для приватных чатов/каналов
            const chatIdStr = message.chat_id.toString();
            const cleanChatId = chatIdStr.startsWith('-100') ? chatIdStr.slice(4) : chatIdStr.replace('-', '');
            
            return `https://t.me/c/${cleanChatId}/${message.message_id}`;
        },
        
        /**
         * Извлечение параметров из URL
         * @param {string} url - URL для анализа
         * @returns {Object} Объект с параметрами
         */
        getUrlParams: function(url = window.location.href) {
            const params = {};
            const urlObj = new URL(url);
            urlObj.searchParams.forEach((value, key) => {
                params[key] = value;
            });
            return params;
        },
        
        /**
         * Проверка валидности URL
         * @param {string} url - URL для проверки
         * @returns {boolean} Результат проверки
         */
        isValidUrl: function(url) {
            try {
                new URL(url);
                return true;
            } catch {
                return false;
            }
        }
    },
    
    /**
     * Валидация данных
     */
    ValidationUtils: {
        /**
         * Проверка что значение не пустое
         * @param {any} value - Значение для проверки
         * @returns {boolean} Результат проверки
         */
        isNotEmpty: function(value) {
            if (value === null || value === undefined) return false;
            if (typeof value === 'string') return value.trim().length > 0;
            if (Array.isArray(value)) return value.length > 0;
            if (typeof value === 'object') return Object.keys(value).length > 0;
            return true;
        },
        
        /**
         * Проверка числового значения в диапазоне
         * @param {number} value - Значение
         * @param {number} min - Минимум
         * @param {number} max - Максимум
         * @returns {boolean} Результат проверки
         */
        isInRange: function(value, min, max) {
            const num = parseFloat(value);
            return !isNaN(num) && num >= min && num <= max;
        },
        
        /**
         * Проверка API ID
         * @param {string} apiId - API ID для проверки
         * @returns {boolean} Результат проверки
         */
        isValidApiId: function(apiId) {
            return /^\d+$/.test(apiId) && apiId.length >= 6 && apiId.length <= 10;
        },
        
        /**
         * Проверка API Hash
         * @param {string} apiHash - API Hash для проверки
         * @returns {boolean} Результат проверки
         */
        isValidApiHash: function(apiHash) {
            return /^[a-fA-F0-9]{32}$/.test(apiHash);
        }
    },
    
    /**
     * Работа с числами и статистикой
     */
    NumberUtils: {
        /**
         * Форматирование числа с разделителями тысяч
         * @param {number} number - Число для форматирования
         * @returns {string} Отформатированное число
         */
        formatNumber: function(number) {
            return new Intl.NumberFormat('ru-RU').format(number);
        },
        
        /**
         * Вычисление процентов
         * @param {number} value - Значение
         * @param {number} total - Общее количество
         * @returns {string} Процент с символом %
         */
        getPercentage: function(value, total) {
            if (total === 0) return '0%';
            return Math.round((value / total) * 100) + '%';
        },
        
        /**
         * Округление до определенного количества знаков
         * @param {number} number - Число
         * @param {number} decimals - Количество знаков после запятой
         * @returns {number} Округленное число
         */
        roundTo: function(number, decimals = 2) {
            return Math.round(number * Math.pow(10, decimals)) / Math.pow(10, decimals);
        },
        
        /**
         * Случайное число в диапазоне
         * @param {number} min - Минимум
         * @param {number} max - Максимум
         * @returns {number} Случайное число
         */
        randomBetween: function(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        },
        
        /**
         * Клампинг числа в диапазоне
         * @param {number} value - Значение
         * @param {number} min - Минимум
         * @param {number} max - Максимум
         * @returns {number} Значение в пределах диапазона
         */
        clamp: function(value, min, max) {
            return Math.min(Math.max(value, min), max);
        }
    },
    
    /**
     * Работа с производительностью
     */
    PerformanceUtils: {
        /**
         * Дебаунс функции
         * @param {Function} func - Функция для дебаунса
         * @param {number} wait - Время ожидания в мс
         * @returns {Function} Дебаунсированная функция
         */
        debounce: function(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },
        
        /**
         * Троттлинг функции
         * @param {Function} func - Функция для троттлинга
         * @param {number} limit - Лимит времени в мс
         * @returns {Function} Троттлированная функция
         */
        throttle: function(func, limit) {
            let inThrottle;
            return function() {
                const args = arguments;
                const context = this;
                if (!inThrottle) {
                    func.apply(context, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        },
        
        /**
         * Измерение времени выполнения функции
         * @param {Function} func - Функция для измерения
         * @param {string} label - Метка для логирования
         * @returns {any} Результат выполнения функции
         */
        measureTime: function(func, label = 'Function') {
            const start = performance.now();
            const result = func();
            const end = performance.now();
            console.log(`⏱️ ${label} выполнилась за ${(end - start).toFixed(2)}ms`);
            return result;
        },
        
        /**
         * Асинхронная пауза
         * @param {number} ms - Время паузы в миллисекундах
         * @returns {Promise} Promise который разрешается через указанное время
         */
        sleep: function(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
    },
    
    /**
     * Работа с DOM
     */
    DOMUtils: {
        /**
         * Безопасное получение элемента по ID
         * @param {string} id - ID элемента
         * @returns {HTMLElement|null} Элемент или null
         */
        safeGetById: function(id) {
            return document.getElementById(id);
        },
        
        /**
         * Создание элемента с атрибутами
         * @param {string} tag - Тег элемента
         * @param {Object} attributes - Объект атрибутов
         * @param {string} content - Содержимое элемента
         * @returns {HTMLElement} Созданный элемент
         */
        createElement: function(tag, attributes = {}, content = '') {
            const element = document.createElement(tag);
            
            Object.entries(attributes).forEach(([key, value]) => {
                if (key === 'style' && typeof value === 'object') {
                    Object.assign(element.style, value);
                } else {
                    element.setAttribute(key, value);
                }
            });
            
            if (content) {
                element.innerHTML = content;
            }
            
            return element;
        },
        
        /**
         * Показ/скрытие элемента
         * @param {string|HTMLElement} element - Элемент или его ID
         * @param {boolean} show - Показать или скрыть
         */
        toggleVisibility: function(element, show) {
            const el = typeof element === 'string' ? this.safeGetById(element) : element;
            if (el) {
                el.style.display = show ? 'block' : 'none';
            }
        },
        
        /**
         * Добавление CSS классов
         * @param {string|HTMLElement} element - Элемент или его ID
         * @param {string|Array} classes - Класс или массив классов
         */
        addClass: function(element, classes) {
            const el = typeof element === 'string' ? this.safeGetById(element) : element;
            if (el) {
                const classList = Array.isArray(classes) ? classes : [classes];
                el.classList.add(...classList);
            }
        },
        
        /**
         * Удаление CSS классов
         * @param {string|HTMLElement} element - Элемент или его ID
         * @param {string|Array} classes - Класс или массив классов
         */
        removeClass: function(element, classes) {
            const el = typeof element === 'string' ? this.safeGetById(element) : element;
            if (el) {
                const classList = Array.isArray(classes) ? classes : [classes];
                el.classList.remove(...classList);
            }
        },
        
        /**
         * Прокрутка к элементу
         * @param {string|HTMLElement} element - Элемент или его ID
         * @param {Object} options - Опции прокрутки
         */
        scrollToElement: function(element, options = { behavior: 'smooth' }) {
            const el = typeof element === 'string' ? this.safeGetById(element) : element;
            if (el) {
                el.scrollIntoView(options);
            }
        }
    },
    
    /**
     * Работа с файлами
     */
    FileUtils: {
        /**
         * Скачивание данных как файл
         * @param {string} data - Данные для скачивания
         * @param {string} filename - Имя файла
         * @param {string} mimeType - MIME тип файла
         */
        downloadAsFile: function(data, filename, mimeType = 'text/plain') {
            const blob = new Blob([data], { type: mimeType });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        },
        
        /**
         * Получение размера файла в читаемом формате
         * @param {number} bytes - Размер в байтах
         * @returns {string} Размер в человекочитаемом формате
         */
        formatFileSize: function(bytes) {
            if (bytes === 0) return '0 Bytes';
            
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },
        
        /**
         * Проверка типа файла по расширению
         * @param {string} filename - Имя файла
         * @param {Array} allowedExtensions - Разрешенные расширения
         * @returns {boolean} Результат проверки
         */
        isAllowedFileType: function(filename, allowedExtensions) {
            const extension = filename.toLowerCase().split('.').pop();
            return allowedExtensions.includes(extension);
        }
    },
    
    /**
     * Работа с цветами
     */
    ColorUtils: {
        /**
         * Генерация случайного цвета
         * @returns {string} HEX цвет
         */
        randomColor: function() {
            return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
        },
        
        /**
         * Получение цвета на основе строки (детерминированный)
         * @param {string} str - Строка для генерации цвета
         * @returns {string} HEX цвет
         */
        stringToColor: function(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = str.charCodeAt(i) + ((hash << 5) - hash);
            }
            
            const color = Math.abs(hash).toString(16).substring(0, 6);
            return '#' + '000000'.substring(0, 6 - color.length) + color;
        },
        
        /**
         * Проверка светлый или темный цвет
         * @param {string} hex - HEX цвет
         * @returns {boolean} true если светлый
         */
        isLightColor: function(hex) {
            const rgb = parseInt(hex.slice(1), 16);
            const r = (rgb >> 16) & 0xff;
            const g = (rgb >> 8) & 0xff;
            const b = (rgb >> 0) & 0xff;
            
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            return brightness > 155;
        }
    },
    
    /**
     * Криптографические утилиты
     */
    CryptoUtils: {
        /**
         * Простое хеширование строки
         * @param {string} str - Строка для хеширования
         * @returns {string} Хеш строки
         */
        simpleHash: function(str) {
            let hash = 0;
            if (str.length === 0) return hash.toString();
            
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Конвертация в 32-битное целое
            }
            
            return Math.abs(hash).toString(36);
        },
        
        /**
         * Генерация UUID v4
         * @returns {string} UUID
         */
        generateUUID: function() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
    },
    
    /**
     * Работа с браузером
     */
    BrowserUtils: {
        /**
         * Получение информации о браузере
         * @returns {Object} Информация о браузере
         */
        getBrowserInfo: function() {
            const ua = navigator.userAgent;
            let browser = 'Unknown';
            
            if (ua.includes('Chrome')) browser = 'Chrome';
            else if (ua.includes('Firefox')) browser = 'Firefox';
            else if (ua.includes('Safari')) browser = 'Safari';
            else if (ua.includes('Edge')) browser = 'Edge';
            else if (ua.includes('Opera')) browser = 'Opera';
            
            return {
                name: browser,
                userAgent: ua,
                language: navigator.language,
                platform: navigator.platform,
                cookieEnabled: navigator.cookieEnabled,
                onLine: navigator.onLine
            };
        },
        
        /**
         * Проверка поддержки localStorage
         * @returns {boolean} Поддерживается ли localStorage
         */
        isLocalStorageSupported: function() {
            try {
                const test = 'test';
                localStorage.setItem(test, test);
                localStorage.removeItem(test);
                return true;
            } catch {
                return false;
            }
        },
        
        /**
         * Копирование в буфер обмена
         * @param {string} text - Текст для копирования
         * @returns {Promise<boolean>} Успешность операции
         */
        copyToClipboard: async function(text) {
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text);
                    return true;
                } else {
                    // Fallback для старых браузеров
                    const textArea = document.createElement('textarea');
                    textArea.value = text;
                    textArea.style.position = 'fixed';
                    textArea.style.left = '-999999px';
                    textArea.style.top = '-999999px';
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    
                    const result = document.execCommand('copy');
                    document.body.removeChild(textArea);
                    return result;
                }
            } catch {
                return false;
            }
        },
        
        /**
         * Получение размеров экрана
         * @returns {Object} Размеры экрана
         */
        getScreenSize: function() {
            return {
                width: window.innerWidth,
                height: window.innerHeight,
                availWidth: screen.availWidth,
                availHeight: screen.availHeight,
                devicePixelRatio: window.devicePixelRatio || 1
            };
        }
    },
    
    /**
     * Логирование с цветами
     */
    Logger: {
        /**
         * Логирование информации
         * @param {string} message - Сообщение
         * @param {any} data - Дополнительные данные
         */
        info: function(message, data = null) {
            console.log(`ℹ️ ${message}`, data ? data : '');
        },
        
        /**
         * Логирование успеха
         * @param {string} message - Сообщение
         * @param {any} data - Дополнительные данные
         */
        success: function(message, data = null) {
            console.log(`✅ ${message}`, data ? data : '');
        },
        
        /**
         * Логирование предупреждения
         * @param {string} message - Сообщение
         * @param {any} data - Дополнительные данные
         */
        warn: function(message, data = null) {
            console.warn(`⚠️ ${message}`, data ? data : '');
        },
        
        /**
         * Логирование ошибки
         * @param {string} message - Сообщение
         * @param {any} error - Объект ошибки
         */
        error: function(message, error = null) {
            console.error(`❌ ${message}`, error ? error : '');
        },
        
        /**
         * Логирование отладочной информации
         * @param {string} message - Сообщение
         * @param {any} data - Дополнительные данные
         */
        debug: function(message, data = null) {
            if (window.DEBUG_MODE) {
                console.log(`🐛 ${message}`, data ? data : '');
            }
        }
    }
};

// Глобальные алиасы для удобства
window.formatDate = window.Utils.DateUtils.formatDate;
window.getRelativeTime = window.Utils.DateUtils.getRelativeTime;
window.generateId = window.Utils.StringUtils.generateId;
window.sanitizeString = window.Utils.StringUtils.sanitize;
window.formatNumber = window.Utils.NumberUtils.formatNumber;
window.downloadFile = window.Utils.FileUtils.downloadAsFile;
window.copyToClipboard = window.Utils.BrowserUtils.copyToClipboard;

console.log('✅ Utils модуль загружен и готов к работе');