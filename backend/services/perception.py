"""
AI Perception Service - Transparency into how AI views the user
Includes data correction and dispute handling
"""
from fastapi import APIRouter, HTTPException, Depends, Header, Body, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
from bson import ObjectId
from database import get_database
from config import settings
from openai import OpenAI
import json
import logging

logger = logging.getLogger(__name__)

def calculate_age(date_of_birth):
    """Calculate age from date of birth"""
    if isinstance(date_of_birth, str):
        date_of_birth = datetime.strptime(date_of_birth, "%Y-%m-%d").date()
    elif isinstance(date_of_birth, datetime):
        date_of_birth = date_of_birth.date()
    
    today = date.today()
    return today.year - date_of_birth.year - ((today.month, today.day) < (date_of_birth.month, date_of_birth.day))

router = APIRouter(prefix="/api/ai-perception", tags=["ai-perception"])

# Initialize OpenAI client
try:
    client = OpenAI(api_key=settings.openai_api_key)
except Exception as e:
    logger.warning(f"OpenAI client initialization failed: {e}")
    client = None

# Models
class PerceptionAttribute(BaseModel):
    category: str  # e.g., "Risk Profile", "Spending Habits", "Financial Health"
    label: str     # e.g., "Conservative Spender", "High Risk"
    confidence: float
    evidence: List[str]  # Why AI thinks this (e.g., "Low debt-to-income ratio")
    lastUpdated: datetime
    status: str = "active"  # active, disputed, corrected

class PerceptionResponse(BaseModel):
    summary: str
    attributes: List[PerceptionAttribute]
    lastAnalysis: datetime

class DisputeRequest(BaseModel):
    category: str
    label: str
    reason: str
    correction: Optional[str] = None

def get_user_from_clerk_id(clerk_id: str, db):
    user = db.users.find_one({"clerkId": clerk_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.get("", response_model=PerceptionResponse)
def get_ai_perception(
    x_clerk_user_id: str = Header(..., alias="x-clerk-user-id"),
    refresh: bool = Query(False, description="Force refresh and bypass cache"),
    db = Depends(get_database)
):
    """Get the AI's perception of the user based on their data"""
    user = get_user_from_clerk_id(x_clerk_user_id, db)
    user_id = user["_id"]

    # Check for existing cached perception (unless refresh is requested)
    if not refresh:
        existing_perception = db.ai_perceptions.find_one(
            {"userId": user_id},
            sort=[("lastAnalysis", -1)]
        )

        if existing_perception:
            last_analysis = existing_perception.get("lastAnalysis")
            # Cache for 24 hours (1 day) - only refresh manually or after cache expires
            if isinstance(last_analysis, datetime) and (datetime.utcnow() - last_analysis).total_seconds() < 86400:
                # Convert attributes to PerceptionAttribute objects
                attributes = []
                for attr in existing_perception.get("attributes", []):
                    # Handle datetime conversion
                    last_updated = attr.get("lastUpdated")
                    if isinstance(last_updated, str):
                        try:
                            last_updated = datetime.fromisoformat(last_updated.replace('Z', '+00:00'))
                        except:
                            last_updated = datetime.utcnow()
                    elif not isinstance(last_updated, datetime):
                        last_updated = datetime.utcnow()
                    
                    attributes.append(PerceptionAttribute(
                        category=attr.get("category", "Unknown"),
                        label=attr.get("label", "Unknown"),
                        confidence=attr.get("confidence", 0.5),
                        evidence=attr.get("evidence", []),
                        lastUpdated=last_updated,
                        status=attr.get("status", "active")
                    ))
                
                # Handle lastAnalysis datetime
                if isinstance(last_analysis, str):
                    try:
                        last_analysis = datetime.fromisoformat(last_analysis.replace('Z', '+00:00'))
                    except:
                        last_analysis = datetime.utcnow()
                
                return PerceptionResponse(
                    summary=existing_perception.get("summary", "No summary available."),
                    attributes=attributes,
                    lastAnalysis=last_analysis or datetime.utcnow()
                )

    # If no cache or old, generate new perception
    # Gather data
    user_data = {
        "income": user.get("income"),
        "creditScore": user.get("creditScore"),
        "employmentStatus": user.get("employmentStatus"),
    }
    
    # Calculate age if dateOfBirth exists
    if user.get("dateOfBirth"):
        try:
            user_data["age"] = calculate_age(user.get("dateOfBirth"))
        except Exception as e:
            logger.warning(f"Could not calculate age: {e}")
    
    # Fetch recent transactions with AI analysis for spending wisdom insights
    six_months_ago = datetime.now() - timedelta(days=180)
    recent_txns = list(db.transactions.find({
        "userId": user_id,
        "createdAt": {"$gte": six_months_ago},
        "type": "debit"
    }).sort("createdAt", -1).limit(50))
    
    # Analyze spending wisdom patterns
    wise_count = 0
    unwise_count = 0
    total_wisdom_score = 0
    category_wisdom = {}
    
    for txn in recent_txns:
        ai_analysis = txn.get("aiAnalysis", {})
        wisdom = ai_analysis.get("spendingWisdom", "neutral")
        wisdom_score = ai_analysis.get("wisdomScore", 0.5)
        
        if wisdom == "wise":
            wise_count += 1
        elif wisdom == "unwise":
            unwise_count += 1
        
        total_wisdom_score += wisdom_score
        
        # Track category-wise wisdom
        category = txn.get("category", "other")
        if category not in category_wisdom:
            category_wisdom[category] = {"wise": 0, "unwise": 0, "neutral": 0}
        category_wisdom[category][wisdom] = category_wisdom[category].get(wisdom, 0) + 1
    
    avg_wisdom_score = total_wisdom_score / len(recent_txns) if recent_txns else 0.5
    wisdom_ratio = wise_count / len(recent_txns) if recent_txns else 0
    
    txn_summary = f"{len(recent_txns)} recent transactions analyzed. Wisdom score: {avg_wisdom_score:.2f}, Wise: {wise_count}, Unwise: {unwise_count}. Category patterns: {json.dumps(category_wisdom, default=str)}"

    if not client:
        # Fallback if OpenAI not available
        return PerceptionResponse(
            summary="AI perception service currently unavailable.",
            attributes=[],
            lastAnalysis=datetime.utcnow()
        )

    prompt = f"""
    Analyze this user's banking profile to create a "Digital Perception" based on their financial behavior.
    
    User Data: {json.dumps(user_data, default=str)}
    Transaction Analysis: {txn_summary}

    Generate 4-6 key perception attributes in these categories: "Risk Profile", "Spending Habits", "Financial Health".
    
    IMPORTANT: Consider spending wisdom patterns:
    - If user has many "unwise" transactions, they may be "Impulsive Spender" or "Poor Financial Discipline"
    - If user has many "wise" transactions, they may be "Prudent Spender" or "Goal-Oriented"
    - Consider category patterns - frequent unwise spending in certain categories indicates habits
    
    For each attribute, provide:
    - category: "Risk Profile" | "Spending Habits" | "Financial Health"
    - label: Descriptive label (e.g., "Impulsive Spender", "Prudent Saver", "High-Risk Spender")
    - confidence: 0.0-1.0 (how confident you are in this assessment)
    - evidence: 1-2 specific evidence points from the data

    Return valid JSON with this structure:
    {{
        "summary": "2 sentence summary of how the bank sees this user, including spending wisdom patterns.",
        "attributes": [
            {{
                "category": "Spending Habits",
                "label": "Impulsive Spender",
                "confidence": 0.85,
                "evidence": ["High ratio of unwise transactions", "Frequent impulse purchases"]
            }}
        ]
    }}
    """

    try:
        # Increased timeout for complex AI analysis (90 seconds)
        response = client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": "You are a transparent AI banking advisor. Output valid JSON."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            max_completion_tokens=5000,
            timeout=90.0,  # 90 second timeout for complex analysis
        )
        
        # Debug logging
        logger.info(f"OpenAI Response: {response}")
        logger.info(f"Choices: {response.choices}")
        if response.choices:
            logger.info(f"First choice: {response.choices[0]}")
            logger.info(f"Message: {response.choices[0].message}")
            logger.info(f"Content: {response.choices[0].message.content}")
        
        content = response.choices[0].message.content
        if not content:
            logger.error(f"Empty content. Full response: {response.model_dump()}")
            raise ValueError("OpenAI returned empty content")
            
        try:
            ai_data = json.loads(content)
        except json.JSONDecodeError as e:
            logger.error(f"JSON Parse Error: {e}. Content: {content}")
            # Try to recover if it's a markdown block
            if "```json" in content:
                try:
                    json_str = content.split("```json")[1].split("```")[0].strip()
                    ai_data = json.loads(json_str)
                except:
                    raise ValueError(f"Invalid JSON response from AI: {content[:100]}...")
            else:
                raise ValueError(f"Invalid JSON response from AI: {content[:100]}...")
        
        # Build attributes with proper types
        attributes = []
        for attr in ai_data.get("attributes", []):
            attributes.append(PerceptionAttribute(
                category=attr.get("category", "Unknown"),
                label=attr.get("label", "Unknown"),
                confidence=attr.get("confidence", 0.5),
                evidence=attr.get("evidence", []),
                lastUpdated=datetime.utcnow(),
                status="active"
            ))

        perception_doc = PerceptionResponse(
            summary=ai_data.get("summary", "Analysis complete."),
            attributes=attributes,
            lastAnalysis=datetime.utcnow()
        )

        # Save to DB (convert to dict for MongoDB)
        db_doc = {
            "userId": user_id,
            "summary": perception_doc.summary,
            "attributes": [attr.dict() for attr in perception_doc.attributes],
            "lastAnalysis": perception_doc.lastAnalysis
        }
        db.ai_perceptions.update_one(
            {"userId": user_id},
            {"$set": db_doc},
            upsert=True
        )
        
        return perception_doc

    except Exception as e:
        logger.error(f"AI Perception generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate AI perception")


@router.post("/dispute")
def dispute_perception(
    dispute: DisputeRequest,
    x_clerk_user_id: str = Header(..., alias="x-clerk-user-id"),
    db = Depends(get_database)
):
    """Dispute an AI perception attribute"""
    user = get_user_from_clerk_id(x_clerk_user_id, db)
    user_id = user["_id"]

    # Log the dispute
    dispute_doc = {
        "userId": user_id,
        "category": dispute.category,
        "label": dispute.label,
        "reason": dispute.reason,
        "proposedCorrection": dispute.correction,
        "status": "pending_review",
        "timestamp": datetime.utcnow()
    }
    
    db.ai_disputes.insert_one(dispute_doc)

    # Update the perception attribute status to 'disputed'
    db.ai_perceptions.update_one(
        {
            "userId": user_id, 
            "attributes": {
                "$elemMatch": {"category": dispute.category, "label": dispute.label}
            }
        },
        {
            "$set": {"attributes.$.status": "disputed"}
        }
    )

    return {"message": "Dispute submitted successfully. The AI model will be retrained/reviewed."}

