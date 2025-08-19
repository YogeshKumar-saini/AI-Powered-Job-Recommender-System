from apify_client import ApifyClient
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

APIFY_API_TOKEN = os.getenv("APIFY_API_TOKEN")

if not APIFY_API_TOKEN:
    raise ValueError("⚠️ Missing APIFY_API_TOKEN in .env file")

# Initialize Apify client
apify_client = ApifyClient(APIFY_API_TOKEN)


# Fetch LinkedIn jobs based on search query and location
def fetch_linkedin_jobs(search_query: str, location: str = "India", rows: int = 60):
    """
    Fetch LinkedIn jobs using Apify actor.
    """
    run_input = {
        "keyword": search_query,
        "location": location,
        "rows": rows,
        "limit": min(rows, 100),  # Limit to avoid timeouts
        "proxy": {
            "useApifyProxy": True,
            "apifyProxyGroups": ["RESIDENTIAL"],
        },
    }

    run = apify_client.actor("JkfTWxtpgfvcRQn3p").call(run_input=run_input)
    jobs = list(apify_client.dataset(run["defaultDatasetId"]).iterate_items())
    return jobs


