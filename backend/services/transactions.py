"""
Transactions Service - All transaction management and AI analysis
"""
from fastapi import APIRouter, HTTPException, Depends, Header, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from bson import ObjectId
from database import get_database
from config import settings
from openai import OpenAI
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/transactions", tags=["transactions"])

# Initialize OpenAI client
try:
    client = OpenAI(api_key=settings.openai_api_key)
except Exception as e:
    logger.warning(f"OpenAI client initialization failed: {e}")
    client = None

# Request/Response Models
class TransactionRequest(BaseModel):
    accountId: str = Field(..., description="Account ID")
    type: str = Field(..., description="Transaction type: debit or credit")
    amount: float = Field(..., gt=0, description="Transaction amount")
    description: str = Field(..., description="Transaction description")
    category: str = Field(..., description="Transaction category")
    merchantName: Optional[str] = Field(None, description="Merchant name")
    merchantCategory: Optional[str] = Field(None, description="Merchant category")
    currency: str = Field(default="INR", description="Currency code")

class TransactionResponse(BaseModel):
    id: str
    accountId: str
    userId: str
    type: str
    amount: float
    currency: str
    description: str
    category: str
    merchantName: Optional[str] = None
    merchantCategory: Optional[str] = None
    status: str
    aiAnalysis: Optional[Dict[str, Any]] = None
    createdAt: str
    updatedAt: str

class TransactionRecommendation(BaseModel):
    insight: str
    recommendation: str
    potentialSavings: Optional[float] = None
    category: str
    priority: str  # high, medium, low

def get_user_from_clerk_id(clerk_id: str, db):
    """Get user from MongoDB using Clerk ID"""
    user = db.users.find_one({"clerkId": clerk_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

def analyze_transaction_with_ai(transaction_data: Dict, user_data: Dict, db) -> Dict:
    """Analyze transaction with AI for fraud detection, categorization, and spending wisdom"""
    if not client:
        return {
            "fraudScore": 0.1,
            "riskLevel": "low",
            "categoryConfidence": 0.8,
            "anomalyScore": 0.0,
            "spendingWisdom": "neutral",
            "wisdomScore": 0.5,
            "wisdomReason": "AI analysis unavailable",
            "explanation": "AI analysis unavailable"
        }
    
    try:
        # Get user's recent transaction patterns
        six_months_ago = datetime.now() - timedelta(days=180)
        recent_transactions = list(db.transactions.find(
            {
                "userId": user_data["userId"],
                "createdAt": {"$gte": six_months_ago}
            },
            {"amount": 1, "category": 1, "type": 1, "merchantName": 1, "description": 1}
        ).limit(50))
        
        avg_amount = sum(t.get("amount", 0) for t in recent_transactions) / len(recent_transactions) if recent_transactions else 0
        common_categories = {}
        monthly_spending = {}
        for t in recent_transactions:
            cat = t.get("category", "other")
            common_categories[cat] = common_categories.get(cat, 0) + 1
            if t.get("type") == "debit":
                month = t.get("createdAt", datetime.now()).strftime("%Y-%m")
                monthly_spending[month] = monthly_spending.get(month, 0) + t.get("amount", 0)
        
        avg_monthly_spending = sum(monthly_spending.values()) / len(monthly_spending) if monthly_spending else 0
        monthly_income = user_data.get("income", 0) / 12 if user_data.get("income", 0) > 0 else 0
        
        # Get user's savings goals and accounts
        savings_goals = list(db.savings_goals.find({"userId": user_data["userId"]}).limit(5))
        savings_accounts = list(db.savings_accounts.find({"userId": user_data["userId"]}).limit(5))
        total_savings = sum(acc.get("balance", 0) for acc in savings_accounts)
        
        prompt = f"""
        Analyze this transaction comprehensively:
        
        Transaction Details:
        - Amount: ₹{transaction_data['amount']:,.2f}
        - Type: {transaction_data['type']}
        - Description: {transaction_data['description']}
        - Category: {transaction_data['category']}
        - Merchant: {transaction_data.get('merchantName', 'Unknown')}
        
        User's Financial Profile:
        - Monthly Income: ₹{monthly_income:,.2f}
        - Average Monthly Spending: ₹{avg_monthly_spending:,.2f}
        - Total Savings: ₹{total_savings:,.2f}
        - Credit Score: {user_data.get('creditScore', 'N/A')}
        - Active Savings Goals: {len(savings_goals)}
        - Average Transaction Amount: ₹{avg_amount:,.2f}
        - Common Spending Categories: {json.dumps(common_categories, indent=2)}
        
        Provide comprehensive analysis:
        1. Fraud risk score (0-1, where 0 is safe and 1 is highly suspicious)
        2. Risk level (low, medium, high)
        3. Category confidence (0-1)
        4. Anomaly score (0-1) - how unusual this transaction is compared to patterns
        5. Spending Wisdom Assessment:
           - spendingWisdom: "wise" | "unwise" | "neutral"
           - wisdomScore: 0.0-1.0 (0 = very unwise, 1 = very wise)
           - wisdomReason: Brief explanation (e.g., "This purchase aligns with your savings goals" or "This is an impulse purchase that exceeds your typical spending")
        6. Brief overall explanation
        
        Consider for wisdom assessment:
        - Is this aligned with financial goals?
        - Is this an impulse purchase?
        - Does this fit within normal spending patterns?
        - Is this a necessary expense or discretionary?
        - Impact on savings goals and financial health
        
        Return JSON:
        {{
            "fraudScore": 0.0-1.0,
            "riskLevel": "low|medium|high",
            "categoryConfidence": 0.0-1.0,
            "anomalyScore": 0.0-1.0,
            "spendingWisdom": "wise|unwise|neutral",
            "wisdomScore": 0.0-1.0,
            "wisdomReason": "Brief explanation of wisdom assessment",
            "explanation": "Brief overall explanation"
        }}
        """
        
        response = client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": "You are a comprehensive financial advisor AI. Analyze transactions for fraud risk AND spending wisdom. Provide honest, actionable insights."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            timeout=30.0
        )
        
        ai_result = json.loads(response.choices[0].message.content)
        
        # Ensure all required fields are present
        result = {
            "fraudScore": ai_result.get("fraudScore", 0.1),
            "riskLevel": ai_result.get("riskLevel", "low"),
            "categoryConfidence": ai_result.get("categoryConfidence", 0.8),
            "anomalyScore": ai_result.get("anomalyScore", 0.0),
            "spendingWisdom": ai_result.get("spendingWisdom", "neutral"),
            "wisdomScore": ai_result.get("wisdomScore", 0.5),
            "wisdomReason": ai_result.get("wisdomReason", "Analysis completed"),
            "explanation": ai_result.get("explanation", "Transaction analyzed")
        }
        
        return result
    
    except Exception as e:
        logger.error(f"AI analysis error: {e}")
        return {
            "fraudScore": 0.1,
            "riskLevel": "low",
            "categoryConfidence": 0.8,
            "anomalyScore": 0.0,
            "spendingWisdom": "neutral",
            "wisdomScore": 0.5,
            "wisdomReason": f"Analysis error: {str(e)}",
            "explanation": f"Analysis error: {str(e)}"
        }

def get_transaction_recommendations(user_id: ObjectId, db) -> List[TransactionRecommendation]:
    """Get AI-powered recommendations based on transaction patterns"""
    if not client:
        return []
    
    try:
        # Get transaction data
        six_months_ago = datetime.now() - timedelta(days=180)
        transactions = list(db.transactions.find(
            {
                "userId": user_id,
                "createdAt": {"$gte": six_months_ago},
                "status": "completed"
            },
            {"amount": 1, "category": 1, "type": 1, "description": 1, "createdAt": 1}
        ).limit(100))
        
        if not transactions:
            return []
        
        # Calculate spending patterns
        monthly_spending = {}
        category_spending = {}
        
        for t in transactions:
            if t.get("type") == "debit":
                month = t.get("createdAt", datetime.now()).strftime("%Y-%m")
                monthly_spending[month] = monthly_spending.get(month, 0) + t.get("amount", 0)
                cat = t.get("category", "other")
                category_spending[cat] = category_spending.get(cat, 0) + t.get("amount", 0)
        
        total_spending = sum(monthly_spending.values())
        avg_monthly = total_spending / len(monthly_spending) if monthly_spending else 0
        
        prompt = f"""
        Analyze this user's spending patterns and provide actionable recommendations:
        
        Spending Data:
        - Total spending (6 months): {total_spending:.2f}
        - Average monthly spending: {avg_monthly:.2f}
        - Category breakdown: {json.dumps(category_spending, indent=2)}
        - Monthly trends: {json.dumps(monthly_spending, indent=2)}
        
        Provide 3-5 specific, actionable recommendations to help save money and improve financial health.
        Focus on:
        1. Spending reduction opportunities
        2. Category-specific insights
        3. Behavioral patterns
        
        Return JSON:
        {{
            "recommendations": [
                {{
                    "insight": "What pattern you noticed",
                    "recommendation": "Specific actionable advice",
                    "potentialSavings": 0.00,
                    "category": "category_name",
                    "priority": "high|medium|low"
                }}
            ]
        }}
        """
        
        response = client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": "You are a financial advisor AI. Provide specific, actionable recommendations."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        
        ai_result = json.loads(response.choices[0].message.content)
        recommendations = []
        
        for rec in ai_result.get("recommendations", []):
            recommendations.append(TransactionRecommendation(
                insight=rec.get("insight", ""),
                recommendation=rec.get("recommendation", ""),
                potentialSavings=rec.get("potentialSavings"),
                category=rec.get("category", "general"),
                priority=rec.get("priority", "medium")
            ))
        
        return recommendations
    
    except Exception as e:
        logger.error(f"Recommendation generation error: {e}")
        return []

# Transaction Endpoints
@router.get("", response_model=List[TransactionResponse])
def get_transactions(
    accountId: Optional[str] = Query(None, description="Filter by account ID"),
    type: Optional[str] = Query(None, description="Filter by type: debit or credit"),
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(100, ge=1, le=500),
    skip: int = Query(0, ge=0),
    x_clerk_user_id: str = Header(..., alias="x-clerk-user-id"),
    db = Depends(get_database)
):
    """Get all transactions for the user"""
    user = get_user_from_clerk_id(x_clerk_user_id, db)
    user_id = user["_id"]
    
    query = {"userId": user_id}
    
    if accountId:
        query["accountId"] = ObjectId(accountId)
    
    if type:
        query["type"] = type
    
    if category:
        query["category"] = category
    
    # Use projection to only fetch needed fields
    projection = {
        "_id": 1, "accountId": 1, "userId": 1, "type": 1, "amount": 1, 
        "currency": 1, "description": 1, "category": 1, "merchantName": 1,
        "reference": 1, "date": 1, "createdAt": 1, "updatedAt": 1, "aiAnalysis": 1
    }
    
    transactions = list(db.transactions.find(query, projection=projection)
                       .sort("createdAt", -1)
                       .limit(limit)
                       .skip(skip))
    
    result = []
    for txn in transactions:
        result.append(TransactionResponse(
            id=str(txn["_id"]),
            accountId=str(txn["accountId"]),
            userId=str(txn["userId"]),
            type=txn.get("type", ""),
            amount=txn.get("amount", 0),
            currency=txn.get("currency", "INR"),
            description=txn.get("description", ""),
            category=txn.get("category", ""),
            merchantName=txn.get("merchantName"),
            merchantCategory=txn.get("merchantCategory"),
            status=txn.get("status", "completed"),
            aiAnalysis=txn.get("aiAnalysis"),
            createdAt=txn.get("createdAt", datetime.now()).isoformat(),
            updatedAt=txn.get("updatedAt", datetime.now()).isoformat()
        ))
    
    return result

@router.post("", response_model=TransactionResponse)
def create_transaction(
    transaction_data: TransactionRequest,
    x_clerk_user_id: str = Header(..., alias="x-clerk-user-id"),
    db = Depends(get_database),
    skip_ai: bool = Query(False, description="Skip AI analysis for faster processing")
):
    """Create a new transaction with optional AI analysis"""
    user = get_user_from_clerk_id(x_clerk_user_id, db)
    user_id = user["_id"]
    
    # Verify account exists and belongs to user - check both accounts and savings_accounts
    account = db.accounts.find_one({
        "_id": ObjectId(transaction_data.accountId),
        "userId": user_id
    })
    
    # If not found in regular accounts, check savings accounts
    savings_account = None
    if not account:
        savings_account = db.savings_accounts.find_one({
            "_id": ObjectId(transaction_data.accountId),
            "userId": user_id
        })
        if savings_account:
            # Create a compatible account object from savings account
            account = {
                "_id": savings_account["_id"],
                "userId": savings_account["userId"],
                "accountNumber": savings_account.get("accountNumber", ""),
                "accountType": "savings",
                "balance": savings_account.get("balance", 0),
                "currency": "INR",
                "status": "active",
                "name": savings_account.get("name"),
                "metadata": {
                    "interestRate": savings_account.get("interestRate"),
                    "apy": savings_account.get("apy"),
                    "minimumBalance": savings_account.get("minimumBalance", 0),
                    "savingsAccountType": savings_account.get("accountType")
                }
            }
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Validate transaction type
    if transaction_data.type not in ["debit", "credit"]:
        raise HTTPException(status_code=400, detail="Transaction type must be 'debit' or 'credit'")
    
    # Update account balance first (fast operation)
    current_balance = account.get("balance", 0)
    is_savings_account = savings_account is not None or account.get("accountType") == "savings"
    min_balance = account.get("metadata", {}).get("minimumBalance", 0) if account.get("metadata") else 0
    
    if transaction_data.type == "credit":
        new_balance = current_balance + transaction_data.amount
    else:  # debit
        new_balance = current_balance - transaction_data.amount
        # Check for overdraft or minimum balance violation
        if new_balance < 0:
            if new_balance < -min_balance:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient balance. Available: ₹{current_balance:,.2f}"
                )
        # For savings accounts, check minimum balance requirement
        if is_savings_account and new_balance < min_balance:
            raise HTTPException(
                status_code=400,
                detail=f"Withdrawal would violate minimum balance requirement of ₹{min_balance:,.2f}. Available: ₹{current_balance:,.2f}"
            )
    
    # Prepare transaction data
    new_transaction = {
        "accountId": ObjectId(transaction_data.accountId),
        "userId": user_id,
        "type": transaction_data.type,
        "amount": transaction_data.amount,
        "currency": transaction_data.currency,
        "description": transaction_data.description,
        "category": transaction_data.category,
        "merchantName": transaction_data.merchantName,
        "merchantCategory": transaction_data.merchantCategory,
        "status": "completed",
        "createdAt": datetime.now(),
        "updatedAt": datetime.now()
    }
    
    # AI analysis - do it synchronously only if not skipped, otherwise use default
    if skip_ai:
        # Use default/low-risk analysis for speed
        new_transaction["aiAnalysis"] = {
            "fraudScore": 0.0,
            "riskLevel": "low",
            "categoryConfidence": 0.8,
            "anomalyScore": 0.0,
            "spendingWisdom": "neutral",
            "wisdomScore": 0.5,
            "wisdomReason": "AI analysis skipped",
            "explanation": "Transaction processed successfully"
        }
    else:
        # Analyze with AI (slower but more thorough)
        try:
            user_data = {
                "userId": user_id,
                "income": user.get("income"),
                "creditScore": user.get("creditScore")
            }
            
            ai_analysis = analyze_transaction_with_ai(
                {
                    "amount": transaction_data.amount,
                    "type": transaction_data.type,
                    "description": transaction_data.description,
                    "category": transaction_data.category,
                    "merchantName": transaction_data.merchantName or ""
                },
                user_data,
                db
            )
            new_transaction["aiAnalysis"] = ai_analysis
        except Exception as e:
            logger.warning(f"AI analysis failed, using default: {e}")
            # Fallback to default analysis if AI fails
            new_transaction["aiAnalysis"] = {
                "fraudScore": 0.0,
                "riskLevel": "low",
                "categoryConfidence": 0.8,
                "anomalyScore": 0.0,
                "spendingWisdom": "neutral",
                "wisdomScore": 0.5,
                "wisdomReason": "AI analysis unavailable",
                "explanation": "Transaction processed successfully"
            }
    
    # Insert transaction
    result = db.transactions.insert_one(new_transaction)
    new_transaction["_id"] = result.inserted_id
    
    # Update account balance - update the correct collection
    if savings_account:
        # Update savings account
        db.savings_accounts.update_one(
            {"_id": ObjectId(transaction_data.accountId)},
            {"$set": {"balance": new_balance, "updatedAt": datetime.now()}}
        )
        # Also sync to regular accounts if it exists there
        account_number = account.get("accountNumber")
        if account_number:
            db.accounts.update_one(
                {"accountNumber": account_number, "userId": user_id},
                {"$set": {"balance": new_balance, "updatedAt": datetime.now()}},
                upsert=False
            )
    else:
        # Update regular account
        db.accounts.update_one(
            {"_id": ObjectId(transaction_data.accountId)},
            {"$set": {"balance": new_balance, "updatedAt": datetime.now()}}
        )
        # Also update savings_accounts if this account number exists there
        account_number = account.get("accountNumber")
        if account_number:
            db.savings_accounts.update_one(
                {"accountNumber": account_number},
                {"$set": {"balance": new_balance, "updatedAt": datetime.now()}},
                upsert=False  # Don't create if doesn't exist
            )
    
    # Trigger AI perception update in background (don't wait for it)
    try:
        # Invalidate perception cache so it regenerates on next request
        db.ai_perceptions.update_one(
            {"userId": user_id},
            {"$set": {"lastAnalysis": datetime(1970, 1, 1)}},  # Set to old date to force refresh
            upsert=False
        )
    except Exception as e:
        logger.warning(f"Failed to invalidate perception cache: {e}")
    
    # Invalidate caches (new transaction may change recommendations, insights, and health score)
    try:
        # Invalidate transaction recommendations cache
        cache_key = f"transaction_recommendations_{user_id}"
        db.transaction_recommendations_cache.delete_one({"_id": cache_key})
        logger.info(f"Invalidated recommendations cache for user {user_id}")
        
        # Invalidate comprehensive insights cache (includes health score)
        insights_cache_key = f"ai_insights_{user_id}"
        db.ai_insights_cache.delete_one({"_id": insights_cache_key})
        logger.info(f"Invalidated insights cache for user {user_id}")
    except Exception as e:
        logger.warning(f"Failed to invalidate caches: {e}")
    
    return TransactionResponse(
        id=str(new_transaction["_id"]),
        accountId=str(new_transaction["accountId"]),
        userId=str(new_transaction["userId"]),
        type=new_transaction["type"],
        amount=new_transaction["amount"],
        currency=new_transaction["currency"],
        description=new_transaction["description"],
        category=new_transaction["category"],
        merchantName=new_transaction.get("merchantName"),
        merchantCategory=new_transaction.get("merchantCategory"),
        status=new_transaction["status"],
        aiAnalysis=new_transaction.get("aiAnalysis"),
        createdAt=new_transaction["createdAt"].isoformat(),
        updatedAt=new_transaction["updatedAt"].isoformat()
    )

@router.get("/summary/stats")
def get_transaction_stats(
    x_clerk_user_id: str = Header(..., alias="x-clerk-user-id"),
    db = Depends(get_database)
):
    """Get transaction statistics"""
    user = get_user_from_clerk_id(x_clerk_user_id, db)
    user_id = user["_id"]
    
    # Use aggregation for efficiency
    pipeline = [
        {"$match": {"userId": user_id}},
        {
            "$group": {
                "_id": None,
                "totalTransactions": {"$sum": 1},
                "totalSpent": {
                    "$sum": {
                        "$cond": [{"$eq": ["$type", "debit"]}, "$amount", 0]
                    }
                },
                "totalReceived": {
                    "$sum": {
                        "$cond": [{"$eq": ["$type", "credit"]}, "$amount", 0]
                    }
                },
                "flaggedCount": {
                    "$sum": {
                        "$cond": [{"$eq": ["$aiAnalysis.riskLevel", "high"]}, 1, 0]
                    }
                },
                "categoryBreakdown": {
                    "$push": {
                        "category": "$category",
                        "amount": "$amount"
                    }
                }
            }
        }
    ]
    
    result = list(db.transactions.aggregate(pipeline))
    
    if not result:
        return {
            "totalTransactions": 0,
            "totalSpent": 0,
            "totalReceived": 0,
            "flaggedCount": 0,
            "categoryBreakdown": {}
        }
    
    stats = result[0]
    
    # Process category breakdown
    category_breakdown = {}
    for item in stats.get("categoryBreakdown", []):
        if item:
            cat = item.get("category", "other")
            amount = item.get("amount", 0)
            category_breakdown[cat] = category_breakdown.get(cat, 0) + amount
    
    return {
        "totalTransactions": stats.get("totalTransactions", 0),
        "totalSpent": round(stats.get("totalSpent", 0), 2),
        "totalReceived": round(stats.get("totalReceived", 0), 2),
        "flaggedCount": stats.get("flaggedCount", 0),
        "categoryBreakdown": {k: round(v, 2) for k, v in category_breakdown.items()}
    }

@router.get("/recommendations/insights")
def get_transaction_recommendations_endpoint(
    x_clerk_user_id: str = Header(..., alias="x-clerk-user-id"),
    refresh: bool = Query(False, description="Force refresh and bypass cache"),
    db = Depends(get_database)
):
    """Get AI-powered transaction recommendations (cached for 30 minutes)"""
    user = get_user_from_clerk_id(x_clerk_user_id, db)
    user_id = user["_id"]
    
    # Check cache first (unless refresh is requested)
    if not refresh:
        cache_key = f"transaction_recommendations_{user_id}"
        cached_data = db.transaction_recommendations_cache.find_one({"_id": cache_key})
        
        if cached_data:
            cache_age = (datetime.now() - cached_data.get("created_at", datetime.now())).total_seconds()
            # Cache for 30 minutes (1800 seconds)
            if cache_age < 1800:
                logger.info(f"Returning cached recommendations (age: {cache_age:.1f}s)")
                return {
                    "recommendations": cached_data.get("recommendations", []),
                    "cached": True,
                    "cacheAge": round(cache_age, 1)
                }
    
    # Generate new recommendations
    recommendations = get_transaction_recommendations(user_id, db)
    
    # Convert to dict format for response and cache
    recommendations_dict = [
        {
            "insight": rec.insight,
            "recommendation": rec.recommendation,
            "potentialSavings": rec.potentialSavings,
            "category": rec.category,
            "priority": rec.priority
        }
        for rec in recommendations
    ]
    
    # Cache the recommendations for 30 minutes
    try:
        cache_key = f"transaction_recommendations_{user_id}"
        cache_data = {
            "_id": cache_key,
            "recommendations": recommendations_dict,
            "created_at": datetime.now(),
            "userId": user_id
        }
        db.transaction_recommendations_cache.replace_one(
            {"_id": cache_key},
            cache_data,
            upsert=True
        )
        logger.info(f"Cached recommendations for user {user_id}")
    except Exception as e:
        logger.warning(f"Failed to cache recommendations: {e}")
    
    return {
        "recommendations": recommendations_dict,
        "cached": False
    }

@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(
    transaction_id: str,
    x_clerk_user_id: str = Header(..., alias="x-clerk-user-id"),
    db = Depends(get_database)
):
    """Get a specific transaction"""
    user = get_user_from_clerk_id(x_clerk_user_id, db)
    user_id = user["_id"]
    
    transaction = db.transactions.find_one({
        "_id": ObjectId(transaction_id),
        "userId": user_id
    })
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    return TransactionResponse(
        id=str(transaction["_id"]),
        accountId=str(transaction["accountId"]),
        userId=str(transaction["userId"]),
        type=transaction.get("type", ""),
        amount=transaction.get("amount", 0),
        currency=transaction.get("currency", "INR"),
        description=transaction.get("description", ""),
        category=transaction.get("category", ""),
        merchantName=transaction.get("merchantName"),
        merchantCategory=transaction.get("merchantCategory"),
        status=transaction.get("status", "completed"),
        aiAnalysis=transaction.get("aiAnalysis"),
        createdAt=transaction.get("createdAt", datetime.now()).isoformat(),
        updatedAt=transaction.get("updatedAt", datetime.now()).isoformat()
    )

@router.delete("/{transaction_id}")
def delete_transaction(
    transaction_id: str,
    x_clerk_user_id: str = Header(..., alias="x-clerk-user-id"),
    db = Depends(get_database)
):
    """Delete a transaction and reverse its effect on account balance"""
    user = get_user_from_clerk_id(x_clerk_user_id, db)
    user_id = user["_id"]
    
    # Find transaction first
    transaction = db.transactions.find_one({
        "_id": ObjectId(transaction_id),
        "userId": user_id
    })
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Reverse balance effect
    account_id = transaction.get("accountId")
    amount = transaction.get("amount", 0)
    trans_type = transaction.get("type")
    
    if account_id and amount > 0:
        account = db.accounts.find_one({"_id": account_id})
        if account:
            current_balance = account.get("balance", 0)
            if trans_type == "credit":
                # It was a credit (add), so we subtract to reverse
                new_balance = current_balance - amount
            elif trans_type == "debit":
                # It was a debit (subtract), so we add to reverse
                new_balance = current_balance + amount
            else:
                new_balance = current_balance
                
            db.accounts.update_one(
                {"_id": account_id},
                {"$set": {"balance": new_balance, "updatedAt": datetime.now()}}
            )

    # Delete transaction
    result = db.transactions.delete_one({
        "_id": ObjectId(transaction_id),
        "userId": user_id
    })
    
    return {"success": True, "message": "Transaction deleted and balance reversed"}

