from google import genai
import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv('GOOGLE_API_KEY')
print(f"Testing with API Key: {api_key[:5]}...{api_key[-5:]}")

# Test v1
client = genai.Client(api_key=api_key, http_options={'api_version': 'v1'})

print("\n--- Listing Models (v1) ---")
try:
    models = client.models.list()
    for m in models:
        print(f"Name: {m.name}")
except Exception as e:
    print(f"Error listing models: {e}")

test_models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro', 'gemini-2.0-flash']

print("\n--- Testing Model Calls (v1) ---")
for model_id in test_models:
    print(f"Testing: {model_id}")
    try:
        # Try both the name and the models/ prefixed name
        response = client.models.generate_content(model=model_id, contents="ping")
        print(f"  Success (direct): {response.text[:20]}...")
    except Exception as e:
        print(f"  Fail (direct): {e}")
        
    full_name = f"models/{model_id}"
    try:
        response = client.models.generate_content(model=full_name, contents="ping")
        print(f"  Success (prefixed): {response.text[:20]}...")
    except Exception as e:
        print(f"  Fail (prefixed): {e}")
