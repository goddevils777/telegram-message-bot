from pyrogram import Client
import asyncio
import sys
import json
import os

async def create_session_for_user(api_id, api_hash, user_id):
    """Создает сессию для пользователя"""
    session_name = f"user_{user_id}"
    
    client = Client(session_name, api_id=api_id, api_hash=api_hash)
    
    try:
        await client.start()
        me = await client.get_me()
        
        print(f"✅ Успешно авторизован: {me.first_name}")
        print(f"📱 Телефон: {me.phone_number}")
        print(f"👤 Username: @{me.username}")
        
        # Тестируем получение групп
        groups_count = 0
        async for dialog in client.get_dialogs():
            if dialog.chat.type.name in ["GROUP", "SUPERGROUP"]:
                groups_count += 1
                if groups_count <= 3:
                    print(f"📂 Группа: {dialog.chat.title}")
        
        print(f"📊 Всего найдено групп: {groups_count}")
        
        await client.stop()
        
        # Создаем метку что сессия готова
        session_info = {
            'user_id': user_id,
            'session_ready': True,
            'phone': me.phone_number,
            'username': me.username,
            'first_name': me.first_name,
            'groups_count': groups_count
        }
        
        os.makedirs('user_sessions', exist_ok=True)
        with open(f'user_sessions/{user_id}_session_info.json', 'w') as f:
            json.dump(session_info, f, indent=2)
        
        print(f"✅ Сессия готова! Файл: user_{user_id}.session")
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Использование: python3 create_user_session.py <api_id> <api_hash> <user_id>")
        sys.exit(1)
    
    api_id = int(sys.argv[1])
    api_hash = sys.argv[2]
    user_id = sys.argv[3]
    
    asyncio.run(create_session_for_user(api_id, api_hash, user_id))