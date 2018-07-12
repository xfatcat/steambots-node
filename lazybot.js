// Общая работа со Steam
const SteamUser = require('steam-user');
// Генератор кода двухфакторной авторизации
const SteamTotp = require('steam-totp'); 
// Подгрузчик + парсер веб-страниц 
var request = require('request');
var Cheerio = require('cheerio');

settings = require('./cfg.json');

// Кэш картинок нужен для получения списка имеющихся товаров
const client = new SteamUser({"enablePicsCache": true,"promptSteamGuardCode":false});

// Хранилище данных парсера страниц со значаками и номер страницы
var g_Jar = request.jar();
request = request.defaults({"jar": g_Jar});
var g_Page = 1;


// Функция форматирования сообщений лога к виду "[день.месяц.год] [часы:минуты:секунды] : текст сообщения"
function log(message) {
	var date = new Date();
	var time = [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()];
	
    for(var i = 1; i < 6; i++) {
		if(time[i] < 10) {
			time[i] = '0' + time[i];
		}
	}
	console.log('[' + time[2] + '.' + time[1] + '.' + time[0] + '] [' + time[3] + ':' + time[4] + ':' + time[5] + '] : ' + message);
}

// Параметры для входа в аккаунт
client.logOn({ 
    accountName: settings.username,
    password: settings.password,
    twoFactorCode: SteamTotp.generateAuthCode(settings.sharedSecret)
 });

 var GlobalTimer;

client.on('loggedOn', () => {
	log('Авторизация прошла успешно!');
	log('Бот запущен.');
	client.setPersona(SteamUser.Steam.EPersonaState.Online);
	log('Проверяем список игр...');
	getIdleQueue();
	
});

// Получаем список игр
function getIdleQueue(){
	var IdleQueue = []; 
/*	"appid": appid,
	"name": name,
	"playtime": playtime,
	"drops": drops	 */
 	var totalDrops=0;
 	var gamesToIdle=0;
	var gamesToFarm=0;

	client.gamesPlayed([]);
		
	//?? вот тут пофиксить отваливающееся
	client.webLogOn();
	
	client.once('webSession', function(sessionID, cookies){
		cookies.forEach(function(cookie) {
			g_Jar.setCookie(cookie, 'https://steamcommunity.com');
		});
		
		request("https://steamcommunity.com/my/badges/?p="+g_Page, function(err, response, body) {
			// В случае обрыва/перебоев интернета загрузить страницу ещё раз 
			if(err || response.statusCode != 200) {
				log("Невозможно запросить страницу значка: " + (err || "HTTP error " + response.statusCode) + ". Повтор через 10 секунд...");
				setTimeout(getIdleQueue, 10000);
				return;
			}
			// Бути мэджик
			$_ = Cheerio.load(body);
			$_('.badge_row').each(function(i){
				var row = $_(this);
				var overlay = row.find('.badge_row_overlay');
				if(!overlay) {
					return;
				}
		    
				var match = overlay.attr('href').match(/\/gamecards\/(\d+)/);
				if(!match) {
					return;
				}
				
				// Находим айди продукта
				var appid = parseInt(match[1], 10);
			
				// Находим название продукта и убираем лишнее
				var name = row.find('.badge_title');
				name.find('.badge_view_details').remove();
				name = name.text().replace(/\n/g, '').replace(/\r/g, '').replace(/\t/g, '').trim();
				
				// Проверяем, куплен ли данный продукт (отсеиваем фритуплей и "акции на выходных")
				if(!client.picsCache.apps.hasOwnProperty(appid)) {
					//log("Пропускаем [" + appid + "] " + name + ", товар не приобретён.");
					return;
				}
			
				// Проверяем, выпадут ли ещё карты с данного продукта
				var drops = row.find('.progress_info_bold').text().match(/(\d+) card drops? remaining/);
				if(!drops) {
					return;
				}
				
				drops = parseInt(drops[1], 10);
				if(isNaN(drops) || drops < 1) {
					return;
				}
			
				// Проверяем общее время в игре
				var playtime = row.find('.badge_title_stats').html().match(/(\d+\.\d+) hrs on record/);
				if(!playtime) {
					playtime = 0.0;
				} else {
					playtime = parseFloat(playtime[1], 10);
					if(isNaN(playtime)) {
						playtime = 0.0;
					}
				}
				
				// Одновременно с формированием массива формируем статистику
				totalDrops=totalDrops+drops;
				if(playtime>=2.0){
					gamesToFarm++;
				}else gamesToIdle++;
				//log('Добавлено в очередь: ['+appid+'] '+name+', '+playtime+' часов сыграно, '+drops+' карт доступно.');
				IdleQueue.push({
					"appid": appid,
					"name": name,
					"playtime": playtime,
					"drops": drops
				});
							
			});
			if((gamesToFarm+gamesToIdle)==0){
				finish();
			}
			log((gamesToFarm+gamesToIdle)+' элементов добавлено в очередь. '+totalDrops+' карт доступно.');
			log(gamesToIdle+' элементов в очереди ожидания, '+gamesToFarm+' в очереди фарма.');
			if(gamesToIdle > 0){
				IdleLow(IdleQueue);
			}else if(gamesToFarm){
				log('Идёт фарм ['+IdleQueue[0].appid+'] '+IdleQueue[0].name+', '+IdleQueue[0].drops+' карт осталось.');
				client.gamesPlayed(IdleQueue[0].appid);
				setTimeout(getIdleQueue, (1000 * 60 * 60 * 15));
			}
			
		});
	});
	
}

function IdleLow(IdleQueue){
	var idleList=[];
	var maxTime=2.0;
	log('Выбираем игры с общим временем меньше 2 часов.');
	IdleQueue.some(function(app){
		if(app.playtime < 2.0){
			if(app.playtime < maxTime){
				maxTime = app.playtime;
			}
			log('Добавлена ['+app.appid+'] '+app.name+' в список ожидания под номером ('+(idleList.length+1)+').');
			idleList.push(app.appid);
		}
		return idleList.length == 32;
	});
	log('Набиваем 2 часа ожидания для '+idleList.length+' элементов. Список обновится через '+(2.0-maxTime)*60+' минут.' );
	client.gamesPlayed(idleList);
	
	setTimeout(getIdleQueue, (1000 * 60 * 60 * (2.0 - maxTime)));
};


// Завершение работы командой прерывания в консоль
process.on('SIGINT', function() {
	log("Получена команда прерывания. Завершение работы.");
	shutdown();	
});

// Завершение фарма
function finish(){
	log("Фарм завершён!");
	if(!settings.quit_after) {
		setPersona(SteamUser.Steam.EPersonaState.Snooze);
	}else shutdown();
}
// Функция отключения вынесена отдельно для вызова в прочих ситуациях
function shutdown(code=0) {
	clearTimeout(GlobalTimer);
	try{
		client.logOff();
		client.once('disconnected', function() {
			process.exit(code);
		});
	}catch(e){
		process.exit(code);
	}
	setTimeout(function() {
		process.exit(code);
	}, 500);
}