# Use official Python image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy requirements first for caching
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire project
COPY . .

# Expose port (assuming FastAPI or Streamlit)
EXPOSE 8000

# Command to run your app (change if using Streamlit)
CMD ["python", "main.py"]
