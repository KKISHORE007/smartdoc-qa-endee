import streamlit as st
from ingest import ingest_pdf
from query import query_documents

# Page config
st.set_page_config(
    page_title="SmartDoc QA",
    page_icon="📄",
    layout="wide"
)

# Title
st.title("📄 SmartDoc QA")
st.markdown("**AI-Powered Document Intelligence — Ask anything from your PDFs**")
st.divider()

# Sidebar
with st.sidebar:
    st.header("📁 Upload Documents")
    uploaded_files = st.file_uploader(
        "Upload PDF files",
        type=["pdf"],
        accept_multiple_files=True
    )

    if uploaded_files:
        if st.button("📥 Ingest Documents", type="primary"):
            for uploaded_file in uploaded_files:
                with st.spinner(f"Processing {uploaded_file.name}..."):
                    try:
                        count = ingest_pdf(uploaded_file, uploaded_file.name)
                        st.success(f"✅ {uploaded_file.name} — {count} chunks ingested!")
                    except Exception as e:
                        st.error(f"❌ Error: {str(e)}")

    st.divider()
    st.markdown("### 📚 How it works")
    st.markdown("""
    1. Upload your PDF files
    2. Click **Ingest Documents**
    3. Ask any question below
    4. Get AI-powered answers with source citations
    """)

    st.divider()
    st.markdown("### 🛠 Tech Stack")
    st.markdown("""
    - **Endee** — Vector Database
    - **sentence-transformers** — Embeddings
    - **Groq LLM** — Answer Generation
    - **Streamlit** — UI
    """)

# Main chat area
st.subheader("💬 Ask a Question")

# Initialize chat history
if "messages" not in st.session_state:
    st.session_state.messages = []

# Display chat history
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])
        if message.get("sources"):
            with st.expander("📎 Sources"):
                for src in message["sources"]:
                    st.markdown(
                        f"📄 **{src['source']}** — Page {src['page']} "
                        f"(Similarity: {src['similarity']}%)"
                    )

# Chat input
if prompt := st.chat_input("Ask anything about your documents..."):
    # Add user message
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    # Generate answer
    with st.chat_message("assistant"):
        with st.spinner("🔍 Searching documents and generating answer..."):
            answer, sources = query_documents(prompt)
            st.markdown(answer)
            if sources:
                with st.expander("📎 Sources"):
                    for src in sources:
                        st.markdown(
                            f"📄 **{src['source']}** — Page {src['page']} "
                            f"(Similarity: {src['similarity']}%)"
                        )

    # Save to history
    st.session_state.messages.append({
        "role": "assistant",
        "content": answer,
        "sources": sources
    })