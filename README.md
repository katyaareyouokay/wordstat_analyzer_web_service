# Wordstat Analyzer
Как установить все необходимое (пишу команды для винды, для мака посмотрите, если что не так):

1. Клонируем репу
2. Создаем виртуальное окружение: python -m venv venv
3. Активируем виртальное окружение: venv/Scripts/activate
4. Устанавливаем библиотеки: pip install -r requirements.txt
5. Создаем .env, кладем туда шаблон переменных окружения из env_example
6. Создаем в субд новую пустую postresql бд (я работаю в DBeaver), называем ее wordstat_analyzer
7. В .env своем, не в шаблон, записываем DATABASE_URL=postgresql://{имя вашего пользователя при настройке субд/имя создателя бд}:{пароль от этого пользователя}@localhost:{5434 или ваш порт, например, 5432}/wordstat_analyzer
8. Запускаем скрипт create_db.py - готово!
<img width="872" height="250" alt="image" src="https://github.com/user-attachments/assets/9de665ed-d81d-44ea-b973-a0383c53d04b" />

Как посмотреть схему бд:
<img width="671" height="253" alt="image" src="https://github.com/user-attachments/assets/a0ae2991-84bb-46ed-9986-df37479fb521" />
<img width="1486" height="966" alt="image" src="https://github.com/user-attachments/assets/bfd4ef8c-c9f6-463b-b825-c680ffc01975" />


