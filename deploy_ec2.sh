#!/usr/bin/env bash
set -euo pipefail

# deploy_ec2.sh
# Bootstrap Docker, clone repo (if needed), build and run services with docker compose,
# and run DB migrations. Designed for Ubuntu/Debian/Amazon Linux.
#
# Usage:
# 1) SSH into server:
#    ssh -i /path/to/key.pem ubuntu@13.60.185.226
# 2) Run (if not cloned): 
#    sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/USER/REPO/BRANCH/deploy_ec2.sh)" <git_repo_url>
# OR clone repo and run script from inside repo:
#    git clone <git_repo_url> Case-manager
#    cd Case-manager
#    sudo ./deploy_ec2.sh

GIT_REPO="${1:-}"
BRANCH="${2:-main}"
PROJECT_DIR="${3:-Case-manager}"

function die { echo "$*" >&2; exit 1; }

# If we're inside a project with docker-compose.yml, use it.
if [ -f docker-compose.yml ]; then
  echo "Using existing repo in $(pwd)"
else
  if [ -z "$GIT_REPO" ]; then
    die "No docker-compose.yml found and no <git_repo> argument provided. Usage: $0 <git_repo> [branch] [project_dir]"
  fi
  echo "Cloning $GIT_REPO (branch: $BRANCH) into $PROJECT_DIR..."
  git clone --depth 1 --branch "$BRANCH" "$GIT_REPO" "$PROJECT_DIR"
  cd "$PROJECT_DIR"
fi

# Install Docker & docker compose plugin if missing
if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y docker.io docker-compose-plugin git
  elif command -v yum >/dev/null 2>&1; then
    sudo yum install -y git
    sudo amazon-linux-extras install -y docker
    sudo systemctl enable --now docker
  elif command -v apk >/dev/null 2>&1; then
    sudo apk add --no-cache docker docker-compose git
  else
    die "Unsupported OS; please install Docker & docker-compose manually."
  fi
fi
sudo systemctl enable --now docker || true

# Create a .env file (compose reads project-root .env) if missing
if [ ! -f .env ]; then
  echo "Creating .env with generated secrets..."
  DB_PASS="${DB_PASS:-$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c16)}"
  JWT_SECRET="${JWT_SECRET:-$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c32)}"
  cat > .env <<EOF
DB_PASS=$DB_PASS
JWT_SECRET=$JWT_SECRET
EOF
  echo ".env created (not committed). DB_PASS and JWT_SECRET set."
fi

echo "Cleaning up any previous containers..."
sudo docker compose down --remove-orphans || true

echo "Building and starting services..."
sudo docker compose pull --quiet || true
sudo docker compose up -d --build

echo "Running DB migrations inside backend container..."
set +e
sudo docker compose exec backend npm run db:migrate
MIGRATE_EXIT=$?
set -e
if [ $MIGRATE_EXIT -ne 0 ]; then
  echo "Migration command exited with code $MIGRATE_EXIT — check logs:"
  sudo docker compose logs backend --tail 200
  die "Migration failed."
fi

echo "Deployment complete. Containers:"
sudo docker compose ps

IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')
echo "Visit: http://$IP (or http://<EC2_PUBLIC_IP>)"
echo "If you cannot reach the service from the internet, open port 80/443 in the EC2 security group."
