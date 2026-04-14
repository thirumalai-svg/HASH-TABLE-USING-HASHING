"""
hash_table.py — Custom Hash Table Implementation
Uses Separate Chaining for collision resolution.
This is the core data structure powering the Mini Search Engine.
"""


class Node:
    """A node in the linked list (chain) at each bucket."""
    def __init__(self, key, value):
        self.key = key
        self.value = value
        self.next = None  # pointer to next node in chain


class HashTable:
    """
    Hash Table with Separate Chaining for collision handling.
    Each bucket holds a linked list of (key, value) pairs.
    """

    def __init__(self, capacity=64):
        self.capacity = capacity          # total number of buckets
        self.size = 0                     # number of key-value pairs stored
        self.buckets = [None] * capacity  # the bucket array
        self.collision_count = 0          # how many collisions occurred
        self.collision_details = []       # log of collision events

    def _hash(self, key):
        """
        Polynomial Rolling Hash Function.
        Maps a string key to a bucket index.
        h = sum(ord(char) * 31^i) % capacity
        """
        hash_val = 0
        prime = 31
        for i, char in enumerate(str(key)):
            hash_val = (hash_val + ord(char) * (prime ** i)) % self.capacity
        return hash_val

    def insert(self, key, value):
        """Insert or update a key-value pair."""
        index = self._hash(key)
        head = self.buckets[index]

        # Check if key already exists → update
        current = head
        while current:
            if current.key == key:
                current.value = value
                return
            current = current.next

        # Key not found → insert at head of chain
        new_node = Node(key, value)
        new_node.next = head
        self.buckets[index] = new_node
        self.size += 1

        # Detect collision: bucket was already occupied
        if head is not None:
            self.collision_count += 1
            self.collision_details.append({
                "bucket": index,
                "existing_key": head.key,
                "new_key": key
            })

    def get(self, key):
        """Retrieve the value for a given key. Returns None if not found."""
        index = self._hash(key)
        current = self.buckets[index]
        while current:
            if current.key == key:
                return current.value
            current = current.next
        return None

    def contains(self, key):
        """Check if a key exists in the table."""
        return self.get(key) is not None

    def delete(self, key):
        """Remove a key-value pair from the table."""
        index = self._hash(key)
        current = self.buckets[index]
        prev = None
        while current:
            if current.key == key:
                if prev:
                    prev.next = current.next
                else:
                    self.buckets[index] = current.next
                self.size -= 1
                return True
            prev = current
            current = current.next
        return False

    def keys(self):
        """Return all keys in the table."""
        result = []
        for bucket in self.buckets:
            current = bucket
            while current:
                result.append(current.key)
                current = current.next
        return result

    def items(self):
        """Return all (key, value) pairs."""
        result = []
        for bucket in self.buckets:
            current = bucket
            while current:
                result.append((current.key, current.value))
                current = current.next
        return result

    def load_factor(self):
        """Load factor = size / capacity. Above 0.7 means many collisions."""
        return round(self.size / self.capacity, 4)

    def get_stats(self):
        """Return statistics about the hash table."""
        chain_lengths = []
        occupied = 0
        for bucket in self.buckets:
            length = 0
            current = bucket
            while current:
                length += 1
                current = current.next
            chain_lengths.append(length)
            if length > 0:
                occupied += 1

        return {
            "capacity": self.capacity,
            "size": self.size,
            "load_factor": self.load_factor(),
            "collision_count": self.collision_count,
            "occupied_buckets": occupied,
            "empty_buckets": self.capacity - occupied,
            "max_chain_length": max(chain_lengths) if chain_lengths else 0,
            "average_chain_length": round(
                sum(chain_lengths) / max(occupied, 1), 2
            ),
            "collision_details": self.collision_details[-10:]  # last 10 collisions
        }

    def get_bucket_view(self, limit=20):
        """
        Return a visual representation of the first `limit` buckets
        for the Visualize tab.
        """
        view = []
        for i, bucket in enumerate(self.buckets[:limit]):
            chain = []
            current = bucket
            while current:
                chain.append({"key": current.key, "value": current.value})
                current = current.next
            view.append({"bucket": i, "chain": chain})
        return view


class InvertedIndex:
    """
    Inverted Index built on top of HashTable.
    Maps: word → { doc_id: frequency }
    """

    def __init__(self):
        self.index = HashTable(capacity=128)   # word → dict of {doc_id: freq}
        self.doc_store = HashTable(capacity=32) # doc_id → document metadata
        self.search_history = HashTable(capacity=16)  # query → result count
        self.doc_count = 0

    def _tokenize(self, text):
        """
        Tokenize text into lowercase words, removing punctuation.
        Returns list of tokens.
        """
        import re
        tokens = re.findall(r'\b[a-z]{2,}\b', text.lower())
        # Remove common stop words
        stop_words = {
            'the', 'is', 'in', 'it', 'and', 'or', 'to', 'a', 'an',
            'of', 'for', 'on', 'are', 'by', 'be', 'with', 'as', 'at',
            'this', 'that', 'from', 'was', 'were', 'not', 'but', 'have',
            'has', 'had', 'can', 'use', 'used', 'its', 'into', 'than',
            'more', 'also', 'all', 'any', 'each', 'do', 'does', 'so'
        }
        return [t for t in tokens if t not in stop_words]

    def add_document(self, doc_id, name, content):
        """
        Index a document: tokenize and insert into inverted index.
        """
        tokens = self._tokenize(content)
        word_freq = {}  # word → count in this doc

        for token in tokens:
            word_freq[token] = word_freq.get(token, 0) + 1

        # Update inverted index
        for word, freq in word_freq.items():
            existing = self.index.get(word)
            if existing is None:
                existing = {}
            existing[doc_id] = freq
            self.index.insert(word, existing)

        # Store document metadata
        self.doc_store.insert(doc_id, {
            "id": doc_id,
            "name": name,
            "content": content,
            "token_count": len(tokens),
            "unique_words": len(word_freq),
            "preview": content[:200] + ("..." if len(content) > 200 else "")
        })
        self.doc_count += 1

    def search(self, query):
        """
        Search for a query across all indexed documents.
        Returns list of results sorted by relevance (TF score).
        """
        tokens = self._tokenize(query)
        if not tokens:
            return {"results": [], "tokens": [], "total": 0}

        # Accumulate scores across query terms
        doc_scores = {}
        matched_words = []

        for token in tokens:
            postings = self.index.get(token)
            if postings:
                matched_words.append(token)
                for doc_id, freq in postings.items():
                    doc_scores[doc_id] = doc_scores.get(doc_id, 0) + freq

        # Build result list
        results = []
        for doc_id, score in sorted(doc_scores.items(), key=lambda x: -x[1]):
            doc = self.doc_store.get(doc_id)
            if doc:
                results.append({
                    "doc_id": doc_id,
                    "name": doc["name"],
                    "score": score,
                    "preview": doc["preview"],
                    "token_count": doc["token_count"]
                })

        # Record in search history
        prev = self.search_history.get(query.lower()) or 0
        self.search_history.insert(query.lower(), prev + 1)

        return {
            "results": results,
            "tokens": matched_words,
            "not_found": [t for t in tokens if t not in matched_words],
            "total": len(results)
        }

    def get_all_docs(self):
        """Return list of all indexed documents."""
        return [v for _, v in self.doc_store.items()]

    def get_search_history(self):
        """Return search history as a list of (query, count) pairs."""
        return sorted(self.search_history.items(), key=lambda x: -x[1])

    def get_index_stats(self):
        """Return stats from both the index and doc store hash tables."""
        return {
            "inverted_index": self.index.get_stats(),
            "doc_store": self.doc_store.get_stats(),
            "search_history_table": self.search_history.get_stats(),
            "total_documents": self.doc_count,
            "total_unique_words": self.index.size
        }

    def get_bucket_view(self, limit=20):
        """Return bucket visualization data."""
        return self.index.get_bucket_view(limit)

    def delete_document(self, doc_id):
        """Remove a document and its index entries."""
        doc = self.doc_store.get(doc_id)
        if not doc:
            return False

        # Remove from inverted index
        tokens = self._tokenize(doc["content"])
        for token in set(tokens):
            postings = self.index.get(token)
            if postings and doc_id in postings:
                del postings[doc_id]
                if postings:
                    self.index.insert(token, postings)
                else:
                    self.index.delete(token)

        self.doc_store.delete(doc_id)
        self.doc_count -= 1
        return True
