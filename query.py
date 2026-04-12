from sentence_transformers import SentenceTransformer
from endee import Endee
from groq import Groq
from config import (
    ENDEE_TOKEN, ENDEE_BASE_URL, EMBEDDING_MODEL,
    INDEX_NAME, GROQ_API_KEY, GROQ_MODEL
)

# Initialize models
embedding_model = SentenceTransformer(EMBEDDING_MODEL)
groq_client = Groq(api_key=GROQ_API_KEY)

def get_endee_client():
    if ENDEE_TOKEN:
        client = Endee(ENDEE_TOKEN)
    else:
        client = Endee()
    client.set_base_url(ENDEE_BASE_URL)
    return client

def search_documents(query_text, top_k=5):
    # Embed the query
    query_vector = embedding_model.encode(query_text).tolist()

    # Search in Endee
    client = get_endee_client()
    index = client.get_index(name=INDEX_NAME)

    results = index.query(
        vector=query_vector,
        top_k=top_k,
        ef=128,
        include_vectors=False
    )

    return results

def generate_answer(query_text, search_results):
    # Build context from search results
    context_parts = []
    sources = []

    for i, result in enumerate(search_results):
        if result.get('meta'):
            text = result['meta'].get('text', '')
            source = result['meta'].get('source', 'Unknown')
            page = result['meta'].get('page', '?')
            similarity = result.get('similarity', 0)

            context_parts.append(f"[Chunk {i+1}] {text}")
            sources.append({
                "source": source,
                "page": page,
                "similarity": round(similarity * 100, 1)
            })

    context = "\n\n".join(context_parts)

    # Build prompt
    prompt = f"""You are a helpful document assistant. Answer the user's question based ONLY on the context provided below. 
If the answer is not in the context, say "I couldn't find relevant information in the uploaded documents."
Always mention which document and page your answer comes from.

Context:
{context}

Question: {query_text}

Answer:"""

    # Call Groq
    response = groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "user", "content": prompt}
        ],
        max_tokens=1000,
        temperature=0.1
    )

    answer = response.choices[0].message.content

    return answer, sources

def query_documents(query_text):
    try:
        # Step 1: Search
        results = search_documents(query_text)

        if not results:
            return "No relevant documents found. Please upload PDFs first.", []

        # Step 2: Generate answer
        answer, sources = generate_answer(query_text, results)

        return answer, sources

    except Exception as e:
        return f"Error: {str(e)}", []