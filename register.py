import face_recognition.api as face_recognition
import cv2
import os
import pickle
import json

def register_yourself(student_id, frames):

    PATH = "static/data/"
    STORAGE_PATH = "storage/"

    os.makedirs(PATH, exist_ok=True)
    os.makedirs(STORAGE_PATH, exist_ok=True)

    # Load existing encodings
    try:
        with open(os.path.join(STORAGE_PATH, "known_face_ids.pickle"), "rb") as fp:
            known_face_ids = pickle.load(fp)

        with open(os.path.join(STORAGE_PATH, "known_face_encodings.pickle"), "rb") as fp:
            known_face_encodings = pickle.load(fp)

    except:
        known_face_ids = []
        known_face_encodings = []

    # Load image index
    try:
        with open(os.path.join(STORAGE_PATH, "id_idx.json"), "r") as fp:
            id_idx = json.load(fp)
    except:
        id_idx = {}

    IMAGE_PATH = os.path.join(PATH, student_id)
    os.makedirs(IMAGE_PATH, exist_ok=True)

    start = id_idx.get(student_id, 0)

    saved = 0
    current_index = start

    try:

        for image in frames:

            if saved >= 10:
                break

            # Save image
            image_name = f"{student_id}_{current_index}.jpg"
            image_path = os.path.join(IMAGE_PATH, image_name)

            cv2.imwrite(image_path, image)

            try:

                rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

                encodings = face_recognition.face_encodings(rgb)

                if len(encodings) == 0:
                    print(f"No face detected in frame {current_index}")
                    continue

                known_face_encodings.append(encodings[0])
                known_face_ids.append(student_id)

                saved += 1
                current_index += 1

                # print(f"Saved Frame : {saved}")

            except Exception as e:
                print("Encoding Error :", e)
                continue

        # Save pickle files
        with open(os.path.join(STORAGE_PATH, "known_face_ids.pickle"), "wb") as fp:
            pickle.dump(known_face_ids, fp)

        with open(os.path.join(STORAGE_PATH, "known_face_encodings.pickle"), "wb") as fp:
            pickle.dump(known_face_encodings, fp)

        # Update index
        id_idx[student_id] = current_index

        with open(os.path.join(STORAGE_PATH, "id_idx.json"), "w") as outfile:
            json.dump(id_idx, outfile)

        return {
            "status": "Success",
            "registered_images": saved
        }

    except Exception as e:
        print("Registration Error:", e)

        return {
            "status": "Fail",
            "registered_images": 0
        }