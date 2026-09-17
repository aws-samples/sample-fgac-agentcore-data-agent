#!/bin/bash
# Pulls config from SSM Parameter Store and generates:
#   1. .env.local (NEXT_PUBLIC_* vars for AgentCore)
#   2. amplify_outputs.json (Amplify auth config)
#
# Usage: ./scripts/load-config.sh [--region ap-southeast-1]

set -euo pipefail

PREFIX="/fgac-data-agent"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Parse parameters (works on macOS and Linux)
while [[ $# -gt 0 ]]; do
  case "$1" in
    -p|--profile)  PROFILE="${2:-}"; shift 2 ;;
    -r|--region)   REGION="${2:-}"; shift 2 ;;
    -v|--verbose)  VERBOSE=true; shift ;;
    *) shift ;;
  esac
done

# initialize parameters for CLI
[[ -n "${PROFILE:-}" ]] && PROFILE_PARAM=" --profile $PROFILE" 
[[ -z "${REGION:-}" ]] && REGION="us-east-1"

echo "Loading config from SSM Parameter Store (region: $REGION, profile: ${PROFILE:-})..."

# Fetch all parameters under the prefix
USER_POOL_ID=$(aws ssm get-parameter --name "$PREFIX/cognito/user-pool-id" --region "$REGION" ${PROFILE_PARAM:-} --query "Parameter.Value" --output text)
CLIENT_ID=$(aws ssm get-parameter --name "$PREFIX/cognito/user-pool-client-id" --region "$REGION" ${PROFILE_PARAM:-} --query "Parameter.Value" --output text)
COGNITO_REGION=$(aws ssm get-parameter --name "$PREFIX/cognito/region" --region "$REGION" ${PROFILE_PARAM:-} --query "Parameter.Value" --output text)
AGENT_ARN=$(aws ssm get-parameter --name "$PREFIX/agentcore/agent-arn" --region "$REGION" ${PROFILE_PARAM:-} --query "Parameter.Value" --output text)
AGENTCORE_REGION=$(aws ssm get-parameter --name "$PREFIX/agentcore/region" --region "$REGION" ${PROFILE_PARAM:-} --query "Parameter.Value" --output text)

echo "  user_pool_id:        $USER_POOL_ID"
echo "  user_pool_client_id: $CLIENT_ID"
echo "  cognito_region:      $COGNITO_REGION"
echo "  agent_arn:           $AGENT_ARN"
echo "  agentcore_region:    $AGENTCORE_REGION"

# Generate .env.local
cat > "$PROJECT_DIR/.env.local" <<EOF
NEXT_PUBLIC_AGENTCORE_REGION=$AGENTCORE_REGION
NEXT_PUBLIC_AGENT_ARN=$AGENT_ARN
EOF
echo "✅ Generated .env.local"

# Generate amplify_outputs.json
cat > "$PROJECT_DIR/amplify_outputs.json" <<EOF
{
  "auth": {
    "user_pool_id": "$USER_POOL_ID",
    "aws_region": "$COGNITO_REGION",
    "user_pool_client_id": "$CLIENT_ID",
    "identity_pool_id": "",
    "mfa_methods": [],
    "standard_required_attributes": ["email"],
    "username_attributes": ["username"],
    "user_verification_types": ["email"],
    "groups": [],
    "mfa_configuration": "NONE",
    "password_policy": {
      "min_length": 8,
      "require_lowercase": true,
      "require_numbers": true,
      "require_symbols": true,
      "require_uppercase": true
    },
    "unauthenticated_identities_enabled": false
  },
  "version": "1.3"
}
EOF
echo "✅ Generated amplify_outputs.json"
echo "Done."
