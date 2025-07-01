import time  # Добавь в начало файла
import asyncio  
from pyrogram import Client, filters

# API данные (твои значения)
API_ID = 29318340  # Твой API ID (число)
API_HASH = "API_HASH"  # Твой API Hash (в кавычках)
BOT_TOKEN = "BOT_TOKEN"  # Токен бота

# Создаём ОСНОВНОЙ клиент для твоего аккаунта
user_app = Client("main_account", api_id=API_ID, api_hash=API_HASH)

# Создаём бота отдельно
bot_app = Client("bot_account", api_id=API_ID, api_hash=API_HASH, bot_token=BOT_TOKEN)

# Команда /start для бота
@bot_app.on_message(filters.command("start"))
def start_command(client, message):
    if len(message.command) > 1 and message.command[1] == "web_login":
        # Генерируем код для веб-авторизации
        auth_code = f"WEB{message.from_user.id}"
        message.reply_text(
            f"🔐 Ваш код для входа в веб-интерфейс:\n\n"
            f"`{auth_code}`\n\n"
            f"Скопируйте этот код и вставьте на сайте."
        )
    else:
        message.reply_text(
            "Привет! Я ищу сообщения по ключевым словам.\n\n"
            "Отправь мне слово для поиска, например: разработка"
        )

async def search_in_groups(keyword):
    try:
        if not user_app.is_connected:
            await user_app.start()
        
        print(f"Поиск слова: {keyword}")
        
        # Получаем ВСЕ групповые чаты
        groups_chats = []
        async for dialog in user_app.get_dialogs():
            if dialog.chat.type.name != "PRIVATE":
                groups_chats.append(dialog.chat)
        
        print(f"Будем искать в {len(groups_chats)} чатах")
        
        found_messages = []
        
        # Ищем во ВСЕХ группах с задержками
        for i, chat in enumerate(groups_chats, 1):
            try:
                print(f"[{i}/{len(groups_chats)}] Ищу в: {chat.title}")
                message_count = 0
                
                # Ищем в последних 1000 сообщений каждой группы
                async for message in user_app.get_chat_history(chat.id, limit=1000):
                    message_count += 1
                    if message.text and keyword.lower() in message.text.lower():
                        found_messages.append({
                            'text': message.text,
                            'author': message.from_user.username if message.from_user else "Неизвестно",
                            'chat': chat.title,
                            'date': message.date.strftime("%d.%m.%Y %H:%M")
                        })
                
                print(f"   Проверено: {message_count} сообщений, найдено: {len([m for m in found_messages if m['chat'] == chat.title])}")
                
                # ЗАДЕРЖКА между группами - 1 секунда
                if i < len(groups_chats):  # Не ждём после последней группы
                    await asyncio.sleep(1)
                        
            except Exception as e:
                print(f"   Ошибка в {chat.title}: {e}")
                # При ошибке ждём дольше
                await asyncio.sleep(2)
        
        print(f"ИТОГО найдено: {len(found_messages)} сообщений")
        return found_messages
        
    except Exception as e:
        print(f"Ошибка: {e}")
        return []

# Обработка поиска
@bot_app.on_message(filters.text & ~filters.command("start"))
async def search_messages(client, message):
    keyword = message.text.strip()
    await message.reply_text(f"Ищу '{keyword}' во всех группах (последние 1000 сообщений в каждой)...\nЭто может занять время ⏳")
    
    results = await search_in_groups(keyword)
    
    if results:
        await message.reply_text(f"🔍 Найдено {len(results)} сообщений! Отправляю результаты...")
        
        response = ""
        sent_count = 0
        
        for i, msg in enumerate(results, 1):
            try:
                # ПОЛНЫЙ текст сообщения без обрезки
                full_text = str(msg['text']).replace('\n', '\n   ')  # Отступы для читаемости
                safe_author = str(msg['author'])
                safe_chat = str(msg['chat'])
                safe_date = str(msg['date'])
                
                new_entry = f"━━━━━━━━━━━━━━━━━━━━━\n"
                new_entry += f"{i}. 📝 ПОЛНОЕ СООБЩЕНИЕ:\n"
                new_entry += f"   {full_text}\n\n"
                new_entry += f"👤 Автор: @{safe_author}\n"
                new_entry += f"💬 Группа: {safe_chat}\n"
                new_entry += f"📅 Дата: {safe_date}\n"
                new_entry += f"━━━━━━━━━━━━━━━━━━━━━\n\n"
                
                # Проверяем длину (Telegram лимит ~4096 символов)
                if len(response + new_entry) > 3800:
                    await message.reply_text(response)
                    sent_count += 1
                    response = new_entry
                else:
                    response += new_entry
                    
            except Exception as e:
                print(f"Ошибка при обработке сообщения {i}: {e}")
                continue
        
        # Отправляем последнюю часть
        if response.strip():
            await message.reply_text(response)
            sent_count += 1
            
        await message.reply_text(f"✅ Готово! Показано {len(results)} полных сообщений в {sent_count} частях")
        
    else:
        await message.reply_text("Сообщения не найдены 😔")

# Запуск
if __name__ == "__main__":
    print("Запуск...")
    bot_app.run()