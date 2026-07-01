DROP TABLE IF EXISTS station_price_history;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS favorites;
DROP TABLE IF EXISTS stations;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id INT AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stations (
    station_code VARCHAR(20),
    station_name VARCHAR(150) NOT NULL,
    address VARCHAR(255) NOT NULL,
    brand VARCHAR(50),
    self_yn VARCHAR(10),
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (station_code),
    KEY idx_stations_address (address),
    KEY idx_stations_brand (brand),
    KEY idx_stations_self_yn (self_yn)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE favorites (
    user_id INT,
    station_code VARCHAR(20),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, station_code),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (station_code) REFERENCES stations(station_code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reviews (
    id INT AUTO_INCREMENT,
    user_id INT,
    station_code VARCHAR(20),
    rating TINYINT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_reviews_station_code (station_code),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (station_code) REFERENCES stations(station_code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE station_price_history (
    station_code VARCHAR(20),
    price_date DATE NOT NULL,
    premium_gasoline_price INT NULL,
    gasoline_price INT NULL,
    diesel_price INT NULL,
    indoor_kerosene_price INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (station_code, price_date),
    KEY idx_station_price_history_price_date (price_date),
    KEY idx_station_price_history_gasoline_price (gasoline_price),
    KEY idx_station_price_history_diesel_price (diesel_price),
    FOREIGN KEY (station_code) REFERENCES stations(station_code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
