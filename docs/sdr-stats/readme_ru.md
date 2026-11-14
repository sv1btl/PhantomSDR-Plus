# Руководство по установке System Stats

Полное руководство по добавлению мониторинга сервера в реальном времени в ваше приложение PhantomSDR с помощью автоматизированного скрипта установки.

## Обзор

Эта функция добавляет кнопку **📊 Stats** в интерфейс PhantomSDR, которая отображает системную информацию в реальном времени:
- Загрузка ЦП, ядра, частота, температура и основные процессы
- Использование памяти (использовано/всего/процент)

Статистика автоматически обновляется каждые 5 секунд, пока открыто модальное окно.

> **Это не то же самое, что страница «Графики» в панели администратора.** Это окно показывает мгновенный срез, который обновляется, пока окно открыто, и не хранит историю. В панели администратора есть отдельная страница **Графики**: она снимает частоту процессора, нагрузку, температуру и число слушателей каждые 2 секунды и строит их за период от 15 минут до 24 часов — см. [руководство по панели администратора](../ru/ADMIN_PANEL_SETUP.md).

---

## Предварительные требования

- **Сервер Linux** (рекомендуется Ubuntu/Debian)
- **Подключение к Интернету** (для загрузки Node.js и пакетов)
- **Доступ Sudo** (для настройки службы systemd)
- **PhantomSDR-Plus** уже установлен и запущен
- **lm-sensors** (рекомендуется для температуры ЦП Intel/AMD — устанавливается автоматически скриптом)

---

## Методы установки

> [!NOTE]
> **Главный установщик уже это предлагает.** `./install.sh` — и четыре установщика для дистрибутивов — запускают `install-stats-server.sh` по умолчанию в рамках обычной установки PhantomSDR-Plus, так что на новой машине сервер статистики обычно уже на месте. Эта страница нужна, чтобы установить его отдельно или позже изменить порт, адрес либо службу.

### Вариант 1: Автоматизированная установка (Рекомендуется) ⭐

Автоматизированный скрипт всё сделает за вас.

#### Шаг 1: Запустите скрипт

```bash
cd ~/PhantomSDR-Plus
chmod +x install-stats-server.sh   # only if it is not already executable
./install-stats-server.sh
```

**ВАЖНО:** НЕ запускайте от имени root или с sudo. Запускайте от имени обычного пользователя.

#### Шаг 2: Следуйте интерактивным подсказкам

Скрипт проведёт вас через:

##### 1. **Установка Node.js** (при необходимости)
```
⚠ Node.js / npm is not installed
Would you like to install Node.js 22 via nvm now? (y/n): y
```
Скрипт устанавливает Node.js 22 через nvm, в любом дистрибутиве Linux — без root и без источника apt. Тот же вопрос задаётся, если Node.js установлен, но его версия ниже 22.

##### 2. **Каталог установки**
```
Installation directory [/home/user/sdr-stats-server]: 
```
Нажмите Enter для значения по умолчанию или укажите произвольный путь.

##### 3. **Настройка порта** (Улучшено!)
```
Port Configuration:
  Default port: 9011
  Common alternatives: 8080, 5000, 8888
Enter port number [9011]: 
```

##### 4. **Адрес сервера**
```
What is your server's public address?
Examples: Your_site_IP, 192.168.1.100, localhost
Server address: Your_site_IP
```
Введите публичный домен или IP-адрес вашего сервера.

##### 5. **Подтверждение**
```
Please confirm your settings:
  Installation directory: /home/user/sdr-stats-server
  Port: 9011
  Server address: Your_site_IP
  Stats URL will be: /stats on the public port 9000
Continue with these settings? (y/n): y
```

##### 6. **Настройка службы Systemd** (Опционально)
```
Would you like to set up the server as a system service (auto-start on boot)? (y/n): y
```

Рекомендуется: Выберите **y**, чтобы сервер запускался автоматически при загрузке.

#### Шаг 3: Установка завершена! ✓

Скрипт отобразит сводку:
```
Configuration Summary:
  Installation: /home/user/sdr-stats-server
  Port: 9011
  API URL: http://localhost:9011/api/system-stats (inside this computer)

Next steps:

Nothing to edit: configure-station.sh already pointed the receiver page
at /stats, which the proxy on port 9000 carries to this
server. No extra port has to be opened on the router.

╔════════════════════════════════════════════════╗
║          Installation Complete! ✓              ║
╚════════════════════════════════════════════════╝
```

---

## Настройте ваше приложение PhantomSDR

На станции, настроенной через `install.sh`, здесь ничего делать не нужно: вопросы станции уже записали `siteStats` как `/stats`, а `proxy.py` передаёт его через публичный порт 9000, поэтому на маршрутизаторе другие порты не открываются.

### `site_information.json`

Строка в `site_information.json` выглядит так:

```json
{
	"siteSysop": "your name or callsign",
	"siteSysopEmailAddress": "mail@mail.net",
	"siteGridSquare": "QTH locator",
	"siteCity": "City Country",
	"siteInformation": "https://github.com/sv1btl/PhantomSDR-Plus",
	"siteHardware": "Hardware you are using, ",
	"siteSoftware": "Software you are using",
	"siteReceiver": "Receiver model",
	"siteAntenna": "Receiving Antenna.",
	"siteNote": "This is a bright new open-source WebSDR project, under active development.",
	"siteIP": "http://Your_site_IP:9000",
  "siteStats": "/stats",
  "siteSDRBaseFrequency": 0,
  "siteSDRBandwidth": 30000000,
  "siteRegion": 1,
  "siteChatEnabled": true
}
```

---

## Тестирование установки

### Тест 1: Проверьте конечную точку API

```bash
curl http://localhost:9011/api/system-stats
```

Ожидаемый вывод (JSON):
```json
{
  "cpu": {
    "usage": 45.2,
    "cores": 8,
    "coresUsed": 1.3,
    "temperature": 62.5,
    "frequency": {
      "current": 3.0,
      "max": 3.9,
      "limit": 4.4
    },
    "topProcesses": [
      {"name": "node", "cpu": 12.5},
      {"name": "phantomsdr", "cpu": 8.3}
    ]
  },
  "memory": {
    "used": 8.5,
    "total": 16,
    "percent": 53
  }
}
```

### Тест 2: Проверьте статус службы

Если вы установили её как службу:

```bash
sudo systemctl status sdr-stats.service
```

Должно показать: `Active: active (running)`

### Тест 3: Протестируйте в браузере

1. Откройте ваш веб-интерфейс PhantomSDR
2. Прокрутите до раздела **Additional Info**
3. Нажмите кнопку **Open Additional Info**
4. Найдите кнопку **📊 Stats** рядом с информацией о ПК
5. Нажмите на неё, чтобы открыть модальное окно статистики
6. Убедитесь, что статистика отображается и обновляется

---

## Управление службой

Если вы установили её как службу systemd, используйте эти команды:

```bash
# Start the service
sudo systemctl start sdr-stats.service

# Stop the service
sudo systemctl stop sdr-stats.service

# Restart the service (after updating files)
sudo systemctl restart sdr-stats.service

# Check status
sudo systemctl status sdr-stats.service

# View real-time logs
sudo journalctl -u sdr-stats.service -f

# View last 50 log entries
sudo journalctl -u sdr-stats.service -n 50

# Enable auto-start on boot
sudo systemctl enable sdr-stats.service

# Disable auto-start
sudo systemctl disable sdr-stats.service

# Edit service
sudo nano /etc/systemd/system/sdr-stats.service

# Delete service
sudo rm /etc/systemd/system/sdr-stats.service
```

---

## Изменение порта после установки

Запустите `bash configure-station.sh` ещё раз и задайте статистике новый порт. Скрипт переносит вместе с ним настройку службы и прокси; страница по-прежнему использует `/stats`, так что больше ничего не меняется и на маршрутизаторе ничего не открывается.

---

## Устранение неполадок

### Проблема: Порт уже используется

**Ошибка:**
```
Error: listen EADDRINUSE: address already in use :::9011
```

**Решение:**

1. Найдите, что использует порт:
```bash
sudo lsof -i :9011
```

2. Остановите этот процесс:
```bash
kill <PID>
# or
sudo systemctl stop sdr-stats.service
```

3. Запустите службу снова:
```bash
sudo systemctl start sdr-stats.service
```

**Альтернатива:** Запустите скрипт установки снова и выберите другой порт по запросу.

### Проблема: Служба не запускается

**Ошибка:**
```
status=217/USER
```

**Решение:**

1. Проверьте файл службы:
```bash
cat /etc/systemd/system/sdr-stats.service
```

2. Убедитесь, что строка `User=` соответствует вашему имени пользователя:
```bash
whoami
```

3. Отредактируйте при необходимости:
```bash
sudo nano /etc/systemd/system/sdr-stats.service
```

4. Перезагрузите и перезапустите:
```bash
sudo systemctl daemon-reload
sudo systemctl restart sdr-stats.service
```

### Проблема: Статистика не отображается в браузере

**Симптомы:** Модальное окно открывается, но данных нет, или отображаются значения 0

**Решения:**

1. Проверьте консоль браузера (F12) на наличие ошибок
2. Убедитесь, что API доступен:
```bash
curl http://localhost:9011/api/system-stats
```
3. Проверьте, что служба запущена:
```bash
sudo systemctl status sdr-stats.service
```
4. Проверьте, что `siteStats` в `site_information.json` равен `/stats` и что запущен `proxy.py`
5. Проверьте наличие ошибок CORS — убедитесь, что сервер разрешает ваш домен

### Проблема: Температура показывает null

**Причина:** Считывание температуры недоступно в вашей системе

**Решения:**

1. **Для большинства систем Linux:** Проверьте, существует ли тепловая зона:
```bash
cat /sys/class/thermal/thermal_zone0/temp
```

2. **Установите lm-sensors:**
```bash
sudo apt-get install lm-sensors
sudo sensors-detect
sensors
```

3. **Примечание:** Температура может быть недоступна на:
- Виртуальных машинах
- Некоторых VPS-провайдерах
- Windows Subsystem for Linux (WSL)
- Системах, отличных от Linux

Это нормально — остальная статистика по-прежнему будет работать!

### Проблема: Node.js не найден

**Ошибка:**
```
node: command not found
```

**Решение:**

1. Установите Node.js:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22 && nvm use 22 && nvm alias default 22
```

2. Проверьте:
```bash
node --version
npm --version
```

---

## Что вы увидите

После установки и настройки модальное окно статистики отображает:

### 🖥️ Раздел ЦП
- **Загрузка**: Общий процент использования ЦП
- **Ядра**: Сколько процессора реально используется, выраженное в целых ядрах — например `1.3 / 12 in use` означает, что машина выполняет работу 1,3 ядра. Величина точная и не требует никакого порога. Это намеренно не подсчёт занятых ядер: планировщик размазывает работу одного ядра по многим, поэтому такой подсчёт мог бы лишь приблизить это число.
- **Частота**: Средняя текущая частота ЦП по всем ядрам в ГГц, с самым быстрым ядром в скобках (если доступна)
- **Температура**: Температура ЦП в градусах Цельсия (если доступна), с цветовой маркировкой: 🟢 зелёный до 69 °C, 🟠 оранжевый 70-79 °C, 🔴 красный от 80 °C и выше
- **Основные процессы**: 5 процессов, наиболее нагружающих ЦП, с цветовой маркировкой процентов:
  - 🟢 Зелёный: до 50 % ЦП
  - 🟠 Оранжевый: 51-80 % ЦП
  - 🔴 Красный: выше 80 % ЦП

### 💾 Раздел памяти
- **Использовано**: Используемая память (ГБ)
- **Всего**: Общий объём системной памяти (ГБ)
- **Использование**: Процент использования памяти (с цветовой маркировкой)

### ♻️ Автообновление
- Статистика обновляется каждые **5 секунд**, пока открыто модальное окно
- Обновление прекращается при закрытии модального окна (экономит ресурсы)

---


## Примечания по безопасности

- Сервер статистики принимает подключения из любого источника (CORS: *)
- Для продакшена рассмотрите возможность ограничения CORS только вашим доменом
- Выбор порта проверяет ввод и наличие конфликтов
- Считывание температуры ЦП доступно только для чтения и безопасно
- Никакая конфиденциальная системная информация не раскрывается

---

## Поддержка и ресурсы

### Удаление сервера статистики:
- Удалите папку /sdr-stats-server
- Если вы создали службу, просто удалите её с помощью:
```bash
sudo rm /etc/systemd/system/sdr-stats.service"`
```
- Измените `App.svelte`: Найдите часть кода:
```
                   <!-- In case you don't want the Stats Button to appear, please comment this button section (12 lines)-->                     
                    <!-- System Stats Button -->
                    <button
                      type="button"
                      class="glass-button text-white py-1 px-2 ml-2 rounded text-xs"
                      on:click={openSystemStats}
                      title="System Resources"
                      aria-haspopup="dialog"
                      aria-expanded={showSystemStats}
                      aria-controls="system-stats-dialog"
                      style="color:rgba(0, 225, 255, 0.993); font-size: 0.75rem;"
                    >
                      📊 Stats
                    </button>
  ```
  и замените на:
```
                   <!-- In case you don't want the Stats Button to appear, please comment this button section (12 lines)-->                     
                    <!-- System Stats Button -->
                    <!--
                    <button
                      type="button"
                      class="glass-button text-white py-1 px-2 ml-2 rounded text-xs"
                      on:click={openSystemStats}
                      title="System Resources"
                      aria-haspopup="dialog"
                      aria-expanded={showSystemStats}
                      aria-controls="system-stats-dialog"
                      style="color:rgba(0, 225, 255, 0.993); font-size: 0.75rem;"
                    >
                      📊 Stats
                    </button>
                    -->
  ```                    
- Перекомпилируйте с помощью команды:
```bash
  cd PhantomSDR-Plus
 ./recompile.sh
 ```
- Перезагрузите ПК и запустите сервер

---

## Краткий справочник команд

```bash
# Installation
cd ~/PhantomSDR-Plus
chmod +x install-stats-server.sh
./install-stats-server.sh

# Service Management
sudo systemctl start sdr-stats.service      # Start
sudo systemctl stop sdr-stats.service       # Stop
sudo systemctl restart sdr-stats.service    # Restart
sudo systemctl status sdr-stats.service     # Status
sudo journalctl -u sdr-stats.service -f     # Logs

# Testing
curl http://localhost:9011/api/system-stats # Test API
curl http://localhost:9011/api/health       # Health check

# Troubleshooting
sudo lsof -i :9011                          # Check port
whoami                                      # Check username
node --version                              # Check Node.js
```

Приятного мониторинга! 📊🚀
