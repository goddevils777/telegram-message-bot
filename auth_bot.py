from pyrogram import Client, filters
import asyncio
from session_manager import SessionManager
from pyrogram.types import InlineKeyboardMarkup, InlineKeyboardButton
import time

# API данные
API_ID = 29318340
API_HASH = "68be30e447857e5e5aa24c23a41c686d"
BOT_TOKEN = "8083238823:AAHgAcvKL7nf29zz66kGB3bL6QCSHOVXCRA"

# Менеджер сессий
session_manager = SessionManager(API_ID, API_HASH)

# Создаём бота
auth_bot = Client("auth_bot", api_id=API_ID, api_hash=API_HASH, bot_token=BOT_TOKEN)

# Состояния
user_states = {}
temp_clients = {}

@auth_bot.on_message(filters.text & filters.private & ~filters.command("start"))
async def handle_text(client, message):
    telegram_user_id = message.from_user.id
    text = message.text.strip()
    
    print(f"🔍 DEBUG: Получен текст от {telegram_user_id}: {text}")
    print(f"🔍 DEBUG: user_states содержит: {list(user_states.keys())}")
    
    if telegram_user_id not in user_states:
        print(f"❌ DEBUG: {telegram_user_id} НЕ найден в user_states")
        await message.reply_text(
            "❌ Нет активного процесса авторизации.\n"
            "Получите новую ссылку на сайте."
        )
        return
    
    print(f"✅ DEBUG: {telegram_user_id} найден в user_states")
    
    state = user_states[telegram_user_id]
    
    if state['step'] == 'waiting_phone':
        await handle_phone(message, telegram_user_id, text, state)
    elif state['step'] == 'waiting_code':
        await handle_code(message, telegram_user_id, text, state)

@auth_bot.on_message(filters.text & filters.private)
async def handle_text(client, message):
    telegram_user_id = message.from_user.id
    text = message.text.strip()
    
    if telegram_user_id not in user_states:
        await message.reply_text("Используйте команду /auth USER_ID")
        return
    
    state = user_states[telegram_user_id]
    
    if state['step'] == 'waiting_phone':
        await handle_phone(message, telegram_user_id, text, state)
    elif state['step'] == 'waiting_code':
        await handle_code(message, telegram_user_id, text, state)

async def start_auth_process(message, telegram_user_id, web_user_id):
    """Начинает процесс авторизации"""
    print(f"🔍 DEBUG: start_auth_process для telegram_user_id={telegram_user_id}, web_user_id={web_user_id}")
    
    # Проверяем есть ли уже сессия
    if session_manager.has_session(web_user_id):
        print(f"🔍 DEBUG: Сессия для {web_user_id} уже существует")
        await message.reply_text(
            "✅ Ваш аккаунт уже подключен!\n"
            "Вернитесь на сайт - ваши группы должны загружаться."
        )
        return
    
    # Начинаем авторизацию
    user_states[telegram_user_id] = {
        'web_user_id': web_user_id,
        'step': 'waiting_phone'
    }
    
    print(f"✅ DEBUG: Состояние сохранено для {telegram_user_id}: {user_states[telegram_user_id]}")
    
    await message.reply_text(
        "🔐 **Подключение вашего аккаунта**\n\n"
        "📱 Отправьте ваш номер телефона в формате:\n"
        "`+380991234567`"
    )

async def handle_code(message, telegram_user_id, code, state):
    if not (code.isdigit() and len(code) == 5):
        await message.reply_text("❌ Введите 5-значный код")
        return
    
    try:
        temp_data = temp_clients[telegram_user_id]
        client = temp_data['client']
        
        # Авторизуемся
        await client.sign_in(
            temp_data['phone'],
            temp_data['phone_code_hash'],
            code
        )
        
        # Получаем информацию о пользователе
        me = await client.get_me()
        await client.disconnect()
        
        # Сохраняем сессию
        session_data = {
            'telegram_user_id': telegram_user_id,
            'phone': temp_data['phone'],
            'first_name': me.first_name or '',
            'last_name': me.last_name or '',
            'username': me.username or '',
            'user_id': str(me.id),
            'created_at': time.time()  # Теперь time будет работать
        }
        
        session_manager.save_session(state['web_user_id'], session_data)
        
        # Очищаем временные данные
        del user_states[telegram_user_id]
        del temp_clients[telegram_user_id]
        
        await message.reply_text(
            f"✅ Аккаунт {me.first_name} успешно подключен!\n"
            f"Теперь вернитесь на сайт и нажмите 'Проверить подключение'."
        )
        
    except Exception as e:
        await message.reply_text(f"❌ Ошибка авторизации: {str(e)}")

async def handle_code(message, telegram_user_id, code, state):
    if not (code.isdigit() and len(code) == 5):
        await message.reply_text("❌ Введите 5-значный код")
        return
    
    try:
        temp_data = temp_clients[telegram_user_id]
        client = temp_data['client']
        
        # Авторизуемся
        await client.sign_in(
            temp_data['phone'],
            temp_data['phone_code_hash'],
            code
        )
        
        # Получаем информацию о пользователе
        me = await client.get_me()
        await client.disconnect()
        
        # Сохраняем сессию
        session_data = {
            'telegram_user_id': telegram_user_id,
            'phone': temp_data['phone'],
            'first_name': me.first_name or '',
            'last_name': me.last_name or '',
            'username': me.username or '',
            'user_id': str(me.id),
            'created_at': time.time()
        }
        
        session_manager.save_session(state['web_user_id'], session_data)
        
        # Очищаем временные данные
        del user_states[telegram_user_id]
        del temp_clients[telegram_user_id]
        
        await message.reply_text(
            f"✅ Аккаунт {me.first_name} успешно подключен!\n"
            f"Теперь вернитесь на сайт - ваши группы загрузятся автоматически."
        )
        
    except Exception as e:
        await message.reply_text(f"❌ Ошибка авторизации: {str(e)}")

if __name__ == "__main__":
    print("🤖 Auth bot starting...")
    auth_bot.run()