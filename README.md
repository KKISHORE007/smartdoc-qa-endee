# 📄 SmartDoc QA — AI-Powered Document Intelligence System

An intelligent document Q&A system that allows users to upload PDFs and ask
natural language questions. Built using RAG (Retrieval Augmented Generation)
with Endee as the vector database.

---

## 🎯 Project Overview

Organizations struggle to extract meaningful insights from large collections
of unstructured documents. Traditional keyword search fails to understand
semantic context. SmartDoc QA solves this by using sentence embeddings and
Endee vector database to enable semantic search — finding meaning, not just
matching words.

---

## 🏗 System Design
PDF Upload → Text Chunker → Sentence Embedder → Endee Vector DB
↓
User Query → Query Embedder → Similarity Search → Top 5 Chunks
↓
Groq LLM → Answer + Citations
---

## 🛠 Tech Stack

| Component | Technology |
|---|---|
| Vector Database | **Endee** |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2) |
| LLM | Groq (llama3-8b-8192) |
| UI | Streamlit |
| PDF Parsing | PyPDF2 |

---

## 🚀 Setup Instructions

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/smartdoc-qa.git
cd smartdoc-qa
```

### 2. Install dependencies
```bash
pip install endee sentence-transformers streamlit PyPDF2 groq
```

### 3. Start Endee vector database
```bash
docker run -p 8080:8080 -v ./endee-data:/data --name endee-server endeeio/endee-server:latest
```

### 4. Configure API keys
Edit `config.py`:
```python
GROQ_API_KEY = "your_groq_api_key"
ENDEE_TOKEN = ""  # leave empty for local Docker
```

### 5. Run the app
```bash
streamlit run app.py
```

---

## 💡 How It Works

### Ingestion Pipeline
1. PDF is uploaded via Streamlit UI
2. PyPDF2 extracts text page by page
3. Text is split into 500-character chunks
4. Each chunk is embedded using sentence-transformers into a 384-dimension vector
5. Vectors are stored in Endee with metadata (source file, page number)

### Query Pipeline
1. User types a natural language question
2. Question is embedded using the same model
3. Endee performs cosine similarity search → returns top 5 matching chunks
4. Chunks + question are sent to Groq LLM
5. LLM generates a cited answer based only on the retrieved context

---

## ✨ Features

- Upload multiple PDFs simultaneously
- Semantic search — finds meaning, not just keywords
- Source citations with page numbers
- Chat history within session
- Fast answers powered by Groq's LPU hardware

---

## 📁 Project Structure
smartdoc-qa/
├── app.py          # Streamlit UI
├── ingest.py       # PDF chunker + embedder + Endee storage
├── query.py        # Semantic search + Groq answer generation
├── config.py       # Configuration and API keys
└── README.md       # Project documentation
---

## 🔑 API Keys Required

- **Groq API Key** — free at console.groq.com
- **Endee** — local Docker (free) or cloud at app.endee.io