import os
import time
import datetime
from collections import namedtuple
from deepface import DeepFace

from src.advanced_rag.pipeline import RAGPipeline


class Middleware:
    def __init__(
        self,
        tmp_folder_path="tmp/videoframes",
        confusion_threshold_seconds=5,
        confusion_percentage_threshold=0.7,
    ):
        # file folder
        self.tmp_folder_path = tmp_folder_path
        # mantian the detection result list from last x seconds
        self.confusion_threshold_seconds = confusion_threshold_seconds
        # confusion rate
        self.confusion_percentage_threshold = confusion_percentage_threshold

        # For detecting
        self.confused_emotions = ["fear", "surprise", "sadness"]
        self.surprise_threshold = 0.1
        self.fear_threshold = 0.2
        self.sad_threshold = 0.2

        # each user has list of files and list of detection results.
        self.user_list_dict = {}
        self.user_confused_dict = {}
        # last time called llm
        self.last_call = None

        self.rag = RAGPipeline(
            documents_dir=os.path.join(self.tmp_folder_path, "db/raw_documents"),
            api_key= os.environ.get('OPEN-AI-KEY'),
            index_persist_directory=os.path.join(self.tmp_folder_path, "db/index"),
            self_correction=False,
            text_splitter="recursive"
        )

    def is_confused(self, emotions):
        if emotions["surprise"] > self.surprise_threshold and (
            emotions["fear"] > self.fear_threshold
            or emotions["sad"] > self.sad_threshold
        ):
            return True
        return False

    def prepare_chat_history(self, directory, ai_messages_file):
        """Sorts transcript files by overall time and speaker name.

        Args:
            directory: Path to the directory containing transcript files.
            ai_messages_file: Path to the file containing AI messages.

        Returns:
            A list of namedtuples containing speaker name, timestamp, message, and AI flag.
        """

        Transcript = namedtuple("Transcript", ["speaker", "timestamp", "message", "ai"])
        messages = []

        # Process transcript files
        for filename in os.listdir(directory):
            if not filename.endswith(".txt"):
                continue

            speaker = filename.split("_")[-1].rstrip(".txt")

            with open(os.path.join(directory, filename), "r") as f:
                for line in f:
                    try:
                        timestamp, message = line.strip().split(" - ", 1)
                        messages.append(Transcript(speaker, timestamp, message, False))
                    except ValueError:
                        # Skip empty lines
                        pass

        # Process AI messages file
        with open(ai_messages_file, "r") as f:
            for line in f:
                try:
                    timestamp, message = line.strip().split(" - ", 1)
                    messages.append(Transcript("SyposiumAI", timestamp, message, True))
                except ValueError:
                    # Skip empty lines
                    pass

        # Sort by timestamp
        messages.sort(key=lambda x: datetime.datetime.fromisoformat(x.timestamp))

        chat_history = []
        for utterance in messages:
            if utterance.ai:
                chat_history.append(("ai", f"SyposiumAI: {utterance.message}"))
            else:
                if utterance.speaker.lower() == "human":
                    participant_name = utterance.speaker
                else:
                    participant_name = f"{utterance.speaker}"
            chat_history.append(("human", f"{participant_name} : {utterance.message}"))

        return chat_history

    def process_frames(self):
        # list contains names of the folders for each participants, name corresponds to the username, e.g. June.Bond
        users = [f for f in os.listdir(self.tmp_folder_path)]
        # This list contains the full path of the user and the user name. e.g. (June.Bond, tmp/videoframes/June.Bond)
        user_paths = [(f, os.path.join(self.tmp_folder_path, f)) for f in users]

        for user, user_path in user_paths:
            # get the most recent that haven't processed
            current_folder = set(
                [os.path.join(user_path, f) for f in os.listdir(user_path)]
            )
            prev_folder = self.user_list_dict.get(user, set())
            frames = current_folder - prev_folder

            if len(frames) == 0:
                continue

            for frame in frames:
                try:
                    # Analyze the frame using DeepFace
                    analysis = DeepFace.analyze(
                        frame, actions=["emotion"], enforce_detection=False
                    )

                    # Extract the dominant emotion
                    emotion = analysis[0]["emotion"]

                    # Get the current time
                    current_time = time.time()

                    confused = self.is_confused(emotion)
                    confusion_detections = self.user_confused_dict.get(user, [])
                    # Add current detection to the list with timestamp
                    confusion_detections.append((current_time, confused))

                    # Remove detections that are older than the threshold seconds
                    confusion_detections = [
                        (timestamp, is_confused)
                        for (timestamp, is_confused) in confusion_detections
                        if current_time - timestamp <= self.confusion_threshold_seconds
                    ]

                    # Update the list
                    self.user_confused_dict[user] = confusion_detections

                    # Calculate the percentage of confusion detections in the last threshold seconds
                    if confusion_detections:
                        confusion_count = sum(
                            1
                            for (_, is_confused) in confusion_detections
                            if is_confused
                        )
                        total_count = len(confusion_detections)
                        confusion_percentage = confusion_count / total_count
                    else:
                        confusion_percentage = 0

                    # Determine if help message should be displayed
                    # 1. At leat 10 frames
                    # 2. reach threshold
                    # 3. cooldown for requst llm, temporarily 3 mins
                    if (
                        len(confusion_detections) >= 10
                        and confusion_percentage >= self.confusion_percentage_threshold
                        and (
                            self.last_call is None
                            or time.time() - self.last_call >= 3 * 60
                        )
                    ):
                        print(f"{user} detected! with {confusion_percentage}")
                        self.last_call = time.time()
                        chat_history = self.prepare_chat_history(
                            os.path.join(self.tmp_folder_path, "transcriptions"),
                            os.path.join(self.tmp_folder_path, "AI.txt")
                        )
                        message = self.rag(
                            "You will receiver an addressee and a chat history. \
                            Help the addresse according to the system prompt, i.e. get \
                            them up to speed with the meeting based on recent chat history \
                            utterances and explain the concepts currently talked about - if \
                            need be retrieve documents fromt the vectorstore to aid in this.",
                            addressee= user, # user corresponds the username, '.' divedes the first name and second name.
                            chat_history=chat_history,
                            previously_retrieved_docs=[]
                        )["answer"]
                        ai_message = f"SymposiumAI: {message}\n"
                        ai_file_path = os.path.join("tmp", "AI.txt")
                        with open(ai_file_path, "a") as ai_file:
                            ai_file.write(ai_message)
                except Exception as e:
                    print(f"Error processing files: {e}")

            self.user_list_dict[user] = current_folder

    # call to run
    def run(self):
        while True:
            self.process_frames()


detector = Middleware()
detector.run()
