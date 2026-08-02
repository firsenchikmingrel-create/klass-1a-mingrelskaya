Админ-панель сайта 1 «А»

Файлы:
- admin.html — интерфейс панели
- admin.js — работа с GitHub API

Куда положить:
В корень репозитория klass-1a-mingrelskaya рядом с index.html.
После публикации адрес будет:
https://firsenchikmingrel-create.github.io/klass-1a-mingrelskaya/admin.html

Авторизация:
Fine-grained GitHub personal access token, ограниченный только репозиторием klass-1a-mingrelskaya.
Repository permission: Contents = Read and write.
Токен хранится только в sessionStorage текущей вкладки и удаляется при выходе.

Возможности первой версии:
- редактирование 3 карточек объявлений;
- расписание на 5 дней, один урок на строку;
- редактирование трёх текущих TXT-материалов;
- редактирование карточки «Ближайшее событие»;
- публикация изменений напрямую в main;
- проверка SHA перед публикацией, чтобы не затереть чужие изменения;
- ссылка на историю GitHub для отката.
