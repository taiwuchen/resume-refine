#!/bin/bash

# ResumeLilt - Start Script
# Starts both backend and frontend servers

cd "$(dirname "$0")"

echo "Starting ResumeLilt..."
echo "Expecting Gotenberg on http://localhost:3000 for PDF previews..."

# Start backend with venv
echo "Starting backend on http://localhost:8000..."
cd backend
../.venv/bin/uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 2

# Start frontend
echo "Starting frontend on http://localhost:5173..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "Both servers started!"
echo "   Backend:  http://localhost:8000"
echo "   Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"

# Handle shutdown
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

# Wait for either process to exit
wait
