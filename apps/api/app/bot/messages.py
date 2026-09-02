MESSAGES = {
    "ru": {
        "welcome": "Привет, {name}! Я TaskPilot — помогу держать задачи под контролем.\n\nПросто отправь задачу сообщением, например:\n<code>Позвонить Анне завтра 14:30</code>",
        "language": "Выбери язык интерфейса:",
        "language_saved": "Язык изменён на русский 🇷🇺",
        "created": "✅ Задача создана\n\n<b>{title}</b>{due}",
        "due": "\n⏰ {value}",
        "today": "Задачи на сегодня",
        "all": "Твои активные задачи",
        "empty": "Пока задач нет. Отправь мне текст — и я создам первую.",
        "done": "Готово! Отличная работа ✨",
        "not_found": "Не удалось найти эту задачу.",
        "help": "Команды:\n/new — создать задачу\n/today — задачи на сегодня\n/tasks — все задачи\n/language — язык\n/settings — настройки\n\nМожно просто написать: <code>Купить билеты завтра 18:00</code>",
        "settings": "⚙️ <b>Настройки</b>\nЯзык: Русский\nЧасовой пояс: {timezone}\nЕжедневная сводка: {hour}:00",
    },
    "en": {
        "welcome": "Hi, {name}! I’m TaskPilot — I’ll help you keep every task under control.\n\nJust send a task, for example:\n<code>Call Anna tomorrow 14:30</code>",
        "language": "Choose your interface language:",
        "language_saved": "Language changed to English 🇬🇧",
        "created": "✅ Task created\n\n<b>{title}</b>{due}",
        "due": "\n⏰ {value}",
        "today": "Today’s tasks",
        "all": "Your active tasks",
        "empty": "No tasks yet. Send me some text to create the first one.",
        "done": "Done! Great work ✨",
        "not_found": "I couldn’t find that task.",
        "help": "Commands:\n/new — create a task\n/today — today’s tasks\n/tasks — all tasks\n/language — language\n/settings — settings\n\nOr simply send: <code>Buy tickets tomorrow 18:00</code>",
        "settings": "⚙️ <b>Settings</b>\nLanguage: English\nTimezone: {timezone}\nDaily digest: {hour}:00",
    },
}


def msg(language: str, key: str, **kwargs: object) -> str:
    bundle = MESSAGES.get(language, MESSAGES["ru"])
    return bundle[key].format(**kwargs)
