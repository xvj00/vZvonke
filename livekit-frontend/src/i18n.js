import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n.use(initReactI18next).init({
    lng: "ru",
    fallbackLng: "ru",
    resources: {
        ru: {
            translation: {
                title: "Дипломный проект: Видеочат",
                name: "Ваше имя",
                room: "Название комнаты",
                join: "Войти в комнату",
                error: "Ошибка подключения к серверу"
            }
        },
        en: {
            translation: {
                title: "Diploma project: Video chat",
                name: "Your name",
                room: "Room name",
                join: "Join room",
                error: "Backend connection error"
            }
        }
    }
});

export default i18n;
