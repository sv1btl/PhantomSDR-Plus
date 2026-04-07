#!/usr/bin/env python3
"""
PhantomSDR-Plus Reverse Proxy
==============================
Listens on port 8901 and routes:
  /admin*  → Admin panel  (localhost:3000)
  /*       → Spectrumserver (localhost:8900)

Run: python3 proxy.py
"""

import asyncio
import aiohttp
from aiohttp import web, ClientSession, ClientTimeout, WSMsgType

LISTEN_HOST = "0.0.0.0"
LISTEN_PORT = 8901
ADMIN_UPSTREAM  = "http://127.0.0.1:3000"
SDR_UPSTREAM    = "http://127.0.0.1:8900"

async def proxy_request(request: web.Request, upstream: str) -> web.StreamResponse:
    url = upstream + str(request.rel_url)
    headers = {k: v for k, v in request.headers.items()
              if k.lower() not in ("host", "content-length", "accept-encoding")}
    headers = {k: v for k, v in request.headers.items()
               if k.lower() not in ("host", "content-length", "accept-encoding")}
    headers["Accept-Encoding"] = "identity"
    headers["X-Forwarded-For"] = request.remote or ""
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
                # Stream response back
                response = web.StreamResponse(
                    status=resp.status,
                    headers={k: v for k, v in resp.headers.items()
                             if k.lower() not in ("transfer-encoding", "connection")},
                )
                await response.prepare(request)
                async for chunk in resp.content.iter_chunked(8192):
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
    """Forward WebSocket connections (needed for spectrumserver)."""
    ws_client = web.WebSocketResponse()
    await ws_client.prepare(request)

    ws_url = upstream.replace("http://", "ws://") + str(request.rel_url)
    headers = {k: v for k, v in request.headers.items()
               if k.lower() not in ("host", "upgrade", "connection",
                                     "sec-websocket-key", "sec-websocket-version")}
    try:
        async with ClientSession() as session:
            async with session.ws_connect(ws_url, headers=headers) as ws_upstream:
                async def forward_up():
                    async for msg in ws_client:
                        if msg.type == WSMsgType.TEXT:
                            await ws_upstream.send_str(msg.data)
                        elif msg.type == WSMsgType.BINARY:
                            await ws_upstream.send_bytes(msg.data)
                        elif msg.type in (WSMsgType.CLOSE, WSMsgType.ERROR):
                            break

                async def forward_down():
                    async for msg in ws_upstream:
                        if msg.type == WSMsgType.TEXT:
                            await ws_client.send_str(msg.data)
                        elif msg.type == WSMsgType.BINARY:
                            await ws_client.send_bytes(msg.data)
                        elif msg.type in (WSMsgType.CLOSE, WSMsgType.ERROR):
                            break

                await asyncio.gather(forward_up(), forward_down())
    except Exception:
        pass
    return ws_client


async def handle(request: web.Request) -> web.StreamResponse:
    path = request.path

    # Route /admin* to admin panel
    if path.startswith("/admin"):
        upstream = ADMIN_UPSTREAM
    else:
        upstream = SDR_UPSTREAM

    # Handle WebSocket upgrade
    if (request.headers.get("Upgrade", "").lower() == "websocket"):
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
    print(f"║  Listening : http://0.0.0.0:{LISTEN_PORT}                   ║")
    print(f"║  /admin*   → Admin panel  (localhost:{str(3000):<5})        ║")
    print(f"║  /*        → SDR server   (localhost:{str(8900):<5})        ║")
    print(f"╚══════════════════════════════════════════════════════╝")

    await asyncio.Event().wait()  # run forever


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[stopped]")
