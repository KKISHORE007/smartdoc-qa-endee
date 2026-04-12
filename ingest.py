import PyPDF2
from sentence_transformers import SentenceTransformer
from endee import Endee
from config import ENDEE_TOKEN, ENDEE_BASE_URL, EMBEDDING_MODEL, INDEX_NAME, DIMENSION
import uuid

# Initialize
model = SentenceTransformer(EMBEDDING_MODEL)

def get_endee_client():
    if ENDEE_TOKEN:
        client = Endee(ENDEE_TOKEN)
    else:
        client = Endee()
    client.set_base_url(ENDEE_BASE_URL)
    return client

def create_index_if_not_exists(client):
    try:
        indexes = client.list_indexes()
        existing = [idx['name'] for idx in indexes] if indexes else []
        if INDEX_NAME not in existing:
            client.create_index(
                name=INDEX_NAME,
                dimension=DIMENSION,
                space_type="cosine"
            )
            print(f"Index '{INDEX_NAME}' created!")
        else:
            print(f"Index '{INDEX_NAME}' already exists.")
    except Exception as e:
        print(f"Index error: {e}")

def extract_text_from_pdf(pdf_file):
    reader = PyPDF2.PdfReader(pdf_file)
    chunks = []
    for page_num, page in enumerate(reader.pages):
        text = page.extract_text()
        if text and text.strip():
            # Split page into smaller chunks of ~500 characters
            words = text.split()
            chunk = ""
            for word in words:
                chunk += word + " "
                if len(chunk) >= 500:
                    chunks.append({
                        "text": chunk.strip(),
                        "page": page_num + 1
                    })
                    chunk = ""
            if chunk.strip():
                chunks.append({
                    "text": chunk.strip(),
                    "page": page_num + 1
                })
    return chunks

def ingest_pdf(pdf_file, filename):
    client = get_endee_client()
    create_index_if_not_exists(client)
    index = client.get_index(name=INDEX_NAME)

    print(f"Extracting text from {filename}...")
    chunks = extract_text_from_pdf(pdf_file)
    print(f"Found {len(chunks)} chunks")

    # Embed all chunks
    texts = [chunk["text"] for chunk in chunks]
    embeddings = model.encode(texts, show_progress_bar=True)

    # Upsert into Endee in batches of 100
    vectors = []
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        vectors.append({
            "id": str(uuid.uuid4()),
            "vector": embedding.tolist(),
            "meta": {
                "text": chunk["text"],
                "source": filename,
                "page": chunk["page"]
            },
            "filter": {
                "source": filename
            }
        })

    # Batch upsert (max 1000 per call)
    batch_size = 100
    for i in range(0, len(vectors), batch_size):
        batch = vectors[i:i+batch_size]
        index.upsert(batch)
        print(f"Uploaded batch {i//batch_size + 1}")

    print(f"Successfully ingested {filename}!")
    return len(chunks)