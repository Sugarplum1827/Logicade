import subprocess
import sys
import os

def run(cmd):
    print(f"\nRunning: {cmd}")
    result = subprocess.run(cmd, shell=True)
    if result.returncode != 0:
        print(f"❌ Command failed: {cmd}")
        sys.exit(1)
    print("✅ Passed")

if __name__ == "__main__":
    print("=== LogiCade Phase 0-8 Verification ===")
    print(f"Python: {sys.version.split()[0]}")
    
    # Phase 1, 2, 3: Deterministic Core & LLM
    run("pytest tests/test_core.py -v")
    run("pytest tests/test_llm.py -v -s -m ollama")
    
    # Phase 8: Analysis
    if os.path.exists("analysis/profile_clusters.py"):
        print("\n--- Running K-Means Clustering ---")
        run("python analysis/profile_clusters.py")
    
    print("\n🎉 LogiCade Verification Complete. Check Supabase Studio for data.")