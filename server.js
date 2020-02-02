
/*
 input html 만들어서 닉네임, 방이름 입력할 수 있도록 한다음
 입력완료 버튼 누르면 해당 값을 넘겨서 ( ejs 사용) 이 값으로 세팅되게 만들어보기 !
 */

var express = require('express');
var app = express( );
var http = require('http')
var pool = require('./dbconfig');
var ejs = require('ejs');
var bodyParser = require('body-parser');

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

app.get('/', function(req, res) {
	roomId = req.query.roomId;
	res.render('client', {"roomId" : roomId});
})
// 사용자가 연결되면

let userList = [];
var io = require('socket.io')(server);
io.on('connection', socket => {
	// 사용자의 소켓 아이디 출력
	console.log('User Connected: ', socket.id);

	socket.on('joinRoom', function(data) { // 원래는 인자로 data 받아야함 ( client에서 설정 )
		var roomId = data.roomId;
		socket.join(roomId); // 새로운 방 들어간다.
		var name = tempNick[Math.floor(Math.random()*6)];
		io.to(roomId).emit('msgAlert', name + '님이 ' + roomId + '방에 참여하셨습니다.');
	// 사용될 닉네임을 결정
	
    userList.push({ // 채팅방 참여 유저 유저리스트에 추가
		   'socketId': socket.id,
		   'nickName': name,
		   'roomId': roomId
		});

	// 채팅방 history 조회
	pool.getConnection(function(err, conn) {
		if(err) throw(err);
		 conn.query('SELECT * FROM CHAT Where ROOMID = ?', [roomId], (err, rows, filds)=> {
		   console.log(rows);
		   if(!err) for(let i=0; i<rows.length; i++) {
			   io.to(socket.id).emit('receive message', rows[i].user, rows[i].content, rows[i].timestamp);
			  }
			 else console.log(err);
		  });
		 });

	// 사용자에게 변경된 닉네임을 보내줌
	io.to(socket.id).emit('change name', name);
	//사용자 입장 알림
	io.to(roomId).emit('in message', name + '님이 입장하셨습니다.');
	// 사용자의 연결이 끊어지면
	socket.on('disconnect', () => {
		console.log('User Disconnected: ', socket.id);
		//소켓 아이디에 해당하는 roomId와 name을 찾아서 구현해준다.
		var out_roomId;
		var out_name;
			 // 퇴장한 유저 유저 리스트에서 삭제
			 for(var i=0; i<userList.length; i++) {
				if(userList[i].socketId === socket.id) {
					out_roomId = userList[i].roomId;
					out_name = userList[i].nickName;
					userList.splice(i, 1);
					break;
				}
			}

		io.to(out_roomId).emit('out message', out_name + '님이 퇴장하셨습니다.');

		console.log('userList:',userList);

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
				conn.query('INSERT INTO CHAT(ROOMID, USER, CONTENT, TIMESTAMP) VALUES(?, ?, ?, ?)', [roomId, name, text, timestamp], function(err, results, fields) {
					if(err) throw(err);
					console.log("채팅 db에 삽입 완료 !");
					conn.release();
				});
			})
		});

		// 사용자가 이름 변경 신호를 보내면
	socket.on('rename', (name,text, roomId) => {
		console.log(socket.id + '(' + name + ') => ' + text + ', roomId : ' + roomId);
		// 사용자에게 변경된 닉네임을 보내줌
		io.to(socket.id).emit('change name', text);
		// (전체)사용자에게 메세지 전달
		io.to(roomId).emit('receive message', name +'님이', text+'(으)로 닉네임을 변경했습니다.', getTimeStamp());
	});
	
/*
	//퇴장 이벤트
	 socket.on('leaveRoom', function(data){
		socket.leave(data.room);
		console.log('room에서 퇴장');
	 })
*/
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