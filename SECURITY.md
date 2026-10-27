# Security / Безпека

## English

- Keep AWS credentials, database credentials and JWT signing secrets on the backend, outside source control. Mobile configuration is shipped to users and cannot hold secrets.
- Use HTTPS for API calls. Store session tokens in Expo SecureStore; do not put tokens, signed S3 URLs or real account details in logs, screenshots or issue reports.
- The backend must verify authentication, ownership, input and uploaded images. Client-side validation is for usability and is not an authorization boundary.
- `src/config.ts`, environment files, signing keys, deployment records and database exports are excluded from version control. Only placeholder configuration belongs in examples.
- Tests use synthetic fixtures and mocked services. Dependency review, installed-build testing and infrastructure maintenance remain separate tasks; this repository has not undergone a penetration test.
- The 1RM calculator provides estimates, not a guarantee of accuracy or safe lifting loads. Estimates from higher repetition counts are less reliable; percentage values inherit that uncertainty.

If a credential is exposed, revoke and replace it. Removing it from a later commit does not invalidate it or erase earlier copies.

### Dependency audit — 24 October 2026

`npm audit` reports seven affected packages (five high, two moderate), including inherited findings; these are not seven independent flaws. The reported paths lead through the Expo CLI, certificate tooling and the optional ngrok development tunnel:

- [node-forge signature verification](https://github.com/advisories/GHSA-86w9-cpqp-85rv): no patched version is listed in the advisory.
- [Zod resource exhaustion](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5): the patched major version is outside the CLI's current dependency range.
- [uuid buffer bounds](https://github.com/advisories/GHSA-w5hq-g745-h8pq): ngrok depends on an older major version.

These packages are not imported by the application source. This does not establish the absence of exposure in development tools or prove an installed app safe. Compatible upstream fixes still need review. Do not use `npm audit fix --force`: its proposed Expo SDK 44 downgrade is incompatible with this SDK 58 project. Treat development servers and tunnels as development infrastructure, not production hosting.

The SDK 58 lint configuration currently resolves ESLint 9.39.5, whose npm package reports end of support. The bundled React lint plugin does not declare ESLint 10 compatibility; upgrading this development tool requires a compatible configuration and plugins.

## Українська

- Ключі AWS, доступ до БД і секрет підпису JWT зберігаються лише на бекенді поза Git. Конфігурація мобільного застосунку потрапляє до користувача й не може містити секретів.
- Для API потрібен HTTPS. Токени сесій зберігаються через Expo SecureStore; токени, підписані S3-посилання та дані реальних акаунтів не додаються до журналів, скриншотів або повідомлень про помилки.
- Авторизацію, належність записів, вхідні дані й зображення перевіряє бекенд. Перевірка у формі допомагає користувачу, але не надає права доступу.
- `src/config.ts`, файли середовища, ключі підпису, записи про VPS і експорти БД виключені з Git. Приклади містять лише порожні або вигадані значення.
- Тести використовують вигадані дані та підставні сервіси. Перевірка залежностей, встановленої збірки й інфраструктури виконується окремо; тест на проникнення не проводився.
- Калькулятор 1RM дає орієнтир, а не гарантію точності чи безпечної ваги. За великої кількості повторень похибка може зростати; таблиця відсотків успадковує цю похибку.

У разі витоку ключ потрібно відкликати й замінити. Видалення з наступного коміту не скасовує ключ і не прибирає попередні копії.

### Перевірка залежностей — 24 жовтня 2026 року

`npm audit` повідомляє про сім зачеплених пакетів: п’ять із високим і два з помірним рівнем. Частина записів успадковує проблему іншої залежності, тому це не сім незалежних вразливостей. Ланцюжки ведуть через Expo CLI, роботу із сертифікатами та необов’язковий тунель ngrok.

Йдеться про перевірку підпису в `node-forge`, використання пам’яті в `zod` і межі буфера в `uuid`; офіційні описи наведені вище. Для `node-forge` виправлену версію ще не вказано, а сумісні оновлення інструментів потребують окремої перевірки.

Код застосунку не імпортує ці пакети напряму. Це не доводить відсутність ризику в інструментах розробки або безпеку встановленої збірки. `npm audit fix --force` не застосовується: запропоноване пониження до Expo SDK 44 несумісне з проєктом на SDK 58. Сервер розробки й тунелі не призначені для робочого розміщення API.

Конфігурація lint для SDK 58 наразі встановлює ESLint 9.39.5, для якого npm повідомляє про завершення підтримки. Підключений плагін React не заявляє сумісності з ESLint 10; оновлення цього інструмента розробки потребує сумісної конфігурації та плагінів.
