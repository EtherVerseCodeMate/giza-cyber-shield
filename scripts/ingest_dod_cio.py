import os
import glob
import json
import pymupdf

def chunk_text(text, chunk_size=1000, overlap=200):
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks

def process_pdf(pdf_path):
    print(f"Processing: {os.path.basename(pdf_path)}")
    try:
        doc = pymupdf.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text() + "\n"
        
        # Clean text basic
        text = text.replace('\x00', '').strip()
        
        if not text:
            print(f"Warning: No text extracted from {os.path.basename(pdf_path)}")
            return []
            
        chunks = chunk_text(text)
        
        records = []
        for i, chunk in enumerate(chunks):
            records.append({
                "source": os.path.basename(pdf_path),
                "chunk_id": i,
                "content": chunk,
                "metadata": {
                    "document_type": "DoD CIO Library",
                    "classification": "UNCLASSIFIED"
                }
            })
        return records
    except Exception as e:
        print(f"Error processing {os.path.basename(pdf_path)}: {e}")
        return []

def main():
    base_dir = os.path.dirname(os.path.dirname(__file__))
    input_dir = os.path.join(base_dir, "data", "governance", "dod_cio")
    output_file = os.path.join(base_dir, "data", "governance", "dod_cio_rag_corpus.jsonl")
    
    pdf_files = glob.glob(os.path.join(input_dir, "*.pdf"))
    print(f"Found {len(pdf_files)} PDF files.")
    
    all_records = []
    
    for pdf in pdf_files:
        records = process_pdf(pdf)
        all_records.extend(records)
        
    print(f"Writing {len(all_records)} chunks to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        for r in all_records:
            f.write(json.dumps(r) + '\n')
            
    print("Done!")

if __name__ == "__main__":
    main()
