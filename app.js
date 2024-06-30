const express = require('express')
const http = require('http')
const cors = require('cors')
const app = express()
const bodyParser = require('body-parser')
const path = require("path")
const xss = require("xss")
const fs = require('fs')
const multer = require('multer')
const { v4: uuidv4 } = require('uuid')

const server = http.createServer(app)
const io = require('socket.io')(server)

app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

if(process.env.NODE_ENV==='production'){
	app.use(express.static(__dirname+"/build"))
	app.get("*", (req, res) => {
		res.sendFile(path.join(__dirname+"/build/index.html"))
	})
}
app.set('port', (process.env.PORT || 4001))

const sanitizeString = (str) => {
	return xss(str)
}

let connections = {}
let messages = {}
let timeOnline = {}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const userDir = path.join(__dirname, 'tmp', 'screenshare', req.params.username);
        if (!fs.existsSync(userDir)){
            fs.mkdirSync(userDir, { recursive: true });
        }
        cb(null, userDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        cb(null, `${timestamp}.png`);
    }
});

const upload = multer({ storage: storage });

app.post('/tmp/screenshare/:username', upload.single('frame'), (req, res) => {
    res.status(200).send('Frame uploaded');
});

const transcriptionDir = path.join(__dirname, 'tmp', 'transcriptions');
if (!fs.existsSync(transcriptionDir)) {
    fs.mkdirSync(transcriptionDir, { recursive: true });
}

app.post('/tmp/transcriptions/:username', (req, res) => {
    const { text } = req.body
    const sanitizedText = sanitizeString(text)
    const logMessage = `${new Date().toISOString()} - ${sanitizedText}\n`
    const filePath = path.join(transcriptionDir, `transcriptions_${req.params.username}.txt`);
    fs.appendFile(filePath, logMessage, (err) => {
        if (err) {
            console.error('Error writing to transcription file', err)
            res.status(500).send('Error saving transcription')
        } else {
            res.status(200).send('Transcription saved')
        }
    })
})

const videoFramesDir = path.join(__dirname, 'tmp', 'videoframes');
if (!fs.existsSync(videoFramesDir)) {
    fs.mkdirSync(videoFramesDir, { recursive: true });
}

const storageVideoFrames = multer.diskStorage({
    destination: (req, file, cb) => {
        const userDir = path.join(videoFramesDir, req.params.username);
        if (!fs.existsSync(userDir)){
            fs.mkdirSync(userDir, { recursive: true });
        }
        cb(null, userDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        cb(null, `${timestamp}.png`);
    }
});

const uploadVideoFrames = multer({ storage: storageVideoFrames });

app.post('/tmp/videoframes/:username', uploadVideoFrames.single('frame'), (req, res) => {
    res.status(200).send('Frame uploaded');
});

const AIFilePath = path.join(__dirname, 'tmp', 'AI.txt');

// Function to read AI.txt file and emit its content to respective clients
const checkAndSendAIContent = () => {
    fs.readFile(AIFilePath, 'utf8', (err, data) => {
        if (err) {
            if (err.code !== 'ENOENT') {
                console.error('Error reading AI.txt file', err);
            }
            return;
        }

        if (data.trim()) { // If the file is not empty
            const lines = data.trim().split('\n');

            lines.forEach(line => {
                const [usernamePart, ...messageParts] = line.split(' ');
                const username = usernamePart.slice(1); // Remove the '@' symbol
                const message = messageParts.join(' ').trim();

                if (username && message) {
                    // Find the socket ID of the user with the given username
                    const socketId = Object.keys(connections).find(key => connections[key].username === username);

                    if (socketId) {
                        io.to(socketId).emit('ai-message', message);
                    }
                }
            });

            // Clear the file after reading
            fs.writeFile(AIFilePath, '', (err) => {
                if (err) {
                    console.error('Error clearing AI.txt file', err);
                }
            });
        }
    });
};

// Check AI.txt file every second
setInterval(checkAndSendAIContent, 1000);

// Store connections with username
io.on('connection', (socket) => {
    socket.on('register-username', (username) => {
        connections[socket.id] = { username };
    });

    socket.on('disconnect', () => {
        delete connections[socket.id];
    });
});

io.on('connection', (socket) => {

	socket.on('join-call', (path) => {
		if(connections[path] === undefined){
			connections[path] = []
		}
		connections[path].push(socket.id)

		timeOnline[socket.id] = new Date()

		for(let a = 0; a < connections[path].length; ++a){
			io.to(connections[path][a]).emit("user-joined", socket.id, connections[path])
		}

		if(messages[path] !== undefined){
			for(let a = 0; a < messages[path].length; ++a){
				io.to(socket.id).emit("chat-message", messages[path][a]['data'], 
					messages[path][a]['sender'], messages[path][a]['socket-id-sender'])
			}
		}

		console.log(path, connections[path])
	})

	socket.on('signal', (toId, message) => {
		io.to(toId).emit('signal', socket.id, message)
	})

	socket.on('chat-message', (data, sender) => {
		data = sanitizeString(data)
		sender = sanitizeString(sender)
	
		var key
		var ok = false
		for (const [k, v] of Object.entries(connections)) {
			for(let a = 0; a < v.length; ++a){
				if(v[a] === socket.id){
					key = k
					ok = true
				}
			}
		}
	
		if(ok === true){
			if(messages[key] === undefined){
				messages[key] = []
			}
			messages[key].push({"sender": sender, "data": data, "socket-id-sender": socket.id})
			console.log("message", key, ":", sender, data)
	
			// Ensure the chat log file exists, create if it doesn't
			const chatLogPath = 'tmp/chat_log.txt';
			if (!fs.existsSync(chatLogPath)) {
				fs.writeFileSync(chatLogPath, '');
			}
	
			// Write message to file
			const logMessage = `${new Date().toISOString()} - ${sender}: ${data}\n`
			fs.appendFile(chatLogPath, logMessage, (err) => {
				if (err) {
					console.error('Error writing to file', err)
				}
			})
	
			for(let a = 0; a < connections[key].length; ++a){
				io.to(connections[key][a]).emit("chat-message", data, sender, socket.id)
			}
		}
	})

	socket.on('disconnect', () => {
		var diffTime = Math.abs(timeOnline[socket.id] - new Date())
		var key
		for (const [k, v] of JSON.parse(JSON.stringify(Object.entries(connections)))) {
			for(let a = 0; a < v.length; ++a){
				if(v[a] === socket.id){
					key = k

					for(let a = 0; a < connections[key].length; ++a){
						io.to(connections[key][a]).emit("user-left", socket.id)
					}
			
					var index = connections[key].indexOf(socket.id)
					connections[key].splice(index, 1)

					console.log(key, socket.id, Math.ceil(diffTime / 1000))

					if(connections[key].length === 0){
						delete connections[key]
					}
				}
			}
		}
	})
})

server.listen(app.get('port'), () => {
	console.log("listening on", app.get('port'))
})
