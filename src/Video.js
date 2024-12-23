import React, { Component } from 'react';
import io from 'socket.io-client';
import faker from 'faker';

import { IconButton, Badge, Input, Button } from '@material-ui/core';
import VideocamIcon from '@material-ui/icons/Videocam';
import VideocamOffIcon from '@material-ui/icons/VideocamOff';
import MicIcon from '@material-ui/icons/Mic';
import MicOffIcon from '@material-ui/icons/MicOff';
import ScreenShareIcon from '@material-ui/icons/ScreenShare';
import StopScreenShareIcon from '@material-ui/icons/StopScreenShare';
import CallEndIcon from '@material-ui/icons/CallEnd';
import ChatIcon from '@material-ui/icons/Chat';
import InfoIcon from '@material-ui/icons/Info';

import { message } from 'antd';
import 'antd/dist/antd.css';

import { Row } from 'reactstrap';
import Modal from 'react-bootstrap/Modal';
import 'bootstrap/dist/css/bootstrap.css';
import './Video.css';

const server_url = 'http://localhost:4001';

var connections = {};
const peerConnectionConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ],
};
var socket = null;
var socketId = null;
var elms = 0;

class Video extends Component {
  constructor(props) {
    super(props);

    this.localVideoref = React.createRef();

    this.videoAvailable = false;
    this.audioAvailable = false;

    this.state = {
      video: false,
      audio: false,
      screen: false,
      showModal: false,
      showInfoModal: false,
      screenAvailable: false,
      messages: [],
      infoMessages: [],
      message: '',
      newmessages: 0,
      newInfoMessages: 0,
      askForUsername: true,
      username: faker.internet.userName(),
    };
    connections = {};

    this.getPermissions();
  }

  getPermissions = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true })
        .then(() => (this.videoAvailable = true))
        .catch(() => (this.videoAvailable = false));

      await navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => (this.audioAvailable = true))
        .catch(() => (this.audioAvailable = false));

      if (navigator.mediaDevices.getDisplayMedia) {
        this.setState({ screenAvailable: true });
      } else {
        this.setState({ screenAvailable: false });
      }

      if (this.videoAvailable || this.audioAvailable) {
        navigator.mediaDevices.getUserMedia({ video: this.videoAvailable, audio: this.audioAvailable })
          .then((stream) => {
            window.localStream = stream;
            this.localVideoref.current.srcObject = stream;
          })
          .then((stream) => {})
          .catch((e) => console.log(e));
      }
    } catch (e) {
      console.log(e);
    }
  };

  getMedia = () => {
    this.setState(
      {
        video: this.videoAvailable,
        audio: this.audioAvailable,
      },
      () => {
        this.getUserMedia();
        this.connectToSocketServer();
      }
    );
  };

  getUserMedia = () => {
    if ((this.state.video && this.videoAvailable) || (this.state.audio && this.audioAvailable)) {
      navigator.mediaDevices
        .getUserMedia({ video: this.state.video, audio: this.state.audio })
        .then(this.getUserMediaSuccess)
        .then((stream) => {})
        .catch((e) => console.log(e));
    } else {
      try {
        let tracks = this.localVideoref.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      } catch (e) {}
    }
  };

  getUserMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (e) {
      console.log(e);
    }

    window.localStream = stream;
    this.localVideoref.current.srcObject = stream;

    for (let id in connections) {
      if (id === socketId) continue;

      connections[id].addStream(window.localStream);

      connections[id].createOffer().then((description) => {
        connections[id].setLocalDescription(description)
          .then(() => {
            socket.emit('signal', id, JSON.stringify({ sdp: connections[id].localDescription }));
          })
          .catch((e) => console.log(e));
      });
    }

    stream.getTracks().forEach(
      (track) =>
        (track.onended = () => {
          this.setState(
            {
              video: false,
              audio: false,
            },
            () => {
              try {
                let tracks = this.localVideoref.current.srcObject.getTracks();
                tracks.forEach((track) => track.stop());
              } catch (e) {
                console.log(e);
              }

              let blackSilence = (...args) => new MediaStream([this.black(...args), this.silence()]);
              window.localStream = blackSilence();
              this.localVideoref.current.srcObject = window.localStream;

              for (let id in connections) {
                connections[id].addStream(window.localStream);

                connections[id].createOffer().then((description) => {
                  connections[id].setLocalDescription(description)
                    .then(() => {
                      socket.emit('signal', id, JSON.stringify({ sdp: connections[id].localDescription }));
                    })
                    .catch((e) => console.log(e));
                });
              }
            }
          );
        })
    );
  };

  getDislayMedia = () => {
    if (this.state.screen) {
      if (navigator.mediaDevices.getDisplayMedia) {
        navigator.mediaDevices
          .getDisplayMedia({ video: true, audio: true })
          .then(this.getDislayMediaSuccess)
          .then((stream) => {})
          .catch((e) => console.log(e));
      }
    }
  };

  getDislayMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (e) {
      console.log(e);
    }

    window.localStream = stream;
    this.localVideoref.current.srcObject = stream;

    this.captureFramesForScreensharing();

    for (let id in connections) {
      if (id === socketId) continue;

      connections[id].addStream(window.localStream);

      connections[id].createOffer().then((description) => {
        connections[id].setLocalDescription(description)
          .then(() => {
            socket.emit('signal', id, JSON.stringify({ sdp: connections[id].localDescription }));
          })
          .catch((e) => console.log(e));
      });
    }

    stream.getTracks().forEach(
      (track) =>
        (track.onended = () => {
          this.setState(
            {
              screen: false,
            },
            () => {
              try {
                let tracks = this.localVideoref.current.srcObject.getTracks();
                tracks.forEach((track) => track.stop());
              } catch (e) {
                console.log(e);
              }

              let blackSilence = (...args) => new MediaStream([this.black(...args), this.silence()]);
              window.localStream = blackSilence();
              this.localVideoref.current.srcObject = window.localStream;

              this.getUserMedia();
            }
          );
        })
    );
  };

  connectToSocketServer = () => {
    socket = io.connect(server_url, { secure: true });

    socket.on('signal', this.gotMessageFromServer);

    socket.on('ai-message', (message) => {
      this.setState(prevState => ({
        infoMessages: [...prevState.infoMessages, message],
        newInfoMessages: prevState.newInfoMessages + 1
      }));
    });

    socket.on('connect', () => {
      socket.emit('join-call', window.location.href);
      socketId = socket.id;

      socket.emit('register-username', this.state.username);

      socket.on('chat-message', this.addMessage);

      socket.on('user-left', (id) => {
        let video = document.querySelector(`[data-socket="${id}"]`);
        if (video !== null) {
          elms--;
          video.parentNode.removeChild(video);

          let main = document.getElementById('main');
          this.changeCssVideos(main);
        }
      });

      socket.on('user-joined', (id, clients) => {
        clients.forEach((socketListId) => {
          connections[socketListId] = new RTCPeerConnection(peerConnectionConfig);
          connections[socketListId].onicecandidate = function (event) {
            if (event.candidate != null) {
              socket.emit('signal', socketListId, JSON.stringify({ ice: event.candidate }));
            }
          };

          connections[socketListId].onaddstream = (event) => {
            var searchVidep = document.querySelector(`[data-socket="${socketListId}"]`);
            if (searchVidep !== null) {
              searchVidep.srcObject = event.stream;
            } else {
              elms = clients.length;
              let main = document.getElementById('main');
              let cssMesure = this.changeCssVideos(main);

              let video = document.createElement('video');

              let css = {
                minWidth: cssMesure.minWidth,
                minHeight: cssMesure.minHeight,
                maxHeight: '100%',
                margin: '10px',
                borderStyle: 'solid',
                borderColor: '#bdbdbd',
                objectFit: 'fill',
              };
              for (let i in css) video.style[i] = css[i];

              video.style.setProperty('width', cssMesure.width);
              video.style.setProperty('height', cssMesure.height);
              video.setAttribute('data-socket', socketListId);
              video.srcObject = event.stream;
              video.autoplay = true;
              video.playsinline = true;

              main.appendChild(video);
            }
          };

          if (window.localStream !== undefined && window.localStream !== null) {
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
            } catch (e) {}

            connections[id2].createOffer().then((description) => {
              connections[id2].setLocalDescription(description)
                .then(() => {
                  socket.emit('signal', id2, JSON.stringify({ sdp: connections[id2].localDescription }));
                })
                .catch((e) => console.log(e));
            });
          }
        }
      });
    });
  };

  silence = () => {
    let ctx = new AudioContext();
    let oscillator = ctx.createOscillator();
    let dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    ctx.resume();
    return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
  };

  black = ({ width = 640, height = 480 } = {}) => {
    let canvas = Object.assign(document.createElement('canvas'), { width, height });
    canvas.getContext('2d').fillRect(0, 0, width, height);
    let stream = canvas.captureStream();
    return Object.assign(stream.getVideoTracks()[0], { enabled: false });
  };

  handleVideo = () => this.setState({ video: !this.state.video }, () => {
    console.log(this.state.video);
    this.getUserMedia();
    if (this.state.video) {
      this.startVideoCapture();
    } else {
      this.stopVideoCapture();
    }
  });

  handleEndCall = () => {
    try {
      let tracks = this.localVideoref.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
    } catch (e) {}

    this.stopVideoCapture();
    window.location.href = '/';
  };

  handleAudio = () => this.setState({ audio: !this.state.audio }, () => this.getUserMedia());
  handleScreen = () => this.setState({ screen: !this.state.screen }, () => this.getDislayMedia());

  captureVideoFrames = () => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const video = this.localVideoref.current;

    const captureFrame = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          const formData = new FormData();
          formData.append('frame', blob);
          fetch(`${server_url}/tmp/videoframes/${this.state.username}`, {
            method: 'POST',
            body: formData,
          });
        },
        'image/png'
      );
    };

    this.frameInterval = setInterval(captureFrame, 1000);
  };

  startVideoCapture = () => {
    this.captureVideoFrames();
  };

  stopVideoCapture = () => {
    clearInterval(this.frameInterval);
  };

  openChat = () => this.setState({ showModal: true, newmessages: 0 });
  closeChat = () => this.setState({ showModal: false });
  openInfo = () => this.setState({ showInfoModal: true, newInfoMessages: 0 });
  closeInfo = () => this.setState({ showInfoModal: false });
  handleMessage = (e) => this.setState({ message: e.target.value });

  addMessage = (data, sender, socketIdSender) => {
    this.setState((prevState) => ({
      messages: [...prevState.messages, { sender: sender, data: data }],
    }));
    if (socketIdSender !== socketId) {
      this.setState({ newmessages: this.state.newmessages + 1 });
    }
  };

  handleUsername = (e) => this.setState({ username: e.target.value });

  sendMessage = () => {
    socket.emit('chat-message', this.state.message, this.state.username);
    this.setState({ message: '', sender: this.state.username });
  };

  copyUrl = () => {
    let text = window.location.href;
    if (!navigator.clipboard) {
      let textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        message.success('Link copied to clipboard!');
      } catch (err) {
        message.error('Failed to copy');
      }
      document.body.removeChild(textArea);
      return;
    }
    navigator.clipboard.writeText(text).then(
      function () {
        message.success('Link copied to clipboard!');
      },
      () => {
        message.error('Failed to copy');
      }
    );
  };

  connect = () => this.setState({ askForUsername: false }, () => {
    this.getMedia();
    this.startVideoCapture();
    this.startSpeechRecognition();
  });

  isChrome = function () {
    let userAgent = (navigator && (navigator.userAgent || '')).toLowerCase();
    let vendor = (navigator && (navigator.vendor || '')).toLowerCase();
    let matchChrome = /google inc/.test(vendor) ? userAgent.match(/(?:chrome|crios)\/(\d+)/) : null;
    return matchChrome !== null;
  };

  captureFramesForScreensharing = () => {
    if (this.state.screen) {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      const video = this.localVideoref.current;

      const captureFrame = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            const formData = new FormData();
            formData.append('frame', blob);
            fetch(`${server_url}/tmp/screenshare/${this.state.username}`, {
              method: 'POST',
              body: formData,
            });
          },
          'image/png'
        );
      };

      this.frameInterval = setInterval(captureFrame, 1000);
    } else {
      clearInterval(this.frameInterval);
    }
  };

  startSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (event) => {
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                const transcript = event.results[i][0].transcript.trim();
                this.sendTranscription(transcript);
              }
            }
          };

          recognition.onerror = (event) => {
            console.error('Speech recognition error', event);
            if (event.error === 'not-allowed') {
              alert('Microphone access was denied. Please allow access to use speech recognition.');
            }
          };

          recognition.onend = () => {
            recognition.start();
          };

          recognition.start();
        })
        .catch((error) => {
          console.error('Error accessing microphone:', error);
          alert('Microphone is not available or access was denied. Speech recognition will not work.');
        });
    } else {
      console.warn('Web Speech API is not supported in this browser');
    }
  };

  sendTranscription = (text) => {
    fetch(`${server_url}/tmp/transcriptions/${this.state.username}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })
      .then((response) => response.text())
      .then((data) => console.log('Transcription saved:', data))
      .catch((error) => console.error('Error saving transcription:', error));
  };

  render() {
    if (this.isChrome() === false) {
      return (
        <div
          style={{
            background: 'white',
            width: '30%',
            height: 'auto',
            padding: '20px',
            minWidth: '400px',
            textAlign: 'center',
            margin: 'auto',
            marginTop: '50px',
            justifyContent: 'center',
          }}
        >
          <h1>Sorry, this works only with Google Chrome</h1>
        </div>
      );
    }
    return (
      <div>
        {this.state.askForUsername === true ? (
          <div>
            <div
              style={{
                background: 'white',
                width: '30%',
                height: 'auto',
                padding: '20px',
                minWidth: '400px',
                textAlign: 'center',
                margin: 'auto',
                marginTop: '50px',
                justifyContent: 'center',
              }}
            >
              <p style={{ margin: 0, fontWeight: 'bold', paddingRight: '50px' }}>Set your username</p>
              <Input placeholder="Username" value={this.state.username} onChange={(e) => this.handleUsername(e)} />
              <Button variant="contained" color="primary" onClick={this.connect} style={{ margin: '20px' }}>
                Connect
              </Button>
            </div>

            <div style={{ justifyContent: 'center', textAlign: 'center', paddingTop: '40px' }}>
              <video
                id="my-video"
                ref={this.localVideoref}
                autoPlay
                muted
                style={{
                  borderStyle: 'solid',
                  borderColor: '#bdbdbd',
                  objectFit: 'fill',
                  width: '60%',
                  height: '30%',
                }}
              ></video>
            </div>
          </div>
        ) : (
          <div>
            <div className="btn-down" style={{ backgroundColor: 'whitesmoke', color: 'whitesmoke', textAlign: 'center' }}>
              <IconButton style={{ color: '#424242' }} onClick={this.handleVideo}>
                {this.state.video === true ? <VideocamIcon /> : <VideocamOffIcon />}
              </IconButton>

              <IconButton style={{ color: '#f44336' }} onClick={this.handleEndCall}>
                <CallEndIcon />
              </IconButton>

              <IconButton style={{ color: '#424242' }} onClick={this.handleAudio}>
                {this.state.audio === true ? <MicIcon /> : <MicOffIcon />}
              </IconButton>

              {this.state.screenAvailable === true ? (
                <IconButton style={{ color: '#424242' }} onClick={this.handleScreen}>
                  {this.state.screen === true ? <ScreenShareIcon /> : <StopScreenShareIcon />}
                </IconButton>
              ) : null}

              <Badge badgeContent={this.state.newmessages} max={999} color="secondary" onClick={this.openChat}>
                <IconButton style={{ color: '#424242' }} onClick={this.openChat}>
                  <ChatIcon />
                </IconButton>
              </Badge>

              <Badge badgeContent={this.state.newInfoMessages} max={999} color="secondary" onClick={this.openInfo}>
                <IconButton style={{ color: '#424242' }} onClick={this.openInfo}>
                  <InfoIcon />
                </IconButton>
              </Badge>
            </div>

            <Modal show={this.state.showModal} onHide={this.closeChat} style={{ zIndex: '999999' }}>
              <Modal.Header closeButton>
                <Modal.Title>Chat Room</Modal.Title>
              </Modal.Header>
              <Modal.Body style={{ overflow: 'auto', overflowY: 'auto', height: '400px', textAlign: 'left' }}>
                {this.state.messages.length > 0 ? (
                  this.state.messages.map((item, index) => (
                    <div key={index} style={{ textAlign: 'left' }}>
                      <p style={{ wordBreak: 'break-all' }}>
                        <b>{item.sender}</b>: {item.data}
                      </p>
                    </div>
                  ))
                ) : (
                  <p>No message yet</p>
                )}
              </Modal.Body>
              <Modal.Footer className="div-send-msg">
                <Input placeholder="Message" value={this.state.message} onChange={(e) => this.handleMessage(e)} />
                <Button variant="contained" color="primary" onClick={this.sendMessage}>
                  Send
                </Button>
              </Modal.Footer>
            </Modal>

            <Modal show={this.state.showInfoModal} onHide={this.closeInfo} style={{ zIndex: '999999' }}>
              <Modal.Header closeButton>
                <Modal.Title>Info</Modal.Title>
              </Modal.Header>
              <Modal.Body style={{ overflow: 'auto', overflowY: 'auto', height: '400px', textAlign: 'left' }}>
                {this.state.infoMessages.length > 0 ? (
                  this.state.infoMessages.map((item, index) => (
                    <div key={index} style={{ textAlign: 'left' }}>
                      <p style={{ wordBreak: 'break-all' }}>{item}</p>
                    </div>
                  ))
                ) : (
                  <p>No info messages yet</p>
                )}
              </Modal.Body>
            </Modal>

            <div className="container">
              <div style={{ paddingTop: '20px' }}>
                <Input value={window.location.href} disable="true"></Input>
                <Button
                  style={{
                    backgroundColor: '#3f51b5',
                    color: 'whitesmoke',
                    marginLeft: '20px',
                    marginTop: '10px',
                    width: '120px',
                    fontSize: '10px',
                  }}
                  onClick={this.copyUrl}
                >
                  Copy invite link
                </Button>
              </div>

              <Row id="main" className="flex-container" style={{ margin: 0, padding: 0 }}>
                <video
                  id="my-video"
                  ref={this.localVideoref}
                  autoPlay
                  muted
                  style={{
                    borderStyle: 'solid',
                    borderColor: '#bdbdbd',
                    margin: '10px',
                    objectFit: 'fill',
                    width: '100%',
                    height: '100%',
                  }}
                ></video>
              </Row>
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default Video;
