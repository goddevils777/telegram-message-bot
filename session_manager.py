import os
import json
import time
from pyrogram import Client

class SessionManager:
    def __init__(self, api_id, api_hash):
        self.api_id = api_id
        self.api_hash = api_hash
        self.sessions_dir = "user_sessions"
        os.makedirs(self.sessions_dir, exist_ok=True)
    
    def has_session(self, user_id):
        """Проверяет есть ли сессия пользователя"""
        session_file = f"{self.sessions_dir}/{user_id}.json"
        pyrogram_session = f"user_{user_id}.session"
        
        return (os.path.exists(session_file) and 
                os.path.exists(pyrogram_session))
    
    def get_user_client(self, user_id):
        """Создает клиент для пользователя"""
        if not self.has_session(user_id):
            return None
        
        return Client(f"user_{user_id}", 
                     api_id=self.api_id, 
                     api_hash=self.api_hash)
    
    def save_session(self, user_id, session_data):
        """Сохраняет данные сессии"""
        session_file = f"{self.sessions_dir}/{user_id}.json"
        with open(session_file, 'w', encoding='utf-8') as f:
            json.dump(session_data, f, ensure_ascii=False, indent=2)
        print(f"✅ Сессия сохранена для пользователя {user_id}")
    
    def get_session_data(self, user_id):
        """Получает данные сессии"""
        session_file = f"{self.sessions_dir}/{user_id}.json"
        if os.path.exists(session_file):
            with open(session_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return None
    
    def delete_session(self, user_id):
        """Удаляет сессию пользователя"""
        try:
            session_file = f"{self.sessions_dir}/{user_id}.json"
            pyrogram_session = f"user_{user_id}.session"
            
            if os.path.exists(session_file):
                os.remove(session_file)
            
            if os.path.exists(pyrogram_session):
                os.remove(pyrogram_session)
                
            print(f"✅ Сессия удалена для пользователя {user_id}")
            return True
        except Exception as e:
            print(f"❌ Ошибка удаления сессии: {e}")
            return False
    
    def list_sessions(self):
        """Возвращает список всех сессий"""
        sessions = []
        if os.path.exists(self.sessions_dir):
            for file in os.listdir(self.sessions_dir):
                if file.endswith('.json'):
                    user_id = file[:-5]  # убираем .json
                    session_data = self.get_session_data(user_id)
                    if session_data:
                        sessions.append({
                            'user_id': user_id,
                            'data': session_data
                        })
        return sessions