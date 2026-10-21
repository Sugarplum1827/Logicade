"""§15 ML Component — K-Means Learner Profiling (post-hoc)."""
import os
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler
from dotenv import load_dotenv
import psycopg

load_dotenv()

def main():
    db_url = os.getenv("SUPABASE_DB_URL", "postgresql://postgres:postgres@127.0.0.1:54322/postgres")
    
    print("Fetching student summary data from Supabase...")
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM public.student_summary")
            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()
            
    if len(rows) < 2:
        print("Not enough data for clustering (need at least 2 students).")
        return

    df = pd.DataFrame(rows, columns=columns)
    
    # Feature selection based on §15
    features = [
        'mean_first_attempt_score',
        'levels_played', 
        'total_errors',
        'total_time_sec',
        'total_hints',
        'overall_repeat_rate'
    ]
    
    X = df[features].fillna(0)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    print(f"Finding optimal k via Silhouette Score (n={len(df)})...")
    best_k = 2
    best_score = -1
    
    # Silhouette requires at least 2 clusters and n_samples > n_clusters
    max_k = min(5, len(df) - 1)
    if max_k < 2:
        print("Need at least 3 students for silhouette scoring. Assigning k=2 arbitrarily.")
        best_k = 2
    else:
        for k in range(2, max_k + 1):
            kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
            labels = kmeans.fit_predict(X_scaled)
            score = silhouette_score(X_scaled, labels)
            print(f"  k={k}, silhouette={score:.3f}")
            if score > best_score:
                best_score = score
                best_k = k
        print(f"\nBest k: {best_k} (Silhouette: {best_score:.3f})")
    
    kmeans = KMeans(n_clusters=best_k, random_state=42, n_init=10)
    df['cluster'] = kmeans.fit_predict(X_scaled)
    
    print("\nCluster Centers (Scaled Features):")
    print(pd.DataFrame(scaler.inverse_transform(kmeans.cluster_centers_), columns=features).round(2))
    
    print("\nStudent Assignments:")
    print(df[['student_id', 'cluster', 'mean_first_attempt_score', 'total_errors', 'overall_repeat_rate']])

if __name__ == "__main__":
    main()