import json
import hashlib

# Данные пользователя
username = "test_user"
user_id = hashlib.md5(username.encode()).hexdigest()[:10]

print(f"User ID для {username}: {user_id}")

# Проверяем какие файлы есть
import os
files = os.listdir('user_sessions/') if os.path.exists('user_sessions/') else []
print(f"Файлы сессий: {files}")

# Если есть test_user.json - копируем
if 'test_user.json' in files:
    with open('user_sessions/test_user.json', 'r') as f:
        session_data = json.load(f)
    
    with open(f'user_sessions/{user_id}.json', 'w') as f:
        json.dump(session_data, f, indent=2)
    
    print(f"✅ Скопировал сессию в user_sessions/{user_id}.json")
else:
    print("❌ Файл test_user.json не найден")