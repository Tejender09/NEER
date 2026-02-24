import os
import asyncio
from dotenv import load_dotenv
from main import gemini_generate_text

async def test_text():
    load_dotenv()
    try:
        print("Calling Google Gemini (Text)...")
        res = gemini_generate_text("Hi, are you working?")
        print(f"Response: {res}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_text())
