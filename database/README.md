# Atlantic Core — Database Setup

This folder contains **`atc.sql`** — the complete Atlantic Core database schema in
a single file, the same way QBCore ships `qbcore.sql` and ESX ships
`es_extended.sql`. Import it once into a fresh database and the server is ready
to use.

- **File:** `atc.sql` (366 ordered migrations, ~365 tables, UTF-8 `utf8mb4`)
- **Database engine:** MariaDB 11 (recommended) or MySQL 8
- **Target database name:** `atc`

> The database is the same on **FiveM and VMP** — the schema and the import steps
> below do not depend on your platform. Only the `server.cfg` you point at the ATC
> API differs; see [docs/hosting/PUBLISHING.md](../docs/hosting/PUBLISHING.md).

<a id="languages"></a>

<div align="center">

### 🌐 Choose your language — click a code to jump to that section

**[🇬🇧 EN](#english)**  ·  **[🇮🇷 FA — فارسی](#فارسی-farsi)**  ·  **[🇹🇷 TR — Türkçe](#türkçe-turkish)**  ·  **[🇪🇸 ES — Español](#español-spanish)**  ·  **[🇩🇪 DE — Deutsch](#deutsch-german)**

</div>

Click **EN**, **FA**, **TR**, **ES**, or **DE** above to jump straight to the
instructions in that language. / روی کد زبان بالا کلیک کنید تا به همان بخش بروید.
/ Yukarıdaki dil koduna tıklayın. / Haz clic en el código de idioma de arriba. /
Klicke oben auf das Sprachkürzel.

---

## English

### What you need (Windows)
- A running MariaDB or MySQL server. The easiest options:
  - **XAMPP** (includes MariaDB + phpMyAdmin), or
  - **HeidiSQL** + a MariaDB install, or
  - the project's Docker setup (`infra/docker-compose.yml`) which creates the
    database for you automatically.

### Option A — Command line (fastest)
Open **PowerShell** or **CMD** in this `database` folder and run:

```bat
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS atc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p atc < atc.sql
```

Enter your MySQL/MariaDB root password when asked. That's it — the schema is now
installed.

> Tip: if `mysql` is "not recognized", add its `bin` folder to your PATH, e.g.
> `C:\xampp\mysql\bin` (XAMPP) or `C:\Program Files\MariaDB 11\bin`. Or just use
> the helper: double-click **`import-windows.bat`** in this folder.

### Option B — phpMyAdmin (XAMPP, point-and-click)
1. Start **Apache** and **MySQL** in the XAMPP Control Panel.
2. Open `http://localhost/phpmyadmin`.
3. Click **New** (left sidebar), type the database name **`atc`**, set collation
   to `utf8mb4_unicode_ci`, and click **Create**.
4. Select the `atc` database, open the **Import** tab.
5. Choose the file **`atc.sql`**, scroll down, and click **Import**.

### Option C — HeidiSQL (point-and-click)
1. Connect to your server in HeidiSQL.
2. Right-click in the database list → **Create new → Database** → name it `atc`
   (collation `utf8mb4_unicode_ci`).
3. Select the `atc` database, then menu **File → Load SQL file…** → pick
   `atc.sql`.
4. Press **F9** (or the blue ▶ "Run" button) to execute.

### Connect the server to the database

ATC does **not** connect to MySQL from the game server. The Lua resources talk to
the **ATC API**, and only the API talks to the database:

```
FiveM / VMP  →  ATC API (Node)  →  MariaDB
```

So the database credentials belong to the API, and the game server only needs to
know where the API is. This is the same on both platforms.

**1 — Give the API the database** (in `infra/.env`, or the API's environment):

```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=atc
DB_USER=atc
DB_PASSWORD=YOUR_PASSWORD
```

`DB_NAME`, `DB_USER` and `DB_PASSWORD` are **required** — the API refuses to start
without them. `DB_HOST` defaults to `127.0.0.1`, `DB_PORT` to `3306`.

**2 — Point the game server at the API** — in your `server.cfg`, from
`infra/server.cfg.example` (FiveM) or `infra/server.cfg.vmp.example` (VMP):

```cfg
set atc_api_url   "http://localhost:3000"
set atc_api_token "your_api_token"   # must match ATC_API_TOKEN in infra/.env
```

Create that `atc` user (or use `root` for local testing):

```sql
CREATE USER 'atc'@'localhost' IDENTIFIED BY 'YOUR_PASSWORD';
GRANT ALL PRIVILEGES ON atc.* TO 'atc'@'localhost';
FLUSH PRIVILEGES;
```

> **Not `mysql_connection_string`.** That convar is the QBCore/ESX pattern; it is
> not read anywhere in ATC, so setting it does nothing.

You're done. Start the API, then your game server.

<sub>[↑ Back to language menu](#languages)</sub>

---

## فارسی (Farsi)

### پیش‌نیازها (ویندوز)
- یک سرور MariaDB یا MySQL در حال اجرا. ساده‌ترین گزینه‌ها:
  - **XAMPP** (شامل MariaDB و phpMyAdmin)، یا
  - **HeidiSQL** به همراه نصب MariaDB، یا
  - راه‌اندازی Docker پروژه (`infra/docker-compose.yml`) که دیتابیس را خودکار می‌سازد.

### روش A — خط فرمان (سریع‌ترین)
**PowerShell** یا **CMD** را در همین پوشه‌ی `database` باز کنید و اجرا کنید:

```bat
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS atc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p atc < atc.sql
```

هنگام درخواست، رمز عبور root را وارد کنید. تمام شد — ساختار دیتابیس نصب شد.

> نکته: اگر دستور `mysql` شناخته نشد، مسیر پوشه‌ی `bin` آن را به PATH اضافه کنید،
> مثلاً `C:\xampp\mysql\bin` (در XAMPP) یا `C:\Program Files\MariaDB 11\bin`.
> یا کافیست روی فایل **`import-windows.bat`** در همین پوشه دوبار کلیک کنید.

### روش B — phpMyAdmin (در XAMPP، با کلیک)
1. در کنترل‌پنل XAMPP، گزینه‌های **Apache** و **MySQL** را روشن کنید.
2. آدرس `http://localhost/phpmyadmin` را باز کنید.
3. روی **New** (نوار کناری چپ) کلیک کنید، نام دیتابیس را **`atc`** بنویسید،
   collation را روی `utf8mb4_unicode_ci` بگذارید و **Create** را بزنید.
4. دیتابیس `atc` را انتخاب کرده و به تب **Import** بروید.
5. فایل **`atc.sql`** را انتخاب کنید، پایین صفحه بروید و **Import** را بزنید.

### روش C — HeidiSQL (با کلیک)
1. در HeidiSQL به سرور خود وصل شوید.
2. در لیست دیتابیس‌ها راست‌کلیک کنید → **Create new → Database** → نام `atc`
   (collation برابر `utf8mb4_unicode_ci`).
3. دیتابیس `atc` را انتخاب کنید، سپس از منو **File → Load SQL file…** فایل
   `atc.sql` را انتخاب کنید.
4. کلید **F9** (یا دکمه‌ی آبی ▶ «Run») را برای اجرا بزنید.

### اتصال سرور به دیتابیس

ATC از سمت سرور بازی **مستقیماً** به MySQL وصل نمی‌شود. منابع Lua با **ATC API**
حرف می‌زنند و فقط API با دیتابیس کار دارد:

```
FiveM / VMP  →  ATC API (Node)  →  MariaDB
```

بنابراین اطلاعات دیتابیس متعلق به API است و سرور بازی فقط باید بداند API کجاست.
این موضوع روی هر دو پلتفرم یکسان است.

**۱ — دیتابیس را به API بدهید** (در `infra/.env` یا محیط اجرای API):

```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=atc
DB_USER=atc
DB_PASSWORD=YOUR_PASSWORD
```

مقادیر `DB_NAME`، `DB_USER` و `DB_PASSWORD` **الزامی** هستند — API بدون آن‌ها اصلاً
بالا نمی‌آید. مقدار پیش‌فرض `DB_HOST` برابر `127.0.0.1` و `DB_PORT` برابر `3306` است.

**۲ — سرور بازی را به API وصل کنید** — در `server.cfg` خودتان، از روی
`infra/server.cfg.example` (فایوام) یا `infra/server.cfg.vmp.example` (VMP):

```cfg
set atc_api_url   "http://localhost:3000"
set atc_api_token "your_api_token"   # باید با ATC_API_TOKEN در infra/.env یکی باشد
```

کاربر `atc` را بسازید (یا برای تست محلی از `root` استفاده کنید):

```sql
CREATE USER 'atc'@'localhost' IDENTIFIED BY 'YOUR_PASSWORD';
GRANT ALL PRIVILEGES ON atc.* TO 'atc'@'localhost';
FLUSH PRIVILEGES;
```

> **نه `mysql_connection_string`.** آن convar الگوی QBCore/ESX است و در هیچ‌جای ATC
> خوانده نمی‌شود؛ ست کردنش هیچ کاری نمی‌کند.

تمام شد. اول API و سپس سرور بازی را اجرا کنید.

<sub>[↑ بازگشت به منوی زبان‌ها](#languages)</sub>

---

## Türkçe (Turkish)

### Gerekenler (Windows)
- Çalışan bir MariaDB veya MySQL sunucusu. En kolay seçenekler:
  - **XAMPP** (MariaDB + phpMyAdmin içerir), veya
  - **HeidiSQL** + bir MariaDB kurulumu, veya
  - projenin Docker kurulumu (`infra/docker-compose.yml`) — veritabanını sizin
    için otomatik oluşturur.

### Seçenek A — Komut satırı (en hızlısı)
Bu `database` klasöründe **PowerShell** ya da **CMD** açın ve şunu çalıştırın:

```bat
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS atc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p atc < atc.sql
```

İstendiğinde MySQL/MariaDB root parolanızı girin. Hepsi bu — şema kuruldu.

> İpucu: `mysql` "tanınmıyor" hatası alırsanız, `bin` klasörünü PATH'e ekleyin,
> örn. `C:\xampp\mysql\bin` (XAMPP) veya `C:\Program Files\MariaDB 11\bin`.
> Ya da bu klasördeki **`import-windows.bat`** dosyasına çift tıklayın.

### Seçenek B — phpMyAdmin (XAMPP, tıkla-çalıştır)
1. XAMPP Kontrol Panelinde **Apache** ve **MySQL**'i başlatın.
2. `http://localhost/phpmyadmin` adresini açın.
3. Sol menüde **New**'e tıklayın, veritabanı adını **`atc`** yazın, collation'ı
   `utf8mb4_unicode_ci` seçin ve **Create**'e basın.
4. `atc` veritabanını seçin, **Import** sekmesini açın.
5. **`atc.sql`** dosyasını seçin, aşağı inip **Import**'a basın.

### Seçenek C — HeidiSQL (tıkla-çalıştır)
1. HeidiSQL'de sunucunuza bağlanın.
2. Veritabanı listesinde sağ tıklayın → **Create new → Database** → adı `atc`
   (collation `utf8mb4_unicode_ci`).
3. `atc` veritabanını seçin, ardından menüden **File → Load SQL file…** ile
   `atc.sql` dosyasını seçin.
4. Çalıştırmak için **F9**'a (veya mavi ▶ "Run" düğmesine) basın.

### Sunucuyu veritabanına bağlama

ATC, oyun sunucusundan MySQL'e **doğrudan bağlanmaz**. Lua kaynakları **ATC API**
ile konuşur ve veritabanıyla yalnızca API ilgilenir:

```
FiveM / VMP  →  ATC API (Node)  →  MariaDB
```

Yani veritabanı kimlik bilgileri API'ye aittir; oyun sunucusunun bilmesi gereken
tek şey API'nin nerede olduğudur. Bu, her iki platformda da aynıdır.

**1 — Veritabanını API'ye verin** (`infra/.env` içinde veya API'nin ortamında):

```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=atc
DB_USER=atc
DB_PASSWORD=SIFRENIZ
```

`DB_NAME`, `DB_USER` ve `DB_PASSWORD` **zorunludur** — API bunlar olmadan hiç
başlamaz. `DB_HOST` varsayılanı `127.0.0.1`, `DB_PORT` varsayılanı `3306`'dır.

**2 — Oyun sunucusunu API'ye yönlendirin** — `server.cfg` dosyanızda,
`infra/server.cfg.example` (FiveM) veya `infra/server.cfg.vmp.example` (VMP)
örneğinden:

```cfg
set atc_api_url   "http://localhost:3000"
set atc_api_token "your_api_token"   # infra/.env içindeki ATC_API_TOKEN ile aynı olmalı
```

`atc` kullanıcısını oluşturun (veya yerel test için `root` kullanın):

```sql
CREATE USER 'atc'@'localhost' IDENTIFIED BY 'SIFRENIZ';
GRANT ALL PRIVILEGES ON atc.* TO 'atc'@'localhost';
FLUSH PRIVILEGES;
```

> **`mysql_connection_string` değil.** O convar QBCore/ESX kalıbıdır; ATC'nin
> hiçbir yerinde okunmaz, dolayısıyla ayarlamanız hiçbir şey yapmaz.

Bitti. Önce API'yi, sonra oyun sunucunuzu başlatın.

<sub>[↑ Dil menüsüne dön](#languages)</sub>

---

## Español (Spanish)

### Qué necesitas (Windows)
- Un servidor MariaDB o MySQL en ejecución. Las opciones más fáciles:
  - **XAMPP** (incluye MariaDB + phpMyAdmin), o
  - **HeidiSQL** + una instalación de MariaDB, o
  - la configuración Docker del proyecto (`infra/docker-compose.yml`), que crea
    la base de datos automáticamente.

### Opción A — Línea de comandos (la más rápida)
Abre **PowerShell** o **CMD** en esta carpeta `database` y ejecuta:

```bat
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS atc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p atc < atc.sql
```

Introduce la contraseña root de MySQL/MariaDB cuando se solicite. Listo — el
esquema ya está instalado.

> Consejo: si `mysql` "no se reconoce", añade su carpeta `bin` al PATH, p. ej.
> `C:\xampp\mysql\bin` (XAMPP) o `C:\Program Files\MariaDB 11\bin`. O simplemente
> haz doble clic en **`import-windows.bat`** en esta carpeta.

### Opción B — phpMyAdmin (XAMPP, con clics)
1. Inicia **Apache** y **MySQL** en el Panel de Control de XAMPP.
2. Abre `http://localhost/phpmyadmin`.
3. Haz clic en **New** (barra lateral izquierda), escribe el nombre **`atc`**,
   pon el cotejamiento en `utf8mb4_unicode_ci` y pulsa **Create**.
4. Selecciona la base de datos `atc` y abre la pestaña **Import**.
5. Elige el archivo **`atc.sql`**, baja y pulsa **Import**.

### Opción C — HeidiSQL (con clics)
1. Conéctate a tu servidor en HeidiSQL.
2. Clic derecho en la lista de bases de datos → **Create new → Database** →
   nómbrala `atc` (cotejamiento `utf8mb4_unicode_ci`).
3. Selecciona la base de datos `atc`, luego menú **File → Load SQL file…** y
   elige `atc.sql`.
4. Pulsa **F9** (o el botón azul ▶ "Run") para ejecutar.

### Conectar el servidor a la base de datos

ATC **no** se conecta a MySQL desde el servidor de juego. Los recursos Lua hablan
con la **ATC API**, y solo la API habla con la base de datos:

```
FiveM / VMP  →  ATC API (Node)  →  MariaDB
```

Así que las credenciales de la base de datos pertenecen a la API, y el servidor de
juego solo necesita saber dónde está la API. Esto es igual en ambas plataformas.

**1 — Dale la base de datos a la API** (en `infra/.env`, o en el entorno de la API):

```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=atc
DB_USER=atc
DB_PASSWORD=TU_CONTRASENA
```

`DB_NAME`, `DB_USER` y `DB_PASSWORD` son **obligatorias**: la API se niega a
arrancar sin ellas. `DB_HOST` usa `127.0.0.1` por defecto y `DB_PORT`, `3306`.

**2 — Apunta el servidor de juego a la API** — en tu `server.cfg`, a partir de
`infra/server.cfg.example` (FiveM) o `infra/server.cfg.vmp.example` (VMP):

```cfg
set atc_api_url   "http://localhost:3000"
set atc_api_token "your_api_token"   # debe coincidir con ATC_API_TOKEN en infra/.env
```

Crea el usuario `atc` (o usa `root` para pruebas locales):

```sql
CREATE USER 'atc'@'localhost' IDENTIFIED BY 'TU_CONTRASENA';
GRANT ALL PRIVILEGES ON atc.* TO 'atc'@'localhost';
FLUSH PRIVILEGES;
```

> **No es `mysql_connection_string`.** Esa convar es el patrón de QBCore/ESX; no se
> lee en ninguna parte de ATC, así que configurarla no hace nada.

Listo. Inicia primero la API y luego tu servidor de juego.

<sub>[↑ Volver al menú de idiomas](#languages)</sub>

---

## Deutsch (German)

### Was du brauchst (Windows)
- Einen laufenden MariaDB- oder MySQL-Server. Die einfachsten Optionen:
  - **XAMPP** (enthält MariaDB + phpMyAdmin), oder
  - **HeidiSQL** + eine MariaDB-Installation, oder
  - das Docker-Setup des Projekts (`infra/docker-compose.yml`), das die Datenbank
    automatisch anlegt.

### Variante A — Kommandozeile (am schnellsten)
Öffne **PowerShell** oder **CMD** in diesem `database`-Ordner und führe aus:

```bat
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS atc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p atc < atc.sql
```

Gib auf Nachfrage dein MySQL/MariaDB-root-Passwort ein. Fertig — das Schema ist
installiert.

> Tipp: Falls `mysql` "nicht erkannt" wird, füge den `bin`-Ordner zum PATH hinzu,
> z. B. `C:\xampp\mysql\bin` (XAMPP) oder `C:\Program Files\MariaDB 11\bin`.
> Oder doppelklicke einfach auf **`import-windows.bat`** in diesem Ordner.

### Variante B — phpMyAdmin (XAMPP, per Klick)
1. Starte **Apache** und **MySQL** im XAMPP Control Panel.
2. Öffne `http://localhost/phpmyadmin`.
3. Klicke links auf **New**, gib als Namen **`atc`** ein, setze die Kollation auf
   `utf8mb4_unicode_ci` und klicke **Create**.
4. Wähle die Datenbank `atc` und öffne den Reiter **Import**.
5. Wähle die Datei **`atc.sql`**, scrolle nach unten und klicke **Import**.

### Variante C — HeidiSQL (per Klick)
1. Verbinde dich in HeidiSQL mit deinem Server.
2. Rechtsklick in der Datenbankliste → **Create new → Database** → Name `atc`
   (Kollation `utf8mb4_unicode_ci`).
3. Wähle die Datenbank `atc`, dann Menü **File → Load SQL file…** und wähle
   `atc.sql`.
4. Drücke **F9** (oder den blauen ▶ "Run"-Button) zum Ausführen.

### Server mit der Datenbank verbinden

ATC verbindet sich **nicht** vom Gameserver aus mit MySQL. Die Lua-Ressourcen
sprechen mit der **ATC-API**, und nur die API spricht mit der Datenbank:

```
FiveM / VMP  →  ATC API (Node)  →  MariaDB
```

Die Datenbank-Zugangsdaten gehören also zur API, und der Gameserver muss nur
wissen, wo die API liegt. Das ist auf beiden Plattformen identisch.

**1 — Der API die Datenbank geben** (in `infra/.env` oder der Umgebung der API):

```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=atc
DB_USER=atc
DB_PASSWORD=DEIN_PASSWORT
```

`DB_NAME`, `DB_USER` und `DB_PASSWORD` sind **Pflicht** — ohne sie startet die API
gar nicht. `DB_HOST` ist standardmäßig `127.0.0.1`, `DB_PORT` ist `3306`.

**2 — Den Gameserver auf die API zeigen lassen** — in deiner `server.cfg`, auf
Basis von `infra/server.cfg.example` (FiveM) oder `infra/server.cfg.vmp.example`
(VMP):

```cfg
set atc_api_url   "http://localhost:3000"
set atc_api_token "your_api_token"   # muss ATC_API_TOKEN in infra/.env entsprechen
```

Lege den `atc`-Benutzer an (oder nutze `root` für lokale Tests):

```sql
CREATE USER 'atc'@'localhost' IDENTIFIED BY 'DEIN_PASSWORT';
GRANT ALL PRIVILEGES ON atc.* TO 'atc'@'localhost';
FLUSH PRIVILEGES;
```

> **Nicht `mysql_connection_string`.** Diese Convar ist das QBCore/ESX-Muster; sie
> wird nirgends in ATC gelesen — sie zu setzen bewirkt nichts.

Fertig. Starte zuerst die API, dann deinen Gameserver.

<sub>[↑ Zurück zur Sprachauswahl](#languages)</sub>

---

## Notes

- `atc.sql` is generated from the project's ordered migrations in
  `packages/*/migrations`. If you develop ATC and add migrations, regenerate this
  file so a fresh import always matches the latest schema.
- The schema is idempotent (`CREATE TABLE IF NOT EXISTS`), so re-importing into an
  existing `atc` database will not drop your data — but always back up first.
- No game assets or seed/sample data are included; this is schema only.

— Atlantic Core, an open project by Naiemi Group.
