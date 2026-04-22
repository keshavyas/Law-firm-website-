from google import genai
import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv('GOOGLE_API_KEY')
print(f"Testing with API Key: {api_key[:5]}... (length: {len(api_key)})")

def test_config(api_version):
    print(f"\n=== Testing API Version: {api_version} ===")
    try:
        client = genai.Client(api_key=api_key, http_options={'api_version': api_version})
        models = client.models.list()
        
        working_models = []
        for m in models:
            # Only test models that look like Gemini
            if "gemini" in m.name.lower():
                print(f"Testing {m.name}...", end=" ")
                try:
                    # Use a very short timeout and minimal prompt
                    response = client.models.generate_content(model=m.name, contents="say hi")
                    if response and response.text:
                        print("SUCCESS")
                        working_models.append(m.name)
                    else:
                        print("EMPTY RESPONSE")
                except Exception as e:
                    err_str = str(e)
                    if "429" in err_str:
                        print("FAIL (429 Quota)")
                    elif "404" in err_str:
                        print("FAIL (404 Not Found)")
                    else:
                        print(f"FAIL ({err_str[:50]})")
        return working_models
    except Exception as e:
        print(f"Fatal error with {api_version}: {e}")
        return []

v1_working = test_config('v1')
v1beta_working = test_config('v1beta')

print("\n\nSUMMARY")
print(f"V1 working: {v1_working}")
print(f"V1beta working: {v1beta_working}")
