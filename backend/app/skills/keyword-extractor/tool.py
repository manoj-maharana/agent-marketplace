import re
from collections import Counter

from app.framework.skills import BaseSkill, skill_registry

_STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with", "is", "are",
    "was", "were", "it", "this", "that", "as", "at", "by", "be", "from", "has", "have", "had",
    "not", "its", "their", "they", "you", "your", "we", "our", "i", "he", "she", "his", "her",
    "them", "which", "who", "what", "when", "where", "how", "why", "can", "will", "would",
    "should", "could", "do", "does", "did", "so", "if", "than", "then", "there", "these",
    "those", "been", "being", "also", "into", "about", "over", "under", "more", "most",
}


class KeywordExtractorSkill(BaseSkill):
    key = "keyword_extractor"
    name = "Keyword Extractor"
    description = "Pull the most frequent, meaningful keywords out of a block of text."
    parameters = {
        "type": "object",
        "properties": {
            "text": {"type": "string", "description": "The text to extract keywords from."},
            "top_n": {"type": "integer", "description": "How many keywords to return (default 8)."},
        },
        "required": ["text"],
    }

    async def run(self, text: str, top_n: int = 8) -> dict:
        words = re.findall(r"[a-zA-Z][a-zA-Z'-]{2,}", text.lower())
        filtered = [w for w in words if w not in _STOPWORDS]
        counts = Counter(filtered)
        keywords = [{"word": w, "count": c} for w, c in counts.most_common(max(1, top_n))]
        return {"keywords": keywords}


skill_registry.register(KeywordExtractorSkill())
