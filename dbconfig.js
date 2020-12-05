let mysql = require('mysql');

//커넥션 연결
let dbConfig = {
    host: "localhost",
    port: "3306",
    user: "root",
    password: "password",
    database: "chatDb",
    multipleStatements : true,
    connectionLimit: 50
};

var pool = mysql.createPool(dbConfig);
module.exports = pool;