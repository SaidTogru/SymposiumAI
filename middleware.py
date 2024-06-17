from deepface import DeepFace
import time, os
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

    def is_confused(self, emotions):
        if emotions["surprise"] > self.surprise_threshold and (
            emotions["fear"] > self.fear_threshold
            or emotions["sad"] > self.sad_threshold
        ):
            return True
        return False

    def process_frames(self):
        users = [f for f in os.listdir(self.tmp_folder_path)]
        user_paths = [(f, os.path.join(self.tmp_folder_path, f)) for f in users]

        for user, user_path in user_paths:
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
                        # TODO collect all new information in the tmp folder for every user as context
                        # NOTE exclude of course videoframes (thats just for confusion detection)
                        # NOTE Then call the LLM call call_llm to generate a response for the user with the given context
                        # NOTE message = self.call_llm
                        message = None
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
