
"""
SouHimBou AI Data Loader
"Imhotep's Scrolls" & "The Cyber Brain"

Responsibility:
    - Ingest proprietary patent documentation (Soul)
    - Ingest personal "Cyber Brain" data (Persona/Skills)
    - Fuse Adinkra Archetypes with Persona Archetypes (Warrior, Sage, TechMage)
    - Generate "Unified Soul Embeddings" for model alignment
"""
import os
import re
from typing import List, Dict, Optional
import logging
from pathlib import Path

# Adinkra Symbols - The "Ancient Soul" Archetypes
ADINKRA_SYMBOLS = {
    "Eban": {
        "meaning": "Fortress, Security, Protection",
        "role": "access_control",
        "weight": 1.5,
        "keywords": ["security", "defense", "perimeter", "protection", "fortress"]
    },
    "Fawohodie": {
        "meaning": "Emancipation, Freedom",
        "role": "privilege_management",
        "weight": 1.2,
        "keywords": ["freedom", "privilege", "emancipation", "release"]
    },
    "Nkyinkyim": {
        "meaning": "Journey, Adaptability",
        "role": "adaptive_rekeying",
        "weight": 1.4,
        "keywords": ["adapt", "journey", "change", "transition", "dynamic"]
    },
    "Dwennimmen": {
        "meaning": "Ram's Horns, Strength",
        "role": "conflict_resolution",
        "weight": 1.3,
        "keywords": ["strength", "conflict", "resilience", "toughness", "war"]
    }
}

# Persona Archetypes - The "Living Mind" (SGT Kone)
PERSONA_ARCHETYPES = {
    "Warrior": {
        "meaning": "Discipline, Tactics, Combat",
        "source": "SpecOps, Martial Arts, Navy SEALs",
        "weight": 1.5,
        "keywords": ["spec", "ops", "seal", "calisthenic", "martial", "combat", "relentless", "ownership", "tactical"]
    },
    "Sage": {
        "meaning": "Wisdom, Spirituality, Mindfulness",
        "source": "Meditations, Qi Gong, Philosophy",
        "weight": 1.4,
        "keywords": ["meditation", "spirituality", "zen", "mind", "tao", "wuji", "qi", "gong", "wisdom", "soul"]
    },
    "TechMage": {
        "meaning": "Cyber-Warfare, Forensics, Engineering",
        "source": "Cyber_Skills, Forensics, Network",
        "weight": 1.6,
        "keywords": ["cyber", "network", "security", "forensics", "python", "code", "hacking", "troubleshooting", "comptia"]
    }
}

class SouHimBouLoader:
    def __init__(self, secret_path: str, cyber_brain_path: str):
        self.secret_path = Path(secret_path)
        self.cyber_brain_path = Path(cyber_brain_path)
        self.logger = logging.getLogger("souhimbou.data_loader")
        self.documents = []
        
        self.stats = {
            "adinkra_counts": {k: 0 for k in ADINKRA_SYMBOLS.keys()},
            "persona_counts": {k: 0 for k in PERSONA_ARCHETYPES.keys()}
        }

    def load_unified_corpus(self) -> List[Dict]:
        """
        Load both the Secret Patent Corpus and the Cyber Brain Corpus.
        """
        self.logger.info("Initializing SouHimBou Consciousness Ingestion...")
        
        # 1. Ingest The Soul (Patents)
        self._scan_directory(self.secret_path, source_type="soul")
        
        # 2. Ingest The Mind (Cyber Brain)
        self._scan_directory(self.cyber_brain_path, source_type="persona")
        
        self._summarize_findings()
        return self.documents

    def _scan_directory(self, path: Path, source_type: str):
        if not path.exists():
            self.logger.warning(f"Path not found: {path}")
            return

        self.logger.info(f"Ingesting {source_type.upper()} data from: {path}")

        for root, _, files in os.walk(path):
            for file in files:
                file_path = Path(root) / file
                
                # For basic text files, read content
                if file.endswith(('.md', '.txt')):
                    try:
                        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read()
                        self._analyze_text_content(content, file, source_type)
                    except Exception as e:
                        self.logger.error(f"Error reading {file}: {e}")
                
                # For binary/other files (PDF, DOCX, PNG), analyze filename only
                else:
                    self._analyze_filename(file, source_type)

    def _analyze_text_content(self, content: str, filename: str, source_type: str):
        """Analyze text content for symbols and keywords."""
        # 1. Adinkra Scan
        for symbol, meta in ADINKRA_SYMBOLS.items():
            count = len(re.findall(re.escape(symbol), content, re.IGNORECASE))
            if count > 0:
                self.stats["adinkra_counts"][symbol] += count

        # 2. Persona Keyword Scan (in content)
        for persona, meta in PERSONA_ARCHETYPES.items():
            for kw in meta["keywords"]:
                if kw.lower() in content.lower():
                     self.stats["persona_counts"][persona] += 1
                     # Break after finding presence to avoid overcounting single doc
                     break

    def _analyze_filename(self, filename: str, source_type: str):
        """Analyze filename for thematic relevance (important for PDFs/DOCX)."""
        name_lower = filename.lower()
        
        # Persona Keyword Scan (in filename)
        for persona, meta in PERSONA_ARCHETYPES.items():
            for kw in meta["keywords"]:
                if kw in name_lower:
                    self.stats["persona_counts"][persona] += 1
                    break

    def _summarize_findings(self):
        self.logger.info("--- SouHimBou Consciousness Report ---")
        self.logger.info("Adinkra Archetypes (The Soul):")
        for k, v in self.stats["adinkra_counts"].items():
            self.logger.info(f"  {k}: {v}")
            
        self.logger.info("Persona Archetypes (The Mind):")
        for k, v in self.stats["persona_counts"].items():
            self.logger.info(f"  {k}: {v}")

    def get_unified_embedding(self) -> Dict[str, float]:
        """
        Generate the final weighted embedding vector combining Ancient Soul and Modern Persona.
        """
        embedding = {}
        
        # Process Adinkra (Soul)
        for symbol, count in self.stats["adinkra_counts"].items():
            raw_score = count * ADINKRA_SYMBOLS[symbol]['weight']
            embedding[f"Soul_{symbol}"] = raw_score
            
        # Process Persona (Mind)
        for persona, count in self.stats["persona_counts"].items():
            raw_score = count * PERSONA_ARCHETYPES[persona]['weight']
            embedding[f"Mind_{persona}"] = raw_score
            
        # Normalize
        total_score = sum(embedding.values())
        if total_score == 0:
            return {k: 0.1 for k in embedding.keys()}
            
        normalized = {k: round(v / total_score, 4) for k, v in embedding.items()}
        return normalized

if __name__ == "__main__":
    import os
    logging.basicConfig(level=logging.INFO)
    soul_path = os.environ.get("ADINKHEPRA_ML_CLASSIFIED_DOCS_PATH", "")
    brain_path = os.environ.get("ADINKHEPRA_ML_CYBER_BRAIN_PATH", "")
    if not soul_path and not brain_path:
        print("Usage: ADINKHEPRA_ML_CLASSIFIED_DOCS_PATH=<path> ADINKHEPRA_ML_CYBER_BRAIN_PATH=<path> python data_loader.py")
        raise SystemExit(1)
    loader = SouHimBouLoader(secret_path=soul_path, cyber_brain_path=brain_path)
    loader.load_unified_corpus()
    print("\nUnified Consciousness Embedding:", loader.get_unified_embedding())
