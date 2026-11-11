#!/usr/bin/env bash
set -euo pipefail
# Only new application UIDs use this table. Never flush the host/VPN tables.
# SERVER_IP and GATEWAY_IP are placeholders: set them for your server.
case "${1:-}" in
  start)
    if ip -4 route show table 18080 2>/dev/null | grep -q .; then
      echo "Refusing to overwrite existing route table 18080" >&2
      exit 1
    fi
    if ip -4 rule show | grep -Eq '^(15|16):'; then
      echo "Policy priorities 15/16 must be unused" >&2
      exit 1
    fi
    ip -4 route add table 18080 default via GATEWAY_IP dev eth0 onlink src SERVER_IP
    ip -4 rule add priority 15 uidrange "$(id -u shisha)-$(id -u shisha)" lookup 18080
    ip -4 rule add priority 16 uidrange "$(id -u shisha-caddy)-$(id -u shisha-caddy)" lookup 18080
    ;;
  stop)
    ip -4 rule del priority 15 uidrange "$(id -u shisha)-$(id -u shisha)" lookup 18080 || true
    ip -4 rule del priority 16 uidrange "$(id -u shisha-caddy)-$(id -u shisha-caddy)" lookup 18080 || true
    ip -4 route del table 18080 default via GATEWAY_IP dev eth0 || true
    ;;
  *) echo "Usage: shisha-egress.sh start|stop" >&2; exit 2 ;;
esac
