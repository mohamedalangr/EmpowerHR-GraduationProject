import requests

try:
    r = requests.get('http://127.0.0.1:8000/api/feedback/hr/forms/')
    print('status', r.status_code)
    print(r.text[:500])
except Exception as e:
    print('error', type(e), e)
