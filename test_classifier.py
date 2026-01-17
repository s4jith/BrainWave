import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from backend.app.services.subject_classifier import subject_classifier

async def test():
    queries = [
        "explain newtons laws",
        "y = mx + c",
        "what is an atom",
        "explain thermodynamics", # Ambiguous (Physics + Chem)
        "what is integration"
    ]
    
    print(f"{'QUERY':<30} | {'DETECTED':<15} | {'CONFIDENCE':<10}")
    print("-" * 60)
    
    for q in queries:
        result = await subject_classifier.classify(q)
        print(f"{q:<30} | {result.get('detected_subject', 'Unknown'):<15} | {result.get('confidence', 0):<10}")

if __name__ == "__main__":
    asyncio.run(test())
