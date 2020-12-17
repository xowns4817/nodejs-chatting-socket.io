
/*
 input html 만들어서 닉네임, 방이름 입력할 수 있도록 한다음
 입력완료 버튼 누르면 해당 값을 넘겨서 ( ejs 사용) 이 값으로 세팅되게 만들어보기 !
 */

const express = require('express');
const app = express( );
const http = require('http')
const pool = require('./dbconfig');
//const redisClient = require('./redisconfig');
const ejs = require('ejs');
const bodyParser = require('body-parser');

app.set('views', __dirname + '/views');
app.set('view engine',  'ejs');
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

var server = http.createServer(app);
server.listen(3000, function( ){
	console.log("Connect Server !");
	//console.log(date_module);
})
//app.use(express.static('/public'));

var tempNick = ["감자탕","맛탕","새우탕","그라탕","갈비탕","백설탕"];

// main page
app.get('/', function(req, res) {
	//chatRoom, chatMember select
	pool.getConnection(function(err, conn) {
		if(err) throw(err);
		conn.query('SELECT * FROM chatRoom', (err, rows, filds)=> {
			if(err) throw(err);
			else {
				console.log(rows);
				res.render('chat_main', {"roomData": JSON.stringify(rows)});
			};
		});
	});
});

// move chatting room
app.get("/chat/in", function(req, res) {
	
	let roomId = req.query.roomId;
	let nickname = req.query.nickname;
	let roomTitle = req.query.roomTitle;

	console.log(roomId);
	console.log(nickname);
	console.log(roomTitle);
	
	pool.getConnection(function(err, conn) {
		if(err) throw(err);
		var timestamp = getTimeStamp( );

			conn.query('INSERT INTO chatMember(NICKNAME, ROOM_ID, JOIN_TIME) values(?, ?, ?)', [nickname, roomId, timestamp], (err, rows, filds)=> {
				if(err) throw(err);
				console.log("member insert success !");
				   
				// update chatRoom join_membercnt
				conn.query('UPDATE chatRoom set join_member_count = join_member_count + 1 where id = ?', [roomId], (err, rows, filds) => {
					if(err) throw(err);
					console.log("chatRoom joinMembers update success !");
					res.render('client', {"roomId": roomId, "roomTitle": roomTitle, "nickname": nickname});
				})
			});
		});
});

// create chatting room
app.get('/chat', function(req, res) {
	console.log(req.query.roomTitle);
	console.log(req.query.nickname);

	let roomTitle = req.query.roomTitle;
	let nickname = req.query.nickname;
	let roomId = null;

	// chatRoom insert
	pool.getConnection(function(err, conn) {
		if(err) throw(err);
		var timestamp = getTimeStamp( );

		 conn.query('INSERT INTO chatRoom(TITLE, JOIN_MEMBER_COUNT, CREATED) values(?, ?, ?)', [roomTitle, 0, timestamp], (err, rows, filds)=> {
		   if(!err) {
			   console.log("room create success !");
			   console.log(rows.insertId);
			   roomId=rows.insertId;
			   conn.query('INSERT INTO chatMember(NICKNAME, ROOM_ID, JOIN_TIME) values(?, ?, ?)', [nickname, roomId, timestamp], (err, rows, filds)=> {
				   if(err) throw(err);
				   console.log("member insert success !");
				   
				   // update chatRoom join_membercnt
				   conn.query('UPDATE chatRoom set join_member_count = join_member_count + 1 where id = ?', [roomId], (err, rows, filds) => {
					   if(err) throw(err);
					   console.log("chatRoom joinMembers update success !");
					   res.render('client', {"roomId": roomId, "roomTitle" : roomTitle, "nickname": nickname});
				   })
			   })
		   }
		   else console.log(err);
		});
	});
	
});

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
			});
		});

	// 사용자에게 변경된 닉네임을 보내줌
	io.to(socket.id).emit('change name', name);
	//사용자 입장 알림
	io.to(roomId).emit('in message', name + '님이 입장하셨습니다.');	
	// 사용자의 연결이 끊어지면
	socket.on('disconnect', () => {
		console.log('User Disconnected: ', socket.id);
		
		let leave_roomId=null;
		let leave_nickname=null;

		pool.getConnection(function(err, conn){
			if(err) throw err;
			else {
				// select roomId, nickname from socket_id ( chatMember )
				conn.query('SELECT * from chatMember where socket_id = ?', [socket.id], function(err, results, fields) {
					if(err) throw(err);
					leave_roomId=results[0].room_id;
					leave_nickname=results[0].nickname;
					io.to(leave_roomId).emit('out message', leave_nickname + '님이 퇴장하셨습니다.');
					// delete out chatmember
					conn.query('DELETE FROM chatMember where room_id = ? and nickname = ?', [leave_roomId, leave_nickname], function(err, results, fields) {
						if(err) throw(err);
						else {
							// update join_member_cnt
							conn.query('UPDATE chatRoom set join_member_count = join_member_count - 1 where id = ?', [leave_roomId], function(err, results, fields) {
								if(err) throw(err);
								else {
									// select join_member_count
									conn.query('SELECT join_member_count from chatRoom where id = ?', [leave_roomId], function(err, results, fields) {
										if(err) throw(err);
										else {
											// delete chatRoom
											if(results[0].join_member_count === 0) {
												// delete chatting Msg
												conn.query('DELETE from chatMsg where room_id = ?', [leave_roomId], function(err, results, fields) {
													if(err) throw(err);

													//delete chatRoom
													conn.query('DELETE FROM chatRoom where id = ?', [leave_roomId], function(err, results, fields) {
														if(err) throw(err);
													});
												});
											}; 
										};
									});
								};
							});
						}
					});
			});
			};
		});
	});
});

	//Client에서 보낸 값 받음		
		socket.on('send message', (name, text, roomId) => {
			//massage = name + ' : ' + text;
			console.log(socket.id + '(' + name + ') : ' + text + ", roomId : " + roomId);
			// (전체)사용자에게 메세지 전달 
			var timestamp = getTimeStamp( );
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

function getTimeStamp() {
    var d = new Date();
    var s =
      leadingZeros(d.getFullYear(), 4) + '-' +
      leadingZeros(d.getMonth() + 1, 2) + '-' +
      leadingZeros(d.getDate(), 2) + ' ' +
  
      leadingZeros(d.getHours(), 2) + ':' +
      leadingZeros(d.getMinutes(), 2) + ':' +
      leadingZeros(d.getSeconds(), 2);
  
    return s;
  }
  
  function leadingZeros(n, digits) {
    var zero = '';
    n = n.toString();
  
    if (n.length < digits) {
      for (i = 0; i < digits - n.length; i++)
        zero += '0';
    }
    return zero + n;
  }