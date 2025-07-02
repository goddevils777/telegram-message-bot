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

# Инициализация приложения
app = Flask(__name__)
app.secret_key = "abc123xyz789randomd6d215bd18a5303bac88cbc4dcbab1d1"

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

# Основные маршруты
@app.route('/')
def index():
    # Прямой вход в дашборд без Telegram авторизации
    return render_template('dashboard.html')


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
    # Используем статичного пользователя
    user_id = 'local_user'
    
    if not is_user_account_connected(user_id):
        return jsonify({'error': 'Сначала добавьте API ключи'}), 403
    
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
        
        # Увеличиваем счетчик для статистики
        if user_id not in user_usage:
            user_usage[user_id] = {'searches_used': 0, 'ai_analysis_used': 0, 'is_premium': True}
        user_usage[user_id]['searches_used'] += 1
        
        print(f"✅ Найдено {len(results)} реальных сообщений для '{keyword}'")
        
        return jsonify({
            'success': True,
            'results': results,
            'total': len(results)
        })
        
    except Exception as e:
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
    
    search_record = {
        'id': len(search_history.get(user_id, [])) + 1,
        'keywords': data.get('keywords', []),
        'results_count': data.get('results_count', 0),
        'groups_count': data.get('groups_count', 0),
        'date': datetime.now().strftime("%d.%m.%Y %H:%M"),
        'results': data.get('results', [])[:20]
    }
    
    if user_id not in search_history:
        search_history[user_id] = []
    
    search_history[user_id].insert(0, search_record)
    
    if len(search_history[user_id]) > 50:
        search_history[user_id] = search_history[user_id][:50]
    
    print(f"✅ Поиск сохранён в историю для пользователя {user_id}")
    
    return jsonify({'success': True, 'message': 'Поиск сохранён в историю'})

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
    
    if not messages:
        return jsonify({'error': 'Нет сообщений для анализа'}), 400
    
    print(f"🤖 Анализируем {len(messages)} сообщений")
    
    try:
        potential_clients = analyze_messages_for_needs(messages)
        
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

def analyze_messages_for_needs(messages):
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
        
        prompt = f"""Проанализируй сообщения из Telegram групп и найди те, где люди выражают потребности или ищут услуги.

{messages_text}

Верни результат СТРОГО в JSON формате без дополнительного текста:
[
  {{
    "message_number": 1,
    "original_message": "полный текст сообщения",
    "client_need": "краткое описание потребности",
    "author": "@username",
    "group": "название группы", 
    "date": "дата",
    "confidence": "высокая"
  }}
]

Ищи только реальные потребности:
- Поиск услуг/товаров
- Просьбы о помощи за деньги
- Поиск исполнителей
- Желание что-то купить
- Проблемы которые можно решить за деньги

Игнорируй:
- Обычное общение
- Новости и мемы
- Технические сообщения

Если потребностей нет, верни: []"""

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
                    
                    # Небольшая пауза чтобы не получить блокировку
                    if processed_count % 5 == 0:
                        await asyncio.sleep(1)
                        
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
        return []

async def search_in_selected_groups_real(client, keyword, selected_group_ids):
    """Реальный поиск в выбранных группах"""
    try:
        await client.start()
        
        keywords = [word.strip().lower() for word in keyword.split() if word.strip()]
        
        if not keywords:
            return []
        
        print(f"🔍 Поиск слов: {keywords}")
        print(f"📂 В выбранных группах: {len(selected_group_ids)}")
        
        # Получаем группы для поиска
        chat_groups = []
        async for dialog in client.get_dialogs():
            chat = dialog.chat
            if (chat.type.name in ["GROUP", "SUPERGROUP"] and 
                str(chat.id) in selected_group_ids):
                chat_groups.append(chat)
        
        print(f"✅ Найдено {len(chat_groups)} групп для поиска")
        
        found_messages = []
        
        for i, chat in enumerate(chat_groups, 1):
            try:
                print(f"[{i}/{len(chat_groups)}] 🔍 Ищу в: {chat.title}")
                
                message_count = 0
                async for message in client.get_chat_history(chat.id, limit=200):
                    if message.text:
                        message_text = message.text.lower()
                        
                        # Проверяем есть ли наши ключевые слова
                        matched_words = [word for word in keywords if word in message_text]
                        
                        if matched_words:
                            found_messages.append({
                                'text': message.text,
                                'author': message.from_user.username if message.from_user and message.from_user.username else "Аноним",
                                'chat': chat.title,
                                'date': message.date.strftime("%d.%m.%Y %H:%M"),
                                'matched_words': matched_words
                            })
                            
                        message_count += 1
                
                print(f"  📝 Проверено {message_count} сообщений, найдено совпадений: {len([m for m in found_messages if m['chat'] == chat.title])}")
                
                # Пауза между группами
                await asyncio.sleep(0.5)
                        
            except Exception as e:
                print(f"❌ Ошибка в группе {chat.title}: {e}")
                # При ошибке продолжаем с следующей группой
                continue
        
        await client.stop()
        
        print(f"🎉 ИТОГО найдено: {len(found_messages)} сообщений")
        
        # Ограничиваем результаты 50-ю сообщениями
        return found_messages[:50]
        
    except Exception as e:
        print(f"❌ Общая ошибка поиска: {e}")
        return []

if __name__ == '__main__':
    app.run(debug=True, port=8000)