FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir -r requirements.txt

COPY wait-for-postgres.sh /wait-for-postgres.sh
RUN chmod +x /wait-for-postgres.sh

COPY . .

EXPOSE 8000

CMD ["/wait-for-postgres.sh", "postgres", "sh", "-c", "python manage.py migrate && python manage.py runserver 0.0.0.0:8000"]
