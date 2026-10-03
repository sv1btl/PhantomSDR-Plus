#!/usr/bin/env python3
"""
PhantomSDR-Plus Reverse Proxy
==============================
Reads all configuration from admin_config.json (written by setup_admin.sh):

  proxy_port   → port this proxy listens on          (e.g. 8902)
  port         → admin panel internal port           (e.g. 3000)
  public_port  → spectrumserver port                 (e.g. 8900)
  sdr_host     → host used to reach spectrumserver   (127.0.0.1)

Routes:
  /admin*  → Admin panel     (localhost:{port})
  /*       → Spectrumserver  ({sdr_host}:{public_port})

Several receivers on one port: see receivers.toml.example. With a
receivers.toml next to this file, /* goes to one of the receivers listed there
(chosen by ?rx=, the rx cookie, the Host header, else the default), and the
proxy can also listen on the public port the listeners already use.

Note on sdr_host
----------------
Older versions had to set this to the machine's LAN IP because spectrumserver
closed WebSockets arriving from 127.0.0.1.  That filter is gone, so the upstream
is plain loopback: no DHCP lease change or downed interface can break the proxy,
and setup no longer has to guess which of docker0 / vmnet* / a VPN is the "real"
interface.  Override sdr_host in admin_config.json only if spectrumserver runs
on a different machine.

Run:  python3 proxy.py            (foreground)
      bash manage_admin.sh start  (background with logging)
"""

import asyncio
import logging
import re
import sys
import json
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


# sdr_host: loopback by default — spectrumserver serves local connections now
# (see src/websocket.cpp on_open). An explicit sdr_host in admin_config.json is
# still honoured for the unusual case of spectrumserver running on another host.
_sdr_host = _cfg.get("sdr_host") or "127.0.0.1"
_sdr_port = int(_cfg["public_port"])

LISTEN_HOST    = "0.0.0.0"
LISTEN_PORT    = int(_cfg["proxy_port"])
ADMIN_UPSTREAM = f"http://127.0.0.1:{int(_cfg['port'])}"
SDR_UPSTREAM   = f"http://{_sdr_host}:{_sdr_port}"

# ── Several receivers behind one port (receivers.toml) ─────────────────────────
# Optional. Without the file there is one SDR upstream, exactly as before. With
# it, every non-admin request goes to one of the receivers listed there, chosen
# in this order:
#   1. ?rx=<id> in the URL — the page, and every socket and poll it opens
#      (frontend/src/lib/rx.js adds it)
#   2. the rx cookie, set on any response to a request with a valid ?rx=
#   3. the receiver whose `hostnames` list holds the Host header's name
#   4. the default receiver
# A Kiwi client carries none of these, so it always lands on the default.
# [front] port is a second listening port next to proxy_port: the public port
# the listeners, the directories and websdr.org already know.
RX_COOKIE   = "rx"
RECEIVERS: "dict[str, dict]" = {}
DEFAULT_RX  = ""
FRONT_PORT  = 0
_rx_path = Path(__file__).parent / "receivers.toml"
if _rx_path.exists():
    try:
        import tomllib
        with open(_rx_path, "rb") as _f:
            _rxcfg = tomllib.load(_f)
    except Exception as _e:
        print(f"[ERROR] {_rx_path.name}: {_e}", file=sys.stderr)
        sys.exit(1)
    for _r in _rxcfg.get("receiver", []):
        _id = str(_r.get("id", "")).strip()
        if not re.fullmatch(r"[A-Za-z0-9_-]+", _id) or "port" not in _r:
            print(f"[ERROR] {_rx_path.name}: every [[receiver]] needs an id "
                  f"(letters, digits, - and _) and a port", file=sys.stderr)
            sys.exit(1)
        RECEIVERS[_id] = {
            "name":      str(_r.get("name", _id)),
            "upstream":  f"http://{_r.get('host', _sdr_host)}:{int(_r['port'])}",
            "host":      str(_r.get("host", _sdr_host)),
            "port":      int(_r["port"]),
            "hostnames": [str(h).lower() for h in _r.get("hostnames", [])],
            # Where the page's receiver picker sends a visitor. Absolute when
            # the receiver has its own public port; else this proxy + ?rx=.
            "url":       str(_r.get("url") or ("/?rx=" + _id)),
        }
        if _r.get("default"):
            if DEFAULT_RX:
                print(f"[ERROR] {_rx_path.name}: more than one default receiver",
                      file=sys.stderr)
                sys.exit(1)
            DEFAULT_RX = _id
    if not RECEIVERS:
        print(f"[ERROR] {_rx_path.name}: no [[receiver]] entries", file=sys.stderr)
        sys.exit(1)
    DEFAULT_RX   = DEFAULT_RX or next(iter(RECEIVERS))
    SDR_UPSTREAM = RECEIVERS[DEFAULT_RX]["upstream"]
    FRONT_PORT   = int(_rxcfg.get("front", {}).get("port", 0) or 0)


def _pick_receiver(request: web.Request) -> "tuple[str, str]":
    """Return (upstream, id to remember in the rx cookie, or "")."""
    if not RECEIVERS:
        return SDR_UPSTREAM, ""
    rid = request.query.get("rx", "")
    if rid in RECEIVERS:
        return RECEIVERS[rid]["upstream"], rid
    rid = request.cookies.get(RX_COOKIE, "")
    if rid in RECEIVERS:
        return RECEIVERS[rid]["upstream"], ""
    host = (request.host or "").lower()
    host = host[:host.rfind(":")] if host.rfind(":") > host.rfind("]") else host
    for rid, r in RECEIVERS.items():
        if host in r["hostnames"]:
            return r["upstream"], ""
    return SDR_UPSTREAM, ""


def _upstream_path(request: web.Request) -> str:
    """The request path and query for the upstream, minus our own rx=: it
    only picks the receiver, and spectrumserver matches some paths (/users)
    exactly, query and all."""
    url = request.rel_url
    if "rx" in url.query:
        rest = [(k, v) for k, v in url.query.items() if k != "rx"]
        url = url.with_query(rest or None)
    return str(url)


# Which receivers answer right now, for /receivers.json: a stopped receiver
# drops out of the page's picker instead of leading to an error page. One TCP
# connect per receiver, half a second at most, and the answer is reused for
# a few seconds so that every open page re-reading the list costs nothing.
_UP_CACHE: "dict[str, bool]" = {}
_UP_CACHE_AT = 0.0
_UP_CACHE_S = 5.0


async def _receiver_up(r: dict) -> bool:
    try:
        _reader, writer = await asyncio.wait_for(
            asyncio.open_connection(r["host"], r["port"]), timeout=0.5)
        writer.close()
        return True
    except Exception:
        return False


async def _receivers_up() -> "dict[str, bool]":
    global _UP_CACHE, _UP_CACHE_AT
    now = asyncio.get_running_loop().time()
    if now - _UP_CACHE_AT > _UP_CACHE_S:
        ids = list(RECEIVERS)
        results = await asyncio.gather(*(_receiver_up(RECEIVERS[i]) for i in ids))
        _UP_CACHE, _UP_CACHE_AT = dict(zip(ids, results)), now
    return _UP_CACHE


def _local_port(request: web.Request) -> int:
    """The port this request arrived on (proxy_port or the front port)."""
    try:
        return int(request.transport.get_extra_info("sockname")[1])
    except Exception:
        return LISTEN_PORT

# ── Active WebSocket registry (powers the admin "kick") ─────────────────────────
# proxy.py owns every client WebSocket, so it can disconnect a user simply by
# closing the matching ws_client — no CAP_NET_ADMIN / 'ss -K' privilege needed.
# admin_server.py calls the localhost-only /__proxy_control/kick endpoint below.
ACTIVE_WS: "dict[str, set]" = {}

# Close code sent to a kicked listener. A plain 1000 is indistinguishable from
# an ordinary dropped connection, and audio.js reconnects after one of those —
# so the kicked browser came straight back with sound while its waterfall, which
# has no reconnect, stayed frozen. 4001 is in the private range and the frontend
# treats it as terminal (KICKED_CLOSE_CODE in frontend/src/refused.js).
KICK_CLOSE_CODE = 4001


def _norm_ip(ip: str) -> str:
    ip = (ip or "").strip()
    if ip.startswith("::ffff:"):
        ip = ip[7:]  # IPv4-mapped IPv6 → plain IPv4, so keys match ss/admin list
    return ip


def _register_ws(ip: str, ws) -> None:
    ACTIVE_WS.setdefault(ip, set()).add(ws)


def _unregister_ws(ip: str, ws) -> None:
    conns = ACTIVE_WS.get(ip)
    if conns is not None:
        conns.discard(ws)
        if not conns:
            ACTIVE_WS.pop(ip, None)


async def handle_kick(request: web.Request) -> web.Response:
    """Localhost-only control endpoint: close all WebSockets from a given IP.

    Called by admin_server.py's /admin/api/kick. Restricted to loopback so it
    can never be reached by an external client through the public proxy port.
    """
    if not _is_local(request):
        return web.json_response({"ok": False, "msg": "forbidden"}, status=403)
    try:
        data = await request.json()
    except Exception:
        data = {}
    ip = _norm_ip(data.get("ip", ""))
    if not ip:
        return web.json_response({"ok": False, "msg": "no ip"}, status=400)

    closed = 0
    for ws in list(ACTIVE_WS.get(ip, ())):
        try:
            if not ws.closed:
                await ws.close(code=KICK_CLOSE_CODE,
                               message=b"disconnected by the sysop")
                closed += 1
        except Exception:
            pass
    return web.json_response({"ok": True, "count": closed})

# ── Client-identity headers ───────────────────────────────────────────────────
# spectrumserver believes X-Forwarded-For / X-Real-IP from a loopback peer, and
# every connection this proxy makes to it IS loopback. Whatever a client sends
# in these headers is therefore dropped (in any letter case) before ours are
# added, or a visitor could claim to be 127.0.0.1 and skip the per-IP limits.
_CLIENT_ID_HEADERS = frozenset(("x-forwarded-for", "x-forwarded-host",
                                "x-forwarded-proto", "x-forwarded-port",
                                "x-real-ip", "forwarded"))


def _is_local(request: web.Request) -> bool:
    return _norm_ip(request.remote) in ("127.0.0.1", "::1")

# ─────────────────────────────────────────────────────────────────────────────

async def proxy_request(request: web.Request, upstream: str,
                        set_rx: str = "") -> web.StreamResponse:
    url = upstream + _upstream_path(request)
    headers = {k: v for k, v in request.headers.items()
               if k.lower() not in ("host", "content-length", "accept-encoding")
               and k.lower() not in _CLIENT_ID_HEADERS}
    headers["Accept-Encoding"]   = "identity"
    headers["X-Forwarded-For"]   = request.remote or ""
    headers["X-Forwarded-Host"]  = request.headers.get("Host", "")
    headers["X-Forwarded-Proto"] = "http"
    headers["X-Forwarded-Port"]  = str(_local_port(request))
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
                if set_rx:
                    response.set_cookie(RX_COOKIE, set_rx, max_age=31536000,
                                        path="/", samesite="Lax")
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

    # Register for the admin kick (see handle_kick). request.remote is the real
    # client IP because the browser connects to this proxy directly.
    client_ip = _norm_ip(request.remote)
    _register_ws(client_ip, ws_client)

    ws_url = upstream.replace("http://", "ws://") + _upstream_path(request)

    _skip = frozenset(("host", "upgrade", "connection",
                        "sec-websocket-key", "sec-websocket-version",
                        "sec-websocket-protocol", "sec-websocket-extensions"))
    fwd_headers = {k: v for k, v in request.headers.items()
                   if k.lower() not in _skip
                   and k.lower() not in _CLIENT_ID_HEADERS}
    fwd_headers["X-Forwarded-For"]   = request.remote or ""
    fwd_headers["X-Forwarded-Host"]  = request.headers.get("Host", "")
    fwd_headers["X-Forwarded-Proto"] = "ws"
    fwd_headers["X-Forwarded-Port"]  = str(_local_port(request))

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
                            elif msg.type == WSMsgType.ERROR:
                                break
                        # The loop ends at the browser's close frame without
                        # yielding it (aiohttp's iterator swallows it), so the
                        # close is passed on here, code and all.
                        if not ws_upstream.closed:
                            await ws_upstream.close(
                                code=ws_client.close_code or 1000)

                    async def forward_down():
                        """Spectrumserver → Browser"""
                        async for msg in ws_upstream:
                            if msg.type == WSMsgType.TEXT:
                                await ws_client.send_str(msg.data)
                            elif msg.type == WSMsgType.BINARY:
                                await ws_client.send_bytes(msg.data)
                            elif msg.type == WSMsgType.ERROR:
                                break
                        # Same here: the server's close frame ends the loop
                        # unseen, and its code is what the page acts on (4003
                        # refused by a limit, 4001 kicked by the sysop), so
                        # it must reach the browser rather than a plain 1000.
                        if not ws_client.closed:
                            await ws_client.close(
                                code=ws_upstream.close_code or 1000,
                                message=b"upstream closed")

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
    _unregister_ws(client_ip, ws_client)
    return ws_client


async def handle(request: web.Request) -> web.StreamResponse:
    if request.path == "/__proxy_control/kick":
        return await handle_kick(request)
    # spectrumserver's /~~kick is allowed for a loopback TCP peer — and to it,
    # everything relayed from here is loopback. Without this check anyone who
    # could reach this port could disconnect and ban any listener.
    if "~~kick" in request.path and not _is_local(request):
        return web.json_response({"ok": False, "msg": "forbidden"}, status=403)
    if request.path.startswith("/admin"):
        upstream, set_rx = ADMIN_UPSTREAM, ""
    elif request.path == "/receivers.json" and RECEIVERS:
        # The receiver list for the page's picker: ids, names and public URLs,
        # never the internal ports — and only the receivers that are running,
        # so a stopped one's button disappears. Readable cross-origin, because
        # a receiver with its own public port serves its page from another
        # origin.
        up = await _receivers_up()
        return web.json_response(
            [{"id": rid, "name": r["name"], "url": r["url"],
              "default": rid == DEFAULT_RX}
             for rid, r in RECEIVERS.items() if up.get(rid, True)],
            headers={"Cache-Control": "no-cache",
                     "Access-Control-Allow-Origin": "*"})
    else:
        upstream, set_rx = _pick_receiver(request)
    if request.headers.get("Upgrade", "").lower() == "websocket":
        return await proxy_websocket(request, upstream)
    return await proxy_request(request, upstream, set_rx)


# ── Access-log noise filter ───────────────────────────────────────────────────
# The admin dashboard polls these paths every few seconds. Logging each poll
# buries the interesting traffic and inflates proxy.log roughly tenfold, so
# successful polls are dropped. Anything that is not a plain 200 still gets
# logged, so failures on these paths remain visible.
# /admin/api/logs/clear is quiet for a different reason: the admin panel
# truncates proxy.log while serving it, and this access line would be written
# afterwards — leaving one line behind and making the clear look like it failed.
#
# Keep this list identical to _QUIET_PATHS in admin_server.py. It drifted once:
# the panel silenced eight paths while the proxy silenced three, so admin.log
# stayed readable and proxy.log filled with the same polls the panel had already
# decided were noise — /admin/api/thermal alone was 72 of 78 lines, ~3 MB/day
# from a single open dashboard tab. These are the sysop's own polls; they say
# nothing about who used the receiver, which is the point of an access log.
_QUIET_PATHS = ("/admin/api/status", "/admin/api/thermal", "/admin/api/logs",
                "/admin/api/logs/clear",
                "/admin/api/autorun/status", "/admin/api/users",
                "/admin/api/graph-stats", "/admin/api/chat")
_ACCESS_RE = re.compile(r'"[A-Z]+ (?P<path>[^ ?"]+)[^"]*" (?P<status>\d{3})')


class QuietPollFilter(logging.Filter):
    def filter(self, record):
        m = _ACCESS_RE.search(record.getMessage())
        if not m or m.group("status") != "200":
            return True
        return m.group("path") not in _QUIET_PATHS


async def main():
    # AppRunner (unlike web.run_app) never calls basicConfig, so aiohttp's
    # access logger stays unconfigured and every request line is discarded.
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    logging.getLogger("aiohttp.access").addFilter(QuietPollFilter())

    app = web.Application()
    app.router.add_route("*", "/{path_info:.*}", handle)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, LISTEN_HOST, LISTEN_PORT)
    await site.start()
    if FRONT_PORT and FRONT_PORT != LISTEN_PORT:
        await web.TCPSite(runner, LISTEN_HOST, FRONT_PORT).start()

    print(f"╔══════════════════════════════════════════════════════╗")
    print(f"║  PhantomSDR-Plus Reverse Proxy                       ║")
    print(f"║  Listening : http://0.0.0.0:{LISTEN_PORT:<5}                ║")
    print(f"║  /admin*   → Admin panel  (localhost:{int(_cfg['port']):<5})        ║")
    print(f"║  /*        → SDR server   ({_sdr_host}:{_sdr_port:<5})  ║")
    print(f"╚══════════════════════════════════════════════════════╝")
    if RECEIVERS:
        if FRONT_PORT and FRONT_PORT != LISTEN_PORT:
            print(f"  also listening on :{FRONT_PORT} (receivers.toml [front])")
        for rid, r in RECEIVERS.items():
            mark = "  (default)" if rid == DEFAULT_RX else ""
            print(f"  ?rx={rid:<8} → {r['upstream']}  {r['name']}{mark}")

    await asyncio.Event().wait()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[stopped]")
