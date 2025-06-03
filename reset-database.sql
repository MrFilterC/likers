-- Database Reset Script
-- Bu script tüm tabloları temizler ve ID sequence'larını sıfırlar

-- Tüm tabloları temizle (foreign key sırası önemli)
TRUNCATE TABLE leaderboard CASCADE;
TRUNCATE TABLE votes CASCADE;
TRUNCATE TABLE posts CASCADE;
TRUNCATE TABLE rounds CASCADE;
TRUNCATE TABLE users CASCADE;

-- Alternatif: Tabloları tamamen silip yeniden oluşturmak için
-- (Eğer TRUNCATE yeterli olmazsa bu komutları kullanın)

/*
DROP TABLE IF EXISTS leaderboard CASCADE;
DROP TABLE IF EXISTS votes CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS rounds CASCADE;
DROP TABLE IF EXISTS users CASCADE;
*/ 