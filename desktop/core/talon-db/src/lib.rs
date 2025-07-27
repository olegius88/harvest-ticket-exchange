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

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateUserRequest {
    pub fio: String,
    pub phone: String,
    pub password: String,
    pub position: String,
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
];

impl TalonDatabase {
    pub fn new<P: AsRef<Path>>(db_path: P) -> Result<Self, DatabaseError> {
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

        // Получаем текущую версию схемы
        let current_version = self.get_current_schema_version()?;

        // Применяем все миграции, которые еще не были применены
        for migration in MIGRATIONS {
            if migration.version > current_version {
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
        // Валидация
        self.validate_user_data(&request)?;

        // Проверяем, что пользователь с таким телефоном не существует
        if self.get_user_by_phone(&request.phone).is_ok() {
            return Err(DatabaseError::UserAlreadyExists);
        }

        // Хешируем пароль
        let password_hash = bcrypt::hash(&request.password, bcrypt::DEFAULT_COST).map_err(|e| {
            DatabaseError::ValidationError(format!("Password hashing failed: {}", e))
        })?;

        let user_id = Uuid::new_v4().to_string();
        let now = Utc::now();

        self.conn.execute(
            "INSERT INTO users (id, fio, phone, position, password_hash, created_at, updated_at, from_remote)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            [
                &user_id,
                &request.fio,
                &request.phone,
                &request.position,
                &password_hash,
                &now.to_rfc3339(),
                &now.to_rfc3339(),
                &"0".to_string(),
            ],
        )?;

        Ok(user_id)
    }

    pub fn login_user(&self, request: LoginRequest) -> Result<User, DatabaseError> {
        let user = self.get_user_by_phone(&request.phone)?;

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
        let mut stmt = self.conn.prepare(
            "SELECT id, fio, phone, position, password_hash, created_at, updated_at, from_remote
             FROM users WHERE phone = ?1",
        )?;

        let user = stmt
            .query_row([phone], |row| {
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

    pub fn get_users_by_position(&self, position: &str) -> Result<Vec<User>, DatabaseError> {
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
