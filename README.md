 
 ### nodejs - socket.io - mysql 

 #### 채팅 history를 디비에 저장

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
 - http://server url:port/
 - 같은 채팅방에 있는 유저들끼리 대화 가능

### [ 확장 예정 ]
 1. 현재 채팅중인방, 채팅인원 
 2. 서버 여러대 확장을 고려해 redis-pub/sub or Mq( rabbitMq, zeroMq )를 통해 분산처리 ( 같은 채팅 방에 있지만 다른서버에 붙은 유저들 처리 가능 )
