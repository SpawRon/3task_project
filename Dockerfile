FROM python:3.10-slim

WORKDIR /app

COPY backend /app/backend
COPY frontend /app/frontend

RUN pip install --no-cache-dir fastapi uvicorn sqlalchemy pydantic python-multipart

RUN mkdir -p /app/uploaded_images

EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]