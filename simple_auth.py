from pyrogram import Client
import asyncio

# Твои данные
API_ID = 29318340
API_HASH = "68be30e447857e5e5aa24c23a41c686d"

async def create_user_session():
    """Создаём сессию пользователя вручную"""
    client = Client("test_user_session", api_id=API_ID, api_hash=API_HASH)
    
    try:
        await client.start()
        me = await client.get_me()
        
        print(f"✅ Успешно авторизован: {me.first_name}")
        print(f"ID: {me.id}")
        print(f"Username: {me.username}")
        
        # Тестируем получение групп
        groups = []
        async for dialog in client.get_dialogs():
            if dialog.chat.type.name in ["GROUP", "SUPERGROUP"]:
                groups.append(dialog.chat.title)
                if len(groups) >= 5:
                    break
        
        print(f"Найдено групп: {groups}")
        
        await client.stop()
        
        # Создаём файл сессии для веб-приложения
        import json
        import os
        
        user_id = "test_user"  # Временный ID
        session_data = {
            'is_connected': True,
            'phone': '+test',
            'user_info': {
                'first_name': me.first_name or '',
                'last_name': me.last_name or '',
                'username': me.username or '',
                'user_id': str(me.id)
            }
        }
        
        os.makedirs('user_sessions', exist_ok=True)
        with open(f'user_sessions/{user_id}.json', 'w', encoding='utf-8') as f:
            json.dump(session_data, f, ensure_ascii=False, indent=2)
        
        print(f"✅ Сессия сохранена в user_sessions/{user_id}.json")
        print("Теперь в веб-приложении авторизуйся как 'test_user'")
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")

if __name__ == "__main__":
    asyncio.run(create_user_session())