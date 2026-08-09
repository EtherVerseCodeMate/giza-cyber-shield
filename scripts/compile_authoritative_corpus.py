import os
import json
import glob

def find_authoritative_docs(base_dir):
    target_docs = ["MEMORY.md", "AGENTS.md", "SECURITY.md", "DEPLOYMENT_SECURITY_CHECKLIST.md"]
    found_files = []
    for root, _, files in os.walk(base_dir):
        # Skip node_modules and vendor to avoid pulling in third-party SECURITY.mds
        if "node_modules" in root or "vendor" in root:
            continue
        for file in files:
            if file in target_docs:
                found_files.append(os.path.join(root, file))
    return found_files

def chunk_markdown(content, source_name, chunk_size=1000, overlap=200):
    chunks = []
    start = 0
    # Simple chunking, can be improved to split on headings
    while start < len(content):
        end = start + chunk_size
        chunks.append({
            "source": source_name,
            "content": content[start:end],
            "metadata": {
                "document_type": "Khepra Internal Architecture & Security",
                "classification": "AUTHORITATIVE"
            }
        })
        start += chunk_size - overlap
    return chunks

def main():
    base_dir = os.path.dirname(os.path.dirname(__file__))
    dod_corpus_path = os.path.join(base_dir, "data", "governance", "dod_cio_rag_corpus.jsonl")
    output_file = os.path.join(base_dir, "data", "governance", "authoritative_khepra_corpus.jsonl")
    
    docs = find_authoritative_docs(base_dir)
    print(f"Found {len(docs)} authoritative internal documents.")
    
    all_records = []
    
    # Process Internal Docs
    for doc_path in docs:
        print(f"Ingesting {os.path.relpath(doc_path, base_dir)}...")
        with open(doc_path, 'r', encoding='utf-8') as f:
            content = f.read()
            doc_chunks = chunk_markdown(content, os.path.relpath(doc_path, base_dir))
            all_records.extend(doc_chunks)
            
    # Load DoD CIO RAG Corpus
    if os.path.exists(dod_corpus_path):
        print(f"Loading DoD CIO corpus from {dod_corpus_path}...")
        with open(dod_corpus_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    record = json.loads(line)
                    all_records.append(record)
    else:
        print("Warning: DoD CIO corpus not found.")
        
    print(f"Writing {len(all_records)} total chunks to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        for r in all_records:
            f.write(json.dumps(r) + '\n')
            
    print("Done! Corpus compilation complete.")

if __name__ == "__main__":
    main()
