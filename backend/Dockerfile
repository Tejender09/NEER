# Use official Python lightweight image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies (build-essential for some python libs if needed)
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Prisma CLI for Python
RUN pip install prisma

# Copy the rest of the application
COPY . .

# Generate Prisma client
RUN prisma generate

# Expose port (Cloud Run uses 8000 by default in our setup)
EXPOSE 8000

# Start script: Push schema changes then start the server
# Using 'prisma db push' ensures the Supabase schema is synced before the app starts
CMD ["sh", "-c", "prisma db push --accept-data-loss && uvicorn main:app --host 0.0.0.0 --port 8000"]
