from sentence_transformers import SentenceTransformer
from endee import Endee
from groq import Groq
from config import EMBEDDING_MODEL, INDEX_NAME, GROQ_API_KEY, GROQ_MODEL
import requests

embedding_model = SentenceTransformer(EMBEDDING_MODEL)
groq_client = Groq(api_key=GROQ_API_KEY)

def get_endee_client():
    client = Endee(token="open")
    client.set_base_url("http://localhost:8080/api/v1")
    return client

def search_online(query_text):
    try:
        url = f"https://ddg-api.herokuapp.com/search?query={query_text}&limit=3"
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            results = response.json()
            online_text = ""
            sources = []
            for r in results:
                online_text += f"{r.get('snippet', '')}\n\n"
                sources.append(r.get('link', ''))
            return online_text, sources
        return "", []
    except:
        return "", []

def query_documents(query_text):
    try:
        # === DOCUMENT SEARCH ===
        query_vector = embedding_model.encode(query_text).tolist()
        client = get_endee_client()
        index = client.get_index(name=INDEX_NAME)
        results = index.query(vector=query_vector, top_k=5, include_vectors=False)

        doc_context = ""
        doc_sources = []
        if results:
            for i, result in enumerate(results):
                meta = result.get("meta", {})
                text = meta.get("text", "")
                source = meta.get("source", "Unknown")
                page = meta.get("page", "?")
                similarity = result.get("similarity", 0)
                doc_context += f"[Chunk {i+1}] {text}\n\n"
                doc_sources.append({
                    "source": source,
                    "page": page,
                    "similarity": round(float(similarity) * 100, 1)
                })

        # === ONLINE SEARCH ===
        online_context, online_links = search_online(query_text)

        # === DOCUMENT ANSWER ===
        doc_answer = ""
        if doc_context:
            doc_prompt = f"""You are a document assistant. Answer the question in DETAIL using ONLY the context below.
- Write at least 3-5 sentences
- Mention specific details from the document
- Mention the page number where you found the answer
- Do NOT give a one line answer

Context from document:
{doc_context}

Question: {query_text}

Detailed Answer:"""
            doc_response = groq_client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": doc_prompt}],
                max_tokens=1000,
                temperature=0.1
            )
            doc_answer = doc_response.choices[0].message.content

        # === ONLINE ANSWER ===
        online_answer = ""
        if online_context:
            online_prompt = f"""Answer the question in detail using the web search results below.
- Write at least 3-5 sentences
- Give a comprehensive explanation

Web search results:
{online_context}

Question: {query_text}

Detailed Answer:"""
            online_response = groq_client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": online_prompt}],
                max_tokens=1000,
                temperature=0.1
            )
            online_answer = online_response.choices[0].message.content

        return doc_answer, doc_sources, online_answer, online_links

    except Exception as e:
        return f"Error: {str(e)}", [], "", []