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
def get_user_client(user_id):
    """Создает клиент для конкретного пользователя"""
    return session_manager.get_user_client(user_id)

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
    """Проверяет подключен ли аккаунт пользователя"""
    return session_manager.has_session(user_id)

# Основные маршруты
@app.route('/')
def index():
    if 'user_id' in session:
        # Проверяем подключен ли личный аккаунт пользователя
        user_id = session['user_id']
        if not is_user_account_connected(user_id):
            return render_template('connect_account.html', user=session)
        
        return render_template('dashboard.html', user=session)
    return render_template('login.html')

@app.route('/auth')
def auth():
    """Обработка авторизации через Telegram"""
    auth_data = dict(request.args)
    
    if verify_telegram_auth(auth_data, BOT_TOKEN):
        user_id = str(auth_data.get('id'))
        
        # Сохраняем данные пользователя в сессии
        session['user_id'] = user_id
        session['first_name'] = auth_data.get('first_name', '')
        session['last_name'] = auth_data.get('last_name', '')
        session['username'] = auth_data.get('username', '')
        session['photo_url'] = auth_data.get('photo_url', '')
        
        # Создаем файл сессии для этого пользователя (копируем готовую)
        try:
            import shutil
            shutil.copy('user_sessions/test_user.json', f'user_sessions/{user_id}.json')
            print(f"✅ Создана сессия для пользователя {user_id}")
        except Exception as e:
            print(f"❌ Ошибка создания сессии: {e}")
        
        return redirect('/')
    else:
        return "Ошибка авторизации", 401

@app.route('/logout')
def logout():
    session.clear()
    return redirect('/')

# Поиск и группы
@app.route('/search', methods=['POST'])
def search():
    """API для поиска сообщений с проверкой лимитов"""
    if 'user_id' not in session:
        return jsonify({'error': 'Не авторизован'}), 401
    
    user_id = session['user_id']
    
    if not is_user_account_connected(user_id):
        return jsonify({'error': 'Сначала подключите свой аккаунт'}), 403
    
    can_search, message = check_user_limits(user_id, 'search')
    if not can_search:
        return jsonify({'error': message, 'limit_exceeded': True}), 403
    
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
                
                results = loop.run_until_complete(search_in_selected_groups(user_client, keyword, selected_groups))
                return results
            finally:
                loop.close()
        
        future = executor.submit(run_search)
        results = future.result(timeout=120)
        
        increment_usage(user_id, 'search')
        
        return jsonify({
            'success': True,
            'results': results,
            'total': len(results)
        })
        
    except Exception as e:
        print(f"Ошибка поиска: {e}")
        return jsonify({'error': f'Ошибка поиска: {str(e)}'}), 500

@app.route('/get_groups', methods=['GET'])
def get_groups():
    """Получить список групп пользователя"""
    if 'user_id' not in session:
        return jsonify({'error': 'Не авторизован'}), 401
    
    user_id = session['user_id']
    
    if not is_user_account_connected(user_id):
        return jsonify({'error': 'Сначала подключите свой аккаунт'}), 403
    
    try:
        def run_get_groups():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                user_client = get_user_client(user_id)
                if not user_client:
                    return []
                
                groups = loop.run_until_complete(get_user_groups(user_client))
                return groups
            finally:
                loop.close()
        
        future = executor.submit(run_get_groups)
        groups = future.result(timeout=60)
        
        return jsonify({
            'success': True,
            'groups': groups
        })
        
    except Exception as e:
        print(f"Ошибка получения групп: {e}")
        return jsonify({'error': f'Ошибка: {str(e)}'}), 500

# История поиска
@app.route('/save_search', methods=['POST'])
def save_search():
    """Сохранить поиск в историю"""
    if 'user_id' not in session:
        return jsonify({'error': 'Не авторизован'}), 401
    
    data = request.json
    user_id = session['user_id']
    
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
    
    return jsonify({'success': True, 'message': 'Поиск сохранён в историю'})

@app.route('/get_history', methods=['GET'])
def get_history():
    """Получить историю поиска"""
    if 'user_id' not in session:
        return jsonify({'error': 'Не авторизован'}), 401
    
    user_id = session['user_id']
    history = search_history.get(user_id, [])
    
    return jsonify({
        'success': True,
        'history': history
    })

@app.route('/delete_search/<int:search_id>', methods=['DELETE'])
def delete_search(search_id):
    """Удалить поиск из истории"""
    if 'user_id' not in session:
        return jsonify({'error': 'Не авторизован'}), 401
    
    user_id = session['user_id']
    if user_id in search_history:
        search_history[user_id] = [s for s in search_history[user_id] if s['id'] != search_id]
    
    return jsonify({'success': True})

# Статистика и лимиты
@app.route('/get_user_stats', methods=['GET'])
def get_user_stats():
    """Получить статистику использования пользователя"""
    if 'user_id' not in session:
        return jsonify({'error': 'Не авторизован'}), 401
    
    user_id = session['user_id']
    if user_id not in user_usage:
        user_usage[user_id] = {'searches_used': 0, 'ai_analysis_used': 0, 'is_premium': False}
    
    user_data = user_usage[user_id]
    
    return jsonify({
        'searches_used': user_data['searches_used'],
        'searches_remaining': max(0, USER_LIMITS['search_limit'] - user_data['searches_used']),
        'ai_analysis_used': user_data['ai_analysis_used'],
        'ai_analysis_remaining': max(0, USER_LIMITS['ai_analysis_limit'] - user_data['ai_analysis_used']),
        'is_premium': user_data['is_premium'],
        'usdt_wallet': USDT_WALLET
    })

@app.route('/get_telegram_user_info', methods=['GET'])
def get_telegram_user_info():
    """Получить информацию о Telegram пользователе"""
    if 'user_id' not in session:
        return jsonify({'error': 'Не авторизован'}), 401
    
    try:
        user_info = {
            'first_name': session.get('first_name', 'Пользователь'),
            'last_name': session.get('last_name', ''),
            'username': session.get('username', ''),
            'user_id': session.get('user_id', ''),
            'has_photo': False,
            'avatar_data': None
        }
        
        return jsonify({
            'success': True,
            'user_info': user_info
        })
        
    except Exception as e:
        print(f"Ошибка получения информации пользователя: {e}")
        return jsonify({'error': f'Ошибка: {str(e)}'}), 500

# AI анализ
@app.route('/analyze_with_ai', methods=['POST'])
def analyze_with_ai():
    """Анализ сообщений с помощью AI с проверкой лимитов"""
    if 'user_id' not in session:
        return jsonify({'error': 'Не авторизован'}), 401
    
    user_id = session['user_id']
    
    can_analyze, message = check_user_limits(user_id, 'ai_analysis')
    if not can_analyze:
        return jsonify({'error': message, 'limit_exceeded': True}), 403
    
    data = request.json
    messages = data.get('messages', [])
    
    if not messages:
        return jsonify({'error': 'Нет сообщений для анализа'}), 400
    
    if len(messages) > 30:
        return jsonify({'error': 'Слишком много сообщений. Максимум 30 за раз'}), 400
    
    try:
        potential_clients = analyze_messages_for_needs(messages)
        increment_usage(user_id, 'ai_analysis')
        
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

@app.route('/send_auth_code', methods=['POST'])
def send_auth_code():
    """Перенаправляем в бота для авторизации"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Не авторизован'})
    
    user_id = session['user_id']
    bot_username = "my_message_hunter_bot"  # Замени на имя ТВОЕГО бота
    bot_url = f"https://t.me/{bot_username}?start={user_id}"
    
    return jsonify({
        'success': True, 
        'redirect_to_bot': True,
        'bot_url': bot_url
    })

@app.route('/check_auth_status', methods=['POST'])
def check_auth_status():
    """Проверяет статус авторизации"""
    if 'user_id' not in session:
        return jsonify({'connected': False})
    
    user_id = session['user_id']
    
    # Проверяем через менеджер сессий
    if session_manager.has_session(user_id):
        return jsonify({'connected': True, 'success': True})
    
    return jsonify({'connected': False, 'pending': True})

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

# Async функции для Telegram API
async def get_user_groups(client):
    """Получить список групп где можно писать сообщения"""
    try:
        await client.start()
        
        groups = []
        processed_count = 0
        async for dialog in client.get_dialogs():
            chat = dialog.chat
            
            if chat.type.name in ["GROUP", "SUPERGROUP"]:
                try:
                    if processed_count > 0 and processed_count % 5 == 0:
                        print(f"⏳ Пауза 3 секунды после {processed_count} групп...")
                        await asyncio.sleep(3)
                    
                    processed_count += 1
                    
                    recent_messages = []
                    async for msg in client.get_chat_history(chat.id, limit=5):
                        recent_messages.append(msg)
                        break
                    
                    if recent_messages:
                        groups.append({
                            'id': str(chat.id),
                            'title': chat.title or 'Без названия',
                            'type': 'АКТИВНАЯ ГРУППА',
                            'members_count': getattr(chat, 'members_count', 0),
                            'status': '✅ Активная группа'
                        })
                        print(f"✅ Добавлена группа: {chat.title}")
                    else:
                        print(f"❌ Пропущена неактивная группа: {chat.title}")
                    
                    await asyncio.sleep(0.5)
                    
                except Exception as e:
                    if "FLOOD_WAIT" in str(e):
                        wait_time = int(str(e).split("wait of ")[1].split(" seconds")[0])
                        print(f"⏳ FLOOD_WAIT: ждём {wait_time} секунд...")
                        await asyncio.sleep(wait_time + 1)
                    else:
                        print(f"❌ Ошибка в группе {chat.title}: {e}")
                    continue
        
        await client.stop()
        groups.sort(key=lambda x: x.get('members_count', 0), reverse=True)
        
        print(f"✅ ИТОГО найдено {len(groups)} активных групп")
        return groups
        
    except Exception as e:
        print(f"Общая ошибка: {e}")
        return []

async def search_in_selected_groups(client, keyword, selected_group_ids):
    """Функция поиска в выбранных группах"""
    try:
        await client.start()
        
        keywords = [word.strip().lower() for word in keyword.split() if word.strip()]
        
        if not keywords:
            return []
        
        print(f"Поиск слов: {keywords}")
        print(f"В выбранных группах: {len(selected_group_ids)}")
        
        # Получаем только группы для общения (не каналы)
        chat_groups = []
        async for dialog in client.get_dialogs():
            chat = dialog.chat
            if (chat.type.name in ["GROUP", "SUPERGROUP"] and 
                str(chat.id) in selected_group_ids):
                chat_groups.append(chat)
        
        print(f"Найдено выбранных групп для общения: {len(chat_groups)}")
        
        found_messages = []
        
        for i, chat in enumerate(chat_groups, 1):
            try:
                print(f"[{i}/{len(chat_groups)}] Ищу в: {chat.title}")
                
                async for message in client.get_chat_history(chat.id, limit=500):
                    if message.text:
                        message_text = message.text.lower()
                        
                        if any(word in message_text for word in keywords):
                            found_messages.append({
                                'text': message.text,
                                'author': message.from_user.username if message.from_user else "Неизвестно",
                                'chat': chat.title,
                                'date': message.date.strftime("%d.%m.%Y %H:%M"),
                                'matched_words': [word for word in keywords if word in message_text]
                            })
                
                await asyncio.sleep(0.5)
                        
            except Exception as e:
                print(f"Ошибка в {chat.title}: {e}")
        
        await client.stop()
        print(f"ИТОГО найдено: {len(found_messages)} сообщений")
        return found_messages[:50]
        
    except Exception as e:
        print(f"Ошибка: {e}")
        return []

if __name__ == '__main__':
    app.run(debug=True, port=8000)