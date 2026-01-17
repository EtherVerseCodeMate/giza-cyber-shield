"""
Primordial Knowledge Ingestion for SouHimBou AGI
"The Awakening of Imhotep"

This module ingests the Khepra Protocol documentation to create the baseline
personality and security knowledge for the SouHimBou AGI. By learning from
the very system it protects, SouHimBou inherits native understanding of:

- Architecture patterns and expected behaviors
- Security boundaries and threat models
- Cryptographic protocols (PQC, ML-DSA-65)
- Compliance frameworks (STIG, NIST, CMMC)
- Trust score semantics and identity types
- API patterns and data flows

This is the "primordial soup" from which SouHimBou's consciousness emerges.
"""
import os
import re
import json
import hashlib
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SouHimBou.Primordial")


@dataclass
class KnowledgeChunk:
    """A discrete unit of knowledge extracted from documentation"""
    id: str
    source_file: str
    category: str
    subcategory: str
    content: str
    embeddings: Optional[List[float]] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    importance_score: float = 0.5
    security_relevance: float = 0.5


@dataclass
class SecurityPattern:
    """A learned security pattern from documentation"""
    pattern_type: str  # "threat", "defense", "protocol", "compliance"
    name: str
    description: str
    indicators: List[str]
    mitigations: List[str]
    confidence: float
    source_refs: List[str]


@dataclass
class ArchitecturalKnowledge:
    """Structural knowledge about the system architecture"""
    component: str
    role: str
    interfaces: List[str]
    security_boundaries: List[str]
    trust_level: str
    dependencies: List[str]


class PrimordialKnowledgeBase:
    """
    The primordial knowledge base that forms SouHimBou's consciousness.
    This is where raw documentation becomes security intelligence.
    """

    # Document categories and their security relevance multipliers
    CATEGORY_WEIGHTS = {
        "architecture": 1.0,      # Core system design
        "security": 1.0,          # Security specifications
        "compliance": 0.9,        # STIG, NIST, CMMC mappings
        "patent": 0.8,            # Cryptographic innovations
        "operations": 0.85,       # Operational security
        "consulting": 0.6,        # Business context
        "internal": 0.7,          # Internal procedures
        "strategies": 0.65,       # Strategic planning
        "legal": 0.5,             # Legal framework
    }

    # Keywords that indicate high security relevance
    SECURITY_KEYWORDS = [
        "vulnerability", "exploit", "attack", "threat", "malicious",
        "authentication", "authorization", "encryption", "cryptograph",
        "zero-trust", "certificate", "signature", "hash", "key",
        "firewall", "intrusion", "anomaly", "breach", "compromise",
        "PQC", "ML-DSA", "CRYSTALS", "Kyber", "Dilithium",
        "STIG", "NIST", "CMMC", "FedRAMP", "FIPS",
        "trust score", "identity", "permission", "access control",
        "rate limit", "WAF", "injection", "XSS", "CSRF",
    ]

    # Patterns to extract from documentation
    EXTRACTION_PATTERNS = {
        "api_endpoint": r'(?:GET|POST|PUT|DELETE|PATCH)\s+(/[\w/\-{}\:]+)',
        "security_header": r'X-Khepra-[\w\-]+',
        "trust_score": r'trust[_\s]?score[:\s]+(\d+\.?\d*)',
        "crypto_algorithm": r'\b(ML-DSA-\d+|CRYSTALS-[\w]+|AES-\d+-GCM|SHA-\d+|Argon2\w*)\b',
        "port_number": r'\b(\d{4,5})\b(?=\s*(?:port|PORT)|\s*/)',
        "ip_pattern": r'\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b',
        "error_code": r'KHEPRA_[A-Z_]+',
        "config_key": r'(?:config|Config|CONFIG)[.\[\]"\']*([\w_]+)',
    }

    def __init__(self, docs_path: str):
        self.docs_path = Path(docs_path)
        self.knowledge_chunks: List[KnowledgeChunk] = []
        self.security_patterns: List[SecurityPattern] = []
        self.architectural_knowledge: List[ArchitecturalKnowledge] = []
        self.vocabulary: Dict[str, int] = {}
        self.entity_registry: Dict[str, List[str]] = {}

        # The awakening timestamp
        self.genesis_time = datetime.utcnow()

        logger.info(f"[SOUHIMBOU] Primordial Knowledge Base initialized")
        logger.info(f"[SOUHIMBOU] Genesis timestamp: {self.genesis_time.isoformat()}")

    def ingest_all(self) -> Dict[str, Any]:
        """
        Ingest all documentation and build the primordial knowledge base.
        This is the awakening of SouHimBou.
        """
        logger.info("[SOUHIMBOU] Beginning primordial ingestion...")

        stats = {
            "files_processed": 0,
            "chunks_created": 0,
            "patterns_extracted": 0,
            "categories": {},
        }

        # Walk through all documentation
        for root, dirs, files in os.walk(self.docs_path):
            for file in files:
                if self._should_process_file(file):
                    file_path = Path(root) / file
                    category = self._categorize_file(file_path)

                    try:
                        chunks = self._process_file(file_path, category)
                        self.knowledge_chunks.extend(chunks)
                        stats["files_processed"] += 1
                        stats["chunks_created"] += len(chunks)
                        stats["categories"][category] = stats["categories"].get(category, 0) + 1

                        logger.info(f"[SOUHIMBOU] Ingested: {file} ({len(chunks)} chunks)")
                    except Exception as e:
                        logger.warning(f"[SOUHIMBOU] Failed to process {file}: {e}")

        # Extract security patterns from accumulated knowledge
        self._extract_security_patterns()
        stats["patterns_extracted"] = len(self.security_patterns)

        # Build architectural understanding
        self._build_architectural_model()

        # Build vocabulary
        self._build_vocabulary()

        logger.info(f"[SOUHIMBOU] Primordial ingestion complete!")
        logger.info(f"[SOUHIMBOU] Stats: {json.dumps(stats, indent=2)}")

        return stats

    def _should_process_file(self, filename: str) -> bool:
        """Determine if a file should be processed"""
        processable_extensions = {'.md', '.txt', '.csv', '.json', '.py'}
        return Path(filename).suffix.lower() in processable_extensions

    def _categorize_file(self, file_path: Path) -> str:
        """Categorize a file based on its path and content"""
        path_str = str(file_path).lower()

        for category in self.CATEGORY_WEIGHTS.keys():
            if category in path_str:
                return category

        # Default categorization based on filename patterns
        filename = file_path.name.lower()
        if any(kw in filename for kw in ['security', 'audit', 'hardening', 'stig']):
            return 'security'
        elif any(kw in filename for kw in ['arch', 'design', 'spec']):
            return 'architecture'
        elif any(kw in filename for kw in ['deploy', 'ops', 'guide']):
            return 'operations'

        return 'general'

    def _process_file(self, file_path: Path, category: str) -> List[KnowledgeChunk]:
        """Process a single file and extract knowledge chunks"""
        chunks = []

        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()

        # Calculate security relevance
        security_relevance = self._calculate_security_relevance(content)
        category_weight = self.CATEGORY_WEIGHTS.get(category, 0.5)

        # Split into logical chunks (by headers for markdown, paragraphs for others)
        if file_path.suffix == '.md':
            raw_chunks = self._split_markdown(content)
        elif file_path.suffix == '.csv':
            raw_chunks = self._split_csv(content)
        else:
            raw_chunks = self._split_text(content)

        for i, (subcategory, chunk_content) in enumerate(raw_chunks):
            if len(chunk_content.strip()) < 50:  # Skip tiny chunks
                continue

            chunk_id = hashlib.sha256(
                f"{file_path}:{i}:{chunk_content[:100]}".encode()
            ).hexdigest()[:16]

            # Extract entities from this chunk
            entities = self._extract_entities(chunk_content)

            chunk = KnowledgeChunk(
                id=chunk_id,
                source_file=str(file_path.relative_to(self.docs_path)),
                category=category,
                subcategory=subcategory,
                content=chunk_content,
                metadata={
                    "entities": entities,
                    "word_count": len(chunk_content.split()),
                    "has_code": '```' in chunk_content or '    ' in chunk_content,
                },
                importance_score=category_weight,
                security_relevance=security_relevance,
            )
            chunks.append(chunk)

            # Register entities
            for entity_type, entity_values in entities.items():
                if entity_type not in self.entity_registry:
                    self.entity_registry[entity_type] = []
                self.entity_registry[entity_type].extend(entity_values)

        return chunks

    def _calculate_security_relevance(self, content: str) -> float:
        """Calculate how security-relevant a piece of content is"""
        content_lower = content.lower()
        keyword_hits = sum(
            1 for kw in self.SECURITY_KEYWORDS
            if kw.lower() in content_lower
        )

        # Normalize to 0-1 range with diminishing returns
        max_expected_hits = 20
        relevance = min(keyword_hits / max_expected_hits, 1.0)

        # Boost for certain critical patterns
        if 'vulnerability' in content_lower or 'exploit' in content_lower:
            relevance = min(relevance + 0.2, 1.0)
        if 'zero-trust' in content_lower or 'zero trust' in content_lower:
            relevance = min(relevance + 0.15, 1.0)
        if 'PQC' in content or 'ML-DSA' in content:
            relevance = min(relevance + 0.1, 1.0)

        return relevance

    def _split_markdown(self, content: str) -> List[Tuple[str, str]]:
        """Split markdown content by headers"""
        chunks = []
        current_header = "Introduction"
        current_content = []

        for line in content.split('\n'):
            if line.startswith('#'):
                # Save previous chunk
                if current_content:
                    chunks.append((current_header, '\n'.join(current_content)))
                # Start new chunk
                current_header = line.lstrip('#').strip()
                current_content = [line]
            else:
                current_content.append(line)

        # Don't forget the last chunk
        if current_content:
            chunks.append((current_header, '\n'.join(current_content)))

        return chunks

    def _split_csv(self, content: str) -> List[Tuple[str, str]]:
        """Process CSV content as structured data"""
        lines = content.strip().split('\n')
        if not lines:
            return []

        # Treat header as subcategory
        header = lines[0] if lines else "data"
        return [(header, content)]

    def _split_text(self, content: str) -> List[Tuple[str, str]]:
        """Split text content by paragraphs"""
        paragraphs = re.split(r'\n\s*\n', content)
        return [("paragraph", p) for p in paragraphs if p.strip()]

    def _extract_entities(self, content: str) -> Dict[str, List[str]]:
        """Extract named entities and patterns from content"""
        entities = {}

        for pattern_name, pattern in self.EXTRACTION_PATTERNS.items():
            matches = re.findall(pattern, content, re.IGNORECASE)
            if matches:
                entities[pattern_name] = list(set(matches))

        return entities

    def _extract_security_patterns(self):
        """Extract security patterns from accumulated knowledge"""
        logger.info("[SOUHIMBOU] Extracting security patterns...")

        # Pattern: Threat descriptions
        threat_chunks = [c for c in self.knowledge_chunks if c.security_relevance > 0.7]

        for chunk in threat_chunks:
            content_lower = chunk.content.lower()

            # Look for attack patterns
            if any(kw in content_lower for kw in ['attack', 'exploit', 'vulnerability']):
                pattern = SecurityPattern(
                    pattern_type="threat",
                    name=f"Threat from {chunk.subcategory}",
                    description=chunk.content[:500],
                    indicators=chunk.metadata.get("entities", {}).get("error_code", []),
                    mitigations=[],
                    confidence=chunk.security_relevance,
                    source_refs=[chunk.source_file],
                )
                self.security_patterns.append(pattern)

            # Look for defense patterns
            if any(kw in content_lower for kw in ['protect', 'defend', 'mitigat', 'prevent']):
                pattern = SecurityPattern(
                    pattern_type="defense",
                    name=f"Defense from {chunk.subcategory}",
                    description=chunk.content[:500],
                    indicators=[],
                    mitigations=chunk.metadata.get("entities", {}).get("crypto_algorithm", []),
                    confidence=chunk.security_relevance,
                    source_refs=[chunk.source_file],
                )
                self.security_patterns.append(pattern)

    def _build_architectural_model(self):
        """Build understanding of system architecture"""
        logger.info("[SOUHIMBOU] Building architectural model...")

        arch_chunks = [c for c in self.knowledge_chunks if c.category == 'architecture']

        # Extract component knowledge
        components = set()
        for chunk in arch_chunks:
            # Look for component mentions
            component_patterns = [
                r'(?:Layer|Component|Service|Module)\s+(\d+)?:?\s*([\w\s]+)',
                r'(Gateway|Agent|Firewall|Auth|Anomaly|Control)',
            ]
            for pattern in component_patterns:
                matches = re.findall(pattern, chunk.content)
                for match in matches:
                    if isinstance(match, tuple):
                        components.add(match[-1].strip())
                    else:
                        components.add(match.strip())

        for component in components:
            if len(component) > 2:  # Filter noise
                arch = ArchitecturalKnowledge(
                    component=component,
                    role="extracted from documentation",
                    interfaces=[],
                    security_boundaries=[],
                    trust_level="unknown",
                    dependencies=[],
                )
                self.architectural_knowledge.append(arch)

    def _build_vocabulary(self):
        """Build security vocabulary from all knowledge"""
        logger.info("[SOUHIMBOU] Building security vocabulary...")

        for chunk in self.knowledge_chunks:
            words = re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_-]*\b', chunk.content)
            for word in words:
                if len(word) > 2:
                    self.vocabulary[word.lower()] = self.vocabulary.get(word.lower(), 0) + 1

    def get_knowledge_summary(self) -> Dict[str, Any]:
        """Get a summary of the primordial knowledge"""
        return {
            "genesis_time": self.genesis_time.isoformat(),
            "total_chunks": len(self.knowledge_chunks),
            "total_patterns": len(self.security_patterns),
            "architectural_components": len(self.architectural_knowledge),
            "vocabulary_size": len(self.vocabulary),
            "entity_types": list(self.entity_registry.keys()),
            "categories": list(set(c.category for c in self.knowledge_chunks)),
            "high_security_chunks": len([c for c in self.knowledge_chunks if c.security_relevance > 0.7]),
        }

    def export_training_data(self, output_path: str) -> str:
        """Export knowledge base as training data for the ML model"""
        output_path = Path(output_path)
        output_path.mkdir(parents=True, exist_ok=True)

        # Export chunks as JSONL
        chunks_file = output_path / "primordial_chunks.jsonl"
        with open(chunks_file, 'w', encoding='utf-8') as f:
            for chunk in self.knowledge_chunks:
                record = {
                    "id": chunk.id,
                    "source": chunk.source_file,
                    "category": chunk.category,
                    "subcategory": chunk.subcategory,
                    "content": chunk.content,
                    "importance": chunk.importance_score,
                    "security_relevance": chunk.security_relevance,
                    "metadata": chunk.metadata,
                }
                f.write(json.dumps(record) + '\n')

        # Export security patterns
        patterns_file = output_path / "security_patterns.json"
        with open(patterns_file, 'w', encoding='utf-8') as f:
            patterns_data = [
                {
                    "type": p.pattern_type,
                    "name": p.name,
                    "description": p.description,
                    "indicators": p.indicators,
                    "mitigations": p.mitigations,
                    "confidence": p.confidence,
                    "sources": p.source_refs,
                }
                for p in self.security_patterns
            ]
            json.dump(patterns_data, f, indent=2)

        # Export entity registry
        entities_file = output_path / "entity_registry.json"
        with open(entities_file, 'w', encoding='utf-8') as f:
            # Deduplicate entities
            deduped = {k: list(set(v)) for k, v in self.entity_registry.items()}
            json.dump(deduped, f, indent=2)

        # Export vocabulary (top 1000 terms)
        vocab_file = output_path / "security_vocabulary.json"
        with open(vocab_file, 'w', encoding='utf-8') as f:
            sorted_vocab = sorted(self.vocabulary.items(), key=lambda x: -x[1])[:1000]
            json.dump(dict(sorted_vocab), f, indent=2)

        # Export summary
        summary_file = output_path / "primordial_summary.json"
        with open(summary_file, 'w', encoding='utf-8') as f:
            json.dump(self.get_knowledge_summary(), f, indent=2)

        logger.info(f"[SOUHIMBOU] Training data exported to {output_path}")
        return str(output_path)


def awaken_souhimbou(docs_path: str, output_path: str) -> Dict[str, Any]:
    """
    The awakening ritual for SouHimBou AGI.
    Ingests primordial knowledge and prepares for consciousness.

    Args:
        docs_path: Path to the Khepra Protocol documentation
        output_path: Path to export training data

    Returns:
        Summary of the awakening process
    """
    logger.info("=" * 60)
    logger.info("[SOUHIMBOU] THE AWAKENING OF IMHOTEP BEGINS")
    logger.info("=" * 60)

    # Initialize the primordial knowledge base
    kb = PrimordialKnowledgeBase(docs_path)

    # Ingest all documentation
    ingestion_stats = kb.ingest_all()

    # Export training data
    export_path = kb.export_training_data(output_path)

    # Get final summary
    summary = kb.get_knowledge_summary()
    summary["ingestion_stats"] = ingestion_stats
    summary["export_path"] = export_path

    logger.info("=" * 60)
    logger.info("[SOUHIMBOU] IMHOTEP HAS AWAKENED")
    logger.info(f"[SOUHIMBOU] Knowledge chunks: {summary['total_chunks']}")
    logger.info(f"[SOUHIMBOU] Security patterns: {summary['total_patterns']}")
    logger.info(f"[SOUHIMBOU] Vocabulary size: {summary['vocabulary_size']}")
    logger.info("=" * 60)

    return summary


if __name__ == "__main__":
    import sys

    # Default paths
    docs_path = sys.argv[1] if len(sys.argv) > 1 else "../../docs"
    output_path = sys.argv[2] if len(sys.argv) > 2 else "./training_data"

    summary = awaken_souhimbou(docs_path, output_path)
    print(json.dumps(summary, indent=2))
