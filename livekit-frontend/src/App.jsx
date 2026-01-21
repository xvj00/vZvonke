import { useState } from 'react';
import axios from 'axios';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles'; // Импорт стандартных стилей чата
import './App.css';

function App() {
    const [userName, setUserName] = useState('');
    const [roomName, setRoomName] = useState('');
    const [token, setToken] = useState(null);

    // Функция запроса токена у Laravel
    const handleJoin = async () => {
        try {
            const response = await axios.post('http://localhost:8000/api/get-token', {
                room_name: roomName,
                user_name: userName,
            });

            if (response.data.token) {
                setToken(response.data.token);
            }
        } catch (error) {
            alert("Ошибка подключения к бэкенду. Проверь Laravel и CORS!");
            console.error(error);
        }
    };

    // 1. Если токена нет — показываем форму входа
    if (!token) {
        return (
            <div className="join-container" style={{ padding: '20px', textAlign: 'center' }}>
                <h1>Дипломный проект: Видеочат 🎓</h1>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '300px', margin: '0 auto' }}>
                    <input
                        placeholder="Ваше имя"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                    />
                    <input
                        placeholder="Название комнаты"
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                    />
                    <button onClick={handleJoin}>Войти в комнату</button>
                </div>
            </div>
        );
    }

    // 2. Если токен получен — запускаем LiveKit
    return (
        <div style={{ height: '100vh' }}>
            <LiveKitRoom
                video={false}
                audio={false}
                token={token}
                serverUrl="ws://localhost:7880" // Адрес твоего LiveKit в Docker
                onDisconnected={() => setToken(null)}
                data-lk-theme="default" // Темная тема оформления
            >
                {/* Готовый интерфейс конференции (сетка, кнопки, чат) */}
                <VideoConference />
            </LiveKitRoom>
        </div>
    );
}

export default App;