from flask import Flask, render_template, request, redirect, session, jsonify
import hashlib
import hmac
import time
from urllib.parse import unquote
import json
from pyrogram import Client
import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import anthropic
import google.generativeai as genai
import requests
import time
from datetime import datetime, timedelta

app = Flask(__name__)
app.secret_key = "secret_key"

# Настройки
executor = ThreadPoolExecutor(max_workers=1)
GEMINI_API_KEY = "GEMINI_API_KEY"  # Вставь свой ключ
search_history = {}

# Твои API данные
API_ID = 29318340
API_HASH = "API_HASH"
BOT_TOKEN = "BOT_TOKEN"

# Система лимитов
USER_LIMITS = {
    'search_limit': 17,
    'ai_analysis_limit': 7
}

# Хранилище использования пользователей
user_usage = {}

# USDT кошелек для оплаты
USDT_WALLET = "USDT_WALLET"  # Замени на свой Trust Wallet адрес

# API данные (твои значения)
API_ID = 29318340  # Твой API ID (число)
API_HASH = "API_HASH"  # Твой API Hash (в кавычках)

# Для авторизации пользователей (не через бота)
TELEGRAM_BOT_TOKEN = "TELEGRAM_BOT_TOKEN"  # Оставляем для проверки авторизации

def verify_telegram_auth(auth_data, bot_token):
    """Проверяем подлинность данных от Telegram"""
    check_hash = auth_data.pop('hash', None)
    auth_data.pop('auth_date', None)
    
    data_check_string = '\n'.join([f"{k}={v}" for k, v in sorted(auth_data.items())])
    secret_key = hashlib.sha256(bot_token.encode()).digest()
    calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    
    return calculated_hash == check_hash

@app.route('/')
def index():
    if 'user_id' in session:
        return render_template('dashboard.html', user=session)
    return render_template('login.html', bot_username="my_message_hunter_bot")  # Имя ТВОЕГО бота

@app.route('/auth')
def auth():
    """Обработка авторизации через Telegram"""
    auth_data = dict(request.args)
    
    if verify_telegram_auth(auth_data, BOT_TOKEN):
        # Сохраняем данные пользователя в сессии
        session['user_id'] = auth_data.get('id')
        session['first_name'] = auth_data.get('first_name', '')
        session['last_name'] = auth_data.get('last_name', '')
        session['username'] = auth_data.get('username', '')
        session['photo_url'] = auth_data.get('photo_url', '')
        
        return redirect('/')
    else:
        return "Ошибка авторизации", 401

@app.route('/logout')
def logout():
    session.clear()
    return redirect('/')

@app.route('/auth_with_code', methods=['POST'])
def auth_with_code():
    """Авторизация по коду от бота"""
    auth_code = request.form.get('auth_code', '').strip()
    
    if not auth_code.startswith('WEB'):
        return "Неверный код", 400
    
    user_id = auth_code[3:]  # Убираем "WEB"
    
    session['user_id'] = user_id
    session['first_name'] = 'Пользователь'
    session['username'] = user_id
    
    return redirect('/')



@app.route('/search', methods=['POST'])
def search():
    """API для поиска сообщений с проверкой лимитов"""
    if 'user_id' not in session:
        return jsonify({'error': 'Не авторизован'}), 401
    
    user_id = session['user_id']
    
    # Проверяем лимиты
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
                web_client = Client("main_account", api_id=API_ID, api_hash=API_HASH)
                results = loop.run_until_complete(search_in_selected_groups(web_client, keyword, selected_groups))
                return results
            finally:
                loop.close()
        
        future = executor.submit(run_search)
        results = future.result(timeout=120)
        
        # Увеличиваем счетчик использования
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
    
    try:
        def run_get_groups():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                client = Client("main_account", api_id=API_ID, api_hash=API_HASH)
                groups = loop.run_until_complete(get_user_groups(client))
                return groups
            finally:
                loop.close()
        
        future = executor.submit(run_get_groups)
        groups = future.result(timeout=60)  # Увеличил timeout
        
        return jsonify({
            'success': True,
            'groups': groups
        })
        
    except Exception as e:
        print(f"Ошибка получения групп: {e}")
        return jsonify({'error': f'Ошибка: {str(e)}'}), 500

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
        'results': data.get('results', [])[:20]  # Сохраняем только первые 20 результатов
    }
    
    if user_id not in search_history:
        search_history[user_id] = []
    
    search_history[user_id].insert(0, search_record)  # Новые поиски в начале
    
    # Ограничиваем историю 50 записями
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

@app.route('/analyze_with_ai', methods=['POST'])
def analyze_with_ai():
    """Анализ сообщений с помощью AI с проверкой лимитов"""
    if 'user_id' not in session:
        return jsonify({'error': 'Не авторизован'}), 401
    
    user_id = session['user_id']
    
    # Проверяем лимиты AI анализа
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
        
        # Увеличиваем счетчик использования AI
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
        # Настраиваем Gemini
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        # Подготавливаем данные для анализа
        messages_text = ""
        for i, msg in enumerate(messages, 1):
            messages_text += f"Сообщение {i}:\n"
            messages_text += f"Автор: @{msg.get('author', 'неизвестно')}\n"
            messages_text += f"Группа: {msg.get('chat', 'неизвестно')}\n"
            messages_text += f"Дата: {msg.get('date', 'неизвестно')}\n"
            messages_text += f"Текст: {msg.get('text', '')}\n"
            messages_text += "---\n"
        
        # Промпт для Gemini
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

        # Отправляем запрос в Gemini
        response = model.generate_content(prompt)
        
        # Парсим ответ
        ai_response = response.text.strip()
        
        # Убираем возможный markdown
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

def check_tron_usdt_payment(wallet_address, amount_usdt=10, hours_back=24):
    """Проверка USDT TRC-20 платежей через TronScan API"""
    try:
        url = "https://apilist.tronscan.org/api/token_trc20/transfers"
        params = {
            'limit': 50,
            'start': 0,
            'toAddress': wallet_address,
            'contract_address': 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'  # USDT TRC-20 контракт
        }
        
        response = requests.get(url, params=params, timeout=10)
        if response.status_code != 200:
            return False, "Ошибка API TronScan"
        
        data = response.json()
        transfers = data.get('token_transfers', [])
        
        # Проверяем транзакции за последние 24 часа
        cutoff_time = datetime.now() - timedelta(hours=hours_back)
        
        for transfer in transfers:
            # Проверяем сумму (USDT имеет 6 децималей)
            transfer_amount = float(transfer['quant']) / 1000000
            
            # Проверяем время (timestamp в миллисекундах)
            transfer_time = datetime.fromtimestamp(transfer['block_ts'] / 1000)
            
            if (transfer_amount >= amount_usdt and 
                transfer_time > cutoff_time):
                
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

@app.route('/check_payment', methods=['POST'])
def check_payment():
    """Проверка платежа пользователя"""
    if 'user_id' not in session:
        return jsonify({'error': 'Не авторизован'}), 401
    
    user_id = session['user_id']
    
    try:
        # Проверяем платёж на кошелёк
        payment_found, payment_info = check_tron_usdt_payment(USDT_WALLET, amount_usdt=10)
        
        if payment_found:
            # Активируем премиум для пользователя
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
                'message': payment_info  # Сообщение об ошибке
            })
            
    except Exception as e:
        print(f"Ошибка проверки платежа: {e}")
        return jsonify({'error': f'Ошибка проверки: {str(e)}'}), 500

@app.route('/activate_premium/<user_id>', methods=['POST'])
def activate_premium(user_id):
    """Ручная активация премиума (для админа)"""
    # Можно добавить проверку админских прав
    
    if user_id not in user_usage:
        user_usage[user_id] = {'searches_used': 0, 'ai_analysis_used': 0, 'is_premium': False}
    
    user_usage[user_id]['is_premium'] = True
    
    return jsonify({'success': True, 'message': f'Премиум активирован для пользователя {user_id}'})

@app.route('/get_telegram_user_info', methods=['GET'])
def get_telegram_user_info():
    """Получить информацию о Telegram пользователе"""
    if 'user_id' not in session:
        return jsonify({'error': 'Не авторизован'}), 401
    
    try:
        def get_user_info():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                client = Client("main_account", api_id=API_ID, api_hash=API_HASH)
                user_info = loop.run_until_complete(fetch_user_info(client))
                return user_info
            finally:
                loop.close()
        
        future = executor.submit(get_user_info)
        user_info = future.result(timeout=10)
        
        return jsonify({
            'success': True,
            'user_info': user_info
        })
        
    except Exception as e:
        print(f"Ошибка получения информации пользователя: {e}")
        return jsonify({'error': f'Ошибка: {str(e)}'}), 500

async def fetch_user_info(client):
    """Получить информацию о текущем пользователе"""
    try:
        await client.start()
        
        # Получаем информацию о себе
        me = await client.get_me()
        
        user_info = {
            'first_name': me.first_name or '',
            'last_name': me.last_name or '',
            'username': me.username or '',
            'phone': me.phone_number or '',
            'user_id': str(me.id),
            'has_photo': bool(me.photo)
        }
        
        # Пытаемся получить ссылку на аватар
        if me.photo:
            try:
                # Скачиваем маленькую версию аватара
                photo_path = await client.download_media(me.photo.small_file_id, in_memory=True)
                # Конвертируем в base64 для отображения
                import base64
                user_info['avatar_data'] = base64.b64encode(photo_path.getvalue()).decode()
            except:
                user_info['avatar_data'] = None
        else:
            user_info['avatar_data'] = None
        
        await client.stop()
        return user_info
        
    except Exception as e:
        print(f"Ошибка получения пользователя: {e}")
        return {
            'first_name': 'Пользователь',
            'last_name': '',
            'username': '',
            'phone': '',
            'user_id': '',
            'has_photo': False,
            'avatar_data': None
        }        

async def get_user_groups(client):
    """Получить список групп где можно писать сообщения"""
    try:
        await client.start()
        
        groups = []
        processed_count = 0
        async for dialog in client.get_dialogs():
            chat = dialog.chat
            
            # Фильтруем только группы для общения
            if chat.type.name in ["GROUP", "SUPERGROUP"]:
                try:
                    # Добавляем задержку каждые 5 групп
                    if processed_count > 0 and processed_count % 5 == 0:
                        print(f"⏳ Пауза 3 секунды после {processed_count} групп...")
                        await asyncio.sleep(3)
                    
                    processed_count += 1
                    
                    # Упрощённая проверка - без лишних API вызовов
                    recent_messages = []
                    async for msg in client.get_chat_history(chat.id, limit=5):
                        recent_messages.append(msg)
                        break  # Берём только первое сообщение для проверки
                    
                    # Если есть хотя бы одно сообщение - добавляем группу
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
                    
                    # Небольшая задержка между группами
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
        
        # Сортируем по количеству участников
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

async def search_in_user_groups(client, keyword):
    """Функция поиска в группах пользователя"""
    try:
        await client.start()
        
        # Разбиваем на отдельные слова
        keywords = [word.strip().lower() for word in keyword.split() if word.strip()]
        
        if not keywords:
            return []
        
        print(f"Поиск слов: {keywords}")
        
        # Получаем групповые чаты
        groups_chats = []
        async for dialog in client.get_dialogs():
            if dialog.chat.type.name != "PRIVATE":
                groups_chats.append(dialog.chat)
        
        print(f"Найдено {len(groups_chats)} чатов")
        
        found_messages = []
        
        # Ищем в первых 5 группах
        for i, chat in enumerate(groups_chats[:5], 1):
            try:
                print(f"[{i}/5] Ищу в: {chat.title}")
                
                async for message in client.get_chat_history(chat.id, limit=200):
                    if message.text:
                        message_text = message.text.lower()
                        
                        # Проверяем есть ли ЛЮБОЕ из ключевых слов
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
        return found_messages[:30]
        
    except Exception as e:
        print(f"Ошибка: {e}")
        return []

if __name__ == '__main__':
    app.run(debug=True, port=8000)

