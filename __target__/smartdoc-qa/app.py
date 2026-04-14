import streamlit as st
from ingest import ingest_pdf
from query import query_documents
import json
import os
from datetime import datetime

st.set_page_config(
    page_title="SmartDoc QA",
    page_icon="📄",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.markdown("""
<style>
/* ── Reset & Base ── */
body, .stApp {
    background-color: #1a1a1a;
    color: #e8e6e3;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* ── Sidebar ── */
[data-testid="stSidebar"] {
    background-color: #111111 !important;
    border-right: 1px solid #2a2a2a;
    width: 260px !important;
}
[data-testid="stSidebar"] * { color: #e8e6e3 !important; }

/* ── Hide Streamlit chrome ── */
#MainMenu, footer, header, [data-testid="stToolbar"] { visibility: hidden; }

/* ── Main background ── */
.main .block-container {
    background: #1a1a1a;
    padding-top: 0 !important;
    max-width: 780px;
    margin: auto;
}

/* ── Welcome screen ── */
.welcome-title {
    font-size: 36px;
    font-weight: 700;
    color: #e8e6e3;
    text-align: center;
    margin-bottom: 6px;
    letter-spacing: -0.5px;
}
.welcome-sub {
    font-size: 15px;
    color: #6b6b6b;
    text-align: center;
    margin-bottom: 36px;
}

/* ── Suggestion chips ── */
.chip-row {
    display: flex;
    gap: 10px;
    justify-content: center;
    flex-wrap: wrap;
    margin-bottom: 40px;
}
.chip {
    background: #252525;
    border: 1px solid #333;
    border-radius: 20px;
    padding: 8px 16px;
    font-size: 13px;
    color: #c9c7c4;
    cursor: pointer;
}
.chip:hover { background: #2f2f2f; }

/* ── Messages ── */
.user-bubble {
    background: #2f2f2f;
    border-radius: 18px 18px 4px 18px;
    padding: 12px 18px;
    margin: 12px 0 12px auto;
    max-width: 75%;
    width: fit-content;
    float: right;
    clear: both;
    font-size: 15px;
    color: #e8e6e3;
}
.bot-bubble {
    clear: both;
    margin: 12px 0;
    max-width: 90%;
}
.doc-card {
    background: #252525;
    border-left: 3px solid #4a9eff;
    border-radius: 0 10px 10px 0;
    padding: 14px 18px;
    margin: 10px 0;
    font-size: 14px;
    color: #d4d2cf;
    line-height: 1.7;
}
.web-card {
    background: #252525;
    border-left: 3px solid #4caf50;
    border-radius: 0 10px 10px 0;
    padding: 14px 18px;
    margin: 10px 0;
    font-size: 14px;
    color: #d4d2cf;
    line-height: 1.7;
}
.card-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 8px;
}
.doc-label { color: #4a9eff; }
.web-label { color: #4caf50; }

/* ── Source badges ── */
.badge {
    display: inline-block;
    background: #333;
    border-radius: 6px;
    padding: 3px 10px;
    font-size: 11px;
    color: #9b9a97;
    margin: 3px 3px 0 0;
}

/* ── Chat input ── */
[data-testid="stChatInput"] textarea {
    background: #252525 !important;
    color: #e8e6e3 !important;
    border: 1px solid #333 !important;
    border-radius: 14px !important;
    font-size: 15px !important;
}
[data-testid="stChatInput"] {
    background: #252525 !important;
    border-radius: 14px !important;
    border: 1px solid #333 !important;
}

/* ── Sidebar buttons ── */
.stButton > button {
    background: #252525 !important;
    color: #e8e6e3 !important;
    border: 1px solid #333 !important;
    border-radius: 8px !important;
    padding: 8px 14px !important;
    font-size: 13px !important;
    text-align: left !important;
    width: 100% !important;
}
.stButton > button:hover {
    background: #2f2f2f !important;
    border-color: #444 !important;
}

/* ── File uploader ── */
[data-testid="stFileUploader"] {
    background: #252525 !important;
    border: 1.5px dashed #333 !important;
    border-radius: 10px !important;
}

/* ── Divider ── */
hr { border-color: #2a2a2a !important; }

/* ── Spinner ── */
.stSpinner > div { border-top-color: #4a9eff !important; }

/* ── Section labels in sidebar ── */
.sidebar-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #555;
    margin: 16px 0 8px 0;
}
</style>
""", unsafe_allow_html=True)

# ── Helpers ───────────────────────────────────────────────
HISTORY_FILE = "chat_history.json"

def load_history():
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r") as f:
            return json.load(f)
    return []

def save_history(messages):
    with open(HISTORY_FILE, "w") as f:
        json.dump(messages, f, indent=2)

# ── Session state ─────────────────────────────────────────
if "messages" not in st.session_state:
    st.session_state.messages = []
if "uploaded_docs" not in st.session_state:
    st.session_state.uploaded_docs = []

# ── Sidebar ───────────────────────────────────────────────
with st.sidebar:
    st.markdown("### 📄 SmartDoc QA")
    st.divider()

    st.markdown("<div class='sidebar-label'>Upload Documents</div>", unsafe_allow_html=True)
    uploaded_files = st.file_uploader(
        "PDFs",
        type=["pdf"],
        accept_multiple_files=True,
        label_visibility="collapsed"
    )

    if uploaded_files:
        if st.button("⚡ Ingest Documents"):
            for f in uploaded_files:
                with st.spinner(f"Processing {f.name}..."):
                    try:
                        count = ingest_pdf(f, f.name)
                        if f.name not in st.session_state.uploaded_docs:
                            st.session_state.uploaded_docs.append(f.name)
                        st.success(f"✅ {f.name} — {count} chunks")
                    except Exception as e:
                        st.error(f"❌ {str(e)}")

    if st.session_state.uploaded_docs:
        st.markdown("<div class='sidebar-label'>Loaded</div>", unsafe_allow_html=True)
        for doc in st.session_state.uploaded_docs:
            st.markdown(f"<div style='font-size:13px; color:#9b9a97; padding:4px 0;'>📄 {doc}</div>", unsafe_allow_html=True)

    st.divider()

    # History
    st.markdown("<div class='sidebar-label'>Recent Chats</div>", unsafe_allow_html=True)
    saved = load_history()
    user_msgs = [m for m in saved if m["role"] == "user"]
    if user_msgs:
        for i, msg in enumerate(user_msgs[-8:]):
            label = msg["content"][:35] + "..." if len(msg["content"]) > 35 else msg["content"]
            if st.button(f"💬  {label}", key=f"h_{i}"):
                st.session_state.messages = saved
                st.rerun()
    else:
        st.markdown("<div style='font-size:13px; color:#555;'>No chats yet</div>", unsafe_allow_html=True)

    st.divider()
    if st.button("🗑️  Clear History"):
        save_history([])
        st.session_state.messages = []
        st.rerun()

# ── Main ──────────────────────────────────────────────────
col1, col2, col3 = st.columns([1, 5, 1])
with col2:

    # Welcome screen
    if not st.session_state.messages:
        st.markdown("<div style='height: 80px'></div>", unsafe_allow_html=True)
        st.markdown("""
        <div class='welcome-title'>📄 SmartDoc QA</div>
        <div class='welcome-sub'>Upload a PDF and ask anything — answers from your document + the web</div>
        <div class='chip-row'>
            <div class='chip'>📖 What is this document about?</div>
            <div class='chip'>🔍 Summarize the key points</div>
            <div class='chip'>💡 Explain the main concept</div>
            <div class='chip'>📝 List all topics covered</div>
        </div>
        """, unsafe_allow_html=True)

    # Chat messages
    for msg in st.session_state.messages:
        if msg["role"] == "user":
            st.markdown(f"<div class='user-bubble'>{msg['content']}</div><div style='clear:both'></div>", unsafe_allow_html=True)
        else:
            content = msg["content"]
            doc_sources = msg.get("doc_sources", [])
            online_links = msg.get("online_links", [])

            parts = content.split("### 🌐 From Online Search")
            doc_part = parts[0].replace("### 📄 From Your Document", "").strip()
            online_part = parts[1].strip() if len(parts) > 1 else ""

            # Doc answer
            st.markdown(f"""
            <div class='bot-bubble'>
                <div class='doc-card'>
                    <div class='card-label doc-label'>📄 From Your Document</div>
                    {doc_part}
                </div>
            """, unsafe_allow_html=True)

            if doc_sources:
                badges = "".join([f"<span class='badge'>📄 {s['source']} · p.{s['page']} · {s['similarity']}%</span>" for s in doc_sources])
                st.markdown(f"<div style='margin: 4px 0 10px 0'>{badges}</div>", unsafe_allow_html=True)

            # Online answer
            if online_part and online_part.strip() and "No online" not in online_part:
                st.markdown(f"""
                <div class='web-card'>
                    <div class='card-label web-label'>🌐 From Online Search</div>
                    {online_part}
                </div>
                """, unsafe_allow_html=True)
                if online_links:
                    links = "".join([f"<a href='{l}' target='_blank' class='badge'>🔗 Source {i+1}</a>" for i, l in enumerate(online_links) if l])
                    st.markdown(f"<div style='margin: 4px 0 10px 0'>{links}</div>", unsafe_allow_html=True)

            st.markdown("</div>", unsafe_allow_html=True)

    # Chat input
    if prompt := st.chat_input("Ask anything about your documents..."):
        st.session_state.messages.append({"role": "user", "content": prompt})

        with st.spinner("Searching..."):
            doc_answer, doc_sources, online_answer, online_links = query_documents(prompt)

        full = f"### 📄 From Your Document\n{doc_answer}\n\n### 🌐 From Online Search\n{online_answer}"
        st.session_state.messages.append({
            "role": "assistant",
            "content": full,
            "doc_sources": doc_sources,
            "online_links": online_links,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M")
        })
        save_history(st.session_state.messages)
        st.rerun()