USE gas_station;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS stations (
    station_code VARCHAR(20),
    station_name VARCHAR(150) NOT NULL,
    address VARCHAR(255) NOT NULL,
    brand VARCHAR(50),
    self_yn VARCHAR(10),
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (station_code)
);

CREATE TABLE IF NOT EXISTS station_price_history (
    station_code VARCHAR(20),
    price_date DATE NOT NULL,
    premium_gasoline_price INT NULL,
    gasoline_price INT NULL,
    diesel_price INT NULL,
    indoor_kerosene_price INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (station_code, price_date),
    FOREIGN KEY (station_code) REFERENCES stations(station_code) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS favorites (
    user_id INT,
    station_code VARCHAR(20),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, station_code),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (station_code) REFERENCES stations(station_code) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reviews (
    id INT AUTO_INCREMENT,
    user_id INT,
    station_code VARCHAR(20),
    rating TINYINT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (station_code) REFERENCES stations(station_code) ON DELETE CASCADE
);
