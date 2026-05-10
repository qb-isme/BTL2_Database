const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Thqb@123', // Đổi lại đúng mật khẩu MySQL của bạn nhé
    database: 'QuanLyKhoaHoc',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;