# Atlantic Core — Database Setup

This folder contains **`atc.sql`** — the complete Atlantic Core database schema in
a single file, the same way QBCore ships `qbcore.sql` and ESX ships
`es_extended.sql`. Import it once into a fresh database and the server is ready
to use.

- **File:** `atc.sql` (366 ordered migrations, ~365 tables, UTF-8 `utf8mb4`)
- **Database engine:** MariaDB 11 (recommended) or MySQL 8
- **Target database name:** `atc`

Pick your language below. / زبان خود را در ادامه انتخاب کنید. / Aşağıdan dilinizi
seçin. / Elige tu idioma abajo. / Wähle unten deine Sprache.

- [English](#english)
- [فارسی (Farsi)](#فارسی-farsi)
- [Türkçe (Turkish)](#türkçe-turkish)
- [Español (Spanish)](#español-spanish)
- [Deutsch (German)](#deutsch-german)

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
Tell ATC how to reach the database. Set it in your FiveM `server.cfg`
(see `infra/server.cfg.example`) and/or in `infra/.env`:

```
set mysql_connection_string "mysql://atc:YOUR_PASSWORD@localhost/atc?charset=utf8mb4"
```

Create that `atc` user (or use `root` for local testing):

```sql
CREATE USER 'atc'@'localhost' IDENTIFIED BY 'YOUR_PASSWORD';
GRANT ALL PRIVILEGES ON atc.* TO 'atc'@'localhost';
FLUSH PRIVILEGES;
```

You're done. Start your server and the resources will use the new database.

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
به ATC بگویید چطور به دیتابیس وصل شود. این مقدار را در `server.cfg` فایوام
(نمونه: `infra/server.cfg.example`) و/یا در `infra/.env` تنظیم کنید:

```
set mysql_connection_string "mysql://atc:YOUR_PASSWORD@localhost/atc?charset=utf8mb4"
```

کاربر `atc` را بسازید (یا برای تست محلی از `root` استفاده کنید):

```sql
CREATE USER 'atc'@'localhost' IDENTIFIED BY 'YOUR_PASSWORD';
GRANT ALL PRIVILEGES ON atc.* TO 'atc'@'localhost';
FLUSH PRIVILEGES;
```

تمام شد. سرور را اجرا کنید تا منابع از دیتابیس جدید استفاده کنند.

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
ATC'ye veritabanına nasıl ulaşacağını söyleyin. Bunu FiveM `server.cfg`
dosyanızda (`infra/server.cfg.example` örneğine bakın) ve/veya `infra/.env`
içinde ayarlayın:

```
set mysql_connection_string "mysql://atc:SIFRENIZ@localhost/atc?charset=utf8mb4"
```

`atc` kullanıcısını oluşturun (veya yerel test için `root` kullanın):

```sql
CREATE USER 'atc'@'localhost' IDENTIFIED BY 'SIFRENIZ';
GRANT ALL PRIVILEGES ON atc.* TO 'atc'@'localhost';
FLUSH PRIVILEGES;
```

Bitti. Sunucunuzu başlatın; kaynaklar yeni veritabanını kullanacak.

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
Indica a ATC cómo llegar a la base de datos. Configúralo en tu `server.cfg` de
FiveM (mira `infra/server.cfg.example`) y/o en `infra/.env`:

```
set mysql_connection_string "mysql://atc:TU_CONTRASENA@localhost/atc?charset=utf8mb4"
```

Crea el usuario `atc` (o usa `root` para pruebas locales):

```sql
CREATE USER 'atc'@'localhost' IDENTIFIED BY 'TU_CONTRASENA';
GRANT ALL PRIVILEGES ON atc.* TO 'atc'@'localhost';
FLUSH PRIVILEGES;
```

Listo. Inicia tu servidor y los recursos usarán la nueva base de datos.

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
Sag ATC, wie es die Datenbank erreicht. Trage es in deiner FiveM `server.cfg`
ein (siehe `infra/server.cfg.example`) und/oder in `infra/.env`:

```
set mysql_connection_string "mysql://atc:DEIN_PASSWORT@localhost/atc?charset=utf8mb4"
```

Lege den `atc`-Benutzer an (oder nutze `root` für lokale Tests):

```sql
CREATE USER 'atc'@'localhost' IDENTIFIED BY 'DEIN_PASSWORT';
GRANT ALL PRIVILEGES ON atc.* TO 'atc'@'localhost';
FLUSH PRIVILEGES;
```

Fertig. Starte deinen Server — die Ressourcen nutzen jetzt die neue Datenbank.

---

## Notes

- `atc.sql` is generated from the project's ordered migrations in
  `packages/*/migrations`. If you develop ATC and add migrations, regenerate this
  file so a fresh import always matches the latest schema.
- The schema is idempotent (`CREATE TABLE IF NOT EXISTS`), so re-importing into an
  existing `atc` database will not drop your data — but always back up first.
- No game assets or seed/sample data are included; this is schema only.

— Atlantic Core, an open project by Naiemi Group.
