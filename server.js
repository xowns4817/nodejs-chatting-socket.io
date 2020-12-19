
/*
 input html 만들어서 닉네임, 방이름 입력할 수 있도록 한다음
 입력완료 버튼 누르면 해당 값을 넘겨서 ( ejs 사용) 이 값으로 세팅되게 만들어보기 !
 */

const express = require('express');
const app = express( );
const http = require('http')
const pool2 = require('./dbconfig').getMysql2Pool; // sync (promise)
const pool = require("./dbconfig").getMysqlPool; // async (callback)
const util = require("./util/common");
//const redisClient = require('./redisconfig');
const ejs = require('ejs');
const chatRouter = require("./router/chat.js");
const bodyParser = require('body-parser');

app.set('views', __dirname + '/views');
app.set('view engine',  'ejs');

app.use('/chat', chatRouter); // 채팅 관련 api는 chat.js로 포워딩
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());


var server = http.createServer(app);
server.listen(3000, function( ){
	console.log("Connect Server !");
})
//app.use(express.static('/public'));


var io = require('socket.io')(server);
io.on('connection', socket => {
	// 사용자의 소켓 아이디 출력
	console.log('User Connected: ', socket.id);

	setInterval(function( ){
		socket.emit('heartBeat', JSON.stringify({cmd: "heartBeat", date : new Date()}));
	}, 5000);
	
	socket.on('joinRoom', function(data) { // 원래는 인자로 data 받아야함 ( client에서 설정 )
		let roomId = data.roomId;
		let name=data.nickname;

		socket.join(roomId); // 새로운 방 들어간다.
		//var name = tempNick[Math.floor(Math.random()*6)];
		io.to(roomId).emit('msgAlert', name + '님이 ' + roomId + '방에 참여하셨습니다.');

	   // roomId, socket_id mapping
	   pool.getConnection(function(err, conn) {
			if(err) throw(err);
			conn.query('UPDATE chatMember set socket_id = ? where room_id = ? and nickname = ?', [socket.id, roomId, name], function(err, results, fields) {
				if(err) throw(err);
				conn.release();
			});
	   });

		// 채팅방 history 조회
		pool.getConnection(function(err, conn) {
			if(err) throw(err);
				conn.query('SELECT * FROM chatMsg Where ROOM_ID = ?', [roomId], (err, rows, filds)=> {
				//console.log(rows);
				if(!err) for(let i=0; i<rows.length; i++) {
					io.to(socket.id).emit('receive message', rows[i].nickname, rows[i].content, rows[i].chat_time);
				} else console.log(err);

				conn.release();
			});
		});

	// 사용자에게 변경된 닉네임을 보내줌
	io.to(socket.id).emit('change name', name);
	//사용자 입장 알림
	io.to(roomId).emit('in message', name + '님이 입장하셨습니다.');	
	// 사용자의 연결이 끊어지면
	socket.on('disconnect', async () => {
		console.log('User Disconnected: ', socket.id);
		
		let leave_roomId=null;
		let leave_nickname=null;

		try {
			const connection = await pool2.getConnection(async conn => conn);
			try {
				// select roomId, nickname, from socket_id ( chatMember )
				const sql = 'SELECT * FROM chatMember where socket_id = ?';

				await connection.beginTransaction( ); // start tranaction
				const [rows] = await connection.query(sql, [socket.id]);
				leave_roomId=rows[0].room_id;
				leave_nickname=rows[0].nickname;
				io.to(leave_roomId).emit('out message', leave_nickname + '님이 퇴장하셨습니다.');

				// delete out member
				const sql2 = 'DELETE FROM chatMember where room_id = ? and nickname = ?';
				const [rows2] = await connection.query(sql2, [leave_roomId, leave_nickname]);

				// update join_member_count
				const sql3 = 'UPDATE chatRoom set join_member_count = join_member_count - 1 where id = ?';
				const [row3] = await connection.query(sql3, [leave_roomId]);

				// select join_member_count
				const sql4 = 'SELECT join_member_count from chatRoom where id = ?';
				const [row4] = await connection.query(sql4, [leave_roomId]);
				
				await connection.commit();

				// delete chatRoom
				if(row4[0].join_member_count === 0 ) {
					//delete chatting Msg
					const sql5 = 'DELETE from chatMsg where room_id = ?';
					const [row5] = await connection.query(sql5, [leave_roomId]);

					//delete chatRoom
					const sql6 = 'DELETE FROM chatRoom where id = ?';
					const [row6] = await connection.query(sql6, [leave_roomId]);
				}
			} catch(err) {
				console.log("Query Error : " + err);
				await connection.rollback();
			} finally {
				connection.release();
			}
		} catch(err) {
			console.log("DB Connection Error : " + err);
		}
	});
});

	//Client에서 보낸 값 받음		
		socket.on('send message', (name, text, roomId) => {
			//massage = name + ' : ' + text;
			console.log(socket.id + '(' + name + ') : ' + text + ", roomId : " + roomId);
			// (전체)사용자에게 메세지 전달 
			var timestamp = util.getTimeStamp( );
			io.to(roomId).emit('receive message', name, text, timestamp);

			//db write
			pool.getConnection(function(err, conn){
				if(err) throw err;
				conn.query('INSERT INTO chatMsg(ROOM_ID, NICKNAME, CONTENT, CHAT_TIME) VALUES(?, ?, ?, ?)', [roomId, name, text, timestamp], function(err, results, fields) {
					if(err) throw(err);
					console.log("채팅 db에 삽입 완료 !");
					conn.release();
				});
			})
		});

		// 사용자가 이름 변경 신호를 보내면
	socket.on('rename', (name, roomId) => {
		//console.log(socket.id + '(' + name + ') => ' + text + ', roomId : ' + roomId);
		// 사용자에게 변경된 닉네임을 보내줌

	/*
		let oldNickName=null;
		for(var i=0; i<userList.length; i++) {
			if(userList[i].socketId === socket.id) {
				oldNickName = userList[i].nickName;
				userList[i].nickName=name;
				break;
			}
		}
		
		io.to(socket.id).emit('change name', name);
		// (전체)사용자에게 메세지 전달
		io.to(roomId).emit('receive message', oldNickName +'님이', name+'(으)로 닉네임을 변경했습니다.', getTimeStamp());
		*/
	});

	// select join members
	socket.on("req members", function(roomId) {
		console.log("req members");
		pool.getConnection(function(err, conn){
			if(err) throw err;
			conn.query('SELECT * FROM chatMember where room_id = ?', [roomId], function(err, results, fields) {
				if(err) throw(err);
				console.log(results);
				socket.emit("res members", JSON.stringify(results));
				conn.release();
			});
		})
	});

	//퇴장 이벤트 -> leave 메시지를 보내면 해당 방에서 나가는 거고 socket 자체가 끊어지는것은 아님. 이부분 처리 필요.
	 socket.on('leaveRoom', function(data){
		let leave_roomId = data.roomId;
		let leave_nickname = data.nickname;
		socket.leave(leave_roomId);

		io.to(leave_roomId).emit('out message', leave_nickname + '님이 퇴장하셨습니다.');
	 });
});