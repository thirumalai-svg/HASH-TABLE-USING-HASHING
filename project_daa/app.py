"""
app.py — Flask Backend for HashSearch Mini Search Engine
=========================================================
Exposes REST API endpoints consumed by the frontend JavaScript.
All search and indexing uses the custom HashTable from hash_table.py.
"""

from flask import Flask, render_template, request, jsonify
from hash_table import InvertedIndex
import uuid
import os

app = Flask(__name__)
app.secret_key = "hashsearch-secret-2024"

# Global InvertedIndex instance — lives in memory for the session
search_engine = InvertedIndex()

# ─────────────────────────────────────────────────────────────────────────────
# Sample datasets (pre-loaded on first visit or by user request)
# ─────────────────────────────────────────────────────────────────────────────
SAMPLE_DOCS = {
    "doc_tech": {
        "name": "Technology & AI",
        "content": (
            "Artificial intelligence is transforming the world of technology. "
            "Machine learning and deep learning are subsets of artificial intelligence. "
            "Python is the most popular programming language for machine learning. "
            "Neural networks are used in deep learning to solve complex problems. "
            "Natural language processing enables computers to understand human speech."
        )
    },
    "doc_db": {
        "name": "Database Systems",
        "content": (
            "A database is an organized collection of structured data. "
            "Hash tables are used in databases for fast data retrieval. "
            "SQL is a language used to manage and query relational databases. "
            "Indexing in databases improves the speed of data retrieval operations. "
            "NoSQL databases like MongoDB store data in flexible document formats."
        )
    },
    "doc_search": {
        "name": "Search Engines",
        "content": (
            "A search engine indexes documents to enable fast keyword search. "
            "Google uses an inverted index to map keywords to web pages. "
            "Hashing helps search engines retrieve results in constant time. "
            "Ranking algorithms sort search results by relevance and frequency. "
            "PageRank measures the importance of web pages using link analysis."
        )
    },
    "doc_prog": {
        "name": "Programming Concepts",
        "content": (
            "Python supports dictionaries which are built on hash tables internally. "
            "Hash collisions occur when two keys produce the same hash value. "
            "Separate chaining and open addressing are collision resolution techniques. "
            "Every programmer should understand data structures like arrays and hash tables. "
            "Big O notation describes the time complexity of algorithms."
        )
    },
    "doc_college": {
        "name": "College & Students",
        "content": (
            "College students use search engines to find study materials online. "
            "Libraries index books and journals for fast retrieval by students. "
            "Data structures is one of the most important subjects in computer science. "
            "Students who learn algorithms perform better in coding interviews. "
            "Hash tables are fundamental data structures taught in every CS curriculum."
        )
    }
}


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    """Serve the single-page frontend."""
    return render_template("index.html")


@app.route("/api/load-samples", methods=["POST"])
def load_samples():
    """Pre-load all 5 sample documents into the index."""
    loaded = []
    for doc_id, doc in SAMPLE_DOCS.items():
        if not search_engine.doc_store.contains(doc_id):
            search_engine.add_document(doc_id, doc["name"], doc["content"])
            loaded.append(doc["name"])
    return jsonify({"success": True, "loaded": loaded, "message": f"Loaded {len(loaded)} sample documents"})


@app.route("/api/documents", methods=["GET"])
def get_documents():
    """Return list of all indexed documents."""
    docs = search_engine.get_all_docs()
    return jsonify({"documents": docs, "count": len(docs)})


@app.route("/api/documents", methods=["POST"])
def add_document():
    """Add a new document to the index."""
    data = request.get_json()
    name = data.get("name", "").strip()
    content = data.get("content", "").strip()

    if not name or not content:
        return jsonify({"error": "Both name and content are required"}), 400
    if len(content) < 10:
        return jsonify({"error": "Content must be at least 10 characters"}), 400

    doc_id = "doc_" + str(uuid.uuid4())[:8]
    search_engine.add_document(doc_id, name, content)

    doc = search_engine.doc_store.get(doc_id)
    return jsonify({"success": True, "doc_id": doc_id, "document": doc})


@app.route("/api/documents/<doc_id>", methods=["DELETE"])
def delete_document(doc_id):
    """Remove a document from the index."""
    success = search_engine.delete_document(doc_id)
    if success:
        return jsonify({"success": True, "message": "Document removed"})
    return jsonify({"error": "Document not found"}), 404


@app.route("/api/search", methods=["GET"])
def search():
    """Search the inverted index for a query."""
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"error": "Query parameter 'q' is required"}), 400

    result = search_engine.search(query)
    return jsonify(result)


@app.route("/api/stats", methods=["GET"])
def get_stats():
    """Return hash table statistics."""
    stats = search_engine.get_index_stats()
    return jsonify(stats)


@app.route("/api/visualize", methods=["GET"])
def visualize():
    """Return bucket visualization data (first 30 buckets)."""
    limit = min(int(request.args.get("limit", 30)), 64)
    buckets = search_engine.get_bucket_view(limit)
    return jsonify({"buckets": buckets, "total_capacity": search_engine.index.capacity})


@app.route("/api/history", methods=["GET"])
def get_history():
    """Return search history."""
    history = search_engine.get_search_history()
    return jsonify({"history": [{"query": q, "count": c} for q, c in history]})


@app.route("/api/upload", methods=["POST"])
def upload_file():
    """Handle .txt file upload."""
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400
    if not file.filename.endswith(".txt"):
        return jsonify({"error": "Only .txt files are supported"}), 400

    content = file.read().decode("utf-8", errors="ignore").strip()
    name = os.path.splitext(file.filename)[0]
    doc_id = "doc_" + str(uuid.uuid4())[:8]
    search_engine.add_document(doc_id, name, content)

    return jsonify({"success": True, "doc_id": doc_id, "name": name,
                    "characters": len(content)})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
