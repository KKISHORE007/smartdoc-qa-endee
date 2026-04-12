import PyPDF2
from sentence_transformers import SentenceTransformer
from endee import Endee
from config import EMBEDDING_MODEL, INDEX_NAME, DIMENSION
import uuid

model = SentenceTransformer(EMBEDDING_MODEL)

def get_endee_client():
    client = Endee(token="open")
    client.set_base_url("http://localhost:8080/api/v1")
    return client

def create_index_if_not_exists(client):
    try:
        client.create_index(name=INDEX_NAME, dimension=DIMENSION, space_type="cosine")
        print(f"Index '{INDEX_NAME}' created!")
    except Exception as e:
        print(f"Index note: {e}")

def extract_text_from_pdf(pdf_file):
    reader = PyPDF2.PdfReader(pdf_file)
    chunks = []
    for page_num, page in enumerate(reader.pages):
        text = page.extract_text()
        if text and text.strip():
            words = text.split()
            chunk = ""
            for word in words:
                chunk += word + " "
                if len(chunk) >= 500:
                    chunks.append({"text": chunk.strip(), "page": page_num + 1})
                    chunk = ""
            if chunk.strip():
                chunks.append({"text": chunk.strip(), "page": page_num + 1})
    return chunks

def ingest_pdf(pdf_file, filename):
    client = get_endee_client()
    create_index_if_not_exists(client)
    index = client.get_index(name=INDEX_NAME)
    chunks = extract_text_from_pdf(pdf_file)
    texts = [chunk["text"] for chunk in chunks]
    embeddings = model.encode(texts, show_progress_bar=True)
    vectors = []
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        vectors.append({
            "id": str(uuid.uuid4()),
            "vector": embedding.tolist(),
            "meta": {"text": chunk["text"], "source": filename, "page": chunk["page"]}
        })
    batch_size = 100
    for i in range(0, len(vectors), batch_size):
        index.upsert(vectors[i:i+batch_size])
        print(f"Uploaded batch {i//batch_size + 1}")
    print(f"Done! {filename} ingested.")
    return len(chunks)