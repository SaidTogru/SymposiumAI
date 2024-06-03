from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


@app.route("/chat-message", methods=["POST"])
def receive_chat_message():
    data = request.get_json()
    print(f"Received chat message: {data}")
    return jsonify({"status": "success", "message": "Chat message received"}), 200


# @app.route("/ai-message", methods=["POST"])
# def receive_ai_message():
#     data = request.get_json()
#     print(f"Received AI message: {data}")
#     return jsonify({"status": "success", "message": "AI message received"}), 200


@app.route("/upload_audio", methods=["POST"])
def upload_audio():
    audio_data = request.files["audio_data"]
    username = request.form.get("username")  # Get the username
    audio_data.save("uploaded_audio.wav")
    return jsonify({"message": "Audio uploaded successfully"}), 200


if __name__ == "__main__":
    app.run(port=5001)
