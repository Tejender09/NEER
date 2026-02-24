import requests

response = requests.post(
    "http://localhost:8000/chat",
    json={"message": "whats there in PM kisan scheme"}
)

print(f"Status Code: {response.status_code}")
print(response.json())
