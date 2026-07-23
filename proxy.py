#!/usr/bin/env python3
"""
PhantomSDR-Plus Reverse Proxy
==============================
Reads all configuration from admin_config.json (written by setup_admin.sh):

  proxy_port   → port this proxy listens on          (e.g. 8902)
  port         → admin panel internal port           (e.g. 3000)
  public_port  → spectrumserver port                 (e.g. 8900)
  sdr_host     → IP used to reach spectrumserver     (LAN IP, auto-detected)

Routes:
  /admin*  → Admin panel     (localhost:{port})
  /*       → Spectrumserver  ({sdr_host}:{public_port})

Why sdr_host must be the LAN IP and not 127.0.0.1
---------------------------------------------------
spectrumserver silently drops WebSocket data for connections that arrive from
127.0.0.1.  External and LAN clients work fine because their source IP is
non-loopback.  Since the proxy always originates its upstream connection from
the local machine, it must use the LAN IP so spectrumserver treats it as a
normal client.  setup_admin.sh detects and writes this automatically.

Run:  python3 proxy.py            (foreground)
      bash manage_admin.sh start  (background with logging)
"""

import asyncio
import sys
import json
import socket
from pathlib import Path

try:
    import aiohttp
    from aiohttp import web, ClientSession, ClientTimeout, WSMsgType
except ImportError:
    print("[ERROR] aiohttp is not installed. Run:", file=sys.stderr)
    print("        pip3 install aiohttp --break-system-packages", file=sys.stderr)
    sys.exit(1)

# ── Load configuration ─────────────────────────────────────────────────────────
_cfg_path = Path(__file__).parent / "admin_config.json"
try:
    with open(_cfg_path) as _f:
        _cfg = json.load(_f)
except FileNotFoundError:
    print(f"[ERROR] admin_config.json not found at {_cfg_path}", file=sys.stderr)
    print("        Run setup_admin.sh first.", file=sys.stderr)
    sys.exit(1)
except json.JSONDecodeError as _e:
    print(f"[ERROR] admin_config.json is invalid JSON: {_e}", file=sys.stderr)
    sys.exit(1)

for _key in ("port", "public_port", "proxy_port"):
    if _key not in _cfg:
        print(f"[ERROR] Missing '{_key}' in admin_config.json.", file=sys.stderr)
        print("        Re-run setup_admin.sh to reconfigure.", file=sys.stderr)
        sys.exit(1)


def _detect_lan_ip() -> str:
    """Return the machine's primary LAN IP by probing a UDP route (no packet sent)."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"


# sdr_host: prefer explicit config value, fall back to auto-detection.
# Must NOT be 127.0.0.1 — see module docstring.
_sdr_host = _cfg.get("sdr_host") or _detect_lan_ip()
_sdr_port = int(_cfg["public_port"])

LISTEN_HOST    = "0.0.0.0"
LISTEN_PORT    = int(_cfg["proxy_port"])
ADMIN_UPSTREAM = f"http://127.0.0.1:{int(_cfg['port'])}"
SDR_UPSTREAM   = f"http://{_sdr_host}:{_sdr_port}"

# ─────────────────────────────────────────────────────────────────────────────

async def proxy_request(request: web.Request, upstream: str) -> web.StreamResponse:
    url = upstream + str(request.rel_url)
    headers = {k: v for k, v in request.headers.items()
               if k.lower() not in ("host", "content-length", "accept-encoding")}
    headers["Accept-Encoding"]   = "identity"
    headers["X-Forwarded-For"]   = request.remote or ""
    headers["X-Forwarded-Host"]  = request.headers.get("Host", "")
    headers["X-Forwarded-Proto"] = "http"
    headers["X-Forwarded-Port"]  = str(LISTEN_PORT)
    try:
        timeout = ClientTimeout(total=60)
        async with ClientSession(timeout=timeout) as session:
            body = await request.read()
            async with session.request(
                method=request.method,
                url=url,
                headers=headers,
                data=body,
                allow_redirects=False,
                ssl=False,
            ) as resp:
                response = web.StreamResponse(
                    status=resp.status,
                    headers={k: v for k, v in resp.headers.items()
                             if k.lower() not in ("transfer-encoding", "connection")},
                )
                await response.prepare(request)
                async for chunk in resp.content.iter_chunked(65536):
                    await response.write(chunk)
                await response.write_eof()
                return response
    except aiohttp.ClientConnectorError:
        target = "Admin panel" if upstream == ADMIN_UPSTREAM else "Spectrumserver"
        return web.Response(
            status=502,
            text=f"502 Bad Gateway — {target} is not running on {upstream}",
        )
    except Exception as e:
        return web.Response(status=500, text=f"Proxy error: {e}")


async def proxy_websocket(request: web.Request, upstream: str) -> web.WebSocketResponse:
    """Bidirectional WebSocket tunnel.

    Key fixes vs the original:
      • Upstream uses LAN IP (sdr_host), not 127.0.0.1 — spectrumserver
        silently drops waterfall data for loopback connections.
      • max_msg_size=0 on both sides — removes the 4 MB default cap that
        silently kills large FFT frames from the RX-888 at 60 MSPS.
      • heartbeat=30 — keeps long-lived connections alive through NAT.
      • Sec-WebSocket-Protocol forwarded — correct subprotocol negotiation.
      • X-Forwarded-* on WS upgrade — real client IP visible in server logs.
      • Close codes propagated — browser gets a meaningful disconnect reason.
    """
    raw_protocols = request.headers.get("Sec-WebSocket-Protocol", "")
    protocol_list = [p.strip() for p in raw_protocols.split(",") if p.strip()]

    ws_client = web.WebSocketResponse(
        max_msg_size=0,
        protocols=protocol_list,
        autoping=True,
        heartbeat=30.0,
    )
    await ws_client.prepare(request)

    ws_url = upstream.replace("http://", "ws://") + str(request.rel_url)

    _skip = frozenset(("host", "upgrade", "connection",
                        "sec-websocket-key", "sec-websocket-version",
                        "sec-websocket-protocol", "sec-websocket-extensions"))
    fwd_headers = {k: v for k, v in request.headers.items()
                   if k.lower() not in _skip}
    fwd_headers["X-Forwarded-For"]   = request.remote or ""
    fwd_headers["X-Forwarded-Host"]  = request.headers.get("Host", "")
    fwd_headers["X-Forwarded-Proto"] = "ws"
    fwd_headers["X-Forwarded-Port"]  = str(LISTEN_PORT)

    try:
        async with ClientSession() as session:
            try:
                async with session.ws_connect(
                    ws_url,
                    headers=fwd_headers,
                    protocols=protocol_list,
                    max_msg_size=0,
                    heartbeat=30.0,
                    autoclose=True,
                    autoping=True,
                ) as ws_upstream:

                    async def forward_up():
                        """Browser → Spectrumserver"""
                        async for msg in ws_client:
                            if msg.type == WSMsgType.TEXT:
                                await ws_upstream.send_str(msg.data)
                            elif msg.type == WSMsgType.BINARY:
                                await ws_upstream.send_bytes(msg.data)
                            elif msg.type == WSMsgType.CLOSE:
                                await ws_upstream.close()
                                break
                            elif msg.type == WSMsgType.ERROR:
                                break

                    async def forward_down():
                        """Spectrumserver → Browser"""
                        async for msg in ws_upstream:
                            if msg.type == WSMsgType.TEXT:
                                await ws_client.send_str(msg.data)
                            elif msg.type == WSMsgType.BINARY:
                                await ws_client.send_bytes(msg.data)
                            elif msg.type == WSMsgType.CLOSE:
                                await ws_client.close(
                                    code=ws_upstream.close_code or 1000,
                                    message=b"upstream closed",
                                )
                                break
                            elif msg.type == WSMsgType.ERROR:
                                break

                    task_up   = asyncio.ensure_future(forward_up())
                    task_down = asyncio.ensure_future(forward_down())
                    done, pending = await asyncio.wait(
                        {task_up, task_down},
                        return_when=asyncio.FIRST_COMPLETED,
                    )
                    for task in pending:
                        task.cancel()
                        try:
                            await task
                        except asyncio.CancelledError:
                            pass

            except aiohttp.ClientConnectorError:
                if not ws_client.closed:
                    await ws_client.close(code=1014, message=b"upstream unreachable")
            except aiohttp.WSServerHandshakeError:
                if not ws_client.closed:
                    await ws_client.close(code=1014, message=b"upstream handshake failed")
            except Exception:
                if not ws_client.closed:
                    await ws_client.close(code=1011, message=b"proxy error")

    except Exception:
        pass

    if not ws_client.closed:
        await ws_client.close()
    return ws_client


async def handle(request: web.Request) -> web.StreamResponse:
    upstream = ADMIN_UPSTREAM if request.path.startswith("/admin") else SDR_UPSTREAM
    if request.headers.get("Upgrade", "").lower() == "websocket":
        return await proxy_websocket(request, upstream)
    return await proxy_request(request, upstream)


async def main():
    app = web.Application()
    app.router.add_route("*", "/{path_info:.*}", handle)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, LISTEN_HOST, LISTEN_PORT)
    await site.start()

    print(f"╔══════════════════════════════════════════════════════╗")
    print(f"║  PhantomSDR-Plus Reverse Proxy                       ║")
    print(f"║  Listening : http://0.0.0.0:{LISTEN_PORT:<5}                ║")
    print(f"║  /admin*   → Admin panel  (localhost:{int(_cfg['port']):<5})        ║")
    print(f"║  /*        → SDR server   ({_sdr_host}:{_sdr_port:<5})  ║")
    print(f"╚══════════════════════════════════════════════════════╝")

    await asyncio.Event().wait()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[stopped]")
