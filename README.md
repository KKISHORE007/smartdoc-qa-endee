# 📄 SmartDoc AI — RAG Powered Document Intelligence
<div align="center">
  <h3>An intelligent document Q&A system built using Retrieval Augmented Generation (RAG) powered by the <strong>Endee Vector Database</strong>.</h3>
</div>

---

## 🎯 Project Overview
Organizations struggle to extract meaningful insights from large collections of unstructured documents. Traditional keyword searching fails to understand semantic context. **SmartDoc AI** solves this by leveraging modern ML architectures, integrating sentence embeddings with the **Endee Vector Database** to enable high-speed semantic search — finding true meaning, not just matching words.

This project was built to demonstrate a practical agentic AI workflow (Document Q&A and Retrieval Augmented Generation) capable of securely running locally.

---

## 🏗 System Architecture (RAG Pipeline)
1. **Document Ingestion**: PDF is uploaded via the React UI. Node.js backend chunks the text into overlapping segments via `pdf-parse`.
2. **Embedding Generation**: Text chunks are passed through a local HuggingFace `all-MiniLM-L6-v2` transformer model to generate 384-dimension vector embeddings.
3. **Vector Storage**: Emdeddings, along with their text metadata, are securely upserted to the local **Endee Vector Database** (`localhost:8080/api/v1`).
4. **Semantic Search & LLM**: When a user queries, the query is vectorized and sent to Endee for a Cosine-Similarity search. The top K relevant chunks are sent along with the prompt to the Groq LLM API to generate a fully contextual, cited response.

---

## 🛠 Tech Stack

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Vector Database** | **[Endee](https://github.com/endee-io/endee)** | Core Semantic Similarity Search engine |
| **Relational Database** | **MySQL** (Sequelize) | Manages User Profiles and secure Authentication |
| **Embeddings** | **Transformers.js** | Generates text embeddings locally (`all-MiniLM-L6-v2`) |
| **LLM Inference** | **Groq API** | High-speed Llama-3 inference for generation |
| **Backend** | **Node.js + Express** | Orchestrates chunking, auth, and database routing |
| **Frontend** | **React + Vite** | Dynamic Document Workspace & Chat UI |

---

## 🚀 Setup Instructions

### Prerequisites
- Node.js (v18+)
- MySQL Workbench or XAMPP (running on port `3306`)
- Docker (for running Endee locally)

### 1. Start Endee Vector Database
Endee manages all of the high-dimensional Vector searching. Run it via Docker:
```bash
docker run -p 8080:8080 -v ./endee-data:/data --name endee-server endeeio/endee-server:latest
```

### 2. Configure MySQL
Open MySQL Workbench or your preferred MySQL client and run the following query to initialize the application database:
```sql
CREATE DATABASE smartdoc_ai_localhost;
```

### 3. Clone and Install
Clone the repository and install the dependencies for both environments.
```bash
# Clone the repository
git clone https://github.com/KKISHORE007/smartdoc-qa-endee.git
cd smartdoc-qa-endee/smartdoc-qa
```

### 4. Start the Backend
```bash
# Setup Backend
cd backend
npm install
npm run dev
```
*Note: The backend runs on `http://localhost:5000`. Upon starting, Sequelize will automatically connect to your MySQL database and generate the `Users` table!*

### 5. Start the Frontend
In a new terminal window:
```bash
# Setup Frontend
cd frontend
npm install
npm run dev
```
*The frontend development server will start at `http://localhost:5173/`.*

---

## ✨ System Features
- **Endee-Powered RAG**: Unlocks complex semantic search rather than simple regex keyword matching.
- **Offline / Local AI Fallback**: Integrates Local Web Workers to allow browser-based document querying if internet is disabled.
- **Secure Authentication**: Includes robust User management natively synced with a MySQL Database using robust encryption (bcrypt).
- **Multi-Format Reader**: Render PDF files natively adjacent to your AI Workspace. 
- **Lightning Fast LPU Inference**: Employs Groq hardware APIs for near-instant generative text.

---

## 🔑 API Keys
This project requires a Groq API key for generative inference. Rename `.env.example` to `.env` in the backend root and apply your key:
```env
GROQ_API_KEY="your_groq_api_key_here"
```
*(Endee Vector connection works natively via the exposed `localhost:8080/api/v1` URL without tokens).*