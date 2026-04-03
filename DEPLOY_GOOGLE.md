## Deploying DemoCase to Google Cloud (recommended long-term)

This guide covers a minimal, production-suitable deployment using Cloud Run (container-hosting) and Cloud SQL (managed Postgres). Adjust resource names and `<PLACEHOLDER>` values for your project.

Prerequisites
- Install and authenticate the Google Cloud SDK (`gcloud`).
- Enable billing and set your project: `gcloud config set project YOUR_PROJECT_ID`.
- Enable required APIs: Cloud Run, Cloud SQL Admin, Artifact Registry, IAM.

1. Create Cloud SQL (Postgres)

```bash
gcloud sql instances create democase-sql --database-version=POSTGRES_14 --tier=db-f1-micro --region=us-central1
gcloud sql users set-password postgres --instance=democase-sql --password="YourStrongPassword"
gcloud sql databases create case_db --instance=democase-sql
```

2. Build and push Docker images

```bash
# Build backend image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/democase-backend:latest backend

# Build frontend image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/democase-frontend:latest caseR
```

3. Deploy backend to Cloud Run (connect to Cloud SQL)

```bash
gcloud run deploy democase-backend \
  --image gcr.io/YOUR_PROJECT_ID/democase-backend:latest \
  --platform managed --region us-central1 \
  --add-cloudsql-instances YOUR_PROJECT_ID:us-central1:democase-sql \
  --set-env-vars DATABASE_URL="postgres://postgres:YourStrongPassword@/case_db?host=/cloudsql/YOUR_PROJECT_ID:us-central1:democase-sql" \
  --allow-unauthenticated
```

Notes:
- When using Cloud SQL with Cloud Run, use the Cloud SQL Unix socket path (`/cloudsql/...`) in the `DATABASE_URL` or use the Cloud SQL Auth Proxy.
- Create a service account with `roles/cloudsql.client` and attach it to the Cloud Run service if needed.

4. Run migrations & seed (one-off)

You can either run migrations inside a short-lived Cloud Run job or run them locally pointing to the Cloud SQL instance.

```bash
# Example: run migration locally using CLOUD SQL AUTH proxy (or use a CI job)
gcloud sql connect democase-sql --user=postgres --quiet
# or run a temporary container that runs the migrate script
docker run --rm \
  -e DATABASE_URL="postgres://postgres:YourStrongPassword@/case_db?host=/cloudsql/YOUR_PROJECT_ID:us-central1:democase-sql" \
  gcr.io/YOUR_PROJECT_ID/democase-backend:latest \
  node src/config/migrate.js
```

5. Deploy frontend (static)

Option A: Host static site on Cloud Storage + CDN

```bash
npm --prefix caseR run build
gsutil mb -l US gs://YOUR_PROJECT_ID-democase-static
gsutil -m rsync -r caseR/dist gs://YOUR_PROJECT_ID-democase-static
gsutil web set -m index.html -e index.html gs://YOUR_PROJECT_ID-democase-static
```

Option B: Use Cloud Run (already built) behind a HTTPS URL or Firebase Hosting.

6. Domain & HTTPS
- Configure custom domain in Cloud Run or Cloud Storage and provision HTTPS via Google-managed certificates.

If you want, I can generate a CI/CD script (GitHub Actions) to build/push and deploy automatically.
