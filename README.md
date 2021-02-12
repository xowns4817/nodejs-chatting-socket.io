 
 ### 사용 기술 스택
  - nodejs ( rest server )
  - socket.io
  - mysql
  - mongodb ( 사용 예정 )
  - rabbit mq ( 사용 예정 )
  - spring boot ( 사용 예정 - file server )
  - docker 
  - pm2
  - nginx
  - jenkins
  - redis (pub/sub), replica, sentinel(failover 처리) 

### 코드 구조
 
 ![코드 구조](https://user-images.githubusercontent.com/21052356/102683665-e80f5f00-4215-11eb-8f44-3582cfe335db.PNG)
 
 - router : api request 처리 ( 지금은 채팅관련 api만 있으므로 chat.js만 만들어놈 )
 - util : 공통 모듈 처리
 - view : 화면 처리
 - server.js : 소켓관련 로직 처리

 ### [ 데이터베이스 생성 ]
 ```
 create DATABASE chatDb default character set utf8 collate utf8_general_ci;
 ```
 
 ### 채팅 방 테이블 ( chatRoom )
  - 현재 채팅중인 방 리스트 ( 방이 만들어질때 insert되고 방이 없어질때 delete 된다. )
 ```
   create table chatRoom (
     id int not null auto_increment,
     title varchar(50) not null,
     join_member_count int not null,
     created datetime default current_timestamp,
     primary key(id)
    );
 ```
 
 ### 채팅 방 참여 인원 테이블 ( chatMember )
  - 현재 채팅방에 있는 맴버 리스트 ( 맴버가 방에 참여할때 insert되고 방에서 나갈때 delete 된다. )
  ```
   create table chatMember ( 
    id int not null auto_increment,
    nickname varchar(50) not null,
    room_id int not null,
    socket_id varchar(50),
    join_time datetime default current_timestamp,
    primary key(id),
    foreign key(room_id) references chatRoom(id)
   );
  ```
 
 ### 채팅 이력 테이블 ( chatMsg )
  - 채팅방에서 채팅을 치면 이력이 남는다. -> 해당 방이 삭제되면 같이 delete 됨.
 ```
  create table chatMsg (
    id int not null auto_increment,
    room_id int not null,
    nickname varchar(50) not null,
    content varchar(100) not null,
    chat_time datetime default current_timestamp,
    primary key(id),
    foreign key(room_id) references chatRoomt(id)
 );
 ```

 
 ### 채방방 접속 방법
 - http://server url:port/chat
 - 같은 채팅방에 있는 유저들끼리 대화 가능

### [ 구현된 기능 ]
 1. 채팅방 생성
 2. 채팅방 참여
 3. 같은방에서 채팅
 4. 채팅방 리스트 조회
 5. 채팅방에서 채팅중인 유저 조회
 6. 서버 여러대 확장을 고려해 redis-pub/sub을 통한 서버간 message broadcast 처리
 
 
### [ 확장 예정 ]
 1. Mq( rabbitMq, kafka )를 통해 분산처리 ( db 앞단에서 트래픽 관리 )
 2. 참여자 프로필 이미지 설정 ( 채팅방 참여 전 이미지 받음 )
 3. 채팅방 이미지 업로드 기능
 4 로그 데이터 mongodb로 관리 ( 채팅방 create/delete,  채팅방에 참여자 in/out, 채팅 기록 )
 5. 현재는 채팅방에서 참가자 조회할때 매번 db select하는데.. ->  SessionStroage와 같은 캐시를 써서 매번 디비 안타케 처리
 6. winston으로 로그 관리
 
 
### [사용법]
 - npm install pm2 -g
 - pm2 start start.config.js  ( developement으로 실행)  production으로 실행하고 싶으면 pm2 start start.config.js --evn production
 - https://pm2.keymetrics.io/docs/usage/environment/
 
 #### [ single mode -> 서버 1대 - fork mode]
 - // start.config.js
  ```
  module.exports = {
    apps : [
        {
          name: "chattingServer",
          script: "./server.js",
          watch: true,
          out_file: "/dev/null",
          error_file: "/dev/null",
          env: {
              "PORT": 3000,
              "NODE_ENV": "development"
          },
          env_production: {
            "NODE_ENV": "production"
          }
        }
    ]
  }
  ```
  ![fork_mode](https://user-images.githubusercontent.com/21052356/102951947-e0082700-4482-11eb-8839-aae12ba54ee4.png)
  
  #### [ cluster mode -> 서버 여러대 - cluster mode]
  - https://pm2.keymetrics.io/docs/usage/cluster-mode/
  - pm2 cluster mode를 사용하면 cluster로 묶인 서버들은 pm2를 통해 load balancing이 된다. 각 서버들은 같은 port를 공유한다.
  - // start.config.cluster.json 
  ```
  {
    "apps": [
      {
        "name": "chatting cluster",
        "script": "./server.js",
        "instances": 2, // cpu core 갯수,  0으로 설정하면 pc의 최대 core 갯수
        "exec_mode": "cluster",
        "env": {
          "NODE_ENV": "production",
          "PORT": "3000"
        }
      }
    ]
  } 
  
  ```
  ![cluster_mode](https://user-images.githubusercontent.com/21052356/102952000-f57d5100-4482-11eb-8f80-6646b659ec58.png)
  
 ### [ 서버가 1대 일때 채팅서버 구조 ]
  - socket.io 만으로 처리가능. ( 해당 roomId에 있는 유저들에게 메시지를 보낸다. socket.io의 to 함수를 사용하면 특정 socket.id 또는 특정 room에 있는 소켓들에게 메시지 전송 가능 )
 
 ### [ 서버가 여러대 일때 채팅서버 구조 ]
  - socket.io 만으로는 처리 불가.  각 서버는 메모리에 다른 프로세스로 떠있기 때문에 프로세스 사이의 데이터 공유 못함.  -> redis pub/sub을 통해 가능하다.
  - 대략 flow는 다음과 같다.
    - 각 서버들은 redis의 특정 채널을 subscribe를 하고 Client의 요청이 들어오면 요청을 받은 서버는 해당 요청을 redis로 publish를 날려서 다른 서버들이 메시지를 받을 수 있게 한다.
  
![캡처](https://user-images.githubusercontent.com/21052356/102793419-37f44e80-43ed-11eb-8283-7e4ed5e90727.png)
