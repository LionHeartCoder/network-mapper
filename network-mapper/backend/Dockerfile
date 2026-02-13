FROM python:3.11-slim
WORKDIR /app
# When building from project root, copy the backend requirements file
COPY backend/requirements.txt requirements.txt
# Install ping utility
RUN apt-get update && apt-get install -y iputils-ping && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PYTHONUNBUFFERED=1
EXPOSE 5000
CMD ["gunicorn", "backend.app:app", "-b", "0.0.0.0:5000", "--workers", "3"]
