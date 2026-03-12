FROM python:3.12-slim

WORKDIR /app

# install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    tesseract-ocr \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "run.py"]