import React, { Component } from 'react';
import io from 'socket.io-client';
import faker from 'faker';
import { IconButton, Badge, Input, Button } from '@material-ui/core';
import {
  Videocam as VideocamIcon,
  VideocamOff as VideocamOffIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
  ScreenShare as ScreenShareIcon,
  StopScreenShare as StopScreenShareIcon,
  CallEnd as CallEndIcon,
  Chat as ChatIcon
} from '@material-ui/icons';
import 'antd/dist/antd.css';
import { Row } from 'reactstrap';
import Modal from 'react-bootstrap/Modal';
import 'bootstrap/dist/css/bootstrap.css';
import './Video.css';

const server_url = 'http://localhost:4001';

const initialState = {
  video: false,
  audio: false,
  screen: false,
  showModal: false,
  screenAvailable: false,
  chatmessages: [],
  AIMessages: [],
  broadcastMessages: [],
  chatmessage: '',
  AIMessage: '',
  newchatmessages: 0,
  askForUsername: true,
  username: faker.internet.userName(),
};

let connections = {};
const peerConnectionConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
let socket = null;
let socketId = null;
let elms = 0;

class Video extends Component {
  constructor(props) {
    super(props);
    this.localVideoref = React.createRef();
    this.videoAvailable = false;
    this.audioAvailable = false;
    this.state = initialState;
    connections = {};
    this.getPermissions();
  }

  getPermissions = async () => {
    try {
      this.videoAvailable = await navigator.mediaDevices.getUserMedia({ video: true }).then(() => true).catch(() => false);
      this.audioAvailable = await navigator.mediaDevices.getUserMedia({ audio: true }).then(() => true).catch(() => false);
      this.setState({ screenAvailable: !!navigator.mediaDevices.getDisplayMedia });

      if (this.videoAvailable || this.audioAvailable) {
        navigator.mediaDevices.getUserMedia({ video: this.videoAvailable, audio: this.audioAvailable }).then((stream) => {
          window.localStream = stream;
          this.localVideoref.current.srcObject = stream;
        }).catch(console.log);
      }
    } catch (e) {
      console.log(e);
    }
  }

  getMedia = () => {
    this.setState({ video: this.videoAvailable, audio: this.audioAvailable }, () => {
      this.getUserMedia();
      this.connectToSocketServer();
    });
  }

  getUserMedia = () => {
    if ((this.state.video && this.videoAvailable) || (this.state.audio && this.audioAvailable)) {
      navigator.mediaDevices.getUserMedia({ video: this.state.video, audio: this.state.audio }).then(this.getUserMediaSuccess).catch(console.log);
    } else {
      try {
        let tracks = this.localVideoref.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      } catch (e) { }
    }
  }

  getUserMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach(track => track.stop());
    } catch (e) { console.log(e); }

    window.localStream = stream;
    this.localVideoref.current.srcObject = stream;

    for (let id in connections) {
      if (id === socketId) continue;
      connections[id].addStream(window.localStream);
      connections[id].createOffer().then((description) => {
        connections[id].setLocalDescription(description).then(() => {
          socket.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }));
        }).catch(console.log);
      });
    }

    stream.getTracks().forEach(track => track.onended = () => {
      this.setState({ video: false, audio: false }, () => {
        try {
          let tracks = this.localVideoref.current.srcObject.getTracks();
          tracks.forEach(track => track.stop());
        } catch (e) { console.log(e); }

        let blackSilence = (...args) => new MediaStream([this.black(...args), this.silence()]);
        window.localStream = blackSilence();
        this.localVideoref.current.srcObject = window.localStream;

        for (let id in connections) {
          connections[id].addStream(window.localStream);
          connections[id].createOffer().then((description) => {
            connections[id].setLocalDescription(description).then(() => {
              socket.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }));
            }).catch(console.log);
          });
        }
      });
    });
  }

  getDislayMedia = () => {
    if (this.state.screen && navigator.mediaDevices.getDisplayMedia) {
      navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }).then(this.getDislayMediaSuccess).catch(console.log);
    }
  }

  getDislayMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach(track => track.stop());
    } catch (e) { console.log(e); }

    window.localStream = stream;
    this.localVideoref.current.srcObject = stream;

    for (let id in connections) {
      if (id === socketId) continue;
      connections[id].addStream(window.localStream);
      connections[id].createOffer().then((description) => {
        connections[id].setLocalDescription(description).then(() => {
          socket.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }));
        }).catch(console.log);
      });
    }

    stream.getTracks().forEach(track => track.onended = () => {
      this.setState({ screen: false }, () => {
        try {
          let tracks = this.localVideoref.current.srcObject.getTracks();
          tracks.forEach(track => track.stop());
        } catch (e) { console.log(e); }

        let blackSilence = (...args) => new MediaStream([this.black(...args), this.silence()]);
        window.localStream = blackSilence();
        this.localVideoref.current.srcObject = window.localStream;

        this.getUserMedia();
      });
    });
  }

  gotMessageFromServer = (fromId, message) => {
    const signal = JSON.parse(message);
    if (fromId !== socketId) {
      if (signal.sdp) {
        connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
          if (signal.sdp.type === 'offer') {
            connections[fromId].createAnswer().then((description) => {
              connections[fromId].setLocalDescription(description).then(() => {
                socket.emit('signal', fromId, JSON.stringify({ 'sdp': connections[fromId].localDescription }));
              }).catch(console.log);
            }).catch(console.log);
          }
        }).catch(console.log);
      }

      if (signal.ice) {
        connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(console.log);
      }
    }
  }

  changeCssVideos = (main) => {
    const widthMain = main.offsetWidth;
    const minWidth = (widthMain * 30 / 100) < 300 ? "300px" : "30%";
    const minHeight = "40%";
    const height = elms === 0 || elms === 1 ? "100%" : elms === 2 ? "100%" : elms === 3 || elms === 4 ? "50%" : `${100 / elms}%`;
    const width = elms === 0 || elms === 1 ? "100%" : elms === 2 ? "45%" : elms === 3 || elms === 4 ? "35%" : `${100 / elms}%`;

    main.querySelectorAll("video").forEach(video => {
      video.style.minWidth = minWidth;
      video.style.minHeight = minHeight;
      video.style.width = width;
      video.style.height = height;
    });

    return { minWidth, minHeight, width, height };
  }

  connectToSocketServer = () => {
    socket = io.connect(server_url, { secure: true });

    socket.on('signal', this.gotMessageFromServer);

    socket.on('connect', () => {
      socket.emit('join-call', window.location.href);
      socketId = socket.id;

      socket.on('chat-message', this.addChatMessage);

      socket.on('user-left', (id) => {
        const video = document.querySelector(`[data-socket="${id}"]`);
        if (video) {
          elms--;
          video.parentNode.removeChild(video);
          this.changeCssVideos(document.getElementById('main'));
        }
      });

      socket.on('user-joined', (id, clients) => {
        clients.forEach((socketListId) => {
          connections[socketListId] = new RTCPeerConnection(peerConnectionConfig);

          connections[socketListId].onicecandidate = (event) => {
            if (event.candidate) {
              socket.emit('signal', socketListId, JSON.stringify({ 'ice': event.candidate }));
            }
          }

          connections[socketListId].onaddstream = (event) => {
            const existingVideo = document.querySelector(`[data-socket="${socketListId}"]`);
            if (existingVideo) {
              existingVideo.srcObject = event.stream;
            } else {
              elms = clients.length;
              const main = document.getElementById('main');
              const cssMesure = this.changeCssVideos(main);

              const video = document.createElement('video');
              video.style = {
                ...{
                  minWidth: cssMesure.minWidth,
                  minHeight: cssMesure.minHeight,
                  maxHeight: "100%",
                  margin: "10px",
                  borderStyle: "solid",
                  borderColor: "#bdbdbd",
                  objectFit: "fill",
                  width: cssMesure.width,
                  height: cssMesure.height,
                }
              };
              video.setAttribute('data-socket', socketListId);
              video.srcObject = event.stream;
              video.autoplay = true;
              video.playsinline = true;
              main.appendChild(video);
            }
          }

          if (window.localStream) {
            connections[socketListId].addStream(window.localStream);
          } else {
            let blackSilence = (...args) => new MediaStream([this.black(...args), this.silence()]);
            window.localStream = blackSilence();
            connections[socketListId].addStream(window.localStream);
          }
        });

        if (id === socketId) {
          for (let id2 in connections) {
            if (id2 === socketId) continue;
            try {
              connections[id2].addStream(window.localStream);
            } catch (e) { }

            connections[id2].createOffer().then((description) => {
              connections[id2].setLocalDescription(description).then(() => {
                socket.emit('signal', id2, JSON.stringify({ 'sdp': connections[id2].localDescription }));
              }).catch(console.log);
            });
          }
        }
      });
    });
  }

  silence = () => {
    let ctx = new AudioContext();
    let oscillator = ctx.createOscillator();
    let dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    ctx.resume();
    return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
  }

  black = ({ width = 640, height = 480 } = {}) => {
    let canvas = Object.assign(document.createElement("canvas"), { width, height });
    canvas.getContext('2d').fillRect(0, 0, width, height);
    let stream = canvas.captureStream();
    return Object.assign(stream.getVideoTracks()[0], { enabled: false });
  }

  handleVideo = () => this.setState({ video: !this.state.video }, this.getUserMedia);
  handleAudio = () => this.setState({ audio: !this.state.audio }, this.getUserMedia);
  handleScreen = () => this.setState({ screen: !this.state.screen }, this.getDislayMedia);

  handleEndCall = () => {
    try {
      let tracks = this.localVideoref.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    } catch (e) { }
    window.location.href = "/";
  }

  openChat = () => this.setState({ showModal: true, newchatmessages: 0 });
  closeChat = () => this.setState({ showModal: false });

  handleChatMessage = (e) => this.setState({ chatmessage: e.target.value });
  handleAIMessage = (e) => this.setState({ AIMessage: e.target.value });

  addChatMessage = (data, sender, socketIdSender) => {
    this.setState((prevState) => ({
      chatmessages: [...prevState.chatmessages, { sender, data }],
      newchatmessages: socketIdSender !== socketId ? prevState.newchatmessages + 1 : prevState.newchatmessages
    }));
  };

  sendChatMessage = () => {
    // Emit chat message to other clients via socket.io
    socket.emit('chat-message', this.state.chatmessage, this.state.username);

    // Send chat message to the Python server
    fetch('http://localhost:5001/chat-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: this.state.chatmessage,
        sender: this.state.username,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        console.log('Success:', data);
      })
      .catch((error) => {
        console.error('Error:', error);
      });

    // Clear chat message input
    this.setState({ chatmessage: '' });
  };

  sendAIMessage = () => {
    // Add AI message to the local state
    this.setState((prevState) => ({
      AIMessages: [...prevState.AIMessages, { sender: this.state.username, data: this.state.AIMessage }],
      AIMessage: '',
    }));

    // Send AI message to the Python server
    fetch('http://localhost:5001/ai-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: this.state.AIMessage,
        sender: this.state.username,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        console.log('Success:', data);
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  };

  handleUsername = (e) => this.setState({ username: e.target.value });

  connect = () => this.setState({ askForUsername: false }, this.getMedia);

  isChrome = () => /google inc/.test(navigator.vendor.toLowerCase()) && /chrome|crios/.test(navigator.userAgent.toLowerCase());

  render() {
    if (!this.isChrome()) {
      return (
        <div style={{ background: 'white', width: '30%', height: 'auto', padding: '20px', minWidth: '400px', textAlign: 'center', margin: 'auto', marginTop: '50px', justifyContent: 'center' }}>
          <h1>Sorry, this works only with Google Chrome</h1>
        </div>
      );
    }
    return (
      <div>
        {this.state.askForUsername ? (
          <div>
            <div style={{ background: 'white', width: '30%', height: 'auto', padding: '20px', minWidth: '400px', textAlign: 'center', margin: 'auto', marginTop: '50px', justifyContent: 'center' }}>
              <p style={{ margin: 0, fontWeight: 'bold', paddingRight: '50px' }}>Set your username</p>
              <Input placeholder="Username" value={this.state.username} onChange={this.handleUsername} />
              <Button variant="contained" color="primary" onClick={this.connect} style={{ margin: '20px' }}>
                Connect
              </Button>
            </div>
            <div style={{ justifyContent: 'center', textAlign: 'center', paddingTop: '40px' }}>
              <video id="my-video" ref={this.localVideoref} autoPlay muted style={{ borderStyle: 'solid', borderColor: '#bdbdbd', objectFit: 'fill', width: '60%', height: '30%' }}></video>
            </div>
          </div>
        ) : (
          <div className="main-container" style={{ display: 'flex', height: '100vh', weight: '80vh' }}>
            <div style={{ flex: 4, display: 'flex', flexDirection: 'column' }}>
              <div className="btn-down" style={{ backgroundColor: 'whitesmoke', color: 'whitesmoke', textAlign: 'center' }}>
                <IconButton style={{ color: '#424242' }} onClick={this.handleVideo}>
                  {this.state.video ? <VideocamIcon /> : <VideocamOffIcon />}
                </IconButton>
                <IconButton style={{ color: '#f44336' }} onClick={this.handleEndCall}>
                  <CallEndIcon />
                </IconButton>
                <IconButton style={{ color: '#424242' }} onClick={this.handleAudio}>
                  {this.state.audio ? <MicIcon /> : <MicOffIcon />}
                </IconButton>
                {this.state.screenAvailable && (
                  <IconButton style={{ color: '#424242' }} onClick={this.handleScreen}>
                    {this.state.screen ? <ScreenShareIcon /> : <StopScreenShareIcon />}
                  </IconButton>
                )}
                <Badge badgeContent={this.state.newchatmessages} max={999} color="secondary" onClick={this.openChat} overlap="rectangular">
                  <IconButton style={{ color: '#424242' }} onClick={this.openChat}>
                    <ChatIcon />
                  </IconButton>
                </Badge>
              </div>

              <Modal show={this.state.showModal} onHide={this.closeChat} style={{ zIndex: '999999' }}>
                <Modal.Header closeButton>
                  <Modal.Title>Open Chat</Modal.Title>
                </Modal.Header>
                <Modal.Body style={{ overflow: 'auto', overflowY: 'auto', height: '400px', textAlign: 'left' }}>
                  {this.state.chatmessages.length > 0 ? (
                    this.state.chatmessages.map((item, index) => (
                      <div key={index} style={{ textAlign: 'left' }}>
                        <p style={{ wordBreak: 'break-all' }}>
                          <b>{item.sender}</b>: {item.data}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p>No messages yet</p>
                  )}
                </Modal.Body>
                <Modal.Footer className="div-send-msg">
                  <Input placeholder="Message" value={this.state.chatmessage} onChange={this.handleChatMessage} />
                  <Button variant="contained" color="primary" onClick={this.sendChatMessage}>
                    Send
                  </Button>
                </Modal.Footer>
              </Modal>

              <Row id="main" className="flex-container" style={{ margin: 0, padding: 0, flex: 1 }}>
                <video id="my-video" ref={this.localVideoref} autoPlay muted style={{ borderStyle: 'solid', borderColor: '#bdbdbd', margin: '10px', objectFit: 'fill', width: '100%', height: '100%' }}></video>
              </Row>
            </div>

            <div className="right-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #ccc', paddingLeft: '20px', boxSizing: 'border-box' }}>
              <div className="broadcast-messages" style={{ flex: 1, overflowY: 'auto', padding: '10px', borderBottom: '1px solid #ccc' }}>
                <h4>Broadcast Messages from SymposiumAI</h4>
                {this.state.broadcastMessages.length > 0 ? (
                  this.state.broadcastMessages.map((item, index) => (
                    <div key={index} style={{ textAlign: 'left' }}>
                      <p style={{ wordBreak: 'break-all' }}>
                        <b>{item.sender}</b>: {item.data}
                      </p>
                    </div>
                  ))
                ) : (
                  <p>No broadcast messages yet</p>
                )}
              </div>

              <div className="ai-chat" style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                <h4>Chat with SymposiumAI</h4>
                <div style={{ overflowY: 'auto', height: '80%', marginBottom: '-20px' }}>
                  {this.state.AIMessages.length > 0 ? (
                    this.state.AIMessages.map((item, index) => (
                      <div key={index} style={{ textAlign: 'left' }}>
                        <p style={{ wordBreak: 'break-all' }}>
                          <b>{item.sender}</b>: {item.data}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p>No messages yet</p>
                  )}
                </div>
                <Input placeholder="Type a message" value={this.state.AIMessage} onChange={this.handleAIMessage} style={{ width: '70%' }} />
                <Button variant="contained" color="primary" onClick={this.sendAIMessage} style={{ marginLeft: '10px' }}>
                  Send
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default Video;
