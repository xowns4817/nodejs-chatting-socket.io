const express = require("express");
const router = express.Router();
const pool2 = require('../dbconfig').getMysql2Pool; // sync (promise)
const pool = require("../dbconfig").getMysqlPool; // async (callback)
const util = require("../util/common");

// main page
router.get('/', async function(req, res) {
    try {
		const connection = await pool2.getConnection(async conn => conn);
		try {
			const sql = 'SELECT * FROM chatRoom';
			const [rows] = await connection.query(sql);
			res.render('chat_main', {"roomData": JSON.stringify(rows)});
		} catch(err) {
			console.log("Query Error : ", err);
		} finally {
			connection.release();
		}
	} catch (err) {
		console.log("DB Connection Error : ", err);
	}
});

// move chatting room
router.get("/in", async function(req, res) {
    let roomId = req.query.roomId;
	let nickname = req.query.nickname;
	let roomTitle = req.query.roomTitle;
	
	try {
		const connection = await pool2.getConnection(async conn => conn);
		try {
			let timestamp = util.getTimeStamp();
			const insert_sql = 'INSERT INTO chatMember(NICKNAME, ROOM_ID, JOIN_TIME) values(?, ?, ?)';
			
			await connection.beginTransaction(); // start transaction
			const [results] = await connection.query(insert_sql, [nickname, roomId, timestamp]);

			const update_sql = 'UPDATE chatRoom set join_member_count = join_member_count + 1 where id = ?';
			const [results2] = await connection.query(update_sql, [roomId]);
			await connection.commit(); // commit

			res.render('client', {"roomId": roomId, "roomTitle": roomTitle, "nickname": nickname});
		} catch(err) {
			console.log("Query Error : ", err);
			await connection.rollback();
		} finally {
			connection.release();
		}
	} catch(err) {
		console.log("DB Connection Error : ", error);
	}
});

// create chatting room
router.get("/create", async function(req, res) {
    let roomTitle = req.query.roomTitle;
	let nickname = req.query.nickname;
	let roomId = null;

	// chatRoom insert -> 트랜잭션 설정 필요
	try {
		const connection = await pool2.getConnection(async conn => conn);
		try {
			let timestamp = util.getTimeStamp( );
			const sql = 'INSERT INTO chatRoom(TITLE, JOIN_MEMBER_COUNT, CREATED) values(?, ?, ?)';

			await connection.beginTransaction(); // start tranaction
			const [rows] = await connection.query(sql, [roomTitle, 0, timestamp]);
			roomId = rows.insertId;

			const sql2 = 'INSERT INTO chatMember(NICKNAME, ROOM_ID, JOIN_TIME) values(?, ?, ?)';
			const [rows2] = await connection.query(sql2, [nickname, roomId, timestamp]);

			// update chatRoom join_member_cnt
			const sql3 = 'UPDATE chatRoom set join_member_count = join_member_count + 1 where id = ?';
			const [rows3] = await connection.query(sql3, [roomId]);

			await connection.commit( ); // commit
			res.render('client', {"roomId": roomId, "roomTitle" : roomTitle, "nickname": nickname});

		} catch(err) {
			console.log("Query Error " + err);
			await connection.rollback();
		} finally {
			connection.release();
		}
	} catch(err) {
		console.log("DB Connection Error : " + err);
	}
});

module.exports = router;