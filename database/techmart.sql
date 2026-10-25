-- TechMart database for XAMPP / phpMyAdmin
-- phpMyAdmin > Import > choose this file > Go.
CREATE DATABASE IF NOT EXISTS `techmart` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `techmart`;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT NOT NULL AUTO_INCREMENT, name VARCHAR(100) NOT NULL, email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL, role ENUM('customer','admin') NOT NULL DEFAULT 'customer',
  active TINYINT NOT NULL DEFAULT 1, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY uq_users_email (email)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS products (
  id BIGINT NOT NULL AUTO_INCREMENT, name VARCHAR(200) NOT NULL, description TEXT NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'General', price DECIMAL(12,2) NOT NULL, stock INT NOT NULL DEFAULT 0,
  image_url VARCHAR(1000) NOT NULL DEFAULT '', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS orders (
  id BIGINT NOT NULL AUTO_INCREMENT, user_id BIGINT NULL, total DECIMAL(12,2) NOT NULL,
  status ENUM('pending','paid','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id), KEY idx_orders_user (user_id),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT NOT NULL AUTO_INCREMENT, order_id BIGINT NOT NULL, product_id BIGINT NULL, name VARCHAR(255) NOT NULL,
  price DECIMAL(12,2) NOT NULL, qty INT NOT NULL, PRIMARY KEY (id), KEY idx_items_order (order_id),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT NOT NULL AUTO_INCREMENT, user_id BIGINT NULL, audience ENUM('customer','admin') NOT NULL DEFAULT 'customer',
  title VARCHAR(255) NOT NULL, message TEXT NOT NULL, link VARCHAR(255) NOT NULL DEFAULT '/orders.html',
  read_at DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id),
  KEY idx_notifications_user (user_id, id), KEY idx_notifications_audience (audience, id),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS product_reviews (
  id BIGINT NOT NULL AUTO_INCREMENT, product_id BIGINT NOT NULL, user_id BIGINT NOT NULL, rating TINYINT NOT NULL,
  comment VARCHAR(1000) NOT NULL DEFAULT '', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id),
  UNIQUE KEY uq_review_product_user (product_id, user_id), KEY idx_reviews_product (product_id, id),
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE) ENGINE=InnoDB;

INSERT INTO `users` (`id`,`name`,`email`,`password_hash`,`role`,`active`,`created_at`) VALUES
(1,'Admin User','admin@gmail.com','$2a$10$qFlOyWgwrOadfGP1cJW4guA54ceciWL/ZX1LWNefAP9QAytDB2qeW','admin',1,'2026-10-25 01:49:40'),
(2,'Demo Customer','demo@gmail.com','$2a$10$sbyxd36wsYBxBymLt5Uc4u0ftyUew5tUZm/TTqaCVtJLt4E70ZY.S','customer',1,'2026-10-25 01:49:40');

INSERT INTO `products` (`id`,`name`,`description`,`category`,`price`,`stock`,`image_url`,`created_at`,`updated_at`) VALUES
(1,'Wireless Mouse','Ergonomic 2.4GHz wireless mouse with silent clicks.','Accessories',24.99,40,'/images/products/mouse.jpeg','2026-10-25 01:49:40','2026-10-25 01:49:40'),
(2,'Mechanical Keyboard','Hot-swappable switches, white backlight, USB-C.','Accessories',89,15,'/images/products/keyboard.jpeg','2026-10-25 01:49:40','2026-10-25 01:49:40'),
(3,'27" 4K Monitor','IPS panel, 60Hz, HDMI and DisplayPort inputs.','Displays',329,8,'/images/products/monitor.webp','2026-10-25 01:49:40','2026-10-25 01:49:40'),
(4,'USB-C Hub 7-in-1','HDMI, 3x USB-A, SD, microSD and 100W power pass-through.','Accessories',45.5,25,'/images/products/usb-hub.jpg','2026-10-25 01:49:40','2026-10-25 01:49:40'),
(5,'Noise-Cancelling Headphones','Over-ear, 30 hour battery, Bluetooth 5.3.','Audio',159,12,'/images/products/headphones.webp','2026-10-25 01:49:40','2026-10-25 01:49:40'),
(6,'Portable Speaker','Waterproof Bluetooth speaker with 12 hour playtime.','Audio',59.9,30,'/images/products/speaker.webp','2026-10-25 01:49:40','2026-10-25 01:49:40'),
(7,'Webcam 1080p','Auto-focus webcam with built-in dual microphones.','Video',49,3,'/images/products/webcam.jpeg','2026-10-25 01:49:40','2026-10-25 01:49:40'),
(8,'Laptop Stand','Adjustable aluminium stand for 10-17 inch laptops.','Accessories',34,50,'/images/products/laptop-stand.jpg','2026-10-25 01:49:40','2026-10-25 01:49:40'),
(9,'External SSD 1TB','USB 3.2 portable SSD, up to 1000MB/s read speed.','Storage',109,20,'/images/products/ssd.webp','2026-10-25 01:49:40','2026-10-25 01:49:40'),
(10,'Smart Plug (2 pack)','Wi-Fi smart plugs with scheduling and voice control.','Smart Home',22,60,'/images/products/smart-plug.jpg','2026-10-25 01:49:40','2026-10-25 01:49:40'),
(11,'LED Desk Lamp','Dimmable desk lamp with 5 colour temperatures.','Smart Home',39,18,'/images/products/desk-lamp.jpg','2026-10-25 01:49:40','2026-10-25 01:49:40'),
(12,'Gaming Chair','Reclining ergonomic chair with lumbar support.','Furniture',219,0,'/images/products/gaming-chair.jpg','2026-10-25 01:49:40','2026-10-25 01:49:40');

SET FOREIGN_KEY_CHECKS = 1;
