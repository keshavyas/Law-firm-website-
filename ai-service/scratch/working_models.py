from google import genai
import os
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv('GOOGLE_API_KEY'), http_options={'api_version': 'v1'})
models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro', 'gemini-2.0-flash']

for m in models:
    try:
        client.models.generate_content(model=m, contents='hi')
        print(f"{m}: SUCCESS")
    except Exception as e:
        print(f"{m}: FAIL - {e}")
