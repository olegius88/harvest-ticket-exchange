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

pub struct TalonDatabase {
    conn: Connection,
}

impl TalonDatabase {
    pub fn new<P: AsRef<Path>>(db_path: P) -> Result<Self, DatabaseError> {
        let conn = Connection::open(db_path)?;
        let mut db = TalonDatabase { conn };
        db.initialize_tables()?;
        Ok(db)
    }

    fn initialize_tables(&mut self) -> Result<(), DatabaseError> {
        // Создаем таблицу пользователей
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                fio TEXT NOT NULL,
                phone TEXT NOT NULL UNIQUE,
                position TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                from_remote BOOLEAN NOT NULL DEFAULT FALSE
            )",
            [],
        )?;

        // Создаем индексы
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)",
            [],
        )?;

        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_users_position ON users(position)",
            [],
        )?;

        Ok(())
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
                &"false".to_string(),
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
                    from_remote: row.get(7)?,
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
                    from_remote: row.get(7)?,
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
                from_remote: row.get(7)?,
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
}
