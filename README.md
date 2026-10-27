# Workout Tracker

An Expo / React Native app for planning workouts, recording exercises and sets, and tracking completed training days.

[Українська](#українська)

## Current scope

- Account registration, sign-in and session restoration.
- Profile with nickname, avatar and a calendar of completed training days.
- Workouts with exercises, sets, repetitions and weight; editing and deletion.
- Reusable exercise and whole-workout templates, selected before creating a workout.
- Workout completion and reopening, with statistics based on completed workouts.
- Light and dark themes, plus an estimated one-repetition maximum calculator.

This repository records work in progress. It is not an App Store or Google Play release. The app currently targets Expo SDK 58 and is tested manually in Expo Go on iOS; an independent native build has not yet been verified.

## Local setup

Use Node.js 24 LTS. Install the locked dependencies:

```sh
npm ci
cp src/config.example.ts src/config.ts
```

In the ignored `src/config.ts`, set `API_BASE_URL` to the HTTPS API address, including `/api`. The example address is intentionally nonfunctional. Run the backend separately using its own configuration: [workout-backend](https://github.com/stasbelia/workout-backend).

```sh
npm start
```

Open the project in a compatible Expo Go client. The phone must be able to reach both the development server and the API.

## Verification

```sh
npm test
npm run typecheck
npm run lint
```

The current suite contains 182 tests across 19 suites. It covers session handling, navigation, API parsing, avatar flows, profile and theme behavior, workout templates, editing, completion and the 1RM calculator, including avatar isolation between accounts and the workout refresh indicator. Network responses and device services are mocked; tests do not need production credentials or a real user account.

TypeScript checks types without generating files. ESLint uses the Expo SDK 58 configuration to check application source and tests; warnings fail the check. GitHub Actions are not configured yet. Passing automated checks does not replace testing an installed native build.

The dependency audit reports unresolved findings in the Expo development toolchain. See [SECURITY.md](SECURITY.md); the project is not described as vulnerability-free.

## Configuration and privacy

The mobile app must never contain AWS keys, database passwords or the backend JWT signing secret. Session tokens are stored using Expo SecureStore. Avatar access is issued by the backend; the S3 bucket remains private.

Local API configuration, deployment notes, database exports, credentials and historical backend bundles are excluded from Git. Backend source is maintained in its separate repository. See [SECURITY.md](SECURITY.md) for the current security boundaries.

## Українська

Мобільний застосунок на Expo / React Native для планування тренувань, запису вправ і підходів та обліку виконаних тренувальних днів.

### Можливості

- Реєстрація, вхід і відновлення сесії.
- Профіль із нікнеймом, аватаром і календарем виконаних тренувань.
- Тренування з вправами, підходами, повтореннями та вагою; редагування й видалення.
- Власні шаблони вправ і цілих тренувань із вибором шаблону перед створенням.
- Завершення та повторне відкриття тренування; статистика враховує виконані записи.
- Світла й темна теми та калькулятор орієнтовного максимуму на одне повторення.

Репозиторій зберігає поточний стан розробки. Це ще не випуск для App Store чи Google Play. Використовується Expo SDK 58; ручні перевірки виконувалися в Expo Go на iOS. Окрему встановлювану збірку ще не перевірено.

### Локальний запуск

Використовуйте Node.js 24 LTS. Виконайте `npm ci`, скопіюйте `src/config.example.ts` у `src/config.ts` та вкажіть HTTPS-адресу API разом із `/api`. Адреса в прикладі навмисно не є робочою. Файл із вашим налаштуванням ігнорується Git.

Бекенд запускається окремо за інструкцією в [workout-backend](https://github.com/stasbelia/workout-backend). Після `npm start` відкрийте проєкт у сумісній версії Expo Go. Телефон має бачити сервер розробки та API.

### Перевірки

`npm test` запускає 182 тести у 19 наборах; `npm run typecheck` перевіряє типи без створення файлів. Тести охоплюють сесії, навігацію, API, аватари, профіль, теми, шаблони, редагування, завершення тренувань і калькулятор 1RM, зокрема приховування аватара попереднього акаунта та індикатор оновлення списку. Вони використовують підставні відповіді та сервіси, без робочих ключів і реальних акаунтів.

`npm run lint` перевіряє код застосунку й тести за правилами Expo SDK 58; попередження також призводять до невдалої перевірки. Автоматичний запуск через GitHub Actions ще не налаштовано. Ці перевірки не замінюють тестування окремої встановленої збірки.

Перевірка залежностей має невирішені зауваження до інструментів розробки Expo. Деталі — у [SECURITY.md](SECURITY.md); відсутність вразливостей не заявляється.

### Приватні налаштування

Ключі AWS, пароль БД і секрет підпису JWT належать лише бекенду та не повинні бути в мобільному застосунку. Токен сесії зберігається через Expo SecureStore; доступ до приватних аватарів видає сервер.

Локальна адреса API, записи про розгортання, експорти БД, ключі та старі пакети оновлень бекенду виключені з Git. Актуальний бекенд зберігається окремо. Деталі — у [SECURITY.md](SECURITY.md).
