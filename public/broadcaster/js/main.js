
'use strict';
// document.addEventListener("DOMContentLoaded", start);
// function start() {

const startButton = document.getElementById('startButton');
const hangupButton = document.getElementById('closeButton');
const sendButton = document.getElementById('sendButton');
const textVideo = document.getElementById('text_video');
const zritel = document.getElementById('zritel');
const otkl_zritel = document.getElementById('otkl_zritel');
hangupButton.disabled = true;
sendButton.disabled = true;

const localVideo = document.getElementById('myVideo');
const testvideo = document.getElementById('testvideo');
const textSend = document.getElementById('dataChannelSend');
const textRemote = document.getElementById('dataChannelReceive');
const dataAll = document.getElementById('dataAll');
const inputFile  = document.getElementById('inputFile');
const videoImg = document.getElementById('avatar-img');
const isScreen = document.getElementById('isScreen');
const isVideo = document.getElementById('isVideo');

let wsID;
let viewers = new Map();
let localStream;
let iceConfig;


//SOCKET.IO!!!

const signaling = io('wss://0441.upphone.ru:3000',{ 
  transports: [ "websocket", "polling" ],
});
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
  signaling.emit('i-am', {'data':'broadcaster'});
  //обработка событий и передача данных функциям
  signaling.on('your-id', e_yourId);                  //Получили присвоенный ID
  signaling.on('ready', ready);                    //Событие звонка
  signaling.on('answer', answer);                     //Событие ответа на offer - answer
  signaling.on('candidate', candidate);               //Событие icecandidat
  signaling.on('bye', bye);                           //Событие bye
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
  trace('Отправлено - '+JSON.stringify(event));
  signaling.emit(event,msg);
};

//ОБРАБОТЧИКИ НАЖАТИЙ КНОПОК

//Start
startButton.onclick = async () => {
  servSelection();
  viewCountViuwers();
  testRTCConnection();
  trace('Стартуем.');
  //получаем поток с камеры
  //let constrain = {audio: true, video: { mandatory: { maxWidth: 320, maxHeight: 240, }}};
  let constrain = {audio: true, video: true};
    if(isScreen.checked || isVideo.checked){
      try{
        if(isScreen.checked){
          localStream = await navigator.mediaDevices.getDisplayMedia(constrain);
        }else{
          localStream = testvideo.captureStream();
        };
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
    localVideo.style.opacity = '1';
    //Направляем поток в элемент video
    localVideo.srcObject = localStream;
  //отключаем кнопку старт и включаем hangup
  startButton.disabled = true;
  hangupButton.disabled = false;
  //отправляем сигнал ready удаленному клиенту
  //wsSend({type: 'ready'});
  trace('Готов к подключению');
};
//Стоп
hangupButton.onclick = async () => {
  //стартуем функцию hangup
  hangup(0);
};
otkl_zritel.onclick = ()=>{
  let ritelOff = zritel.value;
  if(ritelOff == 'all'){
    let rez = window.confirm('Вы уверены что хотите отключить всех зрителей? Это приведет к завершению трансляции!');
    if(rez){
      viewers.forEach((val,key) => hangup(key));
    };//Отключаем всех по очереди
  }else{
    let rez = window.confirm(`Вы уверены что хотите отключить зрителя ${ritelOff}`);
    if(rez){
      hangup(ritelOff);
    };
  };
};
//send
sendButton.onclick = sendToDataCannel;
//обработчик нажатия кнопки hangup (stop)
async function hangup(send_id) {
  //проверяем наличие соединения
  //если другая сторона разорвала соединение
  if(send_id != 0){
    if(viewers.has(send_id)){
      let viewer = viewers.get(send_id);
      wsSend('bye',send_id);
      if(viewer.pc != null){
        viewer.pc.close(); //закрываем соединение
      };
      viewers.delete(send_id)
    }else{
      trace(`Не удалось отправить ${JSON.stringify({'send_id':send_id,type: 'bye'})}`)
    };
  }else{
    trace('Трансляция остановлена!')
    viewers.forEach((viewer, key)=>{
      if(viewer.pc) {     //соединение есть
        wsSend('bye',key);
        viewer.pc.close(); //закрываем соединение
      };
    });
    viewers.clear();
    //если остановили трансляцию кнопкой
    //останавливаем треки с камеры
    localStream.getTracks().forEach(track => track.stop());
    localStream = null; //убиваем переменную потока
    //включаем кнопку старт и отключаем hangup
    startButton.disabled = false;
    hangupButton.disabled = true;
    localVideo.style.opacity = '0.5';
  };
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
//Ready
async function ready(data) {
  //отправка конфигурации серверов stun и turn
  wsSend('ready', data.id, iceConfig);
  viewers.set(data.id,{'candidates_out':[],'candidates_in':[],'reconnect_count':10});
  let viewer = viewers.get(data.id);
  if(localStream){
    //запускаем функцию создания WebRTC соедиения
    await createPeerConnection(data.id);
    //присваиваем offer результат осинхронной F() createOffer()
    const offer = await  viewer.pc.createOffer();
    viewer.offer = offer;
    //Отправляем предложение (offer) клиенту
    wsSend('offer', data.id, {type: 'offer', sdp: offer.sdp});
    trace('Отправлен offer');
    //устанавливаем предложение (offer) как Local Description
    console.log('test', 'offer',offer);
    await  viewer.pc.setLocalDescription(offer);
    console.log('test', 'setLocalDescription(offer)',offer);
  }else{
    console.log('Нет стрима');
    trace('Попытка соедениться. Видеотрансляция не запущена');
    wsSend('ready',data.id,'Not started video stream!')
  };
};
//пришел ответ (answer) на отправленный ранее запрос (offer) 
async function answer(answer) {
  let viewer = viewers.get(answer.id);
  viewer.answer = answer.data;
  //console.log('answer',answer)
    //проверяем есть ли у нас WebRTC соединение
  if (!viewer.pc) {
    console.error('Нет WebRTC соединение!');
    //обрубаем функцию
    return;
  }
  //устанавливаем полученный ответ (answer) как Remote Description
  await viewer.pc.setRemoteDescription(answer.data);
  trace('Получен и установлен answer');
}
//icecandidat
async function candidate(candidate) {
  let viewer = viewers.get(candidate.id);
  viewer.candidates_in.push(candidate.data);
  //console.log('candidate',candidate);
    //проверяем создано ли соединение
  if (!viewer.pc) {
    console.error('Нет peer соединения!');
    return;
  };
    //проверяем есть ли кандидат
    console.log('candidate',candidate, candidate.data);
  if(candidate && candidate.hasOwnProperty('data') && candidate.data.hasOwnProperty('candidate') && candidate.data.candidate) { 
    await viewer.pc.addIceCandidate(candidate.data); //есть - addIceCandidate(candidate)
    trace('Получен с другой сторны и установлен candidate');
  }else {
    await viewer.pc.addIceCandidate(null); //нет -  addIceCandidate(null)
    trace('Получен с другой сторны null candidate - последний');
  };
};
function bye (event){
  if(viewers.has(event.id)){
    console.log('bye',event);
    let viewer = viewers.get(event.id);
    if(viewer.pc && viewer.pc != null){
      viewer.pc.close(); //закрываем соединение
      viewer.pc = viewer.dataChannel = null;
    };
    viewers.delete(event.id);
  }else{
    console.log('Нет пользователя для его отключения. id -', event.id);
  };
  let fine = false;
  for(let viewer = 0; viewer < viewers.length; viewer++){
    if(viewers[viewer].send_id == event.id){
      if(viewers[viewer].pc) {     //соединение есть
        viewers[viewer].pc.close(); //закрываем соединение
        viewers.splice(viewer,1);
        fine = true;
      };
    };
  };
  if(fine){
    trace(`Зритель ${event.id} отключился!`);
  }else{
    trace(`Зритель ${event.id} уже отключен!`);
  };
  viewCountViuwers();
  loadZritel();
};

//WEBRTC

//Создаем WebRTC соедиение 
function createPeerConnection(send_id) {
  //создаем объект RTCPeerConnection
  let viewer = viewers.get(send_id);
  viewer.pc = new RTCPeerConnection(iceConfig);
  trace('Создано WebRTC соединение.');
  //слушаем событие работы с ice кандидатами
  viewer.pc.oniceconnectionstatechange = event => {
    console.log('ICE State', event.currentTarget.iceGatheringState);
    console.log('ICE State2', viewer.pc.iceConnectionState);
    trace('ICE State '+event.currentTarget.iceGatheringState);
  };
  //запускем функцию создания дата соединения
  viewer.dataChannel = viewer.pc.createDataChannel('data');
  viewer.dataChannel.binaryType = 'arraybuffer';
  viewer.dataChannel.onopen = onDataChannel;
  viewer.dataChannel.onmessage = onDataChannelMassage;
  trace('создан dataChannel.');
  //слушаем событие появления icecandidate
  viewer.pc.onicecandidate = e => {
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
    wsSend('candidate',send_id,message);
    viewer.candidates_out.push(message);
    //console.log('ice candidate ', e.candidate.candidate);
  };
  //слушаем события соединения
  viewer.pc.onconnectionstatechange = e => { 
    let status = e.currentTarget.connectionState;
    if(status == 'failed'){
      trace(`Не удалось установить соединение c send_id ${send_id}. Статус соединения - ${status}`);
      console.log( `connect failed ${send_id}`);
    }else{
      trace('Статус соедиенения '+status);
      console.log( `connect status ${send_id}`, status);
    }
  };
  //pc.ontrack = e => remoteVideo.srcObject = e.streams[0];
  //добавляем видео поток в WebRTC соединение (pc.addTrack())
  localStream.getTracks().forEach(track => {
    viewer.pc.addTrack(track, localStream);
    trace(`track send for send_id ${send_id}`);
    //console.log(`track send for send_id ${send_id}`);
  });
};

//СОБЫТИЯ WEBRTC

//открытие канал данных
function onDataChannel(){
    console.log('Дата канал открыт.');
    trace('Дата канал открыт.');
    sendButton.disabled = false;
    textSend.disabled = false;
    inputFile.disabled = false;
    textSend.value = '';
    textRemote.value = '';
    loadZritel();
};
//добавляем зрителей в select для выбора
function loadZritel(){
  //добавляем зрителей в select для выбора
  zritel.innerHTML = '';
  let el = document.createElement("option");
  el.textContent = 'Всем';
  el.value = 'all';
  zritel.appendChild(el);
  el.setAttribute('selected', "selected");
  viewers.forEach((viewer,key)=>{
    if(viewer.pc && 'connectionState' in viewer.pc && viewer.pc.connectionState == 'connected'){
      let el = document.createElement("option");
      el.textContent = key;
      el.value = key;
      zritel.appendChild(el);
    };
  });
};
//сообщение по каналу данных
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
      };
    };
  };
};

//ОТПРАВКА ДАННЫХ ПО WEBRTC!

//отправка данных по каналу данных
function sendToDataCannel(type, data){
  let send_id = zritel.value;
  //console.log('send', type, data)
  switch(type){
    case 'file_data':
      //console.log("отправка данных о файле", type, data);
      if(send_id != 'all'){ //отправка одному
        let viewer = viewers.get(send_id);
        if(viewer){
          if('dataChannel' in viewer){
            if(viewer.dataChannel.readyState == 'open'){
              console.log('отправка данных файла одному',send_id);
              viewer.dataChannel.send(JSON.stringify({type, data}));
            }else{
              console.log(`Соединение со зрителем id ${send_id} не существует или потеряно`);
            };
          }else{
            console.log('viewer.dataChannel.send error',send_id);
          };
        }else{
          console.log(`Не удалось отправить сообщение зрителю ${send_id}`);
        };
      }else{
        viewers.forEach((viewer,key) => {
          console.log('viewer.send_id',key);
          if('dataChannel' in viewer){
            if(viewer.dataChannel.readyState == 'open'){
              console.log('отправка  данных файла всем',viewer);
              viewer.dataChannel.send(JSON.stringify({type, data}));
            }else{
              console.log(`Соединение со зрителем id ${key} не существует или потеряно`);
            };
          }else{
            console.log('viewer.dataChannel.send error',key);
          };
        });
      };
    break;
    case 'file':
      if(send_id != 'all'){ //отправка одному
        let viewer = viewers.get(send_id);
        if(viewer){
          if('dataChannel' in viewer){
            if(viewer.dataChannel.readyState == 'open'){
              console.log('Отправка куска файла одному');
              viewer.dataChannel.send(data);
            }else{
              console.log(`Соединение со зрителем id ${send_id} не существует или потеряно`);
            };
          }else{
            console.log('viewer.dataChannel.send error',send_id);
          };
        }else{
          console.log(`Не удалось отправить сообщение зрителю ${send_id}`);
        };
      }else{
        viewers.forEach((viewer, key) => {
          //console.log('viewer.send_id',viewer.send_id);
          if('dataChannel' in viewer){
            if(viewer.dataChannel.readyState == 'open'){
              console.log('Отправка куска файла всем');
              viewer.dataChannel.send(data);
            }else{
              console.log(`Соединение со зрителем id ${key} не существует или потеряно`);
            };
          }else{
            console.log('viewer.dataChannel.send error',key);
          };
        });
      };
    break;
    default:
      //console.log("отправка текста", textSend.value);
      if(send_id != 'all'){ //отправка одному
        let viewer = viewers.get(send_id);
        if(viewer){
          console.log('отправляем текст одному', send_id, data);
          viewer.dataChannel.send(JSON.stringify({'type':'text' ,'data':textSend.value}));
        }else{
          console.log(`Не удалось отправить сообщение зрителю ${send_id}`);
        };
      }else{
        viewers.forEach(viewer => {
        //console.log('viewer.send_id',viewer.send_id, {'type':'text' ,'data':textSend.value});
        if('dataChannel' in viewer){
          if(viewer.dataChannel.readyState == 'open'){
            viewer.dataChannel.send(JSON.stringify({'type':'text' ,'data':textSend.value}));
          }else{
            console.log(`Соединение со зрителем id ${viewer.send_id} не существует или потеряно`);
          };
        }else{
          console.log('viewer.dataChannel.send error',viewer.send_id);
        };
      });
      };
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
    alert('Файл не выбран');
    console.log('Файл не выбран');
  } else {
    inputFile.disabled = false;
    fileSend(file)
  };
  inputFile.value = ''
};

//функция отправки файла по dataChannel
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

//ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ!
//выбор turn сервера 
function servSelection(){
  let server = document.querySelector('input[name="server"]:checked').value;
  switch(server){
    case 'upTaxi':
      iceConfig = {iceServers:[{
        urls: 'turn:185.253.33.221:3001', //UpTaxi
        username: 'user',
        credential: 'pass',
      }]};
    console.info('Выбран сервер UpTaxi');
    break;
    case 'amazon':
      iceConfig = {iceServers:[{
            urls: 'turn:3.129.208.146:3001', //amazon
            username: 'user',
            credential: 'pass',
          }]};
      console.info('Выбран сервер Amazon');
    break;
    default:
      alert('Выберете turn сервер');
  };
};
//показ количества зрителей
function viewCountViuwers(){
  let count = 0;
  if(viewers.size >0){
    viewers.forEach(viewer=>{
      if(viewer.pc != null && 'connectionState' in viewer.pc &&viewer.pc.connectionState == 'connected'){
        count++;
      };
    });
  };
  textVideo.innerHTML = `Зрителей сейчас: ${count}`;
};
//контроль живости соединения
async function testRTCConnection(){
  setInterval(()=>{
    if(viewers.size > 0){
      viewers.forEach((val,key)=>{
        if('pc' in val && val.pc != null && 'connectionState' in val.pc){
          if(val.pc.connectionState == 'failed' && val.pc.iceConnectionState == 'disconnected'){
            //viewer.pc.close(); //закрываем соединение
            val.pc = null;
            val.dataChannel = null;
            loadZritel();
              console.log('Соединение потеряно. Id', key);
              trace(`Соединение потеряно. Id ${key}`);
          };
        };
      });
    };
    viewCountViuwers();
  },1000);
};
// Логирование данных с учетом таймингов
function trace(arg) {
  var now = (window.performance.now() / 1000).toFixed(3);
  dataAll.value = dataAll.value + now + ': '+ arg+ '\n' ;
};
//определение что пришел JSON
function IsJson(str) {
  try {
    return true;
  } catch (e) {
    return false;
  }
};
// };