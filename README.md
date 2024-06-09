# SymposiumAI
SymposiumAI is a video conference website... Developed with...

### Features
- Unlimited users
- Messaging chat and video streaming in real-time
- Screen sharing to present documents, slides, and more
- Everyting is peer-to-peer thanks to webrtc
...


### Local setup

yarn install
export NODE_OPTIONS=--openssl-legacy-provider
yarn dev

(sudo lsof -i :4001 --> sudo kill -9 X)

## How to simulate virtual webcam (in linux)
sudo apt update  
sudo apt install v4l2loopback-dkms ffmpeg cheese v4l-utils  
sudo modprobe -r v4l2loopback 

sudo modprobe v4l2loopback devices=1 video_nr=2 card_label="VirtualCam" exclusive_caps=1 
ls /dev/video* 

Screen as Webcam Input: sudo ffmpeg -f x11grab -r 15 -s 1280x720 -i :0.0 -vcodec rawvideo -pix_fmt yuv420p -threads 0 -f v4l2 /dev/video2 
Video as Webcam Input: ffmpeg -re -i <some-video>.mp4 -map 0:v -f v4l2 /dev/video2 

v4l2-ctl --list-devices 
cheese --device=/dev/video2 

