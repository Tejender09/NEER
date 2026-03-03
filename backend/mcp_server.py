import asyncio
import os
import json
from mcp.server.fastmcp import FastMCP
from weather_scout import WeatherScout
from scheme_navigator import SchemeNavigator
from crop_doctor import CropDoctor
from dotenv import load_dotenv
from google import genai

load_dotenv()

# Initialize MCP Server
mcp = FastMCP("NEER-Agricultural-Assistant")

# Shared Gemini Logic (simplified for MCP tools)
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
client = genai.Client(api_key=GOOGLE_API_KEY)

def gemini_text(prompt: str) -> str:
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt
    )
    return response.text.strip()

def gemini_vision(prompt: str, image_bytes: bytes, mime_type: str) -> str:
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=[prompt, {"mime_type": mime_type, "data": image_bytes}]
    )
    return response.text.strip()

# Initialize Agents
weather_agent = WeatherScout(text_fn=gemini_text)
scheme_agent = SchemeNavigator(text_fn=gemini_text)
crop_agent = CropDoctor(vision_fn=gemini_vision, text_fn=gemini_text)

@mcp.tool()
async def get_farming_weather(city: str, state: str, lang: str = "English", crop_type: str = None) -> str:
    """
    Get live weather, farming alerts, and AI advisory for an Indian city.
    
    Args:
        city: City or District name.
        state: Indian State name.
        lang: 'English' or 'Hindi'.
        crop_type: Optional crop name for specific advice.
    """
    res = weather_agent.get_weather(city, state, lang, crop_type)
    return json.dumps(res, indent=2, ensure_ascii=False)

@mcp.tool()
async def find_govt_schemes(state: str, land_size: float, lang: str = "English", crop_context: str = None) -> str:
    """
    Find relevant Indian government agricultural schemes.
    
    Args:
        state: Indian State name.
        land_size: Land size in acres.
        lang: 'English' or 'Hindi'.
        crop_context: Optional text about current crops or health.
    """
    ctx = {"summary": crop_context} if crop_context else None
    res = scheme_agent.find_schemes(state, land_size, lang, ctx)
    return json.dumps(res, indent=2, ensure_ascii=False)

@mcp.tool()
async def diagnose_crop_health(image_path: str, lang: str = "English", state: str = "Rajasthan") -> str:
    """
    Diagnose crop disease from an image file path.
    
    Args:
        image_path: Absolute path to the crop image.
        lang: 'English' or 'Hindi'.
        state: Farmer's state for regional matching.
    """
    if not os.path.exists(image_path):
        return f"Error: File {image_path} not found."
        
    with open(image_path, "rb") as f:
        img_bytes = f.read()
    
    # Simple mime detection
    ext = image_path.split('.')[-1].lower()
    mime = f"image/{ext}" if ext != 'jpg' else "image/jpeg"
    
    res = crop_agent.diagnose(img_bytes, mime, lang, state)
    return json.dumps(res, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    mcp.run()
