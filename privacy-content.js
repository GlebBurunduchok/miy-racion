/* Factual privacy notice for the browser-local version of Мій раціон. */
window.RATION_PRIVACY = {
  updated: '2026-11-16',
  uk: {
    title: 'Політика конфіденційності',
    sections: [
      {
        title: 'Хто відповідає за застосунок',
        paragraphs: [
          'Відповідальна та контактна особа проєкту «Мій раціон» — Крупнік Глєб (Krupnik Hlieb). Ця політика описує поточну версію без віддалених облікових записів і синхронізації.'
        ]
      },
      {
        title: 'Що зберігається на вашому пристрої',
        paragraphs: [
          'Застосунок зберігає в цьому браузері введені вами ім’я й аватар, рік народження, стать, зріст, вагу, активність, цілі, записи їжі та води, історію ваги, рецепти, власні продукти й фото, обране та налаштування. Ці відомості потрібні для щоденника, розрахунків і показу прогресу.',
          'Основні записи зберігаються в localStorage. Браузер також кешує файли застосунку та моделі розпізнавання, зокрема через Service Worker та IndexedDB. Розробник не отримує ваш щоденник автоматично й не має віддаленого доступу до нього.'
        ]
      },
      {
        title: 'Фото етикеток і камера',
        paragraphs: [
          'Розпізнавання етикетки виконується на пристрої. Застосунок не надсилає фото до сервісу розпізнавання. Робочий знімок тимчасово утримується під час обробки; перенесення розпізнаних значень у продукт потребує вашого підтвердження.',
          'Власне фото продукту, яке ви окремо зберігаєте, залишається в локальному щоденнику та його резервній копії. Доступ до камери запитується після запуску сканера; дозвіл можна відкликати в налаштуваннях браузера.'
        ]
      },
      {
        title: 'Коли використовуються зовнішні сервіси',
        paragraphs: [
          'Онлайн-пошук автоматично передає введену назву продукту або відсканований штрихкод зовнішньому каталогу. На статичному сайті це Open Food Facts; версія з локальним сервером може також звертатися до «Таблиці калорійності». Фото окремих каталогових продуктів завантажуються із сайтів джерел. Вбудовані фото базових інгредієнтів постачаються із застосунком.',
          'Окремий HTML-файл може завантажувати файли OCR і мовні моделі з jsDelivr. Фото етикетки до CDN не передається. Хостинг, каталоги, джерела фото та CDN отримують звичайні мережеві дані запиту, наприклад IP-адресу й відомості браузера, за власними політиками. GitHub Pages зберігає IP-адреси відвідувачів для безпеки.'
        ]
      },
      {
        title: 'Ваш контроль над даними',
        paragraphs: [
          'У налаштуваннях можна змінити записи, експортувати JSON-резервну копію, відновити її або скинути активний щоденник. Для повного очищення локальних даних, можливих відновлювальних копій і кешів видаліть дані цього сайту засобами браузера.',
          'Копії JSON, які ви завантажили, потрібно видаляти окремо. Очищення браузера не видаляє журнали сторонніх сервісів. Збереження щоденника триває, поки ви його не очистите або браузер не видалить сховище. Без власної резервної копії віддалене відновлення неможливе.'
        ]
      },
      {
        title: 'Спільні пристрої та відстеження',
        paragraphs: [
          'У застосунку немає власних рекламних трекерів чи аналітичних лічильників. Локальний профіль не захищає щоденник окремим паролем. Людина з доступом до вашого браузера або резервної копії може побачити записи; бережіть ці файли та доступ до пристрою.'
        ]
      },
      {
        title: 'Оновлення політики',
        paragraphs: [
          'Ця редакція діє з 16 листопада 2026 року. Якщо з’являться серверні акаунти, синхронізація або нові способи обробки даних, політику буде оновлено. Посилання на сторонні сайти відкривають сервіси з власними правилами конфіденційності.'
        ]
      }
    ]
  },
  en: {
    title: 'Privacy policy',
    sections: [
      {
        title: 'Responsible person',
        paragraphs: [
          'The responsible person and project contact for Mii Ratsion is Krupnik Hlieb (Крупнік Глєб). This notice describes the current version, which has no remote user accounts or synchronisation.'
        ]
      },
      {
        title: 'Information stored on your device',
        paragraphs: [
          'The app stores the information you enter in this browser: your name and avatar, birth year, sex, height, weight, activity, goals, food and water records, weight history, recipes, custom foods and photos, favourites and preferences. This information supports the diary, calculations and progress views.',
          'Main records use localStorage. The browser also caches app files and recognition models, including through a Service Worker and IndexedDB. The developer does not automatically receive your diary or have remote access to it.'
        ]
      },
      {
        title: 'Label photos and camera access',
        paragraphs: [
          'Nutrition-label recognition runs on your device. The app does not upload the photo to a recognition service. The working image is held temporarily during processing; transferring recognised values into a food requires your confirmation.',
          'A product photo that you separately choose to save remains in your local diary and its backup. Camera access is requested after you launch the scanner. You can revoke that permission in browser settings.'
        ]
      },
      {
        title: 'Connections to external services',
        paragraphs: [
          'Online search automatically sends your product query or scanned barcode to an external catalogue. The static website uses Open Food Facts; the version with a local server may also contact Tablycja Kalorijnosti. Some catalogue photos load from source websites. Built-in ingredient photos are supplied with the app.',
          'The standalone HTML file may download OCR files and language models from jsDelivr. The label image is not sent to that CDN. Hosting, catalogue, image and CDN providers receive ordinary request metadata, such as your IP address and browser information, under their own policies. GitHub Pages logs visitor IP addresses for security.'
        ]
      },
      {
        title: 'Managing and deleting your information',
        paragraphs: [
          'Settings lets you edit records, export a JSON backup, restore it or reset the active diary. To remove all local site information, possible recovery copies and caches, clear this site’s data using your browser.',
          'Downloaded JSON backups must be deleted separately. Clearing browser data does not remove third-party logs. Diary records remain until you clear them or the browser removes its storage. Remote recovery is unavailable without your own backup.'
        ]
      },
      {
        title: 'Shared devices and tracking',
        paragraphs: [
          'The app includes no advertising trackers or analytics counters of its own. A local profile does not protect the diary with a separate password. Anyone with access to your browser or backup file may see your records; protect those files and your device.'
        ]
      },
      {
        title: 'Changes to this notice',
        paragraphs: [
          'This version takes effect on 16 November 2026. The notice will be updated if server accounts, synchronisation or new processing methods are introduced. External links lead to services with their own privacy rules.'
        ]
      }
    ]
  }
};
