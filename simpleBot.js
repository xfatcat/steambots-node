 // Coded by xfatcat
 // Please, keep the credits c:
/*
	Шаблон для входа бота в имеющийся Steam-профиль и смены статуса на видимый "онлайн".
	Поддерживает как стандартный вход по паре логин + пароль с дополнительным вводом 
	кода двухфакторной авторизации с мобильного устройства, так и "тихий" вход без 
	дополнительной авторизации (при условии того, что аккаунт Steam привязан к SDA).
*/
/* После установки Node.JS в командной строке от имени администратора
   выполнить установку всех требуемых модулей:
   npm install steam-user 
   npm install steam-totp
   
   Для удобства запуска можно создать bat-файл с содержанием:
   cmd node simplebot.js
   
   Остановка работы бота: прерывание (Ctrl+C) в командной строке, из которой он был запущен.
*/
const SteamUser = require('steam-user');
const SteamTotp = require('steam-totp');

/* Заводим нового "пользователя" Steam: */
const bot = new SteamUser();
/* Если используется внешний файл настройки: */
//const config = require('./simplebot-config.json');

/* Данные для входа (без внешнего файла настройки). 
   Если закомментировать все строки с использованием 2-факторной авторизации, 
   то после запуска бота консолью будет предложено ввести код из мобильного приложения Steam.
*/
const logOnOptions = {
	
	/* Логин */
	accountName: 'ваш логин',  
	
	/* Пароль */
	password: 'ваш пароль',   
    
	/* Генерируемый вручную код 2-факторной авторизации. 
	   Для генерации используется sharedSecret код из ma-файла SDA привязанного к нему аккаунта.
	   Генерация происходит с помощью SteamTotp
	*/
	twoFactorCode: SteamTotp.generateAuthCode('ваш sharedSecred код') 
};

// /* Данные для входа (с внешним файлом настройки) */
//const logOnOptions = {
//	
//	/* Логин */
//	accountName: config.username,  
//	
//	/* Пароль */
//	password: config.password, 
//  
//	/* Генерируемый вручную код 2-факторной авторизации. 
//	   Для генерации используется sharedSecret код из ma-файла SDA привязанного к нему аккаунта.
//	   Генерация происходит с помощью SteamTotp
//	*/
//	twoFactorCode: SteamTotp.generateAuthCode(config.sharedSecret)
//};

/* Входим в сеть, используя авторизационные данные */
bot.logOn(logOnOptions)

bot.on('loggedOn', () => {
	console.log('Вход в аккаунт произведён успешно!');
	bot.setPersona(SteamUser.Steam.EPersonaState.Online);
	console.log('Бот онлайн.');
});
