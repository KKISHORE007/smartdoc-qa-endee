import os
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
ENDEE_TOKEN = ""
ENDEE_BASE_URL = "http://localhost:8080/api/v1"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
GROQ_MODEL = "llama-3.1-8b-instant"
INDEX_NAME = "smartdoc_index"
DIMENSION = 384