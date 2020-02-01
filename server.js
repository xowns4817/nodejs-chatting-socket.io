var express = require('express');
var app = express( );
var http = require('http')
var pool = require('./dbconfig');

var server = http.createServer(app);
server.listen(3000, function( ){
    console.log("Connect Server !");
})
//app.use(express.static('/public'));

var tempNick = ["감자탕","맛탕","새우탕","그라탕","갈비탕","백설탕"];

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/index.html');
})
// 사용자가 연결되면
var io = require('socket.io')(server);
io.on('connection', socket => {
	// 사용자의 소켓 아이디 출력
	console.log('User Connected: ', socket.id);
	// 사용될 닉네임을 결정
	var name = tempNick[Math.floor(Math.random()*6)];

	pool.getConnection(function(err, conn) {
     if(err) throw(err);
	conn.query('SELECT * FROM CHAT', (err, rows, filds)=> {
		console.log(rows);
		if(!err) for(let i=0; i<rows.length; i++) {
			io.to(socket.id).emit('receive message', rows[i].user, rows[i].content);
		}
		else console.log(err);
	});
	});

	// 사용자에게 변경된 닉네임을 보내줌
	io.to(socket.id).emit('change name', name);
	//사용자 입장 알림
	io.emit('in message', name + '님이 입장하셨습니다.');
	// 사용자의 연결이 끊어지면
	socket.on('disconnect', () => {
		console.log('User Disconnected: ', socket.id);
		io.emit('out message', name + '님이 퇴장하셨습니다.');
	});
	// 사용자가 이름 변경 신호를 보내면
	socket.on('rename', (name,text) => {
		console.log(socket.id + '(' + name + ') => ' + text);
		// 사용자에게 변경된 닉네임을 보내줌
		io.to(socket.id).emit('change name', text);
		// (전체)사용자에게 메세지 전달
		io.emit('receive message', name +'님이', text+'(으)로 닉네임을 변경했습니다.');
	});
	
	// 사용자가 메세지 보낸다는 신호를 보내면
	socket.on('send message', (name, text) => {
		//massage = name + ' : ' + text;
		console.log(socket.id + '(' + name + ') : ' + text);
		// (전체)사용자에게 메세지 전달
		io.emit('receive message', name, text);
		pool.getConnection(function(err, conn){
			if(err) throw err;
			conn.query('INSERT INTO CHAT(USER, CONTENT) VALUES(?, ?)', [name, text], function(err, results, fields) {
				if(err) throw(err);
				console.log("채팅 db에 삽입 완료 !");
				conn.release();
			});
		})
	});
});