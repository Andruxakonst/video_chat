const http = require("http");
const fs = require( "fs");
const ws = require('socket.io');

const port = 3000;
const server = http.createServer((req, res)=>{
    //console.log(req.host, req.port, req.url);
    let url = new URL(req.url, `http://${req.headers.host}`);
    let path = url.pathname; 
    if((path.includes('room'))){
        let params = url.searchParams;
        if(params.get("room_id")){
            res.statusCode = 200;
            res.removeHeader('Access-Control-Allow-Origin');
            res.end('room');
        }else{
            sendHtml('/errors/no_room_param.html');
        };
    }else{
        if(!path.includes('.')){
            path = path+'/index.html';
        };
        if(path == 'socket.io/socket.io.js'){
            
        }else{
            sendHtml(path);
        };
    };

    async function sendHtml(path){
        return await fs.readFile(`public${path}`, (error, data) => {
            if (error) {
                console.log(error)
                res.statusCode = 404;
                res.end('404 \n Resourse not found!');
            } else {
                //res.statusCode = 200;
                res.writeHead(200,{
                    'Access-Control-Allow-Origin': '*',
                    "Access-Control-Allow-Headers": "X-Requested-With",
                    "Access-Control-Allow-Headers": "Content-Type",
                    "Access-Control-Allow-Methods": "PUT, GET, POST, DELETE, OPTIONS",
                    "Access-Control-Allow-Credentials": "true"
                });
                res.end(data);
            };
        }); 
    };
});
server.listen(port, () => console.log("Server started"));
//socket.io
const io = ws(server);
let wsArr = [];
let rooms = [];
let viewers = [];
let broadcasters = [];
io.on('connection', (ws) => {
    //первое соединение сокета
    ws.on('i-am', (msg) => {
        switch(msg.data){
            case 'viewer':
                wsArr.push(ws.id);
                viewers.push(ws.id);
            break;
            case 'broadcaster':
                wsArr.push(ws.id);
                broadcasters.push(ws.id);
                io.emit('broadcasters',broadcasters);
            break;
            default:
                wsArr.push(ws.id);
                console.log('Неизвестный пользователь - ',ws.id, msg.data);
            break;
        };
        ws.emit('your-id', {"data":ws.id});
    });
    io.emit('broadcasters',broadcasters);
    ws.on('ready', ready);
    ws.on('offer', offer);
    ws.on('answer', answer);
    ws.on('candidate', candidate);
    ws.on('bye', bye);
    ws.on('disconnect', () => {
        //чистим массивы от отключенных пользователей
        if(wsArr.indexOf(ws.id) !== -1){
            let index = wsArr.indexOf(ws.id);
            wsArr.splice(index,1);
        };
        if(viewers.indexOf(ws.id) !== -1){
            viewers.splice(viewers.indexOf(ws.id),1);
        };
        if(broadcasters.indexOf(ws.id) !== -1){
            broadcasters.splice(broadcasters.indexOf(ws.id),1);
            io.emit('broadcasters',broadcasters);
        };
    });
});

//ОБРАБОТЧИКИ СОБЫТИЙ ОТ WEBSOCKET ON

function ready(msg){
    send('ready',msg);
};
function offer(msg){
    send('offer',msg);
};
function answer(msg){
    send('answer',msg);
};
function candidate(msg){
    send('candidate',msg);
};
function bye(msg){
    send('bye',msg);
    // setTimeout(()=>{
    //     io.sockets.sockets.get(msg.id).disconnect();
    // }, 2000);
};

function send(type,msg){
    if(type == 'ready' ||type == 'answer' || type == 'offer' ||type == 'candidate'||type == 'bye'){
        let ws = io.sockets.sockets.get(msg.send_id);
        if(ws){
            ws.emit(type, msg);
        }else{
            io.sockets.sockets.get(msg.id).emit(type, 'Error - not user');
        };
    }else{
        console.log('!', type);
    };
};