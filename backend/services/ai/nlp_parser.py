"""NLP parser — converts Turkish natural-language messages into structured allocation actions.

Uses Claude API (Sonnet) with the parse_message.txt prompt template.
Returns IC-003 ChatParseResponse: {message_id, actions, summary, confidence, applied}.
"""

from __future__ import annotations

import json
import logging
from datetime import date
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import anthropic

from backend.config import settings

logger = logging.getLogger(__name__)

_PROMPT_DIR = Path(__file__).parent / "prompts"


class NLPParser:
    """Parse chat messages via Claude API."""

    def __init__(self) -> None:
        self._client: anthropic.Anthropic | None = None

    @property
    def client(self) -> anthropic.Anthropic:
        if self._client is None:
            self._client = anthropic.Anthropic(api_key=settings.claude_api_key)
        return self._client

    async def parse_message(
        self,
        message: str,
        wbs_items: list[dict[str, Any]],
        current_date: str | None = None,
    ) -> dict[str, Any]:
        """Parse a Turkish natural-language message into structured actions.

        Args:
            message: User's message e.g. "Bugün CW-01'de 5 adam çalıştı, 3 ünite bitti"
            wbs_items: List of WBS items [{wbs_code, wbs_name}] for matching
            current_date: Override for today's date (YYYY-MM-DD)

        Returns:
            IC-003 ChatParseResponse dict:
            {message_id, actions: [{wbs_code, date, actual_manpower, qty_done, note}], summary, confidence}
        """
        today = current_date or date.today().isoformat()
        wbs_list = "\n".join(f"- {w['wbs_code']}: {w['wbs_name']}" for w in wbs_items)

        # Load prompt template
        prompt_template = self._load_prompt("parse_message.txt")
        system_prompt = prompt_template.replace("{wbs_list}", wbs_list).replace("{current_date}", today)

        message_id = str(uuid4())

        try:
            response = self.client.messages.create(
                model=settings.claude_model,
                max_tokens=1000,
                temperature=0.3,
                system=system_prompt,
                messages=[{"role": "user", "content": message}],
            )

            raw_text = response.content[0].text
            parsed = self._extract_json(raw_text)

            return {
                "message_id": message_id,
                "actions": parsed.get("actions", []),
                "summary": parsed.get("summary", ""),
                "confidence": float(parsed.get("confidence", 0.5)),
                "applied": False,
            }

        except anthropic.APIError as exc:
            logger.error("Claude API error during NLP parse: %s", exc)
            return {
                "message_id": message_id,
                "actions": [],
                "summary": "AI servisi şu an kullanılamıyor",
                "confidence": 0.0,
                "applied": False,
            }
        except Exception as exc:
            logger.error("Unexpected error during NLP parse: %s", exc)
            return {
                "message_id": message_id,
                "actions": [],
                "summary": f"Mesaj anlaşılamadı: {str(exc)}",
                "confidence": 0.0,
                "applied": False,
            }

    def _load_prompt(self, filename: str) -> str:
        """Load a prompt template from the prompts directory."""
        path = _PROMPT_DIR / filename
        if path.exists():
            return path.read_text(encoding="utf-8")
        logger.warning("Prompt file not found: %s, using fallback", path)
        return self._fallback_parse_prompt()

    @staticmethod
    def _fallback_parse_prompt() -> str:
        return """Sen bir inşaat planlama asistanısın. Kullanıcının mesajını parse et ve JSON formatında aksiyonlara çevir.

Mevcut WBS Kodları:
{wbs_list}

Bugünün Tarihi: {current_date}

Output sadece JSON olsun:
{
  "actions": [{"wbs_code": "CW-01", "date": "2026-02-19", "actual_manpower": 5, "qty_done": 3, "note": null}],
  "summary": "Kısa özet",
  "confidence": 0.95
}"""

    @staticmethod
    def _extract_json(text: str) -> dict[str, Any]:
        """Best-effort JSON extraction from Claude output."""
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Try to find JSON in the text
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                try:
                    return json.loads(text[start:end])
                except json.JSONDecodeError:
                    pass
            return {"actions": [], "summary": text, "confidence": 0.0}
