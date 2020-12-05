 
 ### nodejs - socket.io - mysql 

 #### 채팅 history를 디비에 저장

 ### [ 데이터베이스 생성 ]
 ```
 create DATABASE chatDb default character set utf8 collate utf8_general_ci;
 ```
 
 ### [ 테이블 생성 ] -> 채팅 이력 테이블
 ```
  create table chatTable (
    id int not null auto_increment,
    roomId varchar(255) not null,
    userId varchar(50) not null,
    content varchar(255)m
    timstamp datetime default current_timstamp,
    primary key(id)
 );
 ```
 
 ###채방방 접속 방법
 - http://server url:port?roomId="채팅방 아이디"
 - 같은 채팅방에 있는 유저들끼리 대화 가능

### [ 확장 예정 ]
 1. 현재 채팅중인방, 채팅인원 redis로 관리 
 2. 서버 여러대 확장을 고려해 redis-pub/sub or Mq( rabbitMq, zeroMq )를 통해 분산처리 ( 같은 채팅 방에 있지만 다른서버에 붙은 유저들 처리 가능 )
