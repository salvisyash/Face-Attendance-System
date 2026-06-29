import face_recognition.api as face_recognition
import cv2
import pickle
import os
import numpy as np
from imutils import face_utils
import dlib

p = "shape_predictor_68_face_landmarks.dat"

detector = dlib.get_frontal_face_detector()
predictor = dlib.shape_predictor(p)

def mark_your_attendance(frame):

    STORAGE_PATH = "storage"

    try:
        with open(os.path.join(STORAGE_PATH, "known_face_ids.pickle"), "rb") as fp:
            known_face_ids = pickle.load(fp)

        with open(os.path.join(STORAGE_PATH, "known_face_encodings.pickle"), "rb") as fp:
            known_face_encodings = pickle.load(fp)

    except:
        return "Unknown"

    # Resize image for faster recognition
    small_frame = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)

    rgb_small_frame = cv2.cvtColor(
        small_frame,
        cv2.COLOR_BGR2RGB
    )

    # Facial landmark detection
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    rects = detector(gray, 0)

    for rect in rects:

        shape = predictor(gray, rect)
        shape = face_utils.shape_to_np(shape)

        for (x, y) in shape:
            cv2.circle(frame, (x, y), 2, (0, 255, 0), -1)

    face_locations = face_recognition.face_locations(rgb_small_frame)

    face_encodings = face_recognition.face_encodings(
        rgb_small_frame,
        face_locations
    )

    detected_students = []

    for face_encoding in face_encodings:

        matches = face_recognition.compare_faces(
            known_face_encodings,
            face_encoding,
            tolerance=0.35
        )

        name = "Unknown"

        if len(known_face_encodings) > 0:

            face_distances = face_recognition.face_distance(
                known_face_encodings,
                face_encoding
            )

            best_match_index = np.argmin(face_distances)

            if matches[best_match_index]:
                name = known_face_ids[best_match_index]

        detected_students.append(name)

    # Draw boxes
    for (top, right, bottom, left), name in zip(face_locations, detected_students):

        top *= 4
        right *= 4
        bottom *= 4
        left *= 4

        color = (0, 255, 0)

        if name == "Unknown":
            color = (0, 0, 255)

        cv2.rectangle(frame,
                      (left, top),
                      (right, bottom),
                      color,
                      2)

        cv2.putText(frame,
                    name,
                    (left, top - 10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    color,
                    2)

    recognized = [
        n for n in detected_students
        if n != "Unknown"
    ]

    if len(recognized) > 0:
        return recognized[0]

    return "Unknown"