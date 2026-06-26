from fastapi import FastAPI, Request
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
import uvicorn
import pymysql

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

@app.get("/")
async def home(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {"request": request}
    )

@app.post("/api/adminlogin")
async def login(request: Request):
    data = await request.json()

    username = data.get("username")
    password = data.get("password")

    conn = get_connection()

    try:
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
        conn.close()

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )