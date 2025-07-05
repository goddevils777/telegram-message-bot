from pyrogram import Client
import sys
import os
import json
import shutil
from datetime import datetime

def create_session():
    """Создание сессии в интерактивном режиме"""
    print("🔐 СОЗДАНИЕ СЕССИИ TELEGRAM АККАУНТА")
    print("=" * 50)
    
    # Проверяем API ключи
    if not os.path.exists('config/api_keys.json'):
        print("❌ Не найден файл config/api_keys.json")
        print("Сначала настройте API ключи в веб-интерфейсе")
        return False
    
    with open('config/api_keys.json', 'r') as f:
        config = json.load(f)
    
    api_id = config['API_ID']
    api_hash = config['API_HASH']
    
    # Запрашиваем название для сессии
    account_name = input("📝 Введите название аккаунта (например: 'main_account'): ").strip()
    if not account_name:
        account_name = f"account_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    session_file = f"session_{account_name}"
    
    print(f"\n🚀 Создание сессии '{session_file}'...")
    print("📱 Сейчас будет запрос номера телефона и SMS кода")
    print("⚠️  ВАЖНО: Вводите код ТОЧНО как получили!")
    
    try:
        # Создаем клиент и авторизуемся
        client = Client(session_file, api_id=api_id, api_hash=api_hash)
        
        with client:
            me = client.get_me()
            
            # Сохраняем информацию об аккаунте
            account_info = {
                'session_file': f"{session_file}.session",
                'account_name': account_name,
                'user_info': {
                    'id': str(me.id),
                    'first_name': me.first_name or '',
                    'last_name': me.last_name or '',
                    'username': me.username or '',
                    'phone': me.phone_number or ''
                },
                'created_at': datetime.now().isoformat(),
                'status': 'ready'
            }
            
            # Создаем папку для сессий если её нет
            os.makedirs('sessions', exist_ok=True)
            
            # Перемещаем сессию в папку sessions
            if os.path.exists(f"{session_file}.session"):
                shutil.move(f"{session_file}.session", f"sessions/{session_file}.session")
            
            # Сохраняем информацию об аккаунте
            with open(f"sessions/{account_name}_info.json", 'w', encoding='utf-8') as f:
                json.dump(account_info, f, ensure_ascii=False, indent=2)
            
            print(f"\n✅ УСПЕШНО СОЗДАНА СЕССИЯ!")
            print(f"👤 Аккаунт: {me.first_name} {me.last_name}")
            print(f"📱 Телефон: {me.phone_number}")
            print(f"📁 Файл сессии: sessions/{session_file}.session")
            print(f"📄 Информация: sessions/{account_name}_info.json")
            print(f"\n🌐 Теперь можно использовать этот аккаунт в веб-интерфейсе!")
            
            return True
            
    except Exception as e:
        print(f"\n❌ ОШИБКА СОЗДАНИЯ СЕССИИ: {e}")
        
        # Удаляем файлы при ошибке
        for file in [f"{session_file}.session", f"sessions/{session_file}.session"]:
            if os.path.exists(file):
                os.remove(file)
        
        return False

def list_sessions():
    """Показать список существующих сессий"""
    if not os.path.exists('sessions'):
        print("📁 Папка sessions не найдена")
        return
    
    sessions = []
    for file in os.listdir('sessions'):
        if file.endswith('_info.json'):
            try:
                with open(f"sessions/{file}", 'r', encoding='utf-8') as f:
                    info = json.load(f)
                sessions.append(info)
            except:
                continue
    
    if not sessions:
        print("📭 Нет созданных сессий")
        return
    
    print("\n📋 СУЩЕСТВУЮЩИЕ СЕССИИ:")
    print("=" * 50)
    
    for i, session in enumerate(sessions, 1):
        user = session['user_info']
        print(f"{i}. {session['account_name']}")
        print(f"   👤 {user['first_name']} {user['last_name']}")
        print(f"   📱 {user['phone']}")
        print(f"   📅 {session['created_at'][:10]}")
        print()

def main():
    if len(sys.argv) > 1:
        if sys.argv[1] == 'list':
            list_sessions()
            return
        elif sys.argv[1] == 'help':
            print("🔧 ИНСТРУМЕНТ СОЗДАНИЯ СЕССИЙ")
            print("Использование:")
            print("  python3 create_session_tool.py        - Создать новую сессию")
            print("  python3 create_session_tool.py list   - Показать существующие сессии")
            print("  python3 create_session_tool.py help   - Показать эту справку")
            return
    
    create_session()

if __name__ == "__main__":
    main()