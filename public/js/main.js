
'use strict';

const startButton = document.getElementById('startButton');
const hangupButton = document.getElementById('closeButton');
const sendButton = document.getElementById('sendButton');
const textVideo = document.getElementById('text_video');
hangupButton.disabled = true;
sendButton.disabled = true;

const localVideo = document.getElementById('myVideo');
const remoteVideo = document.getElementById('remoteVideo');
const textSend = document.getElementById('dataChannelSend');
const textRemote = document.getElementById('dataChannelReceive');
const dataAll = document.getElementById('dataAll');
const inputFile  = document.getElementById('inputFile');
const videoImg = document.getElementById('avatar-img');
const isScreen = document.getElementById('isScreen');
const isZritel = document.getElementById('isZritel');

let uuid;
let pc;
let dataChannel;
let localStream;
let iceConfig = {
  iceServers:[
    {urls:'stun:5.9.21.15:3478'},
    {urls:'stun:95.217.56.59:3478'},
    {urls:'stun:stun.l.google.com:19302'},
  ]
};
//обработка сообщений подобно webSocket
const signaling = new WebSocket('ws://localhost:3000');
signaling.onmessage = e => {
    e = JSON.parse(e.data);
    //console.log('получено - ',JSON.stringify(e));
  if (!localStream && e.type != 'uuid') {
    console.log('Еще нет видеопотока с камеры');
    trace('Еще нет видеопотока с камеры');
    return;
  }
  switch (e.type) {
    case 'uuid':
      uuid = e.uuid;
      console.log('uuid', uuid)
      break;
    case 'offer':
      handleOffer(e);
      break;
    case 'answer':
      handleAnswer(e);
      break;
    case 'candidate':
      handleCandidate(e);
      break;
    case 'ready':
      // A second tab joined. This tab will initiate a call unless in a call already.
      if (pc) {
        console.log('Уже на связи, игнорируем', e.data);
        alert('Кто-то еще пытается дозвониться!');
        trace('Уже на связи, игнорируем');
        return;
      }
      makeCall();
      break;
    case 'bye':
      if (pc) {
        hangup();
      }
      break;
    default:
      console.log('Нерасподнано', e);
      break;
  }
};
signaling.onopen =  () =>{
    console.log('подключился к WebSocket');
    trace('подключился к WebSocket');
};
// функция для отправки сообщений на webSocket сервер
function wsSend(msg) {
    msg.uuid = uuid;
    signaling.send(JSON.stringify(msg));
    //console.log('отправлено - ',JSON.stringify(msg));
};
//обработка клика Start
startButton.onclick = async () => {
  trace('Стартуем.');
  //получаем поток с камеры
  let constrain = {audio: true, video: { mandatory: { maxWidth: 480, maxHeight: 320, }}};
  if(!isZritel.checked){
    if(isScreen.checked){
      try{
        localStream = await navigator.mediaDevices.getDisplayMedia(constrain);
      }catch (e) {
        trace('Не удалось получить видеопоток с дисплея: '+e);
        return;
      };
    }else{
      try{
        localStream = await navigator.mediaDevices.getUserMedia(constrain);
      }catch (e) {
        trace('Не удалось получить видеопоток с камеры: '+e);
        return;
      };
    };
    trace('Видеопоток получен.');
    //Направляем поток в элемент video
    localVideo.srcObject = localStream;
  }else{
    trace('Страрт как зритель');
    localStream = {}//для того что бы не пропустила проверка отправки сокетов т.е. зрителю стрим не нужен
  }
  //отключаем кнопку старт и включаем hangup
  startButton.disabled = true;
  hangupButton.disabled = false;
  //отправляем сигнал ready удаленному клиенту
  wsSend({type: 'ready'});
  trace('Готов к подключению');
};
//нажали кнопку hangup
hangupButton.onclick = async () => {
    //стартуем функцию hangup
  hangup();
  //отправляем BYE удаленному
  wsSend({type: 'bye'});
};
//обработчик кнопки отправки сообщений по дата каналу
sendButton.onclick = sendToDataCannel;
//обработчик нажатия кнопки hangup (stop)
async function hangup() {
    //проверяем наличие соединения
  if (pc) {     //соединение есть
    pc.close(); //закрываем соединение
    pc = null;  //обнуляем переменную
  }
  //останавливаем треки с камеры
  if(!isZritel.checked){
    localStream.getTracks().forEach(track => track.stop());
  };
  localStream = null; //убиваем переменную потока
  //включаем кнопку старт и отключаем hangup
  startButton.disabled = false;
  hangupButton.disabled = true;
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
    inputFile.disabled = false;
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
  //console.log('send', type, data)
  switch(type){
    case 'file_data':
      //console.log("отправка данных о файле", type, data);
      dataChannel.send(JSON.stringify({type, data}));
    break;
    case 'file':
      //console.log("отправка файла", data);
      dataChannel.send(data);
    break;
    default:
      //console.log("отправка текста", textSend.value);
      dataChannel.send(JSON.stringify({'type':'text' ,'data':textSend.value}));
      textSend.value = '';
    break
  };
};
//событие выбора файла для отправки
inputFile.addEventListener('change', fileHandler);
//обработчик события выбора файла и его получение
function fileHandler(){
  const file = inputFile.files[0];
  if (!file) {
    alarm('Файл не выбран');
    console.log('Файл не выбран');
  } else {
    inputFile.disabled = false;
    fileSend(file)
  };
};
//функция отправки файла
function fileSend(file){
  console.log(`File is ${[file.name, file.size, file.type, file.lastModified].join(' ')}`);
  //проверка что файл не пустой
  if (file.size === 0) {
    console.log('Файл пустой.');
    alarm('Файл пустой. Пожалуйста, выберете другой файл для отправки!');
    return;
  };
  const chunkSize = 16384; //длинна куска файла
  //Сигналим что передаем файл
  sendToDataCannel('file_data',{'name':file.name,'size':file.size,'type':file.type, chunkSize});
  let fileReader = new FileReader();
  let offset = 0;           //смещение для отправки следующего куска
  fileReader.addEventListener('error', error => console.error('Ошибка чтения файла:', error));
  fileReader.addEventListener('abort', event => console.log('Чтение файла прервано:', event));
  fileReader.addEventListener('load', e => {
    //console.log('FileRead.onload ', e);
    sendToDataCannel('file',e.target.result);
    offset += e.target.result.byteLength;
    if (offset < file.size) {
      readSlice(offset);
    }
  });
  //функция деления файла на куски в arreyBufer
  function readSlice(chunk){
    //console.log('Прочитан кусок ', chunk);
    const slice = file.slice(offset, chunk + chunkSize);
    fileReader.readAsArrayBuffer(slice);
  };
  readSlice(0);
};
//Создаем WebRTC соедиение 
function createPeerConnection(abonent) {
  trace('Создаем WebRTC соединение.');
  //создаем объект RTCPeerConnection
  pc = new RTCPeerConnection(iceConfig);
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
    }
    //отправляем кандидана другой стороне
    wsSend(message);
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
  pc.ontrack = e => remoteVideo.srcObject = e.streams[0];
  //добавляем видео поток в WebRTC соединение (pc.addTrack())
  if(!isZritel.checked){
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  };
}
//когда пришел сигнал Ready от вызывающего
async function makeCall() {
    //запускаем функцию создания WebRTC соедиения
  await createPeerConnection('caller');
  //присваиваем offer результат осинхронной F() createOffer()
  const offer = await pc.createOffer();
  //Отправляем предложение (offer) клиенту
  wsSend({type: 'offer', sdp: offer.sdp});
  //устанавливаем предложение (offer) как Local Description
  await pc.setLocalDescription(offer);
}
//получили предложение (offer)
async function handleOffer(offer) {
  if (pc) {
    console.error('WebRTC соединение уже существует');
    //закрываем функцию
    return;
  }
  //запускаем функцию создания WebTRC соединения
  await createPeerConnection('callee');
  //устанавливаем предложение (offer) как Remote Description
  await pc.setRemoteDescription(offer);
  //создаем ответ (answer) на предложение (offer) 
  const answer = await pc.createAnswer();
  //отправляем ответ (answer) удаленному ПК
  wsSend({type: 'answer', sdp: answer.sdp});
  //устанавливаем ответ (answer) как Local Description
  await pc.setLocalDescription(answer);
}
//пришел ответ (answer) на отправленный ранее запрос (offer) 
async function handleAnswer(answer) {
    //проверяем есть ли у нас WebRTC соединение
  if (!pc) {
    console.error('Нет WebRTC соединение!');
    //обрубаем функцию
    return;
  }
  //устанавливаем полученный ответ (answer) как Remote Description
  await pc.setRemoteDescription(answer);
}
//пришел ice candidat
async function handleCandidate(candidate) {
    //проверяем создано ли соединение
  if (!pc) {
    console.error('Нет peer соединения!');
    return;
  }
    //проверяем есть ли кандидат
  if (!candidate.candidate) { 
    await pc.addIceCandidate(null); //нет -  addIceCandidate(null)
  } else {
    await pc.addIceCandidate(candidate); //есть - addIceCandidate(candidate)
  }
}
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
