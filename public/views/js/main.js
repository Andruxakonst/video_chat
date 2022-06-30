
'use strict';

const startButton = document.getElementById('startButton');
const hangupButton = document.getElementById('closeButton');
const sendButton = document.getElementById('sendButton');
const textVideo = document.getElementById('text_video');
hangupButton.disabled = true;
sendButton.disabled = true;

const remoteVideo = document.getElementById('remoteVideo');
const textSend = document.getElementById('dataChannelSend');
const textRemote = document.getElementById('dataChannelReceive');
const dataAll = document.getElementById('dataAll');
const videoImg = document.getElementById('avatar-img');
const roomUuid = document.getElementById('uuid');

let uuid;
let wsID;
let send_id;
let pc;
let dataChannel;
let localStream;
let iceConfig = {
  iceServers:[
    {
      //urls: 'turn:0441.upphone.ru:3001',
      //urls: 'turn:3.129.208.146:3001', //amazon
      urls: 'turn:185.253.33.221:3001',
      username: 'user',
      credential: 'pass',
    },
    //{urls:'stun:stun.l.google.com:19302'},
  ]
};

//SOCKET.IO!!!

const signaling = io('wss://0441.upphone.ru:3000');
//событие соединения
signaling.on("connect", () => {
  if(signaling.connected){
    console.log('webSocket соединение установлено');
    trace('webSocket соединение установлено');
  }else{
    console.log('webSocket соединение не удалось установить');
    trace('webSocket соединение не удалось установить');
  };
  //отправляем сообщение - представляемся
  signaling.emit('i-am', {'data':'viewer'});
  //обработка событий и передача данных функциям
  signaling.on('your-id', e_yourId);                //Получили присвоенный ID
  signaling.on('ready', ready);                  //Событие звонка
  signaling.on('offer', offer);               //Событие предложение offer
  signaling.on('candidate', candidate);     //Событие icecandidat
  signaling.on('broadcasters', broadcasters);     //Событие icecandidat
  signaling.on('bye', bye);     //Событие icecandidat
});

// функция для отправки сообщений на webSocket сервер
function wsSend(event,send_id,data) {
  let msg = {};
  msg.id = wsID;
  if(data){
    msg.data = data;
  };
  if(send_id){
    msg.send_id = send_id;
  };
  console.log('Отправлено - ',event,msg);
  trace('Отправлено - '+event);
  signaling.emit(event,msg);
};

//ОБРАОТЧИКИ СОБЫТИЙ ОТ SOCKET.IO

//id
function e_yourId(msg){
  try{
    RTCPeerConnection
    wsID = msg.data;
    console.log('wsId:', wsID);
    trace('wsId '+wsID);
  }catch (e){
    alert('WebRTC выключен или не поддерживается браузером! Дальнейшая работа невозможна!')
    console.error('WebRTC выключен или не поддерживается браузером! Дальнейшая работа невозможна!');
    trace('WebRTC выключен или не поддерживается браузером! Дальнейшая работа невозможна!');
    hangupButton.disabled = true;
    sendButton.disabled = true;
    startButton.disabled = true;
  };
};
//offer
async function offer(offer) {
  console.log('offer',offer);
  if (pc) {
    console.error('WebRTC соединение уже существует');
    //закрываем функцию
    //return;
  };
  if(/iPhone|iPad|iPod/i.test(navigator.userAgent)){
    console.log('На iOS нужно получить данные камеры, инче черный экран вместо видео');
    trace('У Вас устройство на базе iOS. Для просмотра вам необходимо принять запрос для получения данных с камеры.');
    navigator.mediaDevices.getUserMedia({'video': true,'audio': true});
  };
  //запускаем функцию создания WebTRC соединения
  await createPeerConnection(offer.id);
  trace('input offer');
  //устанавливаем предложение (offer) как Remote Description
  await pc.setRemoteDescription(offer.data);
  //создаем ответ (answer) на предложение (offer) 
  const answer = await pc.createAnswer();
  //отправляем ответ (answer) удаленному ПК
  wsSend('answer',offer.id,{type: 'answer', sdp: answer.sdp});
  trace('send answer');
  //устанавливаем ответ (answer) как Local Description
  await pc.setLocalDescription(answer);
};
//icecandidat
async function candidate(candidate) {
  //console.log('candidate',candidate);
    //проверяем создано ли соединение
  if (!pc) {
    console.error('Нет peer соединения!');
    return;
  };
    //проверяем есть ли кандидат
    //console.log('candidate',candidate, candidate.data);
  if(pc.iceGatheringState != 'complete'){
    if(candidate.data.candidate){ 
      await pc.addIceCandidate(candidate.data); //есть - addIceCandidate(candidate)
      trace('incoming candidate');
    } else {
      await pc.addIceCandidate(null); //нет -  addIceCandidate(null)
      trace('incoming candidates are over');
    };
  }else{
    trace('ICE кандидат отброшен. complete!');
  };
};

function broadcasters(msg){
  roomUuid.innerHTML = '';
  trace('broadcasters: '+JSON.stringify(msg));
  console.log('broadcasters', msg);
  msg.forEach(br=>{
    let el = document.createElement("option");
    el.textContent = br;
    el.value = br;
    roomUuid.appendChild(el);
  });
};

//включаем кнопку старт когда введен uuid
roomUuid.addEventListener('change', () => {
  //! Сделать проверку ввода ID регуляркой и запросом
  console.log('change')
  if(roomUuid.value !=''){
    send_id = roomUuid.value;
    startButton.disabled = false
  };
});
roomUuid.addEventListener('focus', () => {
  //! Сделать проверку ввода ID регуляркой и запросом
  console.log('focus')
  if(roomUuid.value !=''){
    send_id = roomUuid.value;
    startButton.disabled = false
  };
});

//обработка клика Start
startButton.onclick = async () => {
  remoteVideo.style.opacity = '1';
  trace('Стартуем.');
  //получаем поток с камеры
  
  //отключаем кнопку старт и включаем hangup
  startButton.disabled = true;
  hangupButton.disabled = false;

  send_id = roomUuid.value;
  if(send_id){
      //отправляем сигнал ready удаленному клиенту
      wsSend('ready',send_id);
      trace('Отправляем запрос.');
  }else{
    trace('Введите ID трасляции!');
    alert('Введите ID трасляции!');
  };
};
//нажали кнопку hangup
hangupButton.addEventListener('click', hangup);
//обработчик кнопки отправки сообщений по дата каналу
sendButton.onclick = sendToDataCannel;
//обработчик нажатия кнопки hangup (stop)
function bye(){
  trace('Отключение от трансляции!');
  alert('Вы отключены от трансляции!');
  hangup()
};
async function hangup() {
  console.log('Закрываем соединение! Bye!')
    //проверяем наличие соединения
  if (pc) {     //соединение есть
    pc.close(); //закрываем соединение
    pc = null;  //обнуляем переменную
    dataChannel=null;
  };
  
  //включаем кнопку старт и отключаем hangup
  startButton.disabled = false;
  hangupButton.disabled = true;
  remoteVideo.style.opacity = '0.5';
  wsSend('bye',send_id);
};
//создание дана канала
function createDataChannel(abonent){
  trace('createDataChannel');
    if(!pc){
        console.log('Не удалось создать дата канал. Нет WebRTC соединения')
    }else{
        //создаем дата канал
        if(dataChannel){
            console.log('Дата канал уже открыт')
            return
        }else{
            if(abonent == 'caller'){
                dataChannel = pc.createDataChannel('test');
                dataChannel.binaryType = 'arraybuffer';
                dataChannel.onopen = onDataChannel;
                dataChannel.onmessage = onDataChannelMassage;
            }else{
                 pc.ondatachannel = newDataChannel;
             };
        };
    };
};
//открылся канал данных
function onDataChannel(){
    console.log('Дата канал открыт.');
    trace('Дата канал открыт.');
    sendButton.disabled = false;
    textSend.disabled = false;
    textSend.value = '';
    textRemote.value = '';
};
//пришло сообщение по каналу данных
let fileData = {};
let arrBuffer = [];
let fileUploadSize = 0;
function onDataChannelMassage(msg){
  if(typeof msg.data == 'string' && msg.data.includes('{"type":"')){
    msg = JSON.parse(msg.data);
    console.log('DataCannel', msg)
    switch(msg.type){
      case 'text':
        //console.log('text');
        textRemote.value = msg.data;
        textVideo.innerHTML = msg.data;
      break;
      case 'file_data':
        //console.log('file_data',msg.data);
        fileData = msg.data;
        console.log("Старт передачи данных", fileData.size+' byte')
      break;
      default:
        console.log("Неизвестный тип данных", msg.type)
      break;
    };
  }else{
    fileUploadSize += msg.data.byteLength;
    if(fileData.size > fileUploadSize){
      arrBuffer.push(msg.data);
    }else{
      if(fileData.size == fileUploadSize){
        console.log('Данные переданы успешно', fileUploadSize+' byte');
        //передаем в функцию для дальнейшей обработки 
        fileHandlerSet(arrBuffer, fileData);
        //отчищаем массив и объект для следующей передачи данных
        fileData = {};
        arrBuffer = [];
        fileUploadSize = 0;
      }else{
        console.log(`Ошибка при передачи данных. Размер файла - ${fileData.size}, получено - ${fileUploadSize}`);
      }
    };
  };
};
//обработка полученного массива arreyBuffer
function fileHandlerSet(arrBuffer, fileData){
  //console.log(arrBuffer, fileData);
  let blob = new Blob(arrBuffer, {'type':fileData.type});
  videoImg.src = URL.createObjectURL(blob);
}
//создаем новый канал данных
function newDataChannel(event){
    dataChannel = event.channel;
    dataChannel.binaryType = 'arraybuffer';
    dataChannel.onopen = onDataChannel;
    dataChannel.onmessage = onDataChannelMassage;
};
//отправика по каналу данных
function sendToDataCannel(type, data){
  //console.log("отправка текста", textSend.value);
  dataChannel.send(JSON.stringify({'type':'text' ,'data':textSend.value}));
  textSend.value = '';
};
//Создаем WebRTC соедиение 
function createPeerConnection(abonent) {
  trace('Создаем WebRTC соединение.');
  //создаем объект RTCPeerConnection
  pc = new RTCPeerConnection(iceConfig);
  //слушаем событие работы с ice кандидатами
  pc.oniceconnectionstatechange = event => {
    let state = event.currentTarget.iceGatheringState;
    console.log('ICE State', state);
    trace('ICE State '+state);
    if(state == `closed`){
      send_id = roomUuid.value;
      if(send_id){
          //отправляем сигнал ready удаленному клиенту
          wsSend('ready',send_id);
          trace('Отправляем запрос.');
      }else{
        trace('Введите ID трасляции!');
        alert('Введите ID трасляции!');
      };
    };
  };
  //запускем функцию создания дата соединения
  createDataChannel(abonent)
  //слушаем событие появления icecandidate
  pc.onicecandidate = e => {
    //создаем пустой объект для отправки кандидата
    const message = {
      type: 'candidate',
      candidate: null,
    };
    //если кандидат есть то записываем в него данные 
    if (e.candidate) {
      message.candidate = e.candidate.candidate;
      message.sdpMid = e.candidate.sdpMid;
      message.sdpMLineIndex = e.candidate.sdpMLineIndex;
    };
    //отправляем кандидана другой стороне
    wsSend('candidate',abonent,message);
    trace('send candidate');
  };
  //слушаем события обмена ice даными
  pc.oniceconnectionstatechange = e =>{
    //trace('ice '+JSON.stringify(e));
    console.log('ice', e);
  };
  //слушаем события соединения
  pc.onconnectionstatechange = e => { 
    trace('Статус соедиенения '+e.currentTarget.connectionState);
    console.log('connect', e);
    if(e.currentTarget.connectionState == 'failed'){
      trace('Не удалось установить соединение. Возможно один из клиентов за двумя натами.');
    }
  };
  //слушаем событие появления треков и при появлении трека присваиваем его в remoteVideo
  pc.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
    console.log('ontrack',e.streams[0]);
  };
  //добавляем видео поток в WebRTC соединение (pc.addTrack())
  //remoteVideo.onplay();
}
//когда пришел сигнал Ready от вызывающего
async function ready(data) {
  console.log('ready', typeof data.data);
  if(data.data){
    iceConfig = data.data;
    console.info('ice конфигурация обновлена');
  };
  if(data.id){
    trace('Эта видеотрансляция еще не запущена!');
  }else{
    trace('Видеотрансляция не найдена!');
  };
};
// Логирование данных с учетом таймингов
function trace(arg) {
  var now = (window.performance.now() / 1000).toFixed(3);
  dataAll.value = dataAll.value + now + ': '+ arg+ '\n' ;
};
function IsJson(str) {
  try {
    return true;
  } catch (e) {
    return false;
  }
}