# Face Recognition Attendance System

A production-ready attendance management system using face recognition, built with FastAPI and MongoDB.

## Features

- **Face Registration**: Register employee faces with multiple photos for better accuracy
- **Automatic Attendance**: Mark attendance through face recognition
- **Smart Check-in/Check-out**: Automatically determines attendance type based on history
- **Duplicate Prevention**: Prevents marking attendance multiple times within a configurable window
- **REST API**: Full-featured API for integration with other systems
- **Docker Support**: Easy deployment with Docker and Docker Compose

## Quick Start

### Using Docker (Recommended)

```bash
# Clone the repository
git clone [github.com](https://github.com/yourusername/face-attendance-system.git)
cd face-attendance-system

# Copy environment file
cp .env.example .env

# Start the application
docker-compose up -d

# Access the API at [localhost](http://localhost:8000)
# API docs at [localhost](http://localhost:8000/docs)
