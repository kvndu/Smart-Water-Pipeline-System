from db import supabase

response = supabase.table("pipelines").select("*").limit(5).execute()

print(response.data)