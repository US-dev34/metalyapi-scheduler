FROM python:3.12-slim

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all backend code
COPY . .

EXPOSE 8000

# Run from parent context so "backend.main:app" resolves
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
