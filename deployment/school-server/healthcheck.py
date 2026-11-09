"""Readiness includes both the web app and its private database REST service."""
import os
import urllib.request

urllib.request.urlopen('http://127.0.0.1:8000/api/config',timeout=8).close()
key=os.environ['SUPABASE_SERVICE_ROLE_KEY']
request=urllib.request.Request(
    os.environ['SUPABASE_URL'].rstrip('/')+'/rest/v1/students?select=student_id&limit=1',
    headers={'apikey':key,'Authorization':'Bearer '+key})
urllib.request.urlopen(request,timeout=8).close()
