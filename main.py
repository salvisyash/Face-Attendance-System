from fastapi import FastAPI, Request
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
import uvicorn
import pymysql
import base64
import cv2
import numpy as np
import os
from register import register_yourself
from mark_attendance import mark_your_attendance
from pydantic import BaseModel
from collections import defaultdict
from datetime import datetime

app = FastAPI()

def get_connection():
    return pymysql.connect(
        host="localhost",
        user="root",
        password="Root@123",
        database="faceattendancesystem",
        cursorclass=pymysql.cursors.DictCursor
    )

app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")

class RegisterRequest(BaseModel):
    name: str
    rollNo: str
    department: str
    images: list[str]

class AttendanceRequest(BaseModel):
    images: list[str]

class ImageAttendanceRequest(BaseModel):
    image: str

match_name = None
match_count = 0

@app.get("/")
async def home(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {"request": request}
    )

@app.post("/api/adminlogin")
async def login(request: Request):
    try:
        data = await request.json()

        username = data.get("username")
        password = data.get("password")

        conn = get_connection()

        cursor = conn.cursor()
        sql = """
            SELECT username
            FROM admin
            WHERE username=%s AND password=%s
        """
        cursor.execute(sql, (username, password))
        user = cursor.fetchone()

        if user:
            return {
                "success": True,
                "user": user
            }

        return {
            "success": False,
            "message": "Invalid credentials"
        }

    finally:
        cursor.close()
        conn.close()

@app.post("/api/enrollFace")
def enrollFace(data: RegisterRequest):
    try:
        conn = get_connection()

        cursor = conn.cursor()
        sql = """
            SELECT count(*) as count
            FROM student
            WHERE rollno=%s
        """
        cursor.execute(sql, (data.rollNo))
        user = cursor.fetchone()

        if user['count'] > 0:      
            return {
                "status": "Fail",
                "error": f"{data.name} is already exist in system view."
            }
        
        folder = f"static/data/{data.rollNo}"
        photourl = f"static/data/{data.rollNo}/0.jpg"

        os.makedirs(folder, exist_ok=True)

        frames = []

        for i, img in enumerate(data.images):

            img = img.split(",")[1]
            binary = base64.b64decode(img)
            nparr = np.frombuffer(binary, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            cv2.imwrite(f"{folder}/{i}.jpg", frame)
            frames.append(frame)

        register_yourself(data.rollNo, frames)

        insert_sql = """
            INSERT into student(name, rollno, dept, photourl)
            Values(%s, %s, %s, %s)
        """
        cursor.execute(insert_sql, (data.name, data.rollNo, data.department, photourl))
        conn.commit()

        return {
            "status": "Success",
            "name": data.name
        }
    except Exception as e:  
        print(e)    
        return {
            "status": "Fail",
            "error": str(e)
        }
    finally:
        cursor.close()
        conn.close()

@app.post("/api/attendance")
def attendance(data: AttendanceRequest):
    try:
        conn = get_connection()
        cursor = conn.cursor()

        last_name = None
        consecutive_count = 0

        for img in data.images:

            img = img.split(",")[1]
            binary = base64.b64decode(img)
            nparr = np.frombuffer(binary, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            name = mark_your_attendance(frame)
            # print(name)
            if name == "Unknown":
                last_name = None
                consecutive_count = 0
                continue

            if name == last_name:
                consecutive_count += 1
            else:
                last_name = name
                consecutive_count = 1

            if consecutive_count >= 10:

                sql = """
                    SELECT * 
                    FROM student
                    WHERE rollno=%s
                """
                cursor.execute(sql, (last_name))
                user = cursor.fetchone()
                print(user)

                now = datetime.now()
                current_date = now.strftime("%Y-%m-%d")
                current_time = now.strftime("%H:%M")

                insert_sql = """
                    INSERT into attendance(roll_no, att_date, att_time, status)
                    Values(%s, %s, %s, %s)
                """
                cursor.execute(insert_sql, (user['rollno'], current_date, current_time, 'Present'))
                conn.commit()

                return {
                    "status": "Success",
                    "student": user
                }

        return {
            "status": "Unknown"
        }

    except Exception as e:
        return {
            "status": "Fail",
            "error": str(e)
        }
    finally:
        cursor.close()
        conn.close()

@app.post("/api/imageattendance")
def imageattendance(data: ImageAttendanceRequest):
    try:
        # print(data)
        conn = get_connection()
        cursor = conn.cursor()

        img = data.image.split(",")[1]
        binary = base64.b64decode(img)
        nparr = np.frombuffer(binary, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        last_name = mark_your_attendance(frame)
        # print(last_name)
        if last_name != 'Unknown':
            sql = """
                SELECT * 
                FROM student
                WHERE rollno=%s
            """
            cursor.execute(sql, (last_name))
            user = cursor.fetchone()
            print(user)

            now = datetime.now()
            current_date = now.strftime("%Y-%m-%d")
            current_time = now.strftime("%H:%M")

            insert_sql = """
                INSERT into attendance(roll_no, att_date, att_time, status)
                Values(%s, %s, %s, %s)
            """
            cursor.execute(insert_sql, (user['rollno'], current_date, current_time, 'Present'))
            conn.commit()

            return {
                "status": "Success",
                "student": user
            }

        return {
            "status": "Unknown"
        }

    except Exception as e:
        return {
            "status": "Fail",
            "error": str(e)
        }
    finally:
        cursor.close()
        conn.close()

@app.get("/api/attendancelogs")
def get_attendance_logs():
        
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT 
            s.name, s.rollno as id, s.dept as department, s.photourl, a.att_time as attendance_time, a.att_date as attendance_date, a.status 
            FROM student s 
            INNER JOIN attendance a 
            ON s.rollno = a.roll_no
            ORDER BY a.att_date DESC
        """)

        rows = cursor.fetchall()
        print(rows)

        return {
            "status": "Success",
            "data": rows
        }

    except Exception as e:
        return {
            "status": "Fail",
            "error": str(e)
        }
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True, 
        log_level="debug"
    )