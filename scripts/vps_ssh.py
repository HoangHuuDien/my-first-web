#!/usr/bin/env python3
"""Chạy lệnh trên VPS qua SSH (password từ env VPS_SSH_PASSWORD)."""
import os
import sys

HOST = os.environ.get("VPS_HOST", "103.97.127.140")
PORT = int(os.environ.get("VPS_SSH_PORT", "2018"))
USER = os.environ.get("VPS_SSH_USER", "root")
PASSWORD = os.environ.get("VPS_SSH_PASSWORD", "")


def main():
    if len(sys.argv) < 2:
        print("Usage: vps_ssh.py <remote command>", file=sys.stderr)
        sys.exit(2)
    if not PASSWORD:
        print("Set VPS_SSH_PASSWORD", file=sys.stderr)
        sys.exit(1)
    cmd = sys.argv[1]
    try:
        import paramiko
    except ImportError:
        print("pip install paramiko", file=sys.stderr)
        sys.exit(1)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=60)
    stdin, stdout, stderr = client.exec_command(cmd, get_pty=True)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    client.close()
    if out:
        print(out, end="" if out.endswith("\n") else "\n")
    if err:
        print(err, end="" if err.endswith("\n") else "\n", file=sys.stderr)
    sys.exit(code)


if __name__ == "__main__":
    main()
