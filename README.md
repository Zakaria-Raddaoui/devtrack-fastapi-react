# DevTrack

## Project Documentation

DevTrack is a project aimed at simplifying the management and tracking of development tasks.

## Features Overview
- User authentication and authorization.
- Task management (create, read, update, delete tasks).
- Real-time updates using WebSockets.
- Intuitive UI built with React.

## Setup Instructions
1. Clone the repository:
   ```bash
   git clone https://github.com/Zakaria-Raddaoui/devtrack-fastapi-react.git
   cd devtrack-fastapi-react
   ```
2. Set up a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate   # On Linux/Mac
   venv\Scripts\activate      # On Windows
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the application:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
5. Frontend setup:
   - Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
   - Install frontend dependencies:
   ```bash
   npm install
   ```
   - Start the frontend:
   ```bash
   npm start
   ```

Now you should be able to access the application at `http://localhost:8000` for the backend and `http://localhost:3000` for the frontend.

## Contributing
Contributions are welcome! Please read the [CONTRIBUTING.md](CONTRIBUTING.md) for more details.