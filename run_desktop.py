import threading
import time
import webview
import uvicorn
from server.main import app

def start_server():
    # Run the server on localhost:8000
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="error")

if __name__ == '__main__':
    # Start FastAPI in a background thread
    t = threading.Thread(target=start_server, daemon=True)
    t.start()

    # Wait for the server to boot up
    time.sleep(2)

    # Create the native desktop window
    window = webview.create_window(
        title="LogiCade",
        url="http://127.0.0.1:8000",
        width=1280,
        height=720,
        background_color="#101b16",
        text_select=False
    )
    
    # Start the window loop
    webview.start()