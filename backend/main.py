import os
import sys
import json
import time

# Force UTF-8 encoding for standard output and error to prevent charmap encoding issues on Windows
import codecs
if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
if sys.stderr.encoding.lower() != 'utf-8':
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

import asyncio
import uuid
from datetime import datetime
from typing import Optional
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import shutil
from google import genai
from google.genai import types as genai_types
from typing import List, Dict, Any, Union

load_dotenv()

import local_db  # Using local file DB instead of Supabase

# ============================================================
# INITIALIZE DATABASE
# ============================================================
# We use local JSON files now instead of Supabase.
supabase = None

app = FastAPI(title="NEER — Farmer AI Assistant API")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Enable CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# GEMINI CASCADING MODEL SYSTEM
# Each model on the free tier has its OWN independent rate limit.
# By cascading through multiple models, we effectively multiply
# the available quota (e.g., 15 RPM × 3 models = 45 RPM).
# ============================================================
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    print("WARNING: GOOGLE_API_KEY environment variable not set.")

gemini_client = genai.Client(api_key=GOOGLE_API_KEY)

# Ordered list of models to try. Each has independent rate limits.
GEMINI_MODELS = [
    "gemini-2.0-flash",        # Primary: 15 RPM, 1500 RPD
    "gemini-2.0-flash-lite",   # Fallback 1: 30 RPM, 1500 RPD
    "gemini-2.5-flash-lite",   # Fallback 2: 30 RPM, 1500 RPD
]

MAX_RETRIES = 2         # Number of full cascade retry rounds
RETRY_DELAY_SEC = 5     # Seconds to wait between retry rounds


def _is_rate_limit_error(err: Exception) -> bool:
    """Check if an exception is a Gemini 429 / quota error."""
    err_str = str(err).lower()
    return "429" in err_str or "quota" in err_str or "resource_exhausted" in err_str


def gemini_generate_text(prompt: str) -> str:
    """
    Generate text content via Gemini, cascading through models on 429 errors.
    Retries the full cascade with a delay if all models are exhausted.
    """
    last_error = None
    for attempt in range(MAX_RETRIES + 1):
        for model_id in GEMINI_MODELS:
            try:
                response = gemini_client.models.generate_content(
                    model=model_id,
                    contents=prompt
                )
                return response.text.strip()
            except Exception as e:
                last_error = e
                if _is_rate_limit_error(e):
                    print(f"[CASCADE] {model_id} rate-limited. Trying next model...")
                    continue
                else:
                    # Non-rate-limit error: raise immediately
                    raise

        # All models in this round were rate-limited
        if attempt < MAX_RETRIES:
            print(f"[CASCADE] All models exhausted. Waiting {RETRY_DELAY_SEC}s before retry {attempt + 1}...")
            time.sleep(RETRY_DELAY_SEC)

    raise last_error  # All retries exhausted


def gemini_generate_vision(prompt: str, image_bytes: bytes, mime_type: str) -> str:
    """
    Generate vision content via Gemini, cascading through models on 429 errors.
    """
    last_error = None
    for attempt in range(MAX_RETRIES + 1):
        for model_id in GEMINI_MODELS:
            try:
                response = gemini_client.models.generate_content(
                    model=model_id,
                    contents=[
                        genai_types.Part.from_text(text=prompt),
                        genai_types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
                    ]
                )
                return response.text.strip()
            except Exception as e:
                last_error = e
                if _is_rate_limit_error(e):
                    print(f"[VISION CASCADE] {model_id} rate-limited. Trying next model...")
                    continue
                else:
                    raise

        if attempt < MAX_RETRIES:
            print(f"[VISION CASCADE] All models exhausted. Waiting {RETRY_DELAY_SEC}s before retry {attempt + 1}...")
            time.sleep(RETRY_DELAY_SEC)

    raise last_error


# ============================================================
# CROP DOCTOR AGENT
# ============================================================
from crop_doctor import CropDoctor

crop_doctor = CropDoctor(
    vision_fn=gemini_generate_vision,
    text_fn=gemini_generate_text
)


# ============================================================
# SCHEME NAVIGATOR AGENT
# ============================================================
from scheme_navigator import SchemeNavigator

scheme_navigator = SchemeNavigator(
    text_fn=gemini_generate_text
)


# ============================================================
# WEATHER SCOUT AGENT
# ============================================================
from weather_scout import WeatherScout

weather_scout = WeatherScout(
    text_fn=gemini_generate_text
)


# ============================================================
# DATA & MODELS
# ============================================================
with open("schemes.json", "r", encoding="utf-8") as f:
    SCHEMES_DB = json.load(f)

class ChatRequest(BaseModel):
    message: str
    context: Optional[str] = None

class LoginRequest(BaseModel):
    phone: str
    lang: str = "English"

class ProfileUpdate(BaseModel):
    user_id: str
    name: str
    language: str
    state: str
    district: str
    village: str
    primary_crop: str
    land_size: float


class SchemeRequest(BaseModel):
    state: str
    land_size: float
    lang: str = "English"
    crop_context: Optional[dict] = None

class WeatherRequest(BaseModel):
    city: str = ""
    state: str = "Rajasthan"
    lang: str = "English"
    crop_type: Optional[str] = None


class CommunityPostRequest(BaseModel):
    author: str
    location: str
    avatar: str
    type: str  # 'discussion' | 'mandi'
    content: str
    crop: Optional[str] = None
    price: Optional[float] = None
    image_url: Optional[str] = None

class CommunityLikeRequest(BaseModel):
    post_id: str
    user_id: str

class CommunityCommentRequest(BaseModel):
    post_id: str
    author: str
    content: str

class CommunityBidRequest(BaseModel):
    post_id: str
    author: str
    amount: float

class CropCalendarRequest(BaseModel):
    state: str
    crop: str
    lang: str = "English"

class FarmAdvisorRequest(BaseModel):
    state: str
    crop: str
    task_type: str   # e.g. "irrigation", "fertilizer", "pesticide"
    date: str        # YYYY-MM-DD
    lang: str = "English"

# ============================================================
# ENDPOINTS
# ============================================================

@app.post("/auth/sync")
async def sync_user_endpoint(request: dict):
    """Sync user after Auth (OTP or Google)."""
    user_id = request.get("user_id")
    email = request.get("email")
    phone = request.get("phone")
    name = request.get("name") or "Farmer Friend"
    lang = request.get("lang") or "English"

    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")

    now_str = datetime.utcnow().isoformat() + "Z"

    # Check if user exists in local_db
    existing_user = local_db.get_by_id("users", user_id)

    if existing_user:
        # Update last login
        updated = local_db.update_by_id("users", user_id, {
            "last_login": now_str
        })
        return updated or existing_user
    else:
        # Create new profile record
        new_user = {
            "id": user_id,
            "phone": phone,
            "name": name,
            "language": lang,
            "profile_complete": False,
            "joined_at": now_str,
            "last_login": now_str,
            "state": "",
            "district": "",
            "village": "",
            "primary_crop": "",
            "land_size": 0.0
        }
        res = local_db.insert("users", new_user)
        return res

@app.patch("/user/profile")
async def update_profile_endpoint(request: ProfileUpdate):
    now_str = datetime.utcnow().isoformat() + "Z"
    
    update_data = {
        "name": request.name,
        "language": request.language,
        "state": request.state,
        "district": request.district,
        "village": request.village,
        "primary_crop": request.primary_crop,
        "land_size": request.land_size,
        "profile_complete": True,
        "last_login": now_str
    }
    
    res = local_db.update_by_id("users", request.user_id, update_data)
    if res:
        return res
    raise HTTPException(status_code=404, detail="User not found")

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    """
    NEER Smart Orchestrator — Using Gemini Function Calling to use farming tools.
    """
    context_info = f"\nRELEVANT CONTEXT (User was just looking at these items/schemes):\n{request.context}" if request.context else ""
    
    # Tool definitions for Gemini
    tools = [
        {
            "function_declarations": [
                {
                    "name": "get_weather_update",
                    "description": "Get live weather, farming alerts, and AI advisory for a specific city and state in India.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "city": {"type": "STRING", "description": "The name of the city/district (e.g., 'Jodhpur')."},
                            "state": {"type": "STRING", "description": "The name of the Indian state (e.g., 'Rajasthan')."},
                            "lang": {"type": "STRING", "description": "The language for the response ('English' or 'Hindi').", "default": "English"},
                            "crop_type": {"type": "STRING", "description": "Optional crop type to get specific advice for."}
                        },
                        "required": ["city", "state"]
                    }
                },
                {
                    "name": "find_government_schemes",
                    "description": "Find and rank relevant Indian government agricultural schemes (PM-Kisan, KCC, etc.) based on location and land size.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "state": {"type": "STRING", "description": "The Indian state (e.g., 'Punjab')."},
                            "land_size": {"type": "NUMBER", "description": "The farmer's land size in acres (e.g., 5.5)."},
                            "lang": {"type": "STRING", "description": "The language for the response ('English' or 'Hindi').", "default": "English"},
                            "crop_context": {"type": "STRING", "description": "Optional context about current crops or health."}
                        },
                        "required": ["state", "land_size"]
                    }
                }
            ]
        }
    ]

    system_instruction = f"""
    You are 'NEER', a highly professional, polite, and direct agricultural consultant for Indian farmers.
    Your goal is to provide concise, expert-level advice. Use the provided tools (weather, schemes) when the user's query relates to them.
    {context_info}
    
    GUIDELINES:
    1. STYLE: Be extremely concise. Use bullet points for steps or lists.
    2. TONE: Professional, efficient, and respectful.
    3. HYPERLINKS: Format official websites as markdown links: [Portal Name](url).
    4. LANGUAGE: Respond ONLY in the language the user uses.
    5. FOCUS: Concrete, actionable advice.
    """

    try:
        # We'll use a standard chat-like flow with function calling
        # For simplicity in this cascading setup, we'll implement a manual loop or use the SDK's higher-level features if stable
        # Here we manually handle the call to maintain our cascading model logic
        
        def run_orchestrated_task(model_id):
            chat = gemini_client.chats.create(
                model=model_id,
                config=genai_types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    tools=tools
                )
            )
            
            response = chat.send_message(request.message)
            
            # Check for function calls
            if response.candidates[0].content.parts:
                for part in response.candidates[0].content.parts:
                    if part.function_call:
                        call = part.function_call
                        res_data = {}
                        
                        if call.name == "get_weather_update":
                            res_data = weather_scout.get_weather(**call.args)
                        elif call.name == "find_government_schemes":
                            # Adapter for land_size type and crop_context
                            args = dict(call.args)
                            if isinstance(args.get("crop_context"), str):
                                args["crop_context"] = {"summary": args["crop_context"]}
                            res_data = scheme_navigator.find_schemes(**args)
                        
                        # Send the tool result back to Gemini
                        response = chat.send_message(
                            genai_types.Content(
                                parts=[genai_types.Part.from_function_response(
                                    name=call.name,
                                    response={"result": res_data}
                                )]
                            )
                        )
            
            return response.text.strip()

        # Cascade implementation for the orchestrated task
        last_error = None
        for attempt in range(MAX_RETRIES + 1):
            for model_id in GEMINI_MODELS:
                try:
                    return {"response": run_orchestrated_task(model_id)}
                except Exception as e:
                    last_error = e
                    if _is_rate_limit_error(e):
                        print(f"[ORCHESTRATOR] {model_id} busy. Cascading...")
                        continue
                    raise
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY_SEC)
        raise last_error

    except Exception as e:
        if _is_rate_limit_error(e):
            raise HTTPException(status_code=429, detail="All Gemini models are temporarily busy.")
        raise HTTPException(status_code=500, detail=f"Orchestration failed: {str(e)}")


@app.post("/detect")
async def detect_endpoint(
    image: UploadFile = File(...),
    lang: str = Form("English"),
    state: str = Form(None),
    crop_name: str = Form(None),
    user_id: str = Form(None)
):
    """Crop Doctor Agent — multi-step disease detection pipeline."""
    allowed_types = ["image/jpeg", "image/png", "image/jpg", "image/webp"]
    if image.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload a JPG, PNG, or WEBP image.")

    try:
        contents = await image.read()

        if len(contents) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB.")

        # Run the Crop Doctor Agent pipeline
        result = crop_doctor.diagnose(
            image_bytes=contents,
            mime_type=image.content_type,
            lang=lang,
            state=state,
            crop_hint=crop_name
        )

        # Persistence: If user_id is provided, save to history
        if user_id and result.get("status") == "success":
            try:
                # 1. Save image locally (similar to /upload) to get a URL
                file_ext = image.filename.split('.')[-1] if '.' in image.filename else 'jpg'
                unique_filename = f"{uuid.uuid4().hex}.{file_ext}"
                os.makedirs("uploads", exist_ok=True)
                file_path = os.path.join("uploads", unique_filename)
                with open(file_path, "wb") as buffer:
                    buffer.write(contents)
                
                image_url = f"http://localhost:8000/uploads/{unique_filename}"
                data = result["data"]
                
                # 2. Insert into local history table
                local_db.insert("history", {
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "crop_name": data.get("crop_type"),
                    "disease_name": data.get("disease_candidates")[0]["name"] if data.get("disease_candidates") else "Unknown",
                    "confidence": data.get("disease_candidates")[0]["confidence_percentage"] if data.get("disease_candidates") else 0,
                    "treatment": json.dumps(data.get("organic_treatment", []) + data.get("chemical_treatment", [])),
                    "image_url": image_url,
                    "timestamp": datetime.utcnow().isoformat() + "Z"
                })
                
                # Add image_url to final response for frontend
                result["image_url"] = image_url
            except Exception as e:
                print(f"Failed to save history: {e}")

        return result

    except ValueError as ve:
        # JSON parse errors from the agent
        raise HTTPException(status_code=500, detail=f"AI returned invalid response: {ve}")
    except HTTPException:
        raise
    except Exception as e:
        if _is_rate_limit_error(e):
            raise HTTPException(status_code=429, detail="All Gemini models are temporarily busy. Please wait 30 seconds and try again.")
        raise HTTPException(status_code=500, detail=f"AI processing failed: {str(e)}")


@app.post("/schemes")
async def schemes_endpoint(request: SchemeRequest):
    """Scheme Navigator Agent — smart scheme matching with color-coded tiers."""
    try:
        result = scheme_navigator.find_schemes(
            state=request.state,
            land_size=request.land_size,
            lang=request.lang,
            crop_context=request.crop_context
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=500, detail=f"AI returned invalid response: {ve}")
    except Exception as e:
        if _is_rate_limit_error(e):
            raise HTTPException(status_code=429, detail="All Gemini models are temporarily busy. Please wait 30 seconds and try again.")
        raise HTTPException(status_code=500, detail=f"AI processing failed: {str(e)}")

@app.post("/weather")
async def weather_endpoint(request: WeatherRequest):
    """Weather Scout Agent — live weather intelligence for farmers."""
    try:
        result = weather_scout.get_weather(
            city=request.city,
            state=request.state,
            lang=request.lang,
            crop_type=request.crop_type
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=500, detail=f"Weather processing error: {ve}")
    except Exception as e:
        if _is_rate_limit_error(e):
            raise HTTPException(status_code=429, detail="All Gemini models are temporarily busy. Please wait 30 seconds and try again.")
        raise HTTPException(status_code=500, detail=f"Weather processing failed: {str(e)}")

# ============================================================
# PERSISTENCE ENDPOINTS
# ============================================================

@app.get("/history/{user_id}")
async def get_user_history(user_id: str):
    data = local_db.select_by("history", "user_id", user_id)
    # Sort descending by timestamp
    data.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return data

@app.get("/calendar/{user_id}")
async def get_user_calendar(user_id: str):
    res = local_db.select_by("calendars", "user_id", user_id)
    return res[0] if res else None

@app.post("/calendar")
async def save_user_calendar(request: dict):
    user_id = request.get("user_id")
    if not user_id: raise HTTPException(status_code=400, detail="user_id required")
    
    # Upsert the calendar
    new_record = {
        "user_id": user_id,
        "state": request.get("state"),
        "crop": request.get("crop"),
        "calendar_json": request.get("calendar"),
        "last_updated": datetime.utcnow().isoformat() + "Z"
    }
    res = local_db.upsert_by("calendars", "user_id", user_id, new_record)
    return res

@app.get("/")
def read_root():
    return {"message": "NEER AI Backend is running."}

@app.post("/upload")
async def upload_image(image: UploadFile = File(...)):
    allowed_types = ["image/jpeg", "image/png", "image/jpg", "image/webp"]
    if image.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file format.")
    
    file_ext = image.filename.split('.')[-1] if '.' in image.filename else 'jpg'
    unique_filename = f"{uuid.uuid4().hex}.{file_ext}"
    os.makedirs("uploads", exist_ok=True)
    file_path = os.path.join("uploads", unique_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)
        
    return {"url": f"http://localhost:8000/uploads/{unique_filename}"}

@app.get("/community/posts")
async def get_community_posts(type: Optional[str] = None):
    posts = local_db.select_all("posts")
    comments = local_db.select_all("comments")
    
    # Filter by type if provided
    if type:
        posts = [p for p in posts if p.get("type") == type]
        
    # Sort by descending timestamp
    posts.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    
    # Join comments manually
    for p in posts:
        p["comments"] = [c for c in comments if c.get("post_id") == p["id"]]
        
    return posts

@app.post("/community/posts")
async def create_community_post(request: CommunityPostRequest):
    new_post = request.dict()
    new_post["id"] = str(uuid.uuid4())
    new_post["likes"] = 0
    new_post["liked_by"] = []
    new_post["timestamp"] = datetime.utcnow().isoformat() + "Z"
    
    clean_post = {k: v for k, v in new_post.items() if v is not None}
    
    inserted = local_db.insert("posts", clean_post)
    inserted["comments"] = [] 
    return inserted

@app.post("/community/like")
async def like_community_post(request: CommunityLikeRequest):
    p = local_db.get_by_id("posts", request.post_id)
    if not p:
        raise HTTPException(status_code=404, detail="Post not found")
        
    liked_by = p.get("liked_by") or []
    likes = p.get("likes", 0)

    if request.user_id in liked_by:
        liked_by.remove(request.user_id)
        likes = max(0, likes - 1)
    else:
        liked_by.append(request.user_id)
        likes += 1
        
    local_db.update_by_id("posts", request.post_id, {"likes": likes, "liked_by": liked_by})
    return {"success": True, "likes": likes, "liked_by": liked_by}

@app.post("/community/comment")
async def comment_community_post(request: CommunityCommentRequest):
    
    new_comment = {
        "id": str(uuid.uuid4()),
        "post_id": request.post_id,
        "author": request.author,
        "content": request.content,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
    
    res = local_db.insert("comments", new_comment)
    return res

@app.post("/community/bid")
async def bid_community_post(request: CommunityBidRequest):
    posts = read_community_db()
    for p in posts:
        if p["id"] == request.post_id:
            if p.get("type") != "mandi":
                raise HTTPException(status_code=400, detail="Can only bid on Mandi listings")
            
            new_bid = {
                "id": f"bid-{uuid.uuid4().hex[:8]}",
                "author": request.author,
                "amount": request.amount,
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
            if "bids" not in p:
                p["bids"] = []
            
            p["bids"].append(new_bid)
            write_community_db(posts)
            return new_bid
            
    raise HTTPException(status_code=404, detail="Mandi post not found")

CROP_CALENDAR_CACHE_PATH = "crop_calendar_cache.json"

def read_calendar_cache():
    if os.path.exists(CROP_CALENDAR_CACHE_PATH):
        with open(CROP_CALENDAR_CACHE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def write_calendar_cache(data):
    with open(CROP_CALENDAR_CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)


@app.post("/crop-calendar")
async def generate_crop_calendar(request: CropCalendarRequest):
    cache_key = f"{request.state.lower()}_{request.crop.lower()}"
    cache = read_calendar_cache()
    
    # Return cached result if available
    if cache_key in cache:
        return cache[cache_key]
    
    lang_note = "Respond in Hindi." if request.lang == "Hindi" else "Respond in English."
    prompt = f"""Create a 12-month farming calendar for growing {request.crop} in {request.state}, India.
{lang_note}
Return ONLY a valid JSON array with exactly 12 objects, one per month from January to December.
Each object must have:
- "month": month name (e.g. "January")
- "tasks": array of task objects, each with:
  - "type": one of exactly: "sowing", "irrigation", "fertilizer", "pesticide", "harvesting", "preparation", "other"
  - "description": short actionable task description (max 70 characters)

Return ONLY the JSON array. No markdown, no code fences, no extra text."""
    
    try:
        raw = gemini_generate_text(prompt)
        # Strip markdown code fences if Gemini added them
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            raw = raw.rsplit("```", 1)[0].strip()
        
        calendar_data = json.loads(raw)
        
        result = {
            "state": request.state,
            "crop": request.crop,
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "calendar": calendar_data
        }
        
        # Cache the result
        cache[cache_key] = result
        write_calendar_cache(cache)
        
        return result
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse AI calendar response: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# FARM ADVISOR — live weather + AI time-slot recommendations
# ============================================================
import urllib.request as _ureq
import urllib.parse as _uparse

def _fetch_hourly_weather(lat: float, lon: float, date: str) -> dict:
    """Fetch hourly weather for a specific date from Open-Meteo."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "temperature_2m,relative_humidity_2m,precipitation_probability,wind_speed_10m",
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
        "timezone": "Asia/Kolkata",
        "start_date": date,
        "end_date": date,
    }
    url = f"https://api.open-meteo.com/v1/forecast?{_uparse.urlencode(params)}"
    req = _ureq.Request(url, headers={"User-Agent": "NEER-FarmerAI/1.0"})
    with _ureq.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode())
    
    hourly = data.get("hourly", {})
    times = hourly.get("time", [])
    temps = hourly.get("temperature_2m", [])
    humidity = hourly.get("relative_humidity_2m", [])
    rain_prob = hourly.get("precipitation_probability", [])
    wind = hourly.get("wind_speed_10m", [])
    
    daily = data.get("daily", {})
    
    hours = []
    for i, t in enumerate(times):
        hour_str = t.split("T")[1] if "T" in t else t[-5:]
        hours.append({
            "hour": hour_str,
            "temp": temps[i] if i < len(temps) else None,
            "humidity": humidity[i] if i < len(humidity) else None,
            "rain_prob": rain_prob[i] if i < len(rain_prob) else None,
            "wind": wind[i] if i < len(wind) else None,
        })
    
    return {
        "hours": hours,
        "temp_max": daily.get("temperature_2m_max", [None])[0],
        "temp_min": daily.get("temperature_2m_min", [None])[0],
        "rain_total": daily.get("precipitation_sum", [0])[0],
        "rain_prob_max": daily.get("precipitation_probability_max", [0])[0],
    }


@app.post("/farm-advisor")
async def farm_advisor(request: FarmAdvisorRequest):
    from weather_scout import _get_coordinates, STATE_CITY
    
    coords = _get_coordinates("", request.state)
    
    try:
        weather = _fetch_hourly_weather(coords["lat"], coords["lon"], request.date)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Weather fetch failed: {str(e)}")
    
    # Build a concise hour table for the prompt (every 3 hours)
    hour_table = "\n".join(
        f"  {h['hour']}: {h['temp']}°C, Humidity {h['humidity']}%, Rain {h['rain_prob']}%, Wind {h['wind']} km/h"
        for h in weather["hours"] if h["temp"] is not None and int(h["hour"][:2]) % 3 == 0
    )
    
    lang_note = "Respond in Hindi." if request.lang == "Hindi" else "Respond in English."
    
    prompt = f"""You are NEER's Smart Farm Advisor. A farmer is growing {request.crop} in {request.state}, India.
Today's date: {request.date}
Task to advise on: {request.task_type.upper()}

TODAY'S HOURLY WEATHER FORECAST:
{hour_table}

Daily Summary:
- Max temp: {weather['temp_max']}°C, Min: {weather['temp_min']}°C
- Total rainfall expected: {weather['rain_total']} mm
- Max rain probability: {weather['rain_prob_max']}%

{lang_note}

Based on the EXACT hourly weather, give a precise schedule for today's {request.task_type} task.
Return ONLY valid JSON (no markdown, no code fences):
{{
  "times_today": <integer — how many sessions today>,
  "skip_today": <boolean — true if weather makes this task inadvisable today>,
  "skip_reason": <string or null>,
  "weather_summary": <one short sentence summarizing today's weather relevance>,
  "schedule": [
    {{
      "time": "HH:MM AM/PM",
      "duration_minutes": <integer>,
      "action": <specific action description>,
      "reason": <why this time — reference actual temp/humidity from forecast>
    }}
  ],
  "pro_tip": <one extra tip for today specifically>
}}"""
    
    try:
        raw = gemini_generate_text(prompt).strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            raw = raw.rsplit("```", 1)[0].strip()
        advice = json.loads(raw)
        advice["weather_raw"] = {
            "temp_max": weather["temp_max"],
            "temp_min": weather["temp_min"],
            "rain_total": weather["rain_total"],
            "rain_prob_max": weather["rain_prob_max"],
        }
        return advice
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"AI response parse failed: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
