FROM public.ecr.aws/docker/library/python:3.11-slim

WORKDIR /var/task

# Copy project files
COPY pyproject.toml .
COPY src/ ./src/

# Install the project and its dependencies from pyproject.toml
RUN pip install --no-cache-dir .

EXPOSE 8080

CMD ["python", "src/main.py"]
