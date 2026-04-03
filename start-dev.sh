#!/bin/bash
echo "Starting Cortexa development servers..."

# Start Express server
cd server && npm run dev &
SERVER_PID=$!

# Start Python AI service
cd ../ai-service && python main.py &
AI_PID=$!

# Start Vite frontend
cd ../client && npm run dev &
CLIENT_PID=$!

echo "All services started!"
echo "Frontend: http://localhost:5173"
echo "Express API: http://localhost:5000"
echo "AI Service: http://localhost:8000"

wait
