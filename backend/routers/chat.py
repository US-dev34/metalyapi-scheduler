"""Chat router — NLP message parsing and apply.

POST   /api/v1/chat/{project_id}/message    Send NLP message → parse → ChatParseResponse
POST   /api/v1/chat/{project_id}/apply      Confirm & apply parsed actions to daily_allocations
GET    /api/v1/chat/{project_id}/history     Chat history
"""

import logging
from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from backend.models.db import get_db

logger = logging.getLogger(__name__)
from backend.models.schemas import ChatMessageRequest, ChatParseResponse, ErrorResponse
from backend.services.ai.nlp_parser import NLPParser
from backend.services.schedule_service import ScheduleService

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])
nlp = NLPParser()
schedule = ScheduleService()


@router.post(
    "/{project_id}/message",
    response_model=ChatParseResponse,
    responses={503: {"model": ErrorResponse}},
)
async def send_message(project_id: UUID, payload: ChatMessageRequest):
    """Parse a natural language message using Claude NLP and return structured actions.

    Flow: User message → Claude API → ParsedActions → Preview (not applied yet)
    """
    # Get WBS items for context
    wbs_items = schedule.list_wbs_items(project_id)
    wbs_context = [{"wbs_code": w["wbs_code"], "wbs_name": w["wbs_name"]} for w in wbs_items]

    result = await nlp.parse_message(payload.message, wbs_context)

    # Store chat message in DB
    db = get_db()
    try:
        db.table("chat_messages").insert({
            "project_id": str(project_id),
            "message": payload.message,
            "parsed_actions": result.get("actions", []),
            "applied": False,
        }).execute()
    except Exception as e:
        logger.error("Chat storage failure for project %s: %s", project_id, e)

    return result


@router.post("/{project_id}/apply")
async def apply_actions(project_id: UUID, body: dict):
    """Apply parsed actions to daily_allocations.

    Body: { "message_id": "uuid" }
    Looks up the parsed_actions from the chat message and applies them as allocation updates.
    """
    message_id = body.get("message_id")
    if not message_id:
        raise HTTPException(status_code=400, detail={"error": "message_id required", "code": "ALC_DATE_INVALID"})

    db = get_db()

    # Get the chat message with parsed actions
    msg_resp = db.table("chat_messages").select("*").eq("id", message_id).execute()
    if not msg_resp.data:
        raise HTTPException(status_code=404, detail={"error": "Message not found", "code": "PRJ_NOT_FOUND"})

    msg = msg_resp.data[0]
    actions = msg.get("parsed_actions", [])

    # Apply each action as an allocation upsert
    updated = 0
    for action in actions:
        try:
            wbs_code = action.get("wbs_code")
            # Resolve WBS code to ID
            wbs_resp = (
                db.table("wbs_items")
                .select("id")
                .eq("project_id", str(project_id))
                .eq("wbs_code", wbs_code)
                .execute()
            )
            if not wbs_resp.data:
                continue

            wbs_id = wbs_resp.data[0]["id"]
            row = {
                "wbs_item_id": wbs_id,
                "date": action.get("date"),
                "actual_manpower": action.get("actual_manpower", 0),
                "qty_done": action.get("qty_done", 0),
                "source": "chat",
            }
            if action.get("note"):
                row["notes"] = action["note"]

            db.table("daily_allocations").upsert(row, on_conflict="wbs_item_id,date").execute()
            updated += 1
        except Exception as e:
            logger.error("Failed to apply action for wbs %s: %s", action.get("wbs_code"), e)

    # Mark message as applied
    db.table("chat_messages").update({"applied": True}).eq("id", message_id).execute()

    return {"applied": True, "updated_count": updated}


@router.get("/{project_id}/history")
async def get_history(project_id: UUID):
    """Return chat message history for a project."""
    db = get_db()
    resp = (
        db.table("chat_messages")
        .select("*")
        .eq("project_id", str(project_id))
        .order("timestamp", desc=True)
        .limit(50)
        .execute()
    )
    return resp.data
