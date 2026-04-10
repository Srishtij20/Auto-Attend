# Auto-Attend 🚀

AI-based Attendance System using Face Recognition.

## 🔹 Description
Auto-Attend is a production-ready attendance management system built using FastAPI and MongoDB. It uses face recognition technology to automate attendance marking efficiently and accurately.

## 🔹 Features
- Face Registration (supports multiple images for better accuracy)
- Automatic Attendance using face recognition
- Smart Check-in / Check-out detection
- Duplicate attendance prevention within a time window
- REST API for integration with other systems
- Docker support for easy deployment

## 🔹 Tech Stack
- Backend: FastAPI
- Database: MongoDB
- AI/ML: Face Recognition
- Deployment: Docker & Docker Compose

## 🔹 Quick Start

### Using Docker (Recommended)

```bash
git clone https://github.com/Srishtij20/Auto-Attend.git
cd Auto-Attend

cp .env.example .env
docker-compose up -d