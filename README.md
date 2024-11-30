# SymposiumAI

SymposiumAI is a video conference website that enables real-time messaging, video streaming, and screen sharing. Developed with a focus on privacy, performance, and efficiency, SymposiumAI is tailored for AI assistance to ensure that participants always have relevant information at hand, minimizing wasted time in meetings. Leveraging WebRTC for peer-to-peer communication, SymposiumAI offers a seamless and secure experience.

## Beta Demo

[![Watch the Demo](https://img.youtube.com/vi/Baq2E5SWZlg/maxresdefault.jpg)](https://www.youtube.com/watch?v=Baq2E5SWZlg)

## Features
- Unlimited users
- Real-time messaging chat and video streaming
- Screen sharing for presentations and document sharing
- Peer-to-peer communication using WebRTC
- AI-generated info messages to provide context and relevance
- User-specific context file uploads to enhance meeting productivity

## Prerequisites

Ensure you have the following software installed on your system:
- Node.js
- Yarn
- Python

## Setup and Installation

### Frontend Setup

1. **Clone the repository:**
   ```sh
   git clone https://gitlab.lrz.de/cai-ss24/Bystander-in-Multi-Party-Dialogue.git
   cd Bystander-in-Multi-Party-Dialogue
   ```

2. **Install dependencies:**
   ```sh
   yarn install
   ```

3. **Start the frontend server:**
   ```sh
   yarn dev
   ```

### Backend Setup

1. **Install Python dependencies:**
   ```sh
   pip install -r requirements.txt
   ```

2. **Start the backend server:**
   ```sh
   python middleware.py
   ```

## License

SymposiumAI is licensed under the MIT License. See the LICENSE file for more information.

## Acknowledgments

- Thanks to the WebRTC community for providing a robust framework for real-time communication.
- Special thanks to all contributors and testers.
