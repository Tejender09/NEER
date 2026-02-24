import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

URL = os.getenv("SUPABASE_URL")
KEY = os.getenv("SUPABASE_KEY")

print(f"URL: {URL}")
print(f"KEY: {KEY[:10]}...")

try:
    supabase = create_client(URL, KEY)
    print("Client created successfully.")
    
    tables = ["users", "posts", "comments", "bids", "history", "calendars"]
    for table in tables:
        try:
            res = supabase.table(table).select("*").limit(1).execute()
            print(f"Table '{table}': OK (found {len(res.data)} rows)")
        except Exception as e:
            print(f"Table '{table}': ERROR - {e}")
            
except Exception as e:
    print(f"CRITICAL ERROR: {e}")
