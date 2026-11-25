-- Legacy Database Schema (MySQL 5.1 dialect)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    failed_attempts INT DEFAULT 0,
    role VARCHAR(20) DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'unpaid',
    due_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    transaction_ref VARCHAR(100),
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial test users
-- admin / password123 (MD5: 482c811da5d5b4bc6d497ffa98491e38)
INSERT INTO users (id, username, password_hash, email, status, role) 
VALUES (1, 'admin', '482c811da5d5b4bc6d497ffa98491e38', 'admin@legacybilling.com', 'active', 'admin');

-- john_doe / secretpass (MD5: 5ebe2294ecd0e0f08eab7690d2a6ee69) - suspended account
INSERT INTO users (id, username, password_hash, email, status, failed_attempts, role) 
VALUES (2, 'john_doe', '5ebe2294ecd0e0f08eab7690d2a6ee69', 'john@example.com', 'suspended', 3, 'customer');
