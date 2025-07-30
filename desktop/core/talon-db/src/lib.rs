use chrono::{DateTime, Utc};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::Path;
use thiserror::Error;
use uuid::Uuid;

#[derive(Error, Debug)]
pub enum DatabaseError {
    #[error("Database error: {0}")]
    SqliteError(#[from] rusqlite::Error),

    #[error("User not found")]
    UserNotFound,

    #[error("Invalid credentials")]
    InvalidCredentials,

    #[error("User already exists")]
    UserAlreadyExists,

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Migration error: {0}")]
    MigrationError(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub fio: String,
    pub phone: String,
    pub position: String,
    pub password_hash: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub from_remote: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Kombainer {
    pub id: String,
    pub user_id: String,
    pub combine: String,
    pub brigade: String,
    pub culture: String,
    pub field: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Voditel {
    pub id: String,
    pub user_id: String,
    pub transport: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub from_remote: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TalonOfKombainer {
    pub id: String,
    pub kombainer_id: String,
    pub kombainer_data: Option<String>, // JSON строка с данными комбайнера
    pub kombainer_user_data: Option<String>, // JSON строка с данными пользователя комбайнера
    pub voditel_id: Option<String>,
    pub voditel_user_id: Option<String>,
    pub voditel_data: Option<String>, // JSON строка с данными водителя
    pub voditel_user_data: Option<String>, // JSON строка с данными пользователя водителя
    pub status: String,
    pub start_time: i64,
    pub end_time: Option<i64>,
    pub weight: Option<f64>,
    pub comment: Option<String>,
    pub talon_number: String,
    pub cancellation_reason: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateUserRequest {
    pub fio: String,
    pub phone: String,
    pub password: String,
    pub position: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateKombainerRequest {
    pub user_id: String,
    pub combine: String,
    pub brigade: String,
    pub culture: String,
    pub field: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateVoditelRequest {
    pub user_id: String,
    pub transport: String,
    pub from_remote: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateTalonRequest {
    pub kombainer_id: String,
    pub kombainer_data: Option<String>,
    pub kombainer_user_data: Option<String>,
    pub voditel_id: Option<String>,
    pub voditel_user_id: Option<String>,
    pub voditel_data: Option<String>,
    pub voditel_user_data: Option<String>,
    pub status: String,
    pub start_time: i64,
    pub end_time: Option<i64>,
    pub weight: Option<f64>,
    pub comment: Option<String>,
    pub talon_number: Option<String>, // Если не указан, будет сгенерирован
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateTalonRequest {
    pub kombainer_id: Option<String>,
    pub kombainer_data: Option<String>,
    pub kombainer_user_data: Option<String>,
    pub voditel_id: Option<String>,
    pub voditel_user_id: Option<String>,
    pub voditel_data: Option<String>,
    pub voditel_user_data: Option<String>,
    pub status: Option<String>,
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
    pub weight: Option<f64>,
    pub comment: Option<String>,
    pub cancellation_reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub phone: String,
    pub password: String,
}

// Migration system
#[derive(Debug)]
pub struct Migration {
    pub version: i32,
    pub description: &'static str,
    pub up_sql: &'static str,
    pub down_sql: Option<&'static str>,
}

impl Migration {
    pub fn new(version: i32, description: &'static str, up_sql: &'static str) -> Self {
        Self {
            version,
            description,
            up_sql,
            down_sql: None,
        }
    }

    pub fn with_rollback(mut self, down_sql: &'static str) -> Self {
        self.down_sql = Some(down_sql);
        self
    }
}

pub struct TalonDatabase {
    conn: Connection,
}

// Database migrations
const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        description: "Create users table",
        up_sql: "CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            fio TEXT NOT NULL,
            phone TEXT NOT NULL UNIQUE,
            position TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            from_remote INTEGER NOT NULL DEFAULT 0
        )",
        down_sql: Some("DROP TABLE IF EXISTS users"),
    },
    Migration {
        version: 2,
        description: "Create indexes for users table",
        up_sql: "CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
                 CREATE INDEX IF NOT EXISTS idx_users_position ON users(position)",
        down_sql: Some(
            "DROP INDEX IF EXISTS idx_users_phone;
                       DROP INDEX IF EXISTS idx_users_position",
        ),
    },
    Migration {
        version: 3,
        description: "Create kombainers table",
        up_sql: "CREATE TABLE IF NOT EXISTS kombainers (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            combine TEXT NOT NULL,
            brigade TEXT NOT NULL,
            culture TEXT NOT NULL,
            field TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )",
        down_sql: Some("DROP TABLE IF EXISTS kombainers"),
    },
    Migration {
        version: 4,
        description: "Create voditeli table",
        up_sql: "CREATE TABLE IF NOT EXISTS voditeli (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            transport TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            from_remote INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )",
        down_sql: Some("DROP TABLE IF EXISTS voditeli"),
    },
    Migration {
        version: 5,
        description: "Create talons_of_combainers table",
        up_sql: "CREATE TABLE IF NOT EXISTS talons_of_combainers (
            id TEXT PRIMARY KEY,
            kombainer_id TEXT NOT NULL,
            kombainer_data TEXT,
            kombainer_user_data TEXT,
            voditel_id TEXT,
            voditel_user_id TEXT,
            voditel_data TEXT,
            voditel_user_data TEXT,
            status TEXT NOT NULL,
            start_time INTEGER NOT NULL,
            end_time INTEGER,
            weight REAL,
            comment TEXT,
            talon_number TEXT NOT NULL,
            cancellation_reason TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (kombainer_id) REFERENCES kombainers(id) ON DELETE CASCADE,
            FOREIGN KEY (voditel_id) REFERENCES voditeli(id) ON DELETE SET NULL
        )",
        down_sql: Some("DROP TABLE IF EXISTS talons_of_combainers"),
    },
    Migration {
        version: 6,
        description: "Create indexes for related tables",
        up_sql: "CREATE INDEX IF NOT EXISTS idx_kombainers_user_id ON kombainers(user_id);
                 CREATE INDEX IF NOT EXISTS idx_voditeli_user_id ON voditeli(user_id);
                 CREATE INDEX IF NOT EXISTS idx_talons_kombainer_id ON talons_of_combainers(kombainer_id);
                 CREATE INDEX IF NOT EXISTS idx_talons_voditel_id ON talons_of_combainers(voditel_id);
                 CREATE INDEX IF NOT EXISTS idx_talons_status ON talons_of_combainers(status);
                 CREATE INDEX IF NOT EXISTS idx_talons_talon_number ON talons_of_combainers(talon_number);
                 CREATE INDEX IF NOT EXISTS idx_talons_created_at ON talons_of_combainers(created_at)",
        down_sql: Some(
            "DROP INDEX IF EXISTS idx_kombainers_user_id;
             DROP INDEX IF EXISTS idx_voditeli_user_id;
             DROP INDEX IF EXISTS idx_talons_kombainer_id;
             DROP INDEX IF EXISTS idx_talons_voditel_id;
             DROP INDEX IF EXISTS idx_talons_status;
             DROP INDEX IF EXISTS idx_talons_talon_number;
             DROP INDEX IF EXISTS idx_talons_created_at",
        ),
    },
];

impl TalonDatabase {
    // Функция для нормализации номера телефона
    fn normalize_phone(&self, phone: &str) -> String {
        // Убираем все символы кроме цифр
        let digits_only: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();

        // Если номер начинается с 8, заменяем на 7
        if digits_only.starts_with('8') && digits_only.len() == 11 {
            format!("7{}", &digits_only[1..])
        } else {
            digits_only
        }
    }

    pub fn new(db_path: &str) -> Result<Self, DatabaseError> {
        let conn = Connection::open(db_path)?;
        let mut db = TalonDatabase { conn };
        db.run_migrations()?;
        Ok(db)
    }

    fn run_migrations(&mut self) -> Result<(), DatabaseError> {
        // Создаем таблицу для отслеживания миграций
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                description TEXT NOT NULL,
                applied_at TEXT NOT NULL
            )",
            [],
        )?;

        // Получаем список уже примененных миграций
        let applied_migrations = self.get_applied_migration_versions()?;

        // Применяем все миграции по порядку, которые еще не были применены
        for migration in MIGRATIONS {
            if !applied_migrations.contains(&migration.version) {
                println!(
                    "Applying migration {}: {}",
                    migration.version, migration.description
                );

                // Выполняем SQL миграции
                let statements: Vec<&str> = migration
                    .up_sql
                    .split(';')
                    .map(|s| s.trim())
                    .filter(|s| !s.is_empty())
                    .collect();

                for statement in statements {
                    self.conn.execute(statement, [])?;
                }

                // Записываем информацию о применении миграции
                self.conn.execute(
                    "INSERT INTO schema_migrations (version, description, applied_at) VALUES (?1, ?2, ?3)",
                    [
                        &migration.version.to_string(),
                        migration.description,
                        &Utc::now().to_rfc3339(),
                    ],
                )?;
            }
        }

        Ok(())
    }

    fn get_applied_migration_versions(&self) -> Result<Vec<i32>, DatabaseError> {
        let mut stmt = self
            .conn
            .prepare("SELECT version FROM schema_migrations ORDER BY version")?;
        let rows = stmt.query_map([], |row| Ok(row.get::<_, i32>(0)?))?;

        let mut versions = Vec::new();
        for row in rows {
            versions.push(row?);
        }
        Ok(versions)
    }

    fn get_current_schema_version(&self) -> Result<i32, DatabaseError> {
        let result = self
            .conn
            .query_row("SELECT MAX(version) FROM schema_migrations", [], |row| {
                row.get::<_, Option<i32>>(0)
            });

        match result {
            Ok(Some(version)) => Ok(version),
            Ok(None) => Ok(0), // Нет примененных миграций
            Err(rusqlite::Error::SqliteFailure(_, Some(msg))) if msg.contains("no such table") => {
                Ok(0)
            }
            Err(e) => Err(DatabaseError::SqliteError(e)),
        }
    }

    pub fn create_user(&mut self, request: CreateUserRequest) -> Result<String, DatabaseError> {
        println!("TalonDB: Starting create_user for phone: {}", request.phone);

        // Валидация
        self.validate_user_data(&request)?;
        println!("TalonDB: User data validation passed");

        // Нормализуем номер телефона
        let normalized_phone = self.normalize_phone(&request.phone);
        println!("TalonDB: Normalized phone: {}", normalized_phone);

        // Проверяем, что пользователь с таким телефоном не существует
        if self.get_user_by_phone(&normalized_phone).is_ok() {
            println!(
                "TalonDB: User already exists with normalized phone: {}",
                normalized_phone
            );
            return Err(DatabaseError::UserAlreadyExists);
        }
        println!("TalonDB: No existing user found, proceeding with creation");

        // Хешируем пароль
        let password_hash = bcrypt::hash(&request.password, bcrypt::DEFAULT_COST).map_err(|e| {
            println!("TalonDB: Password hashing failed: {}", e);
            DatabaseError::ValidationError(format!("Password hashing failed: {}", e))
        })?;
        println!("TalonDB: Password hashed successfully");

        let user_id = Uuid::new_v4().to_string();
        let now = Utc::now();
        println!("TalonDB: Generated user_id: {}", user_id);

        let result = self.conn.execute(
            "INSERT INTO users (id, fio, phone, position, password_hash, created_at, updated_at, from_remote)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            [
                &user_id,
                &request.fio,
                &normalized_phone, // Сохраняем нормализованный номер
                &request.position,
                &password_hash,
                &now.to_rfc3339(),
                &now.to_rfc3339(),
                &"0".to_string(),
            ],
        );

        match result {
            Ok(rows_affected) => {
                println!(
                    "TalonDB: User inserted successfully, rows affected: {}",
                    rows_affected
                );
                println!(
                    "TalonDB: User created with ID: {}, FIO: {}, position: {}",
                    user_id, request.fio, request.position
                );
                Ok(user_id)
            }
            Err(e) => {
                println!("TalonDB: Database insert failed: {}", e);
                Err(DatabaseError::from(e))
            }
        }
    }

    pub fn login_user(&self, request: LoginRequest) -> Result<User, DatabaseError> {
        let normalized_phone = self.normalize_phone(&request.phone);
        let user = self.get_user_by_phone_normalized(&normalized_phone)?;

        // Проверяем пароль
        let password_valid =
            bcrypt::verify(&request.password, &user.password_hash).map_err(|e| {
                DatabaseError::ValidationError(format!("Password verification failed: {}", e))
            })?;

        if !password_valid {
            return Err(DatabaseError::InvalidCredentials);
        }

        Ok(user)
    }

    pub fn get_user_by_id(&self, user_id: &str) -> Result<User, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, fio, phone, position, password_hash, created_at, updated_at, from_remote
             FROM users WHERE id = ?1",
        )?;

        let user = stmt
            .query_row([user_id], |row| {
                Ok(User {
                    id: row.get(0)?,
                    fio: row.get(1)?,
                    phone: row.get(2)?,
                    position: row.get(3)?,
                    password_hash: row.get(4)?,
                    created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(5)?)
                        .unwrap()
                        .with_timezone(&Utc),
                    updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(6)?)
                        .unwrap()
                        .with_timezone(&Utc),
                    from_remote: row.get::<_, i64>(7)? != 0,
                })
            })
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => DatabaseError::UserNotFound,
                _ => DatabaseError::SqliteError(e),
            })?;

        Ok(user)
    }

    pub fn get_user_by_phone(&self, phone: &str) -> Result<User, DatabaseError> {
        println!("TalonDB: get_user_by_phone called with: {}", phone);
        let normalized_phone = self.normalize_phone(phone);
        println!("TalonDB: Normalized to: {}", normalized_phone);
        let result = self.get_user_by_phone_normalized(&normalized_phone);
        match &result {
            Ok(user) => println!("TalonDB: Found user: {} ({})", user.fio, user.id),
            Err(e) => println!("TalonDB: User not found: {:?}", e),
        }
        result
    }

    fn get_user_by_phone_normalized(&self, normalized_phone: &str) -> Result<User, DatabaseError> {
        println!(
            "TalonDB: get_user_by_phone_normalized called with: {}",
            normalized_phone
        );

        // Сначала ищем по точному совпадению
        let mut stmt = self.conn.prepare(
            "SELECT id, fio, phone, position, password_hash, created_at, updated_at, from_remote
             FROM users WHERE phone = ?1",
        )?;

        let result = stmt.query_row([normalized_phone], |row| {
            Ok(User {
                id: row.get(0)?,
                fio: row.get(1)?,
                phone: row.get(2)?,
                position: row.get(3)?,
                password_hash: row.get(4)?,
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(5)?)
                    .unwrap()
                    .with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(6)?)
                    .unwrap()
                    .with_timezone(&Utc),
                from_remote: row.get::<_, i64>(7)? != 0,
            })
        });

        match result {
            Ok(user) => return Ok(user),
            Err(rusqlite::Error::QueryReturnedNoRows) => {
                // Продолжаем поиск с нормализацией
            }
            Err(e) => return Err(DatabaseError::SqliteError(e)),
        }

        // Если не найден, ищем с нормализацией существующих номеров
        let mut stmt = self.conn.prepare(
            "SELECT id, fio, phone, position, password_hash, created_at, updated_at, from_remote
             FROM users",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(2)?, // phone
                User {
                    id: row.get(0)?,
                    fio: row.get(1)?,
                    phone: row.get(2)?,
                    position: row.get(3)?,
                    password_hash: row.get(4)?,
                    created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(5)?)
                        .unwrap()
                        .with_timezone(&Utc),
                    updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(6)?)
                        .unwrap()
                        .with_timezone(&Utc),
                    from_remote: row.get::<_, i64>(7)? != 0,
                },
            ))
        })?;

        for row in rows {
            let (stored_phone, user) = row?;
            if self.normalize_phone(&stored_phone) == normalized_phone {
                return Ok(user);
            }
        }

        Err(DatabaseError::UserNotFound)
    }

    pub fn get_all_users_debug(&self) -> Result<Vec<String>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, fio, phone, position, created_at, updated_at, from_remote FROM users",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(format!(
                "ID: {}, FIO: {}, Phone: {}, Position: {}, Created: {}, FromRemote: {}",
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, i64>(6)?
            ))
        })?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }
        Ok(result)
    }

    pub fn get_users_by_position(&self, position: &str) -> Result<Vec<User>, DatabaseError> {
        println!(
            "TalonDB: get_users_by_position called for position: {}",
            position
        );

        let mut stmt = self.conn.prepare(
            "SELECT id, fio, phone, position, password_hash, created_at, updated_at, from_remote
             FROM users WHERE position = ?1 ORDER BY created_at DESC",
        )?;

        let user_iter = stmt.query_map([position], |row| {
            Ok(User {
                id: row.get(0)?,
                fio: row.get(1)?,
                phone: row.get(2)?,
                position: row.get(3)?,
                password_hash: row.get(4)?,
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(5)?)
                    .unwrap()
                    .with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(6)?)
                    .unwrap()
                    .with_timezone(&Utc),
                from_remote: row.get::<_, i64>(7)? != 0,
            })
        })?;

        let mut users = Vec::new();
        for user in user_iter {
            users.push(user?);
        }

        println!(
            "TalonDB: Found {} users with position {}",
            users.len(),
            position
        );
        for user in &users {
            println!(
                "TalonDB: User: {} ({}), phone: {}",
                user.fio, user.id, user.phone
            );
        }

        Ok(users)
    }

    fn validate_user_data(&self, request: &CreateUserRequest) -> Result<(), DatabaseError> {
        if request.fio.trim().is_empty() {
            return Err(DatabaseError::ValidationError(
                "ФИО не может быть пустым".to_string(),
            ));
        }

        if request.phone.trim().is_empty() {
            return Err(DatabaseError::ValidationError(
                "Номер телефона не может быть пустым".to_string(),
            ));
        }

        // Проверяем формат телефона
        let phone_regex = regex::Regex::new(r"^\+?[78][0-9]{10}$").unwrap();
        if !phone_regex.is_match(&request.phone) {
            return Err(DatabaseError::ValidationError(
                "Неверный формат номера телефона".to_string(),
            ));
        }

        if request.password.len() < 6 {
            return Err(DatabaseError::ValidationError(
                "Пароль должен содержать минимум 6 символов".to_string(),
            ));
        }

        let valid_positions = ["kombainer", "voditel", "vesovschik", "admin"];
        if !valid_positions.contains(&request.position.as_str()) {
            return Err(DatabaseError::ValidationError(format!(
                "Недопустимая должность. Разрешенные: {}",
                valid_positions.join(", ")
            )));
        }

        Ok(())
    }

    pub fn update_user_password(
        &mut self,
        user_id: &str,
        new_password: &str,
    ) -> Result<(), DatabaseError> {
        if new_password.len() < 6 {
            return Err(DatabaseError::ValidationError(
                "Пароль должен содержать минимум 6 символов".to_string(),
            ));
        }

        let password_hash = bcrypt::hash(new_password, bcrypt::DEFAULT_COST).map_err(|e| {
            DatabaseError::ValidationError(format!("Password hashing failed: {}", e))
        })?;

        let now = Utc::now();

        let rows_affected = self.conn.execute(
            "UPDATE users SET password_hash = ?1, updated_at = ?2 WHERE id = ?3",
            [&password_hash, &now.to_rfc3339(), user_id],
        )?;

        if rows_affected == 0 {
            return Err(DatabaseError::UserNotFound);
        }

        Ok(())
    }

    pub fn delete_user(&mut self, user_id: &str) -> Result<(), DatabaseError> {
        let rows_affected = self
            .conn
            .execute("DELETE FROM users WHERE id = ?1", [user_id])?;

        if rows_affected == 0 {
            return Err(DatabaseError::UserNotFound);
        }

        Ok(())
    }

    // Методы для работы с комбайнерами
    pub fn create_kombainer(
        &mut self,
        request: CreateKombainerRequest,
    ) -> Result<String, DatabaseError> {
        // Валидация
        self.validate_kombainer_data(&request)?;

        let kombainer_id = Uuid::new_v4().to_string();
        let now = Utc::now();

        self.conn.execute(
            "INSERT INTO kombainers (id, user_id, combine, brigade, culture, field, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            [
                &kombainer_id,
                &request.user_id,
                &request.combine,
                &request.brigade,
                &request.culture,
                &request.field,
                &now.to_rfc3339(),
                &now.to_rfc3339(),
            ],
        )?;

        Ok(kombainer_id)
    }

    pub fn get_kombainer_by_id(&self, kombainer_id: &str) -> Result<Kombainer, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, user_id, combine, brigade, culture, field, created_at, updated_at
             FROM kombainers WHERE id = ?1",
        )?;

        let kombainer = stmt
            .query_row([kombainer_id], |row| {
                Ok(Kombainer {
                    id: row.get(0)?,
                    user_id: row.get(1)?,
                    combine: row.get(2)?,
                    brigade: row.get(3)?,
                    culture: row.get(4)?,
                    field: row.get(5)?,
                    created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(6)?)
                        .unwrap()
                        .with_timezone(&Utc),
                    updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(7)?)
                        .unwrap()
                        .with_timezone(&Utc),
                })
            })
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => DatabaseError::UserNotFound,
                _ => DatabaseError::SqliteError(e),
            })?;

        Ok(kombainer)
    }

    pub fn get_kombainer_by_user_id(&self, user_id: &str) -> Result<Kombainer, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, user_id, combine, brigade, culture, field, created_at, updated_at
             FROM kombainers WHERE user_id = ?1",
        )?;

        let kombainer = stmt
            .query_row([user_id], |row| {
                Ok(Kombainer {
                    id: row.get(0)?,
                    user_id: row.get(1)?,
                    combine: row.get(2)?,
                    brigade: row.get(3)?,
                    culture: row.get(4)?,
                    field: row.get(5)?,
                    created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(6)?)
                        .unwrap()
                        .with_timezone(&Utc),
                    updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(7)?)
                        .unwrap()
                        .with_timezone(&Utc),
                })
            })
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => DatabaseError::UserNotFound,
                _ => DatabaseError::SqliteError(e),
            })?;

        Ok(kombainer)
    }

    // Методы для работы с водителями
    pub fn create_voditel(
        &mut self,
        request: CreateVoditelRequest,
    ) -> Result<String, DatabaseError> {
        // Валидация
        self.validate_voditel_data(&request)?;

        let voditel_id = Uuid::new_v4().to_string();
        let now = Utc::now();

        self.conn.execute(
            "INSERT INTO voditeli (id, user_id, transport, created_at, updated_at, from_remote)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            [
                &voditel_id,
                &request.user_id,
                &request.transport,
                &now.to_rfc3339(),
                &now.to_rfc3339(),
                &(if request.from_remote { "1" } else { "0" }).to_string(),
            ],
        )?;

        Ok(voditel_id)
    }

    pub fn get_voditel_by_id(&self, voditel_id: &str) -> Result<Voditel, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, user_id, transport, created_at, updated_at, from_remote
             FROM voditeli WHERE id = ?1",
        )?;

        let voditel = stmt
            .query_row([voditel_id], |row| {
                Ok(Voditel {
                    id: row.get(0)?,
                    user_id: row.get(1)?,
                    transport: row.get(2)?,
                    created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(3)?)
                        .unwrap()
                        .with_timezone(&Utc),
                    updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                        .unwrap()
                        .with_timezone(&Utc),
                    from_remote: row.get::<_, i64>(5)? != 0,
                })
            })
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => DatabaseError::UserNotFound,
                _ => DatabaseError::SqliteError(e),
            })?;

        Ok(voditel)
    }

    // Методы для работы с талонами
    pub fn create_talon(&mut self, request: CreateTalonRequest) -> Result<String, DatabaseError> {
        // Валидация
        self.validate_talon_data(&request)?;

        let talon_id = Uuid::new_v4().to_string();
        let now = Utc::now();

        // Генерируем номер талона если не указан
        let talon_number = if let Some(number) = request.talon_number {
            number
        } else {
            self.generate_talon_number(&request.kombainer_id)?
        };

        self.conn.execute(
            "INSERT INTO talons_of_combainers (
                id, kombainer_id, kombainer_data, kombainer_user_data,
                voditel_id, voditel_user_id, voditel_data, voditel_user_data,
                status, start_time, end_time, weight, comment, talon_number,
                cancellation_reason, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
            rusqlite::params![
                &talon_id,
                &request.kombainer_id,
                &request.kombainer_data,
                &request.kombainer_user_data,
                &request.voditel_id,
                &request.voditel_user_id,
                &request.voditel_data,
                &request.voditel_user_data,
                &request.status,
                &request.start_time,
                &request.end_time,
                &request.weight,
                &request.comment,
                &talon_number,
                None::<String>, // cancellation_reason
                &now.to_rfc3339(),
                &now.to_rfc3339(),
            ],
        )?;

        Ok(talon_id)
    }

    pub fn get_talon_by_id(&self, talon_id: &str) -> Result<TalonOfKombainer, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, kombainer_id, kombainer_data, kombainer_user_data,
                    voditel_id, voditel_user_id, voditel_data, voditel_user_data,
                    status, start_time, end_time, weight, comment, talon_number,
                    cancellation_reason, created_at, updated_at
             FROM talons_of_combainers WHERE id = ?1",
        )?;

        let talon = stmt
            .query_row([talon_id], |row| {
                Ok(TalonOfKombainer {
                    id: row.get(0)?,
                    kombainer_id: row.get(1)?,
                    kombainer_data: row.get(2)?,
                    kombainer_user_data: row.get(3)?,
                    voditel_id: row.get(4)?,
                    voditel_user_id: row.get(5)?,
                    voditel_data: row.get(6)?,
                    voditel_user_data: row.get(7)?,
                    status: row.get(8)?,
                    start_time: row.get(9)?,
                    end_time: row.get(10)?,
                    weight: row.get(11)?,
                    comment: row.get(12)?,
                    talon_number: row.get(13)?,
                    cancellation_reason: row.get(14)?,
                    created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(15)?)
                        .unwrap()
                        .with_timezone(&Utc),
                    updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(16)?)
                        .unwrap()
                        .with_timezone(&Utc),
                })
            })
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => DatabaseError::UserNotFound,
                _ => DatabaseError::SqliteError(e),
            })?;

        Ok(talon)
    }

    pub fn get_talons_by_kombainer_id(
        &self,
        kombainer_id: &str,
    ) -> Result<Vec<TalonOfKombainer>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, kombainer_id, kombainer_data, kombainer_user_data,
                    voditel_id, voditel_user_id, voditel_data, voditel_user_data,
                    status, start_time, end_time, weight, comment, talon_number,
                    cancellation_reason, created_at, updated_at
             FROM talons_of_combainers WHERE kombainer_id = ?1 ORDER BY created_at DESC",
        )?;

        let talon_iter = stmt.query_map([kombainer_id], |row| {
            Ok(TalonOfKombainer {
                id: row.get(0)?,
                kombainer_id: row.get(1)?,
                kombainer_data: row.get(2)?,
                kombainer_user_data: row.get(3)?,
                voditel_id: row.get(4)?,
                voditel_user_id: row.get(5)?,
                voditel_data: row.get(6)?,
                voditel_user_data: row.get(7)?,
                status: row.get(8)?,
                start_time: row.get(9)?,
                end_time: row.get(10)?,
                weight: row.get(11)?,
                comment: row.get(12)?,
                talon_number: row.get(13)?,
                cancellation_reason: row.get(14)?,
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(15)?)
                    .unwrap()
                    .with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(16)?)
                    .unwrap()
                    .with_timezone(&Utc),
            })
        })?;

        let mut talons = Vec::new();
        for talon in talon_iter {
            talons.push(talon?);
        }

        Ok(talons)
    }

    pub fn get_all_talons(&self) -> Result<Vec<TalonOfKombainer>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, kombainer_id, kombainer_data, kombainer_user_data,
                    voditel_id, voditel_user_id, voditel_data, voditel_user_data,
                    status, start_time, end_time, weight, comment, talon_number,
                    cancellation_reason, created_at, updated_at
             FROM talons_of_combainers ORDER BY created_at DESC",
        )?;

        let talon_iter = stmt.query_map([], |row| {
            Ok(TalonOfKombainer {
                id: row.get(0)?,
                kombainer_id: row.get(1)?,
                kombainer_data: row.get(2)?,
                kombainer_user_data: row.get(3)?,
                voditel_id: row.get(4)?,
                voditel_user_id: row.get(5)?,
                voditel_data: row.get(6)?,
                voditel_user_data: row.get(7)?,
                status: row.get(8)?,
                start_time: row.get(9)?,
                end_time: row.get(10)?,
                weight: row.get(11)?,
                comment: row.get(12)?,
                talon_number: row.get(13)?,
                cancellation_reason: row.get(14)?,
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(15)?)
                    .unwrap()
                    .with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(16)?)
                    .unwrap()
                    .with_timezone(&Utc),
            })
        })?;

        let mut talons = Vec::new();
        for talon in talon_iter {
            talons.push(talon?);
        }

        Ok(talons)
    }

    pub fn update_talon(
        &mut self,
        talon_id: &str,
        request: UpdateTalonRequest,
    ) -> Result<(), DatabaseError> {
        // Проверяем, что талон существует
        let _existing_talon = self.get_talon_by_id(talon_id)?;

        let now = Utc::now();
        let mut query_parts = Vec::new();
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        // Динамически строим запрос только для переданных полей
        if let Some(kombainer_id) = &request.kombainer_id {
            query_parts.push("kombainer_id = ?");
            params.push(Box::new(kombainer_id.clone()));
        }
        if let Some(kombainer_data) = &request.kombainer_data {
            query_parts.push("kombainer_data = ?");
            params.push(Box::new(kombainer_data.clone()));
        }
        if let Some(kombainer_user_data) = &request.kombainer_user_data {
            query_parts.push("kombainer_user_data = ?");
            params.push(Box::new(kombainer_user_data.clone()));
        }
        if let Some(voditel_id) = &request.voditel_id {
            query_parts.push("voditel_id = ?");
            params.push(Box::new(voditel_id.clone()));
        }
        if let Some(voditel_user_id) = &request.voditel_user_id {
            query_parts.push("voditel_user_id = ?");
            params.push(Box::new(voditel_user_id.clone()));
        }
        if let Some(voditel_data) = &request.voditel_data {
            query_parts.push("voditel_data = ?");
            params.push(Box::new(voditel_data.clone()));
        }
        if let Some(voditel_user_data) = &request.voditel_user_data {
            query_parts.push("voditel_user_data = ?");
            params.push(Box::new(voditel_user_data.clone()));
        }
        if let Some(status) = &request.status {
            query_parts.push("status = ?");
            params.push(Box::new(status.clone()));
        }
        if let Some(start_time) = &request.start_time {
            query_parts.push("start_time = ?");
            params.push(Box::new(*start_time));
        }
        if let Some(end_time) = &request.end_time {
            query_parts.push("end_time = ?");
            params.push(Box::new(*end_time));
        }
        if let Some(weight) = &request.weight {
            query_parts.push("weight = ?");
            params.push(Box::new(*weight));
        }
        if let Some(comment) = &request.comment {
            query_parts.push("comment = ?");
            params.push(Box::new(comment.clone()));
        }
        if let Some(cancellation_reason) = &request.cancellation_reason {
            query_parts.push("cancellation_reason = ?");
            params.push(Box::new(cancellation_reason.clone()));
        }

        // Всегда обновляем updated_at
        query_parts.push("updated_at = ?");
        params.push(Box::new(now.to_rfc3339()));

        if query_parts.is_empty() {
            return Err(DatabaseError::ValidationError(
                "No fields to update".to_string(),
            ));
        }

        let sql = format!(
            "UPDATE talons_of_combainers SET {} WHERE id = ?",
            query_parts.join(", ")
        );

        params.push(Box::new(talon_id.to_string()));

        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        let rows_affected = self.conn.execute(&sql, &param_refs[..])?;

        if rows_affected == 0 {
            return Err(DatabaseError::UserNotFound);
        }

        Ok(())
    }

    // Вспомогательные методы для валидации
    fn validate_kombainer_data(
        &self,
        request: &CreateKombainerRequest,
    ) -> Result<(), DatabaseError> {
        if request.combine.trim().is_empty() {
            return Err(DatabaseError::ValidationError(
                "Комбайн не может быть пустым".to_string(),
            ));
        }
        if request.brigade.trim().is_empty() {
            return Err(DatabaseError::ValidationError(
                "Бригада не может быть пустой".to_string(),
            ));
        }
        if request.culture.trim().is_empty() {
            return Err(DatabaseError::ValidationError(
                "Культура не может быть пустой".to_string(),
            ));
        }
        if request.field.trim().is_empty() {
            return Err(DatabaseError::ValidationError(
                "Поле не может быть пустым".to_string(),
            ));
        }
        Ok(())
    }

    fn validate_voditel_data(&self, request: &CreateVoditelRequest) -> Result<(), DatabaseError> {
        if request.transport.trim().is_empty() {
            return Err(DatabaseError::ValidationError(
                "Транспорт не может быть пустым".to_string(),
            ));
        }
        Ok(())
    }

    fn validate_talon_data(&self, request: &CreateTalonRequest) -> Result<(), DatabaseError> {
        if request.kombainer_id.trim().is_empty() {
            return Err(DatabaseError::ValidationError(
                "ID комбайнера не может быть пустым".to_string(),
            ));
        }

        let valid_statuses = [
            "created",
            "assigned",
            "in_progress",
            "voditel_signed",
            "weighed",
            "completed",
            "cancelled",
            "cancelled_by_kombainer",
            "cancelled_by_voditel",
        ];

        if !valid_statuses.contains(&request.status.as_str()) {
            return Err(DatabaseError::ValidationError(format!(
                "Недопустимый статус. Разрешенные: {}",
                valid_statuses.join(", ")
            )));
        }

        if request.start_time <= 0 {
            return Err(DatabaseError::ValidationError(
                "Время начала должно быть положительным".to_string(),
            ));
        }

        Ok(())
    }

    fn generate_talon_number(&self, kombainer_id: &str) -> Result<String, DatabaseError> {
        // Получаем последний неотмененный талон
        let mut stmt = self.conn.prepare(
            "SELECT talon_number FROM talons_of_combainers
             WHERE kombainer_id = ?1 AND status != 'cancelled'
             ORDER BY created_at DESC LIMIT 1",
        )?;

        let last_non_cancelled =
            match stmt.query_row([kombainer_id], |row| Ok(row.get::<_, String>(0)?)) {
                Ok(number) => Some(number),
                Err(rusqlite::Error::QueryReturnedNoRows) => None,
                Err(e) => return Err(DatabaseError::SqliteError(e)),
            };

        // Получаем первый отмененный талон (самый старый)
        let mut stmt = self.conn.prepare(
            "SELECT talon_number FROM talons_of_combainers
             WHERE kombainer_id = ?1 AND status = 'cancelled'
             ORDER BY created_at ASC LIMIT 1",
        )?;

        let first_cancelled =
            match stmt.query_row([kombainer_id], |row| Ok(row.get::<_, String>(0)?)) {
                Ok(number) => Some(number),
                Err(rusqlite::Error::QueryReturnedNoRows) => None,
                Err(e) => return Err(DatabaseError::SqliteError(e)),
            };

        let talon_number = if let Some(cancelled_number) = first_cancelled {
            // Удаляем префикс 'A' если есть
            cancelled_number.trim_start_matches('A').to_string()
        } else {
            // Генерируем следующий номер
            let mut next_number = 1;
            if let Some(last_number) = last_non_cancelled {
                let cleaned_number = last_number.trim_start_matches('A');
                if let Ok(num) = cleaned_number.parse::<i32>() {
                    next_number = num + 1;
                }
            }
            next_number.to_string()
        };

        Ok(talon_number)
    }

    // Migration utilities
    pub fn get_applied_migrations(&self) -> Result<Vec<(i32, String, String)>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT version, description, applied_at FROM schema_migrations ORDER BY version",
        )?;

        let migration_iter = stmt.query_map([], |row| {
            Ok((
                row.get::<_, i32>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })?;

        let mut migrations = Vec::new();
        for migration in migration_iter {
            migrations.push(migration?);
        }

        Ok(migrations)
    }

    pub fn get_pending_migrations(&self) -> Result<Vec<&Migration>, DatabaseError> {
        let current_version = self.get_current_schema_version()?;
        Ok(MIGRATIONS
            .iter()
            .filter(|m| m.version > current_version)
            .collect())
    }

    pub fn rollback_migration(&mut self, target_version: i32) -> Result<(), DatabaseError> {
        let current_version = self.get_current_schema_version()?;

        if target_version >= current_version {
            return Err(DatabaseError::MigrationError(
                "Target version must be lower than current version".to_string(),
            ));
        }

        // Откатываем миграции в обратном порядке
        for migration in MIGRATIONS.iter().rev() {
            if migration.version > target_version && migration.version <= current_version {
                if let Some(down_sql) = migration.down_sql {
                    println!(
                        "Rolling back migration {}: {}",
                        migration.version, migration.description
                    );

                    // Выполняем SQL отката
                    let statements: Vec<&str> = down_sql
                        .split(';')
                        .map(|s| s.trim())
                        .filter(|s| !s.is_empty())
                        .collect();

                    for statement in statements {
                        self.conn.execute(statement, [])?;
                    }

                    // Удаляем запись о миграции
                    self.conn.execute(
                        "DELETE FROM schema_migrations WHERE version = ?1",
                        [&migration.version.to_string()],
                    )?;
                } else {
                    return Err(DatabaseError::MigrationError(format!(
                        "Migration {} does not have rollback SQL",
                        migration.version
                    )));
                }
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn setup_test_db() -> TalonDatabase {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        TalonDatabase::new(db_path.to_str().unwrap()).unwrap()
    }

    #[test]
    fn test_create_user() {
        let mut db = setup_test_db();

        let request = CreateUserRequest {
            fio: "Тест Тестович".to_string(),
            phone: "+79991234567".to_string(),
            password: "password123".to_string(),
            position: "kombainer".to_string(),
        };

        let user_id = db.create_user(request).unwrap();
        assert!(!user_id.is_empty());

        let user = db.get_user_by_id(&user_id).unwrap();
        assert_eq!(user.fio, "Тест Тестович");
        assert_eq!(user.phone, "+79991234567");
        assert_eq!(user.position, "kombainer");
    }

    #[test]
    fn test_create_kombainer() {
        let mut db = setup_test_db();

        // Сначала создаем пользователя
        let user_request = CreateUserRequest {
            fio: "Комбайнер Тестович".to_string(),
            phone: "+79991234567".to_string(),
            password: "password123".to_string(),
            position: "kombainer".to_string(),
        };
        let user_id = db.create_user(user_request).unwrap();

        // Затем создаем комбайнера
        let kombainer_request = CreateKombainerRequest {
            user_id: user_id.clone(),
            combine: "John Deere 9600".to_string(),
            brigade: "Бригада №1".to_string(),
            culture: "Пшеница".to_string(),
            field: "Поле №7".to_string(),
        };

        let kombainer_id = db.create_kombainer(kombainer_request).unwrap();
        assert!(!kombainer_id.is_empty());

        let kombainer = db.get_kombainer_by_id(&kombainer_id).unwrap();
        assert_eq!(kombainer.user_id, user_id);
        assert_eq!(kombainer.combine, "John Deere 9600");
        assert_eq!(kombainer.brigade, "Бригада №1");
    }

    #[test]
    fn test_create_talon() {
        let mut db = setup_test_db();

        // Создаем пользователя для комбайнера
        let user_request = CreateUserRequest {
            fio: "Комбайнер Тестович".to_string(),
            phone: "+79991234567".to_string(),
            password: "password123".to_string(),
            position: "kombainer".to_string(),
        };
        let user_id = db.create_user(user_request).unwrap();

        // Создаем комбайнера
        let kombainer_request = CreateKombainerRequest {
            user_id: user_id.clone(),
            combine: "John Deere 9600".to_string(),
            brigade: "Бригада №1".to_string(),
            culture: "Пшеница".to_string(),
            field: "Поле №7".to_string(),
        };
        let kombainer_id = db.create_kombainer(kombainer_request).unwrap();

        // Создаем талон
        let talon_request = CreateTalonRequest {
            kombainer_id: kombainer_id.clone(),
            kombainer_data: Some(
                r#"{"combine":"John Deere 9600","brigade":"Бригада №1"}"#.to_string(),
            ),
            kombainer_user_data: Some(
                r#"{"fio":"Комбайнер Тестович","phone":"+79991234567"}"#.to_string(),
            ),
            voditel_id: None,
            voditel_user_id: None,
            voditel_data: None,
            voditel_user_data: None,
            status: "created".to_string(),
            start_time: 1640995200000, // 2022-01-01 00:00:00 UTC in milliseconds
            end_time: None,
            weight: None,
            comment: Some("Тестовый талон".to_string()),
            talon_number: None, // Будет сгенерирован автоматически
        };

        let talon_id = db.create_talon(talon_request).unwrap();
        assert!(!talon_id.is_empty());

        let talon = db.get_talon_by_id(&talon_id).unwrap();
        assert_eq!(talon.kombainer_id, kombainer_id);
        assert_eq!(talon.status, "created");
        assert_eq!(talon.start_time, 1640995200000);
        assert_eq!(talon.comment, Some("Тестовый талон".to_string()));
        assert_eq!(talon.talon_number, "1"); // Первый талон должен иметь номер 1
    }
}
