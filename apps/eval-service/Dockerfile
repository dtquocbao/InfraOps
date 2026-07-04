FROM python:3.12-slim
WORKDIR /app
COPY apps/eval-service/src ./src
RUN pip install --no-cache-dir \
    "fastapi>=0.115.0" \
    "uvicorn[standard]>=0.32.0" \
    "pydantic>=2.9.0" \
    "httpx>=0.27.0" \
    "mlflow>=2.17.0"
EXPOSE 8100
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8100", "--app-dir", "src"]
