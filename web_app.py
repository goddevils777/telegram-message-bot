from flask import Flask, render_template, request, redirect, session, jsonify
import hashlib
import hmac
import time
import os
import json
import sys
from urllib.parse import unquote
from pyrogram import Client
import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
import google.generativeai as genai
import requests
from session_manager import SessionManager
from flask import Response
import signal
import schedule
import uuid

# Инициализация приложения
app = Flask(__name__)
app.secret_key = "abc123xyz789randomd6d215bd18a5303bac88cbc4dcbab1d1"

# Настройки поиска
SEARCH_SETTINGS = {
    'messages_per_group': 5000,  # Количество сообщений на группу
    'max_results': 10000,          # Максимум результатов для показа
    'pause_between_groups': 2,   # Пауза между группами (секунды)
    'batch_size': 500           # Размер батча для обработки
}
# Добавьте после других настроек
ACTIVE_SEARCHES = {}  # Словарь активных поисков
SEARCH_LOCK = threading.Lock()

# Система множественных клиентов
active_clients = {}  # Хранилище активных клиентов {account_name: client}
client_managers = {}  # Менеджеры клиентов для каждого аккаунта

class MultiAccountManager:
    def __init__(self):
        self.clients = {}
        self.sessions_info = {}
    
    def load_available_accounts(self):
        """Загружает все доступные аккаунты"""
        sessions_dir = 'sessions'
        if not os.path.exists(sessions_dir):
            return []
        
        accounts = []
        for file in os.listdir(sessions_dir):
            if file.endswith('_info.json'):
                try:
                    account_name = file.replace('_info.json', '')
                    with open(f"{sessions_dir}/{file}", 'r', encoding='utf-8') as f:
                        info = json.load(f)
                    
                    session_file = f"{sessions_dir}/{info['session_file']}"
                    if os.path.exists(session_file):
                        accounts.append({
                            'account_name': account_name,
                            'info': info,
                            'session_path': session_file,
                            'is_active': account_name in self.clients
                        })
                except Exception as e:
                    print(f"❌ Ошибка загрузки аккаунта {file}: {e}")
                    continue
        
        return accounts
    
    def activate_account(self, account_name):
        """Активирует аккаунт для параллельной работы"""
        try:
            if account_name in self.clients:
                print(f"✅ Аккаунт {account_name} уже активен")
                return True
            
            sessions_dir = 'sessions'
            info_file = f"{sessions_dir}/{account_name}_info.json"
            
            if not os.path.exists(info_file):
                print(f"❌ Файл информации {info_file} не найден")
                return False
            
            with open(info_file, 'r', encoding='utf-8') as f:
                info = json.load(f)
            
            session_file = f"{sessions_dir}/{info['session_file']}"
            if not os.path.exists(session_file):
                print(f"❌ Файл сессии {session_file} не найден")
                return False
            
            # Сохраняем информацию для создания клиента позже
            session_path = session_file.replace('.session', '')
            
            self.clients[account_name] = {
                'session_path': session_path,
                'api_id': API_ID,
                'api_hash': API_HASH,
                'ready': True
            }
            self.sessions_info[account_name] = info
            
            print(f"✅ Аккаунт {account_name} подготовлен для параллельной работы")
            return True
            
        except Exception as e:
            print(f"❌ Ошибка активации аккаунта {account_name}: {e}")
            return False
    
    def deactivate_account(self, account_name):
        """Деактивирует аккаунт"""
        try:
            if account_name in self.clients:
                del self.clients[account_name]
                if account_name in self.sessions_info:
                    del self.sessions_info[account_name]
                print(f"✅ Аккаунт {account_name} деактивирован")
                return True
            return False
        except Exception as e:
            print(f"❌ Ошибка деактивации {account_name}: {e}")
            return False
    
    def get_client(self, account_name):
        """Создает и возвращает клиент для указанного аккаунта"""
        if account_name not in self.clients:
            return None
        
        client_info = self.clients[account_name]
        if isinstance(client_info, dict) and 'session_path' in client_info:
            # Создаем клиент только когда нужен
            return Client(
                client_info['session_path'],
                api_id=client_info['api_id'],
                api_hash=client_info['api_hash']
            )
        
        return client_info
    
    def get_active_accounts(self):
        """Возвращает список активных аккаунтов"""
        return list(self.clients.keys())

# Создаем глобальный менеджер
account_manager = MultiAccountManager()

def check_session_exists():
    """Проверяет существует ли активная сессия"""
    session_files = [f for f in os.listdir('.') if f.startswith('user_') and f.endswith('.session')]
    
    if session_files:
        print(f"✅ Найдена сессия: {session_files[0]}")
        return True
    else:
        print("❌ Сессия не найдена - требуется веб-авторизация")
        return False

# Глобальные переменные для авторизации
REQUIRES_AUTH = not check_session_exists()
auth_sessions = {}  # Хранилище процессов авторизации

def create_session_manually():
    """Создание сессии через терминал"""
    print("\n🔐 СОЗДАНИЕ СЕССИИ ПОЛЬЗОВАТЕЛЯ")
    print("Следуйте инструкциям для создания сессии...")
    
    # Используем готовый код pyrogram для авторизации
    client = Client("user_local", api_id=API_ID, api_hash=API_HASH)
    
    # Этот код АВТОМАТИЧЕСКИ запросит номер и код в терминале
    with client:
        me = client.get_me()
        print(f"✅ Авторизован: {me.first_name}")
        print("✅ Сессия создана: user_local.session")
        
        return True



@app.route('/stop_search', methods=['POST'])
def stop_search():
    """Остановка активного поиска"""
    user_id = 'local_user'
    
    with SEARCH_LOCK:
        if user_id in ACTIVE_SEARCHES:
            ACTIVE_SEARCHES[user_id]['cancelled'] = True
            print(f"🛑 Получен сигнал остановки поиска для пользователя {user_id}")
            return jsonify({'success': True, 'message': 'Поиск отменяется...'})
        else:
            return jsonify({'success': False, 'message': 'Активный поиск не найден'})

def is_search_cancelled(user_id):
    """Проверка отменен ли поиск"""
    with SEARCH_LOCK:
        return ACTIVE_SEARCHES.get(user_id, {}).get('cancelled', False)

def start_search_tracking(user_id):
    """Начать отслеживание поиска"""
    with SEARCH_LOCK:
        ACTIVE_SEARCHES[user_id] = {'cancelled': False, 'start_time': time.time()}

def end_search_tracking(user_id):
    """Завершить отслеживание поиска"""
    with SEARCH_LOCK:
        if user_id in ACTIVE_SEARCHES:
            del ACTIVE_SEARCHES[user_id]


@app.route('/get_search_settings', methods=['GET'])
def get_search_settings():
    """Получить настройки поиска"""
    return jsonify(SEARCH_SETTINGS)

@app.route('/update_search_settings', methods=['POST'])
def update_search_settings():
    """Обновить настройки поиска"""
    global SEARCH_SETTINGS
    data = request.json
    
    if 'messages_per_group' in data:
        SEARCH_SETTINGS['messages_per_group'] = min(int(data['messages_per_group']), 10000)
    
    return jsonify({'success': True, 'settings': SEARCH_SETTINGS})

# Настройки
executor = ThreadPoolExecutor(max_workers=1)
GEMINI_API_KEY = "AIzaSyDQsK1Y11VPyd_D6TpPhuqvsgc7GvYrwco"
search_history = {}
user_sessions = {}
sms_auth_sessions = {}  # Для SMS авторизации

# API данные
API_ID = 29318340
API_HASH = "68be30e447857e5e5aa24c23a41c686d"
BOT_TOKEN = "8083238823:AAHgAcvKL7nf29zz66kGB3bL6QCSHOVXCRA"

# Инициализация менеджера сессий
session_manager = SessionManager(API_ID, API_HASH)

# Система лимитов
USER_LIMITS = {
    'search_limit': 17,
    'ai_analysis_limit': 7
}

# Хранилище использования пользователей
user_usage = {}
# Система рассылки
broadcast_tasks = {}  # Хранилище запланированных задач
scheduler_thread = None  # Поток планировщика

# USDT кошелек для оплаты
USDT_WALLET = "TMB8QT6n55WFvzQgN5QNGZWHozt2PjjMJE"

# Утилиты
def load_saved_api_keys():
    """Загружает сохранённые API ключи"""
    global API_ID, API_HASH
    try:
        if os.path.exists('config/api_keys.json'):
            with open('config/api_keys.json', 'r') as f:
                config = json.load(f)
            API_ID = config['API_ID']
            API_HASH = config['API_HASH']
            print(f"✅ Загружены API ключи: ID={API_ID}")
    except Exception as e:
        print(f"❌ Ошибка загрузки ключей: {e}")

# Загружаем ключи при старте
load_saved_api_keys()

def get_user_client(user_id):
    """Создает клиент для локального пользователя с API ключами"""
    # Для локальной версии всегда используем один файл ключей
    keys_file = 'config/api_keys.json'
    
    if not os.path.exists(keys_file):
        return None
    
    try:
        with open(keys_file, 'r') as f:
            keys_data = json.load(f)
        
        api_id = keys_data['API_ID']
        api_hash = keys_data['API_HASH']
        
        return Client(f"user_local", api_id=api_id, api_hash=api_hash)
        
    except Exception as e:
        print(f"❌ Ошибка создания клиента: {e}")
        return None

def check_user_limits(user_id, action_type):
    """Проверка лимитов пользователя"""
    if user_id not in user_usage:
        user_usage[user_id] = {
            'searches_used': 0,
            'ai_analysis_used': 0,
            'is_premium': False
        }
    
    user_data = user_usage[user_id]
    
    if user_data['is_premium']:
        return True, "Премиум пользователь"
    
    if action_type == 'search':
        if user_data['searches_used'] >= USER_LIMITS['search_limit']:
            return False, f"Исчерпан лимит поисков ({USER_LIMITS['search_limit']})"
        return True, f"Осталось поисков: {USER_LIMITS['search_limit'] - user_data['searches_used']}"
    
    elif action_type == 'ai_analysis':
        if user_data['ai_analysis_used'] >= USER_LIMITS['ai_analysis_limit']:
            return False, f"Исчерпан лимит AI анализов ({USER_LIMITS['ai_analysis_limit']})"
        return True, f"Осталось AI анализов: {USER_LIMITS['ai_analysis_limit'] - user_data['ai_analysis_used']}"
    
    return True, "OK"

def increment_usage(user_id, action_type):
    """Увеличить счетчик использования"""
    if user_id not in user_usage:
        user_usage[user_id] = {'searches_used': 0, 'ai_analysis_used': 0, 'is_premium': False}
    
    if action_type == 'search':
        user_usage[user_id]['searches_used'] += 1
    elif action_type == 'ai_analysis':
        user_usage[user_id]['ai_analysis_used'] += 1

def verify_telegram_auth(auth_data, bot_token):
    """Временно принимаем все авторизации для отладки"""
    print(f"🔍 DEBUG: Получены данные: {auth_data}")
    
    # Проверяем что есть обязательные поля
    required_fields = ['id', 'first_name', 'auth_date']
    for field in required_fields:
        if field not in auth_data:
            print(f"❌ Отсутствует поле: {field}")
            return False
    
    # Временно всегда возвращаем True для тестирования
    print("✅ Авторизация принята (отладка)")
    return True

def is_user_account_connected(user_id):
    """Проверяет есть ли API ключи для локальной версии"""
    keys_file = 'config/api_keys.json'
    return os.path.exists(keys_file)

@app.route('/')
def index():
    if REQUIRES_AUTH:
        return render_template('bot_auth.html')  # Авторизация через бота
    else:
        return render_template('dashboard.html')  # Обычный дашборд


@app.route('/get_telegram_user_info', methods=['GET'])
def get_telegram_user_info():
    """Возвращает статичную информацию пользователя"""
    user_info = {
        'first_name': 'Пользователь',
        'last_name': '',
        'username': 'local_user',
        'user_id': 'local',
        'has_photo': False,
        'avatar_data': None
    }
    
    return jsonify({
        'success': True,
        'user_info': user_info
    })



@app.route('/get_groups', methods=['GET'])
def get_groups():
    """Получить список групп пользователя для локальной версии"""
    # Для локальной версии используем статичного пользователя
    user_id = 'local_user'
    
    if not is_user_account_connected(user_id):
        return jsonify({'error': 'Сначала добавьте API ключи'}), 403
    
    try:
        def run_get_groups():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                user_client = get_user_client(user_id)
                if not user_client:
                    return []
                
                groups = loop.run_until_complete(get_user_groups_real(user_client))
                return groups
            finally:
                loop.close()
        
        future = executor.submit(run_get_groups)
        groups = future.result(timeout=60)
        
        print(f"✅ Получено {len(groups)} реальных групп")
        
        return jsonify({
            'success': True,
            'groups': groups
        })
        
    except Exception as e:
        print(f"Ошибка получения групп: {e}")
        return jsonify({'error': f'Ошибка: {str(e)}'}), 500

# История поиска
@app.route('/search', methods=['POST'])
def search():
    """API для поиска сообщений для локальной версии"""
    user_id = 'local_user'
    
    if not is_user_account_connected(user_id):
        return jsonify({'error': 'Сначала добавьте API ключи'}), 403
    
    keyword = request.json.get('keyword', '').strip()
    selected_groups = request.json.get('selected_groups', [])
    search_depth = request.json.get('search_depth', 500)  # По умолчанию 500
    print(f"🔧 Пользователь выбрал глубину поиска: {search_depth} сообщений на группу")
    
    if not keyword or not selected_groups:
        return jsonify({'error': 'Введите ключевое слово и выберите группы'}), 400
    
    # Начинаем отслеживание поиска
    start_search_tracking(user_id)
    
    try:
        def run_search():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                user_client = get_user_client(user_id)
                if not user_client:
                    return []
                
                results = loop.run_until_complete(search_in_selected_groups_real(user_client, keyword, selected_groups, search_depth, user_id))
                return results
            finally:
                loop.close()
        
        future = executor.submit(run_search)
        results = future.result(timeout=300)  # 5 минут максимум
        
        # Проверяем был ли отменен поиск
        if is_search_cancelled(user_id):
            end_search_tracking(user_id)
            return jsonify({'error': 'Поиск отменен пользователем', 'cancelled': True})
        
        # Увеличиваем счетчик для статистики
        if user_id not in user_usage:
            user_usage[user_id] = {'searches_used': 0, 'ai_analysis_used': 0, 'is_premium': True}
        user_usage[user_id]['searches_used'] += 1
        
        print(f"✅ Найдено {len(results)} реальных сообщений для '{keyword}'")
        
        end_search_tracking(user_id)
        return jsonify({
            'success': True,
            'results': results,
            'total': len(results)
        })
        
    except Exception as e:
        end_search_tracking(user_id)
        print(f"Ошибка поиска: {e}")
        return jsonify({'error': f'Ошибка поиска: {str(e)}'}), 500
    
# Локальная версия без лимитов
    
    keyword = request.json.get('keyword', '').strip()
    selected_groups = request.json.get('selected_groups', [])
    
    if not keyword:
        return jsonify({'error': 'Введите ключевое слово'}), 400
    
    if not selected_groups:
        return jsonify({'error': 'Выберите группы для поиска'}), 400
    
    try:
            def run_search():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    user_client = get_user_client(user_id)
                    if not user_client:
                        return []
                    
                    results = loop.run_until_complete(search_in_selected_groups_real(user_client, keyword, selected_groups))
                    return results
                finally:
                    loop.close()
            
            future = executor.submit(run_search)
            results = future.result(timeout=120)
            
            increment_usage(user_id, 'search')
            
            print(f"✅ Найдено {len(results)} реальных сообщений для '{keyword}'")
            
            return jsonify({
                'success': True,
                'results': results,
                'total': len(results)
            })
        
    except Exception as e:
        print(f"Ошибка поиска: {e}")
        return jsonify({'error': f'Ошибка поиска: {str(e)}'}), 500

@app.route('/save_search', methods=['POST'])
def save_search():
    """Сохранить поиск в историю"""
    user_id = 'local_user'
    
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'Нет данных для сохранения'}), 400
        
        search_record = {
            'id': len(search_history.get(user_id, [])) + 1,
            'keywords': data.get('keywords', []),
            'results_count': data.get('results_count', 0),
            'groups_count': data.get('groups_count', 0),
            'date': datetime.now().strftime("%d.%m.%Y %H:%M"),
            'results': data.get('results', [])[:20]  # Ограничиваем 20 результатами
        }
        
        if user_id not in search_history:
            search_history[user_id] = []
        
        search_history[user_id].insert(0, search_record)
        
        # Ограничиваем историю 50 записями
        if len(search_history[user_id]) > 50:
            search_history[user_id] = search_history[user_id][:50]
        
        print(f"✅ Поиск сохранён в историю для пользователя {user_id}")
        
        return jsonify({'success': True, 'message': 'Поиск сохранён в историю'})
        
    except Exception as e:
        print(f"❌ Ошибка сохранения поиска: {e}")
        return jsonify({'error': f'Ошибка сохранения: {str(e)}'}), 500

@app.route('/get_history', methods=['GET'])
def get_history():
    """Получить историю поиска для локального пользователя"""
    # Используем статичного пользователя
    user_id = 'local_user'
    history = search_history.get(user_id, [])
    
    return jsonify({
        'success': True,
        'history': history
    })

@app.route('/delete_search/<int:search_id>', methods=['DELETE'])
def delete_search(search_id):
    """Удалить поиск из истории"""
    user_id = 'local_user'
    if user_id in search_history:
        search_history[user_id] = [s for s in search_history[user_id] if s['id'] != search_id]
    
    return jsonify({'success': True})

# Статистика и лимиты
@app.route('/get_user_stats', methods=['GET'])
def get_user_stats():
    """Получить статистику для локального пользователя"""
    # Используем статичного пользователя для локальной версии
    user_id = 'local_user'
    
    if user_id not in user_usage:
        user_usage[user_id] = {'searches_used': 0, 'ai_analysis_used': 0, 'is_premium': True}
    
    user_data = user_usage[user_id]
    
    return jsonify({
        'searches_used': user_data['searches_used'],
        'searches_remaining': 999,  # Безлимит для локальной версии
        'ai_analysis_used': user_data['ai_analysis_used'],
        'ai_analysis_remaining': 999,  # Безлимит для локальной версии
        'is_premium': True,  # Локальная версия всегда премиум
        'usdt_wallet': USDT_WALLET
    })

# AI анализ
@app.route('/analyze_with_ai', methods=['POST'])
def analyze_with_ai():
    """Анализ сообщений с помощью AI для локальной версии"""
    # Используем статичного пользователя
    user_id = 'local_user'
    
    data = request.json
    messages = data.get('messages', [])
    custom_prompt = data.get('custom_prompt', '').strip()  # ← ПОЛУЧАЕМ КАСТОМНЫЙ ПРОМПТ

    print(f"🎯 Получен кастомный промпт: '{custom_prompt}'")
    
    if not messages:
        return jsonify({'error': 'Нет сообщений для анализа'}), 400
    
    print(f"🤖 Анализируем {len(messages)} сообщений")
    
    try:
        potential_clients = analyze_messages_for_needs(messages, custom_prompt)
        
        # Увеличиваем счетчик для статистики
        if user_id not in user_usage:
            user_usage[user_id] = {'searches_used': 0, 'ai_analysis_used': 0, 'is_premium': True}
        user_usage[user_id]['ai_analysis_used'] += 1
        
        return jsonify({
            'success': True,
            'potential_clients': potential_clients,
            'analyzed_count': len(messages)
        })
        
    except Exception as e:
        print(f"Ошибка анализа AI: {e}")
        return jsonify({'error': f'Ошибка анализа: {str(e)}'}), 500

def analyze_messages_for_needs(messages, custom_prompt=''):
    """Анализ сообщений через Gemini API"""
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        messages_text = ""
        for i, msg in enumerate(messages, 1):
            messages_text += f"Сообщение {i}:\n"
            messages_text += f"Автор: @{msg.get('author', 'неизвестно')}\n"
            messages_text += f"Группа: {msg.get('chat', 'неизвестно')}\n"
            messages_text += f"Дата: {msg.get('date', 'неизвестно')}\n"
            messages_text += f"Текст: {msg.get('text', '')}\n"
            messages_text += "---\n"
        
        # Используем кастомный промпт если передан, иначе базовый
        if custom_prompt:
            user_instruction = custom_prompt
            print(f"🎯 Используем кастомный промпт: {custom_prompt}")
        else:
            user_instruction = "найди те сообщения где люди выражают потребности или ищут услуги"
            print(f"📝 Используем базовый промпт")

        prompt = f"""Проанализируй сообщения из Telegram групп и {user_instruction}.

        {messages_text}

        Верни результат СТРОГО в JSON формате без дополнительного текста:
        [
        {{
            "message_number": 1,
            "original_message": "полный текст сообщения",
            "client_need": "краткое описание того что ищет человек",
            "author": "@username",
            "group": "название группы", 
            "date": "дата",
            "confidence": "высокая"
        }}
        ]

        Критерии поиска: {user_instruction}

        Если подходящих сообщений нет, верни: []"""

        response = model.generate_content(prompt)
        ai_response = response.text.strip()
        
        if ai_response.startswith('```json'):
            ai_response = ai_response.replace('```json', '').replace('```', '').strip()
        elif ai_response.startswith('```'):
            ai_response = ai_response.split('\n', 1)[1]
            if ai_response.endswith('```'):
                ai_response = ai_response.rsplit('\n', 1)[0]
        
        potential_clients = json.loads(ai_response)
        print(f"Gemini нашел {len(potential_clients)} потенциальных клиентов")
        return potential_clients
            
    except Exception as e:
        print(f"Ошибка Gemini API: {e}")
        return []

# Платежи
@app.route('/check_payment', methods=['POST'])
def check_payment():
    """Проверка платежа пользователя"""
    if 'user_id' not in session:
        return jsonify({'error': 'Не авторизован'}), 401
    
    user_id = session['user_id']
    
    try:
        payment_found, payment_info = check_tron_usdt_payment(USDT_WALLET, amount_usdt=10)
        
        if payment_found:
            if user_id not in user_usage:
                user_usage[user_id] = {'searches_used': 0, 'ai_analysis_used': 0, 'is_premium': False}
            
            user_usage[user_id]['is_premium'] = True
            
            return jsonify({
                'success': True,
                'message': 'Платёж найден! Премиум активирован',
                'payment_info': payment_info
            })
        else:
            return jsonify({
                'success': False,
                'message': payment_info
            })
            
    except Exception as e:
        print(f"Ошибка проверки платежа: {e}")
        return jsonify({'error': f'Ошибка проверки: {str(e)}'}), 500




@app.route('/check_api_keys', methods=['GET'])
def check_api_keys():
    """Проверяет сохранены ли API ключи и возвращает их для предзаполнения"""
    try:
        if os.path.exists('config/api_keys.json'):
            with open('config/api_keys.json', 'r') as f:
                config = json.load(f)
            
            # Возвращаем данные для предзаполнения формы
            return jsonify({
                'has_keys': True, 
                'api_id': str(config.get('API_ID', '')),
                'api_hash_masked': config.get('API_HASH', '')[:10] + '...' if config.get('API_HASH') else '',
                'has_hash': bool(config.get('API_HASH'))
            })
        
        return jsonify({'has_keys': False})
        
    except Exception as e:
        print(f"❌ Ошибка проверки API ключей: {e}")
        return jsonify({'has_keys': False})

@app.route('/save_api_keys_local', methods=['POST'])
def save_api_keys_local():
    """Сохраняет или обновляет API ключи для локального использования"""
    data = request.json
    api_id = data.get('api_id', '').strip()
    api_hash = data.get('api_hash', '').strip()
    
    # Валидация API ID (обязательный)
    if not api_id:
        return jsonify({'error': 'Введите API ID'}), 400
    
    if not api_id.isdigit():
        return jsonify({'error': 'API ID должен содержать только цифры'}), 400
    
    try:
        global API_ID, API_HASH
        
        # Загружаем существующую конфигурацию
        existing_config = {}
        if os.path.exists('config/api_keys.json'):
            with open('config/api_keys.json', 'r') as f:
                existing_config = json.load(f)
        
        # Обновляем API ID
        API_ID = int(api_id)
        
        # Обновляем API Hash только если он передан
        if api_hash:
            if len(api_hash) < 32:
                return jsonify({'error': 'API Hash слишком короткий'}), 400
            API_HASH = api_hash
        else:
            # Если API Hash не передан, используем существующий
            API_HASH = existing_config.get('API_HASH', API_HASH)
        
        # Сохраняем обновленную конфигурацию
        config = {
            'API_ID': API_ID,
            'API_HASH': API_HASH,
            'updated_at': time.time()
        }
        
        os.makedirs('config', exist_ok=True)
        with open('config/api_keys.json', 'w') as f:
            json.dump(config, f, indent=2)
        
        print(f"✅ API ключи обновлены: ID={API_ID}, Hash={'обновлен' if api_hash else 'оставлен прежний'}")
        
        return jsonify({
            'success': True,
            'message': 'Настройки сохранены',
            'updated_hash': bool(api_hash)
        })
        
    except Exception as e:
        print(f"❌ Ошибка сохранения настроек: {e}")
        return jsonify({'error': f'Ошибка сохранения: {str(e)}'}), 500

@app.route('/help')
def help_page():
    """Страница справки"""
    return render_template('help.html')

from flask import Response
import json

@app.route('/search_progressive', methods=['POST'])
def search_progressive():
    """Прогрессивный поиск с потоковым выводом результатов"""
    user_id = 'local_user'
    
    if not is_user_account_connected(user_id):
        return jsonify({'error': 'Сначала добавьте API ключи'}), 403
    
    keyword = request.json.get('keyword', '').strip()
    selected_groups = request.json.get('selected_groups', [])
    
    if not keyword or not selected_groups:
        return jsonify({'error': 'Неверные параметры'}), 400
    
    def generate_search_stream():
        try:
            def run_progressive_search():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    user_client = get_user_client(user_id)
                    if not user_client:
                        return
                    
                    loop.run_until_complete(search_with_progress(user_client, keyword, selected_groups, yield_progress))
                finally:
                    loop.close()
            
            def yield_progress(data):
                yield f"data: {json.dumps(data)}\n\n"
            
            global progress_generator
            progress_generator = None
            
            future = executor.submit(run_progressive_search)
            future.result(timeout=300)  # 5 минут максимум
            
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
    
    return Response(
        generate_search_stream(),
        mimetype='text/plain',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        }
    )

progress_generator = None

async def search_with_progress(client, keyword, selected_group_ids, yield_func):
    """Поиск с прогрессом"""
    global progress_generator
    
    try:
        await client.start()
        await asyncio.sleep(2)
        
        keywords = [word.strip().lower() for word in keyword.split() if word.strip()]
        
        # Получаем группы для поиска
        chat_groups = []
        async for dialog in client.get_dialogs():
            chat = dialog.chat
            if (chat.type.name in ["GROUP", "SUPERGROUP"] and 
                str(chat.id) in selected_group_ids):
                chat_groups.append(chat)
        
        total_groups = len(chat_groups)
        total_found = 0
        
        for i, chat in enumerate(chat_groups, 1):
            try:
                # Отправляем прогресс начала группы
                progress_data = {
                    'type': 'group_start',
                    'group_name': chat.title,
                    'current_group': i,
                    'total_groups': total_groups
                }
                yield f"data: {json.dumps(progress_data)}\n\n"
                
                group_messages = []
                message_count = 0
                
                async for message in client.get_chat_history(chat.id, limit=200):
                    if message.text:
                        message_text = message.text.lower()
                        matched_words = [word for word in keywords if word in message_text]
                        
                        found_messages.append({
                            'text': message.text,
                            'author': message.from_user.username if message.from_user and message.from_user.username else "Аноним",
                            'chat': chat.title,
                            'date': message.date.strftime("%d.%m.%Y %H:%M"),
                            'date_timestamp': message.date.timestamp(),
                            'matched_words': matched_words,
                            'message_id': message.id,        # ← ID сообщения
                            'chat_id': chat.id,             # ← ID чата
                            'chat_username': getattr(chat, 'username', None)  # ← Username чата если есть
                        })
                        
                        # ДЕТАЛЬНЫЙ ЛОГ КАЖДОГО НАЙДЕННОГО СООБЩЕНИЯ
                        print(f"  ✅ НАЙДЕНО: '{message.text[:50]}...' от @{message.from_user.username if message.from_user and message.from_user.username else 'Аноним'} в {message.date.strftime('%d.%m %H:%M')}")
                        print(f"      Слова: {matched_words}")
                        total_found += 1
                        
                        message_count += 1
                        
                        # Отправляем прогресс каждые 10 сообщений
                        if message_count % 10 == 0:
                            progress_data = {
                                'type': 'progress',
                                'current_group': i,
                                'total_groups': total_groups,
                                'total_found': total_found,
                                'group_messages': message_count
                            }
                            yield f"data: {json.dumps(progress_data)}\n\n"
                
                # Отправляем результаты группы
                if group_messages:
                    results_data = {
                        'type': 'results',
                        'messages': group_messages,
                        'group': chat.title
                    }
                    yield f"data: {json.dumps(results_data)}\n\n"
                
                # Финальный прогресс группы
                progress_data = {
                    'type': 'progress',
                    'current_group': i,
                    'total_groups': total_groups,
                    'total_found': total_found
                }
                yield f"data: {json.dumps(progress_data)}\n\n"
                
                await asyncio.sleep(0.5)
                
            except Exception as e:
                error_data = {
                    'type': 'error',
                    'error': f"Ошибка в группе {chat.title}: {str(e)}"
                }
                yield f"data: {json.dumps(error_data)}\n\n"
                continue
        
        await client.stop()
        
        # Завершение поиска
        final_data = {
            'type': 'complete',
            'total_found': total_found
        }
        yield f"data: {json.dumps(final_data)}\n\n"
        
    except Exception as e:
        error_data = {
            'type': 'error',
            'error': str(e)
        }
        yield f"data: {json.dumps(error_data)}\n\n"

def check_tron_usdt_payment(wallet_address, amount_usdt=10, hours_back=24):
    """Проверка USDT TRC-20 платежей через TronScan API"""
    try:
        url = "https://apilist.tronscan.org/api/token_trc20/transfers"
        params = {
            'limit': 50,
            'start': 0,
            'toAddress': wallet_address,
            'contract_address': 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
        }
        
        response = requests.get(url, params=params, timeout=10)
        if response.status_code != 200:
            return False, "Ошибка API TronScan"
        
        data = response.json()
        transfers = data.get('token_transfers', [])
        
        cutoff_time = datetime.now() - timedelta(hours=hours_back)
        
        for transfer in transfers:
            transfer_amount = float(transfer['quant']) / 1000000
            transfer_time = datetime.fromtimestamp(transfer['block_ts'] / 1000)
            
            if (transfer_amount >= amount_usdt and transfer_time > cutoff_time):
                return True, {
                    'hash': transfer['transaction_id'],
                    'amount': transfer_amount,
                    'time': transfer_time.strftime('%d.%m.%Y %H:%M'),
                    'from_address': transfer['from_address']
                }
        
        return False, "Платёж не найден"
        
    except Exception as e:
        print(f"Ошибка проверки платежа: {e}")
        return False, f"Ошибка: {str(e)}"

async def get_user_groups_real(client):
    """Получить реальные группы пользователя"""
    try:
        await client.start()
        
        groups = []
        processed_count = 0
        
        print("🔍 Начинаю поиск групп пользователя...")
        
        # Добавляем паузу для синхронизации времени
        await asyncio.sleep(2)
        
        async for dialog in client.get_dialogs():
            chat = dialog.chat
            
            if chat.type.name in ["GROUP", "SUPERGROUP"]:
                try:
                    groups.append({
                        'id': str(chat.id),
                        'title': chat.title or 'Без названия',
                        'type': chat.type.name,
                        'members_count': getattr(chat, 'members_count', 0),
                        'status': '✅ Активная группа'
                    })
                    
                    processed_count += 1
                    print(f"✅ Найдена группа: {chat.title}")
                    
                    # Увеличиваем паузы для избежания ошибок времени
                    if processed_count % 3 == 0:
                        await asyncio.sleep(2)
                        
                except Exception as e:
                    print(f"❌ Ошибка в группе {chat.title}: {e}")
                    continue
        
        await client.stop()
        
        # Сортируем по количеству участников
        groups.sort(key=lambda x: x.get('members_count', 0), reverse=True)
        
        print(f"✅ ИТОГО найдено {len(groups)} групп")
        return groups
        
    except Exception as e:
        print(f"Общая ошибка получения групп: {e}")
        if "BadMsgNotification" in str(e) or "msg_id is too low" in str(e):
            print("⚠️ ОШИБКА ВРЕМЕНИ: Синхронизируйте время на компьютере!")
            print("Windows: w32tm /resync")
            print("Mac: sudo sntp -sS time.apple.com") 
            print("Linux: sudo ntpdate -s time.nist.gov")
        return []

async def search_in_selected_groups_real(client, keyword, selected_group_ids, search_depth=500, user_id='local_user'):
    """Реальный поиск в выбранных группах с поддержкой отмены"""
    try:
        await client.start()
        await asyncio.sleep(2)
        
        # Проверяем отмену в начале
        if is_search_cancelled(user_id):
            print("🛑 Поиск отменен в начале")
            await client.stop()
            return []
        
        keywords = [word.strip().lower() for word in keyword.split() if word.strip()]
        
        if not keywords:
            print("❌ Нет ключевых слов для поиска")
            return []
        
        print(f"🔍 Поиск слов: {keywords}")
        print(f"📂 В выбранных группах: {len(selected_group_ids)}")
        print(f"📜 Глубина поиска: {search_depth} сообщений на группу")
        
        # Получаем группы для поиска
        chat_groups = []
        print("📋 Получаем список групп...")
        
        async for dialog in client.get_dialogs():
            # Проверяем отмену во время загрузки групп
            if is_search_cancelled(user_id):
                print("🛑 Поиск отменен при загрузке групп")
                await client.stop()
                return []
                
            chat = dialog.chat
            if (chat.type.name in ["GROUP", "SUPERGROUP"] and 
                str(chat.id) in selected_group_ids):
                chat_groups.append(chat)
                print(f"✅ Группа добавлена: {chat.title}")
        
        print(f"✅ Найдено {len(chat_groups)} групп для поиска")
        
        if not chat_groups:
            print("❌ Нет групп для поиска!")
            return []
        
        found_messages = []
        
        for i, chat in enumerate(chat_groups, 1):
            # Проверяем отмену перед каждой группой
            if is_search_cancelled(user_id):
                print(f"🛑 Поиск отменен на группе {i}/{len(chat_groups)}")
                break
                
            try:
                print(f"[{i}/{len(chat_groups)}] 🔍 Глубокий поиск в: {chat.title}")
                
                message_count = 0
                chat_found = 0
                processed_batches = 0
                
                # Поиск по сообщениям
                async for message in client.get_chat_history(chat.id, limit=search_depth):
                    # Проверяем отмену каждые 100 сообщений
                    if message_count % 100 == 0 and is_search_cancelled(user_id):
                        print(f"🛑 Поиск отменен в группе {chat.title} после {message_count} сообщений")
                        await client.stop()
                        return found_messages  # Возвращаем то что уже нашли
                    
                    if message.text:
                        message_text = message.text.lower()
                        
                        # ДЕТАЛЬНЫЙ ЛОГ КАЖДОГО СООБЩЕНИЯ
                        if message_count < 5:  # Показываем первые 5 сообщений для отладки
                            print(f"    Сообщение {message_count+1}: '{message.text[:30]}...' от {message.date.strftime('%d.%m %H:%M')}")
                            print(f"    Ищем слова {keywords} в тексте...")
                        
                        # Проверяем есть ли наши ключевые слова
                        matched_words = [word for word in keywords if word in message_text]
                        
                        # Если есть слово "рожище" в любом регистре - дополнительная проверка
                        if any('рожище' in keyword.lower() for keyword in keywords):
                            if 'рожище' in message_text:
                                print(f"    🎯 ПОТЕНЦИАЛЬНОЕ СОВПАДЕНИЕ: '{message.text[:50]}...'")
                                print(f"    Ключевые слова: {keywords}")
                                print(f"    Текст сообщения (lower): '{message_text[:50]}...'")
                        
                    if matched_words:
                        found_messages.append({
                            'text': message.text,
                            'author': message.from_user.username if message.from_user and message.from_user.username else "Аноним",
                            'chat': chat.title,
                            'date': message.date.strftime("%d.%m.%Y %H:%M"),
                            'date_timestamp': message.date.timestamp(),
                            'matched_words': matched_words,
                            'message_id': message.id,
                            'chat_id': chat.id,
                            'chat_username': getattr(chat, 'username', None)
                        })
                        chat_found += 1
                            
                        message_count += 1
                        
                        # Показываем прогресс каждые 500 сообщений
                        if message_count % SEARCH_SETTINGS['batch_size'] == 0:
                            processed_batches += 1
                            print(f"  📊 Обработано: {message_count}/{SEARCH_SETTINGS['messages_per_group']} сообщений, найдено: {chat_found}")
                            await asyncio.sleep(0.3)
                
                group_matches = [m for m in found_messages if m['chat'] == chat.title]
                print(f"  📝 Проверено {message_count} сообщений, найдено совпадений: {len(group_matches)}")
                if len(group_matches) > 0:
                    print(f"      Последнее найденное: {group_matches[-1]['date']}")
                                
                # Пауза между группами
                await asyncio.sleep(SEARCH_SETTINGS['pause_between_groups'])
                        
            except Exception as e:
                print(f"❌ Ошибка в группе {chat.title}: {e}")
                await asyncio.sleep(5)
                continue
        
        await client.stop()
        
        # Финальная проверка отмены
        if is_search_cancelled(user_id):
            print("🛑 Поиск был отменен, возвращаем частичные результаты")

        # Сортируем по дате - самые свежие сверху
        found_messages.sort(key=lambda msg: msg['date_timestamp'], reverse=True)

        # ПРОВЕРЯЕМ СОРТИРОВКУ
        print(f"🔍 ПРОВЕРКА СОРТИРОВКИ:")
        for i, msg in enumerate(found_messages[:5]):  # Показываем первые 5
            print(f"  {i+1}. {msg['date']} - timestamp: {msg['date_timestamp']}")

        # Удаляем только timestamp, оставляем остальные поля  
        for msg in found_messages:
            if 'date_timestamp' in msg:
                del msg['date_timestamp']

        print(f"🔗 Проверяем поля в первом сообщении:")
        if found_messages:
            first_msg = found_messages[0]
            print(f"  message_id: {first_msg.get('message_id', 'НЕТ')}")
            print(f"  chat_id: {first_msg.get('chat_id', 'НЕТ')}")
            print(f"  chat_username: {first_msg.get('chat_username', 'НЕТ')}")
            
        print(f"🎉 ИТОГО найдено: {len(found_messages)} сообщений")
        
        print(f"📤 Возвращаем {min(len(found_messages), SEARCH_SETTINGS['max_results'])} из {len(found_messages)} найденных")

        # Возвращаем результаты (уже отсортированы по timestamp выше)
        return found_messages[:SEARCH_SETTINGS['max_results']]
        
    except Exception as e:
        print(f"❌ Общая ошибка поиска: {e}")
        return []

@app.route('/schedule_broadcast', methods=['POST'])
def schedule_broadcast():
    """Планирование рассылки сообщений"""
    user_id = 'local_user'
    
    data = request.json
    message = data.get('message', '').strip()
    groups = data.get('groups', [])
    date = data.get('date', '')
    time = data.get('time', '')
    repeat = data.get('repeat', 'once')
    
    # Валидация
    if not message:
        return jsonify({'error': 'Сообщение не может быть пустым'}), 400
    
    if not groups:
        return jsonify({'error': 'Выберите группы для рассылки'}), 400
    
    if not date or not time:
        return jsonify({'error': 'Укажите дату и время'}), 400
    
    try:
        # Создаем datetime объект
        scheduled_datetime = datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M")
        
        # Проверяем что время в будущем
        if scheduled_datetime <= datetime.now():
            return jsonify({'error': 'Время должно быть в будущем'}), 400
        
        # Создаем уникальный ID задачи
        task_id = str(uuid.uuid4())[:8]
        
        # Сохраняем задачу
        task_info = {
            'id': task_id,
            'message': message,
            'groups': groups,
            'scheduled_time': scheduled_datetime,
            'repeat': repeat,
            'status': 'scheduled',
            'created_at': datetime.now(),
            'user_id': user_id
        }
        
        broadcast_tasks[task_id] = task_info
        
        print(f"📤 Запланирована рассылка:")
        print(f"  ID: {task_id}")
        print(f"  Время: {scheduled_datetime}")
        print(f"  Групп: {len(groups)}")
        print(f"  Повтор: {repeat}")
        
        # Запускаем планировщик если еще не запущен
        start_scheduler()
        
        return jsonify({
            'success': True,
            'task_id': task_id,
            'task_info': {
                'scheduled_time': scheduled_datetime.strftime('%d.%m.%Y %H:%M'),
                'groups_count': len(groups),
                'repeat_text': get_repeat_text(repeat)
            }
        })
        
    except ValueError as e:
        return jsonify({'error': 'Неверный формат даты/времени'}), 400
    except Exception as e:
        print(f"❌ Ошибка планирования: {e}")
        return jsonify({'error': f'Ошибка планирования: {str(e)}'}), 500

@app.route('/get_account_info', methods=['GET'])
def get_account_info():
    """Получение информации об активном аккаунте"""
    try:
        # Сначала проверяем есть ли информация о текущем аккаунте
        if os.path.exists('current_account.json'):
            with open('current_account.json', 'r', encoding='utf-8') as f:
                account_info = json.load(f)
            
            user_info = account_info['user_info']
            return jsonify({
                'success': True,
                'account_name': f"{user_info['first_name']} {user_info['last_name']}".strip(),
                'phone': user_info['phone'],
                'username': user_info['username'],
                'user_id': user_info['id']
            })
        
        # Если нет current_account.json, пробуем получить из активной сессии
        def run_get_account():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                return loop.run_until_complete(get_current_account_info())
            finally:
                loop.close()
        
        future = executor.submit(run_get_account)
        account_info = future.result(timeout=30)
        
        if account_info:
            return jsonify({
                'success': True,
                'account_name': f"{account_info['first_name']} {account_info['last_name']}".strip(),
                'phone': account_info['phone'],
                'username': account_info['username'],
                'user_id': account_info['user_id']
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Аккаунт не найден'
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Ошибка: {str(e)}'
        })

def get_repeat_text(repeat):
    """Преобразует код повтора в читаемый текст"""
    repeat_texts = {
        'once': 'Однократно',
        'daily': 'Каждый день',
        'weekly': 'Каждую неделю',
        'monthly': 'Каждый месяц'
    }
    return repeat_texts.get(repeat, 'Неизвестно')

def start_scheduler():
    """Запускает планировщик задач"""
    global scheduler_thread
    
    if scheduler_thread is None or not scheduler_thread.is_alive():
        scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
        scheduler_thread.start()
        print("✅ Планировщик рассылки запущен")

def run_scheduler():
    """Основной цикл планировщика"""
    while True:
        try:
            check_broadcast_tasks()
            time.sleep(60)  # Проверяем каждую минуту
        except Exception as e:
            print(f"❌ Ошибка планировщика: {e}")
            time.sleep(60)

def check_broadcast_tasks():
    """Проверяет и выполняет готовые задачи"""
    now = datetime.now()
    
    for task_id, task in list(broadcast_tasks.items()):
        if task['status'] == 'scheduled' and task['scheduled_time'] <= now:
            print(f"🚀 Выполняем рассылку {task_id}")
            execute_broadcast_task(task)

def execute_broadcast_task(task):
    """Выполняет рассылку"""
    try:
        task['status'] = 'executing'
        user_id = task.get('user_id', 'local_user')
        
        print(f"📤 Начинаем рассылку {task['id']}")
        print(f"📝 Сообщение: {task['message'][:100]}...")
        print(f"📂 Групп: {len(task['groups'])}")
        
        # Выполняем рассылку в отдельном потоке
        def run_broadcast():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                user_client = get_user_client(user_id)
                if not user_client:
                    raise Exception("Не удалось создать клиент для отправки")
                
                result = loop.run_until_complete(send_broadcast_messages(
                    user_client, 
                    task['message'], 
                    task['groups']
                ))
                
                task['sent_count'] = result['sent']
                task['failed_count'] = result['failed']
                task['status'] = 'completed'
                task['completed_at'] = datetime.now()
                
                print(f"✅ Рассылка {task['id']} завершена: отправлено {result['sent']}, ошибок {result['failed']}")
                
            except Exception as e:
                task['status'] = 'failed'
                task['error'] = str(e)
                print(f"❌ Ошибка рассылки {task['id']}: {e}")
            finally:
                loop.close()
        
        # Запускаем рассылку в отдельном потоке
        broadcast_thread = threading.Thread(target=run_broadcast, daemon=True)
        broadcast_thread.start()
        
        # Планируем повторную отправку если нужно
        if task['repeat'] != 'once':
            schedule_next_repeat(task)
            
    except Exception as e:
        task['status'] = 'failed'
        task['error'] = str(e)
        print(f"❌ Ошибка рассылки {task['id']}: {e}")

@app.route('/get_broadcast_tasks', methods=['GET'])
def get_broadcast_tasks():
    """Получение списка задач рассылки"""
    try:
        tasks_list = []
        
        for task_id, task in broadcast_tasks.items():
            task_info = {
                'id': task_id,
                'message_preview': task['message'][:50] + '...' if len(task['message']) > 50 else task['message'],
                'groups_count': len(task['groups']),
                'scheduled_time': task['scheduled_time'].strftime('%d.%m.%Y %H:%M'),
                'status': task['status'],
                'repeat': get_repeat_text(task['repeat']),
                'created_at': task['created_at'].strftime('%d.%m.%Y %H:%M')
            }
            
            if task['status'] == 'completed':
                task_info['sent_count'] = task.get('sent_count', 0)
                task_info['failed_count'] = task.get('failed_count', 0)
                task_info['completed_at'] = task['completed_at'].strftime('%d.%m.%Y %H:%M')
            
            if task['status'] == 'failed':
                task_info['error'] = task.get('error', 'Неизвестная ошибка')
            
            tasks_list.append(task_info)
        
        # Сортируем по времени создания (новые сверху)
        tasks_list.sort(key=lambda x: x['created_at'], reverse=True)
        
        return jsonify({
            'success': True,
            'tasks': tasks_list
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Ошибка: {str(e)}'
        })

async def send_broadcast_messages(client, message, group_ids):
    """Отправляет сообщения в выбранные группы"""
    try:
        await client.start()
        
        sent_count = 0
        failed_count = 0
        errors = []
        
        # Получаем список групп БЕЗ проверки прав
        available_groups = {}
        async for dialog in client.get_dialogs():
            chat = dialog.chat
            if chat.type.name in ["GROUP", "SUPERGROUP"]:
                available_groups[str(chat.id)] = chat
        
        print(f"📋 Доступно групп: {len(available_groups)}")
        
        # Отправляем сообщения
        for group_id in group_ids:
            if group_id in available_groups:
                chat = available_groups[group_id]
                
                try:
                    print(f"📤 Пытаемся отправить в: {chat.title}")
                    
                    # ПРОСТАЯ ОТПРАВКА БЕЗ ПРОВЕРОК
                    await client.send_message(chat.id, message)
                    sent_count += 1
                    
                    print(f"✅ УСПЕШНО отправлено в {chat.title}")
                    
                    # Пауза между отправками
                    await asyncio.sleep(2)
                    
                except Exception as e:
                    failed_count += 1
                    error_msg = str(e)
                    
                    # Понятные сообщения об ошибках
                    if "CHAT_WRITE_FORBIDDEN" in error_msg:
                        error_msg = "Нет прав для отправки сообщений"
                    elif "USER_BANNED_IN_CHANNEL" in error_msg:
                        error_msg = "Аккаунт заблокирован в группе"
                    elif "SLOWMODE_WAIT" in error_msg:
                        error_msg = "Ограничение скорости отправки"
                    elif "CHAT_ADMIN_REQUIRED" in error_msg:
                        error_msg = "Требуются права администратора"
                    
                    errors.append(f"{chat.title}: {error_msg}")
                    print(f"❌ {chat.title}: {error_msg}")
                    
                    await asyncio.sleep(1)
            else:
                failed_count += 1
                print(f"❌ Группа {group_id} не найдена в диалогах")
        
        await client.stop()
        
        print(f"📊 ИТОГО: ✅ {sent_count} отправлено, ❌ {failed_count} ошибок")
        
        return {
            'sent': sent_count,
            'failed': failed_count,
            'errors': errors
        }
        
    except Exception as e:
        print(f"❌ Критическая ошибка рассылки: {e}")
        return {
            'sent': 0,
            'failed': len(group_ids),
            'errors': [f"Критическая ошибка: {str(e)}"]
        }

async def check_can_send_messages(client, chat):
    """Проверяет можно ли отправлять сообщения в группу"""
    try:
        # Получаем информацию о группе
        chat_full = await client.get_chat(chat.id)
        
        # Для каналов проверяем права администратора
        if chat.type.name == "CHANNEL":
            return False  # В каналы обычно нельзя писать
        
        # Для групп пытаемся отправить typing (безопасная проверка)
        await client.send_chat_action(chat.id, "typing")
        return True
        
    except Exception:
        # Если не можем даже typing отправить - значит нет прав
        return False

def schedule_next_repeat(task):
    """Планирует следующую отправку для повторяющихся задач"""
    try:
        next_time = task['scheduled_time']
        
        if task['repeat'] == 'daily':
            next_time += timedelta(days=1)
        elif task['repeat'] == 'weekly':
            next_time += timedelta(weeks=1)
        elif task['repeat'] == 'monthly':
            next_time += timedelta(days=30)  # Упрощенно
        
        # Создаем новую задачу
        new_task_id = str(uuid.uuid4())[:8]
        new_task = task.copy()
        new_task['id'] = new_task_id
        new_task['scheduled_time'] = next_time
        new_task['status'] = 'scheduled'
        
        broadcast_tasks[new_task_id] = new_task
        
        print(f"🔄 Запланирован повтор рассылки на {next_time}")
        
    except Exception as e:
        print(f"❌ Ошибка планирования повтора: {e}")

async def get_current_account_info():
    """Получает информацию о текущем авторизованном аккаунте"""
    try:
        client = get_user_client('local_user')
        if not client:
            return None
            
        await client.start()
        me = await client.get_me()
        await client.stop()
        
        return {
            'first_name': me.first_name or '',
            'last_name': me.last_name or '',
            'username': me.username or '',
            'phone': me.phone_number or '',
            'user_id': str(me.id)
        }
    except Exception as e:
        print(f"❌ Ошибка получения аккаунта: {e}")
        return None

@app.route('/web_auth_send_code', methods=['POST'])
def web_auth_send_code():
    """Отправка кода авторизации через веб"""
    try:
        data = request.json
        phone = data.get('phone', '').strip()
        
        if not phone:
            return jsonify({'error': 'Введите номер телефона'}), 400
        
        if not phone.startswith('+'):
            return jsonify({'error': 'Номер должен начинаться с +'}), 400
        
        print(f"📱 Веб-авторизация: отправляем код на {phone}")
        
        # Создаем уникальный ID сессии
        session_id = str(uuid.uuid4())[:8]
        
        def run_send_code():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                # Создаем клиент
                temp_client = Client(f"temp_{session_id}", api_id=API_ID, api_hash=API_HASH)
                
                async def send_code():
                    await temp_client.connect()
                    sent_code = await temp_client.send_code(phone)
                    
                    # Сохраняем данные сессии
                    auth_sessions[session_id] = {
                        'phone': phone,
                        'phone_code_hash': sent_code.phone_code_hash,
                        'created_at': datetime.now()
                    }
                    
                    # НЕ отключаем клиент, он нужен для sign_in
                    return sent_code
                
                result = loop.run_until_complete(send_code())
                print(f"✅ Код отправлен на {phone}, сессия {session_id}")
                
                return {'success': True, 'session_id': session_id}
                
            except Exception as e:
                print(f"❌ Ошибка в потоке: {e}")
                return {'success': False, 'error': str(e)}
            finally:
                loop.close()
        
        # Выполняем в отдельном потоке
        future = executor.submit(run_send_code)
        result = future.result(timeout=60)
        
        if result['success']:
            return jsonify({
                'success': True,
                'session_id': result['session_id'],
                'message': 'Код отправлен'
            })
        else:
            return jsonify({'error': result['error']}), 400
            
    except Exception as e:
        print(f"❌ Общая ошибка отправки кода: {e}")
        return jsonify({'error': f'Ошибка: {str(e)}'}), 500

@app.route('/web_auth_verify_code', methods=['POST'])
def web_auth_verify_code():
    """Проверка кода авторизации через веб"""
    try:
        data = request.json
        phone = data.get('phone', '').strip()
        code = data.get('code', '').strip()
        
        if not phone or not code:
            return jsonify({'error': 'Введите телефон и код'}), 400
        
        # Проверяем что код не пустой
        if not code:
            return jsonify({'error': 'Введите код'}), 400

        # Очищаем код от букв и проверяем что остается 5 цифр
        # Очищаем код от пробелов и букв
        clean_code = ''.join(filter(str.isdigit, code.replace(' ', '')))
        if len(clean_code) != 5:
            return jsonify({'error': 'Код должен содержать 5 цифр (можно добавлять буквы между ними)'}), 400

        print(f"🔧 Исходный код: '{code}', очищенный: '{clean_code}'")
        
        print(f"🔐 Веб-авторизация: проверяем код для {phone}")
        
        # Ищем сессию авторизации
        session_id = None
        for sid, session_data in auth_sessions.items():
            if session_data.get('phone') == phone:
                session_id = sid
                break
        
        if not session_id:
            return jsonify({'error': 'Сессия авторизации не найдена. Запросите код заново'}), 400
        
        def run_verify_code():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                session_data = auth_sessions[session_id]

                
                print(f"🔧 Исходный код: '{code}', очищенный: '{clean_code}'")
                
                temp_client = Client(f"temp_{session_id}", api_id=API_ID, api_hash=API_HASH)
                
                async def verify_code():
                    try:
                        await temp_client.connect()
                        # ИСПОЛЬЗУЕМ ОЧИЩЕННЫЙ КОД
                        await temp_client.sign_in(phone, session_data['phone_code_hash'], clean_code)
                        
                        me = await temp_client.get_me()
                        await temp_client.disconnect()
                        return me
                        
                    except Exception as e:
                        await temp_client.disconnect()
                        raise e
                
                me = loop.run_until_complete(verify_code())
                
                
                # Переименовываем сессию
                import shutil
                temp_session = f"temp_{session_id}.session"
                permanent_session = "user_local.session"
                
                if os.path.exists(temp_session):
                    if os.path.exists(permanent_session):
                        os.remove(permanent_session)
                    shutil.move(temp_session, permanent_session)
                    print(f"✅ Сессия переименована в {permanent_session}")
                
                # Очищаем временные данные
                del auth_sessions[session_id]
                
                user_info = {
                    'first_name': me.first_name or '',
                    'last_name': me.last_name or '',
                    'username': me.username or '',
                    'phone': me.phone_number or phone,
                    'user_id': str(me.id)
                }
                
                print(f"✅ Авторизация завершена: {user_info['first_name']} ({user_info['phone']})")
                
                return {'success': True, 'user_info': user_info}
                
            except Exception as e:
                print(f"❌ Ошибка верификации: {e}")
                
                error_msg = str(e)
                if "PHONE_CODE_INVALID" in error_msg:
                    error_msg = "Неверный код"
                elif "PHONE_CODE_EXPIRED" in error_msg:
                    error_msg = "Код истек, запросите новый"
                elif "SESSION_PASSWORD_NEEDED" in error_msg:
                    error_msg = "Требуется пароль двухфакторной аутентификации"
                
                return {'success': False, 'error': error_msg}
            finally:
                loop.close()
        
        # Выполняем в отдельном потоке
        future = executor.submit(run_verify_code)
        result = future.result(timeout=60)
        
        if result['success']:
            global REQUIRES_AUTH
            REQUIRES_AUTH = False  # Авторизация завершена
            
            return jsonify({
                'success': True,
                'user_info': result['user_info'],
                'message': 'Авторизация успешна'
            })
        else:
            return jsonify({'error': result['error']}), 400
            
    except Exception as e:
        print(f"❌ Общая ошибка проверки кода: {e}")
        return jsonify({'error': f'Ошибка: {str(e)}'}), 500

@app.route('/check_bot_auth', methods=['GET'])
def check_bot_auth():
    """Проверка авторизации через бота"""
    try:
        # Проверяем есть ли файл сессии
        session_files = [f for f in os.listdir('.') if f.startswith('user_') and f.endswith('.session')]
        
        if session_files:
            global REQUIRES_AUTH
            REQUIRES_AUTH = False
            
            return jsonify({
                'success': True,
                'authorized': True,
                'message': 'Авторизация завершена'
            })
        else:
            return jsonify({
                'success': True,
                'authorized': False,
                'message': 'Авторизация не завершена'
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Ошибка: {str(e)}'
        })


def verify_auth_code_sync(session_id, phone, code):
    """Синхронная проверка кода"""
    try:
        if session_id not in auth_sessions:
            return {
                'success': False,
                'error': 'Сессия не найдена'
            }
        
        session_data = auth_sessions[session_id]
        temp_client = session_data['temp_client']
        
        # Создаем новый event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            async def do_verify():
                # Авторизуемся
                await temp_client.sign_in(phone, session_data['phone_code_hash'], code)
                
                # Получаем информацию о пользователе
                me = await temp_client.get_me()
                
                # Отключаем временный клиент
                await temp_client.disconnect()
                
                return me
            
            me = loop.run_until_complete(do_verify())
            
            # Переименовываем сессию в постоянную
            import shutil
            temp_session = f"temp_{session_id}.session"
            permanent_session = "user_local.session"
            
            if os.path.exists(temp_session):
                if os.path.exists(permanent_session):
                    os.remove(permanent_session)
                shutil.move(temp_session, permanent_session)
                print(f"✅ Сессия переименована в {permanent_session}")
            
            # Очищаем временные данные
            del auth_sessions[session_id]
            
            user_info = {
                'first_name': me.first_name or '',
                'last_name': me.last_name or '',
                'username': me.username or '',
                'phone': me.phone_number or phone,
                'user_id': str(me.id)
            }
            
            print(f"✅ Авторизация завершена: {user_info['first_name']} ({user_info['phone']})")
            
            return {
                'success': True,
                'user_info': user_info
            }
            
        finally:
            loop.close()
        
    except Exception as e:
        print(f"❌ Ошибка авторизации: {e}")
        
        error_msg = str(e)
        if "PHONE_CODE_INVALID" in error_msg:
            error_msg = "Неверный код"
        elif "PHONE_CODE_EXPIRED" in error_msg:
            error_msg = "Код истек, запросите новый"
        elif "SESSION_PASSWORD_NEEDED" in error_msg:
            error_msg = "Требуется пароль двухфакторной аутентификации"
        
        return {
            'success': False,
            'error': error_msg
        }

# ... другие маршруты ...



@app.route('/get_available_sessions', methods=['GET'])
def get_available_sessions():
    """Получение списка доступных сессий"""
    try:
        sessions = []
        sessions_dir = 'sessions'
        
        if os.path.exists(sessions_dir):
            for file in os.listdir(sessions_dir):
                if file.endswith('_info.json'):
                    try:
                        with open(f"{sessions_dir}/{file}", 'r', encoding='utf-8') as f:
                            session_info = json.load(f)
                        
                        # Проверяем что файл сессии существует
                        session_file = f"{sessions_dir}/{session_info['session_file']}"
                        if os.path.exists(session_file):
                            sessions.append(session_info)
                            
                    except Exception as e:
                        print(f"❌ Ошибка чтения сессии {file}: {e}")
                        continue
        
        print(f"📋 Найдено {len(sessions)} сессий")
        
        return jsonify({
            'success': True,
            'sessions': sessions
        })
        
    except Exception as e:
        print(f"❌ Ошибка получения сессий: {e}")
        return jsonify({
            'success': False,
            'error': f'Ошибка: {str(e)}'
        })

@app.route('/use_session', methods=['POST'])
def use_session():
    """Активация выбранной сессии"""
    try:
        data = request.json
        account_name = data.get('account_name', '')
        
        if not account_name:
            return jsonify({'error': 'Не указано имя аккаунта'}), 400
        
        sessions_dir = 'sessions'
        info_file = f"{sessions_dir}/{account_name}_info.json"
        
        if not os.path.exists(info_file):
            return jsonify({'error': 'Сессия не найдена'}), 404
        
        # Читаем информацию о сессии
        with open(info_file, 'r', encoding='utf-8') as f:
            session_info = json.load(f)
        
        session_file = f"{sessions_dir}/{session_info['session_file']}"
        
        if not os.path.exists(session_file):
            return jsonify({'error': 'Файл сессии не найден'}), 404
        
        # Копируем сессию в основную папку как user_local.session
        import shutil
        
        # Удаляем старую сессию если есть
        if os.path.exists('user_local.session'):
            os.remove('user_local.session')
        
        # Копируем выбранную сессию
        shutil.copy2(session_file, 'user_local.session')
        
        # Сохраняем информацию о текущем аккаунте
        current_account_info = {
            'account_name': account_name,
            'user_info': session_info['user_info'],
            'activated_at': datetime.now().isoformat()
        }
        
        with open('current_account.json', 'w', encoding='utf-8') as f:
            json.dump(current_account_info, f, ensure_ascii=False, indent=2)
        
        global REQUIRES_AUTH
        REQUIRES_AUTH = False
        
        print(f"✅ Активирована сессия: {account_name}")
        print(f"👤 Пользователь: {session_info['user_info']['first_name']}")
        
        return jsonify({
            'success': True,
            'message': 'Сессия активирована',
            'user_info': session_info['user_info']
        })
        
    except Exception as e:
        print(f"❌ Ошибка активации сессии: {e}")
        return jsonify({'error': f'Ошибка: {str(e)}'}), 500

@app.route('/create_session_terminal', methods=['POST'])
def create_session_terminal():
    """Запуск создания сессии в терминале через отдельный скрипт"""
    try:
        print("\n" + "="*50)
        print("🚀 ЗАПУСК СОЗДАНИЯ СЕССИИ")
        print("Переключитесь в терминал для ввода данных!")
        print("="*50)
        
        def run_creation():
            try:
                import subprocess
                
                # Запускаем скрипт создания сессии
                result = subprocess.run([
                    'python3', 'create_session_tool.py'
                ], capture_output=True, text=True, timeout=300)
                
                if result.returncode == 0:
                    print("✅ Сессия создана успешно")
                    return True
                else:
                    print(f"❌ Ошибка создания: {result.stderr}")
                    return False
                    
            except subprocess.TimeoutExpired:
                print("⏰ Время ожидания истекло")
                return False
            except Exception as e:
                print(f"❌ Ошибка запуска: {e}")
                return False
        
        # Запускаем в отдельном потоке
        future = executor.submit(run_creation)
        result = future.result(timeout=350)
        
        if result:
            return jsonify({
                'success': True,
                'message': 'Сессия создана успешно'
            })
        else:
            return jsonify({'error': 'Ошибка создания сессии'}), 500
            
    except Exception as e:
        print(f"❌ Общая ошибка: {e}")
        return jsonify({'error': f'Ошибка: {str(e)}'}), 500

@app.route('/get_current_account', methods=['GET'])
def get_current_account():
    """Получение информации о текущем активном аккаунте"""
    try:
        if os.path.exists('current_account.json'):
            with open('current_account.json', 'r', encoding='utf-8') as f:
                account_info = json.load(f)
            
            return jsonify({
                'success': True,
                'account': account_info
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Нет активного аккаунта'
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Ошибка: {str(e)}'
        })

@app.route('/switch_account', methods=['GET'])
def switch_account():
    """Переход к выбору аккаунта"""
    global REQUIRES_AUTH
    REQUIRES_AUTH = True
    
    return jsonify({
        'success': True,
        'message': 'Перенаправление к выбору аккаунта'
    })

@app.route('/get_multi_accounts', methods=['GET'])
def get_multi_accounts():
    """Получение списка всех аккаунтов с статусами активности"""
    try:
        accounts = account_manager.load_available_accounts()
        
        return jsonify({
            'success': True,
            'accounts': accounts,
            'active_count': len(account_manager.get_active_accounts())
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Ошибка: {str(e)}'
        })

@app.route('/toggle_account', methods=['POST'])
def toggle_account():
    """Включение/выключение аккаунта для параллельной работы"""
    try:
        data = request.json
        account_name = data.get('account_name', '')
        action = data.get('action', 'toggle')
        
        if not account_name:
            return jsonify({'error': 'Не указано имя аккаунта'}), 400
        
        # Проверяем что аккаунт существует
        sessions_dir = 'sessions'
        info_file = f"{sessions_dir}/{account_name}_info.json"
        
        if not os.path.exists(info_file):
            return jsonify({'error': 'Аккаунт не найден'}), 404
        
        current_active = account_name in account_manager.clients
        
        if action == 'activate' or (action == 'toggle' and not current_active):
            success = account_manager.activate_account(account_name)
            message = 'Аккаунт активирован для параллельной работы' if success else 'Ошибка активации'
        else:
            success = account_manager.deactivate_account(account_name)
            message = 'Аккаунт деактивирован' if success else 'Ошибка деактивации'
        
        if success:
            return jsonify({
                'success': True,
                'message': message,
                'is_active': account_name in account_manager.clients
            })
        else:
            return jsonify({'error': message}), 500
            
    except Exception as e:
        print(f"❌ Ошибка toggle_account: {e}")
        return jsonify({'error': f'Ошибка: {str(e)}'}), 500

@app.route('/parallel_search', methods=['POST'])
def parallel_search():
    """Поиск с использованием нескольких аккаунтов параллельно"""
    try:
        data = request.json
        keyword = data.get('keyword', '').strip()
        selected_groups = data.get('selected_groups', [])
        search_depth = data.get('search_depth', 500)
        account_names = data.get('accounts', [])  # Список аккаунтов для использования
        
        if not keyword:
            return jsonify({'error': 'Введите ключевое слово'}), 400
        
        if not selected_groups:
            return jsonify({'error': 'Выберите группы для поиска'}), 400
        
        # Если аккаунты не указаны, используем все активные
        if not account_names:
            account_names = account_manager.get_active_accounts()
        
        if not account_names:
            return jsonify({'error': 'Нет активных аккаунтов для поиска'}), 400
        
        print(f"🔍 Параллельный поиск:")
        print(f"  Ключевые слова: {keyword}")
        print(f"  Групп: {len(selected_groups)}")
        print(f"  Аккаунтов: {len(account_names)} - {account_names}")
        
        def run_parallel_search():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                return loop.run_until_complete(execute_parallel_search(
                    keyword, selected_groups, search_depth, account_names
                ))
            finally:
                loop.close()
        
        future = executor.submit(run_parallel_search)
        results = future.result(timeout=300)
        
        return jsonify({
            'success': True,
            'results': results['messages'],
            'total': len(results['messages']),
            'accounts_used': results['accounts_used'],
            'search_stats': results['stats']
        })
        
    except Exception as e:
        print(f"❌ Ошибка параллельного поиска: {e}")
        return jsonify({'error': f'Ошибка поиска: {str(e)}'}), 500

async def execute_parallel_search(keyword, selected_groups, search_depth, account_names):
    """Выполняет параллельный поиск несколькими аккаунтами"""
    try:
        all_results = []
        search_stats = {}
        accounts_used = []
        
        # Распределяем группы между аккаунтами
        groups_per_account = len(selected_groups) // len(account_names)
        remaining_groups = len(selected_groups) % len(account_names)
        
        tasks = []
        start_idx = 0
        
        for i, account_name in enumerate(account_names):
            # Определяем группы для этого аккаунта
            groups_count = groups_per_account + (1 if i < remaining_groups else 0)
            end_idx = start_idx + groups_count
            account_groups = selected_groups[start_idx:end_idx]
            start_idx = end_idx
            
            if account_groups:  # Только если есть группы для поиска
                client = account_manager.get_client(account_name)
                if client:
                    task = search_with_account(client, account_name, keyword, account_groups, search_depth)
                    tasks.append(task)
                    accounts_used.append(account_name)
        
        if not tasks:
            return {
                'messages': [],
                'accounts_used': [],
                'stats': {}
            }
        
        # Выполняем все поиски параллельно
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Собираем результаты
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                print(f"❌ Ошибка в аккаунте {accounts_used[i]}: {result}")
                search_stats[accounts_used[i]] = {'error': str(result), 'found': 0}
            else:
                all_results.extend(result['messages'])
                search_stats[accounts_used[i]] = {
                    'found': len(result['messages']),
                    'groups_searched': result['groups_count']
                }
        
        # Сортируем все результаты по дате
        all_results.sort(key=lambda x: x.get('date_timestamp', 0), reverse=True)
        
        # Удаляем timestamp из результатов
        for msg in all_results:
            if 'date_timestamp' in msg:
                del msg['date_timestamp']
        
        print(f"🎉 Параллельный поиск завершен:")
        print(f"  Всего найдено: {len(all_results)} сообщений")
        print(f"  Использовано аккаунтов: {len(accounts_used)}")
        
        return {
            'messages': all_results,
            'accounts_used': accounts_used,
            'stats': search_stats
        }
        
    except Exception as e:
        print(f"❌ Ошибка параллельного поиска: {e}")
        raise e

async def search_with_account(client, account_name, keyword, groups, search_depth):
    """Поиск одним аккаунтом в указанных группах"""
    try:
        # Убеждаемся что есть event loop
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        await client.start()
        
        keywords = [word.strip().lower() for word in keyword.split() if word.strip()]
        found_messages = []
        
        print(f"[{account_name}] 🔍 Поиск в {len(groups)} группах...")
        
        # Получаем группы аккаунта
        available_groups = {}
        async for dialog in client.get_dialogs():
            chat = dialog.chat
            if chat.type.name in ["GROUP", "SUPERGROUP"]:
                available_groups[str(chat.id)] = chat
        
        # Ищем в указанных группах
        for group_id in groups:
            if group_id in available_groups:
                chat = available_groups[group_id]
                try:
                    print(f"[{account_name}] 📂 Поиск в: {chat.title}")
                    
                    message_count = 0
                    async for message in client.get_chat_history(chat.id, limit=search_depth):
                        if message.text:
                            message_text = message.text.lower()
                            matched_words = [word for word in keywords if word in message_text]
                            
                            if matched_words:
                                found_messages.append({
                                    'text': message.text,
                                    'author': message.from_user.username if message.from_user and message.from_user.username else "Аноним",
                                    'chat': chat.title,
                                    'date': message.date.strftime("%d.%m.%Y %H:%M"),
                                    'date_timestamp': message.date.timestamp(),
                                    'matched_words': matched_words,
                                    'found_by_account': account_name,
                                    'message_id': message.id,
                                    'chat_id': chat.id,
                                    'chat_username': getattr(chat, 'username', None)
                                })
                            
                            message_count += 1
                    
                    found_count = len([m for m in found_messages if m['chat'] == chat.title])
                    print(f"[{account_name}] ✅ {chat.title}: найдено {found_count} из {message_count}")
                    
                except Exception as e:
                    print(f"[{account_name}] ❌ Ошибка в группе {chat.title}: {e}")
                    continue
                    
                # Пауза между группами
                await asyncio.sleep(1)
        
        await client.stop()
        
        print(f"[{account_name}] 🎯 Итого найдено: {len(found_messages)} сообщений")
        
        return {
            'messages': found_messages,
            'groups_count': len(groups),
            'account_name': account_name
        }
        
    except Exception as e:
        print(f"[{account_name}] ❌ Критическая ошибка: {e}")
        raise e

if __name__ == '__main__':
    print("🚀 Запускаю Message Hunter...")
    print("📍 Доступные маршруты:")
    for rule in app.url_map.iter_rules():
        print(f"  {rule.rule} - {list(rule.methods)}")
    print("🌐 Откройте: http://localhost:8000")
    app.run(debug=True, port=8000, host='0.0.0.0')