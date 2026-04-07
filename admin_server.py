#!/usr/bin/env python3
"""
PhantomSDR-Plus Admin Panel — Internal service (localhost only).
Do NOT run this directly for public access.
Use proxy.py to expose it on the main port alongside spectrumserver.

Direct access (internal/dev only): http://127.0.0.1:8901/admin
Via proxy (production):            http://server_address:8900/admin
Default password: admin (change on first login!)
"""

import os
import sys
import json
import hashlib
import subprocess
import threading
import time
import signal
import re
import glob
from datetime import datetime, timedelta
from functools import wraps
from pathlib import Path

try:
    import tomllib
except ImportError:
    try:
        import tomli as tomllib
    except ImportError:
        tomllib = None

try:
    import tomli_w
except ImportError:
    tomli_w = None

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

from flask import (Flask, render_template_string, request, session,
                   redirect, url_for, jsonify, Response, flash)

# ─── Config ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent.resolve()
ADMIN_CONFIG_FILE = BASE_DIR / "admin_config.json"
ADMIN_PORT = int(os.environ.get("ADMIN_PORT", 3000))   # internal only — proxy.py exposes it publicly
ADMIN_BIND = os.environ.get("ADMIN_BIND", "0.0.0.0")   # localhost by default; set "0.0.0.0" for standalone
SECRET_KEY = os.environ.get("ADMIN_SECRET", os.urandom(24).hex())

DEFAULT_CONFIG = {
    "password_hash": hashlib.sha256(b"admin").hexdigest(),
    "port": ADMIN_PORT,
    "sdr_base_dir": str(BASE_DIR),
    "log_lines": 200,
    "start_script": "",   # default start script
    "stop_script":  "",   # default stop script
}

# ─── App setup ─────────────────────────────────────────────────────────────────
app = Flask(__name__)
app.secret_key = SECRET_KEY

log_buffer = []
log_lock = threading.Lock()

# ─── Helpers ───────────────────────────────────────────────────────────────────
def load_admin_config():
    if ADMIN_CONFIG_FILE.exists():
        with open(ADMIN_CONFIG_FILE) as f:
            return json.load(f)
    return DEFAULT_CONFIG.copy()

def save_admin_config(cfg):
    with open(ADMIN_CONFIG_FILE, "w") as f:
        json.dump(cfg, f, indent=2)

def hash_password(pwd):
    return hashlib.sha256(pwd.encode()).hexdigest()

def check_password(pwd):
    cfg = load_admin_config()
    return hash_password(pwd) == cfg.get("password_hash", "")

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("authenticated"):
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated

def get_sdr_dir():
    cfg = load_admin_config()
    return Path(cfg.get("sdr_base_dir", str(BASE_DIR)))

def find_config_files():
    base = get_sdr_dir()
    files = {}
    for pattern in ["config.toml", "config-*.toml", "config.example.*.toml"]:
        for f in sorted(base.glob(pattern)):
            files[f.name] = str(f)
    return files

def find_editable_files():
    """Find all editable files (.sh .toml .cpp .h .txt .json .html) in PhantomSDR-Plus dir."""
    import os
    base  = get_sdr_dir()
    exts  = {'.sh', '.toml', '.cpp', '.h', '.txt', '.json', '.html'}
    files = {}
    skip  = {'node_modules', 'build', 'dist', '__pycache__', '.git'}
    for root, dirs, filenames in os.walk(str(base)):
        dirs[:] = [d for d in dirs if not d.startswith('.') and d not in skip]
        for fn in sorted(filenames):
            if Path(fn).suffix.lower() in exts:
                if fn == "admin_config.json":
                    continue
                full = os.path.join(root, fn)
                rel  = os.path.relpath(full, str(base))
                files[rel] = full
    return dict(sorted(files.items()))

def find_json_files():
    base = get_sdr_dir()
    files = {}
    for pattern in ["*.json", "frontend/src/*.json", "frontend/*.json"]:
        for f in sorted(base.glob(pattern)):
            if f.name != "admin_config.json":
                files[str(f.relative_to(base))] = str(f)
    return files

def find_sh_files():
    """Discover all .sh files inside PhantomSDR-Plus directory. Returns {rel_path: abs_path}."""
    import os
    base  = get_sdr_dir()
    files = {}
    for root, dirs, filenames in os.walk(str(base)):
        dirs[:] = [d for d in dirs if not d.startswith('.')
                   and d not in ('node_modules', 'build', 'dist', '__pycache__')]
        for fn in sorted(filenames):
            if fn.endswith('.sh'):
                full = os.path.join(root, fn)
                rel  = os.path.relpath(full, str(base))
                files[rel] = full
    return dict(sorted(files.items()))

def find_config_files_all():
    """Find all .toml config files inside PhantomSDR-Plus directory. Returns {name: abs_path}."""
    base  = get_sdr_dir()
    files = {}
    for pattern in ["config.toml", "config-*.toml", "config.example.*.toml", "*.toml"]:
        for f in sorted(base.glob(pattern)):
            files[f.name] = str(f)
    return dict(sorted(files.items()))

def get_allowed_configs():
    return find_config_files_all()

def get_allowed_scripts():
    return find_sh_files()
def get_process_status():
    status = {"running": False, "pid": None, "name": None, "cpu": 0, "mem": 0, "uptime": None}
    if not HAS_PSUTIL:
        # Fallback: try pgrep
        try:
            result = subprocess.run(["pgrep", "-f", "spectrumserver"], capture_output=True, text=True)
            if result.stdout.strip():
                pid = int(result.stdout.strip().split()[0])
                status["running"] = True
                status["pid"] = pid
                status["name"] = "spectrumserver"
        except Exception:
            pass
        return status
    for proc in psutil.process_iter(["pid", "name", "cmdline", "cpu_percent", "memory_info", "create_time"]):
        try:
            cmd = " ".join(proc.info["cmdline"] or [])
            if "spectrumserver" in cmd or "phantom" in proc.info["name"].lower():
                uptime = time.time() - proc.info["create_time"]
                status.update({
                    "running": True,
                    "pid": proc.info["pid"],
                    "name": proc.info["name"],
                    "cpu": proc.cpu_percent(interval=0.1),
                    "mem": round(proc.info["memory_info"].rss / 1024 / 1024, 1),
                    "uptime": str(timedelta(seconds=int(uptime))),
                })
                break
        except Exception:
            pass
    return status

def get_temperature():
    """Try multiple methods to get CPU temperature."""
    # psutil sensors
    if HAS_PSUTIL and hasattr(psutil, "sensors_temperatures"):
        try:
            temps = psutil.sensors_temperatures()
            for key in ("coretemp", "cpu_thermal", "acpitz", "k10temp", "zenpower"):
                if key in temps and temps[key]:
                    return round(temps[key][0].current, 1)
            # any first available
            for key, entries in temps.items():
                if entries:
                    return round(entries[0].current, 1)
        except Exception:
            pass
    # /sys/class/thermal fallback
    try:
        import glob
        for p in sorted(glob.glob("/sys/class/thermal/thermal_zone*/temp")):
            with open(p) as f:
                val = int(f.read().strip())
            if val > 0:
                return round(val / 1000.0, 1)
    except Exception:
        pass
    # sensors command fallback
    try:
        r = subprocess.run(["sensors"], capture_output=True, text=True, timeout=2)
        import re
        m = re.search(r'[Tt]emp\d*:\s+\+?([\d.]+)', r.stdout)
        if m:
            return round(float(m.group(1)), 1)
    except Exception:
        pass
    return None

def get_system_stats():
    if not HAS_PSUTIL:
        return {"cpu": "N/A", "mem_used": "N/A", "mem_total": "N/A", "disk_used": "N/A", "disk_total": "N/A", "temp": None}
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    return {
        "cpu": psutil.cpu_percent(interval=0.5),
        "mem_used": round(mem.used / 1024**3, 1),
        "mem_total": round(mem.total / 1024**3, 1),
        "mem_pct": mem.percent,
        "disk_used": round(disk.used / 1024**3, 1),
        "disk_total": round(disk.total / 1024**3, 1),
        "disk_pct": disk.percent,
        "temp": get_temperature(),
    }

def get_top_processes(n=12):
    """Return top N processes sorted by CPU usage."""
    if not HAS_PSUTIL:
        # Fallback: use 'ps' command
        try:
            result = subprocess.run(
                ["ps", "aux", "--sort=-%cpu"],
                capture_output=True, text=True
            )
            lines = result.stdout.strip().split("\n")[1:n+1]
            procs = []
            for line in lines:
                parts = line.split(None, 10)
                if len(parts) >= 11:
                    procs.append({
                        "pid": parts[1],
                        "cpu": parts[2],
                        "mem": parts[3],
                        "name": parts[10][:40],
                    })
            return procs
        except Exception:
            return []
    procs = []
    for proc in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent", "status", "username"]):
        try:
            procs.append({
                "pid": proc.info["pid"],
                "name": (proc.info["name"] or "")[:35],
                "cpu": round(proc.info["cpu_percent"] or 0, 1),
                "mem": round(proc.info["memory_percent"] or 0, 1),
                "status": proc.info["status"],
                "user": (proc.info["username"] or "")[:12],
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    procs.sort(key=lambda x: x["cpu"], reverse=True)
    return procs[:n]

def run_script(script_name):
    base = get_sdr_dir()
    sh   = get_allowed_scripts()
    # Resolve absolute path from whitelist map
    if script_name in sh:
        script_path = Path(sh[script_name])
    elif Path(script_name).is_absolute() and Path(script_name).exists():
        script_path = Path(script_name)
    else:
        script_path = base / script_name
    if not script_path.exists():
        return False, "Script not found: " + str(script_path)
    try:
        script_path.chmod(script_path.stat().st_mode | 0o111)
        proc = subprocess.Popen(
            ["bash", str(script_path)],
            cwd=str(script_path.parent),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            start_new_session=True,
        )
        try:
            out, _ = proc.communicate(timeout=3)
        except subprocess.TimeoutExpired:
            out = "(running in background)"
        with log_lock:
            log_buffer.append("[" + datetime.now().strftime("%H:%M:%S") + "] RAN " + script_name + ": " + out[:200])
        return True, "Started " + script_path.name + " (PID " + str(proc.pid) + ")" + chr(10) + out
    except Exception as e:
        return False, str(e)

def stop_server():
    base = get_sdr_dir()
    stop_script = base / "stop-websdr.sh"
    if stop_script.exists():
        return run_script("stop-websdr.sh")
    # Fallback: kill by process name
    try:
        subprocess.run(["killall", "spectrumserver"], capture_output=True)
        return True, "Sent SIGTERM to spectrumserver"
    except Exception as e:
        return False, str(e)

def read_file_safe(path):
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            return f.read()
    except Exception as e:
        return f"# Error reading file: {e}"

def write_file_safe(path, content):
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return True, "Saved successfully"
    except Exception as e:
        return False, str(e)

def tail_log(n=100):
    base = get_sdr_dir()
    lines = []
    # Check common log file locations
    log_candidates = [
        base / "logwebsdr.txt",
    ]
    for lf in log_candidates:
        if lf.exists():
            try:
                with open(lf, encoding="utf-8", errors="replace") as f:
                    all_lines = f.readlines()
                if all_lines:
                    lines = all_lines[-n:]
                    break
            except Exception:
                pass
    # Fallback: journalctl for spectrumserver
    if not lines:
        try:
            result = subprocess.run(
                ["journalctl", "-u", "phantomsdr-admin", "-n", str(n), "--no-pager", "--output=short"],
                capture_output=True, text=True, timeout=3
            )
            if result.stdout.strip():
                lines = result.stdout.strip().splitlines(keepends=True)
        except Exception:
            pass
    # Also try journalctl for spectrumserver process
    if not lines:
        try:
            result = subprocess.run(
                ["journalctl", "_COMM=spectrumserver", "-n", str(n), "--no-pager", "--output=short"],
                capture_output=True, text=True, timeout=3
            )
            if result.stdout.strip():
                lines = result.stdout.strip().splitlines(keepends=True)
        except Exception:
            pass
    # In-memory buffer (admin actions log)
    with log_lock:
        mem_lines = list(log_buffer[-50:])
    return mem_lines + [l.rstrip() for l in lines]

# ─── HTML Template ─────────────────────────────────────────────────────────────
LOGIN_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PhantomSDR Admin · Login</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --green:#00ff41;--green2:#00cc33;--amber:#ffb000;--red:#ff3333;
  --bg:#050a05;--panel:#0d1a0d;--border:#1a3a1a;--dim:#1f3a1f;
  --text:#c8ffc8;--text2:#7ab87a;--glow:0 0 10px #00ff4155,0 0 20px #00ff4122;
}
body{background:var(--bg);font-family:'Share Tech Mono',monospace;color:var(--text);
  min-height:100vh;display:flex;align-items:center;justify-content:center;
  background-image:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,65,0.015) 2px,rgba(0,255,65,0.015) 4px);}
body::before{content:'';position:fixed;inset:0;background:radial-gradient(ellipse 80% 60% at 50% 40%,rgba(0,255,65,0.04) 0%,transparent 70%);pointer-events:none;}

.login-wrap{width:380px;animation:fadeIn .6s ease;}
@keyframes fadeIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}

.logo{text-align:center;margin-bottom:2rem;}
.logo-title{font-family:'Orbitron',sans-serif;font-weight:900;font-size:1.4rem;
  color:var(--green);text-shadow:var(--glow);letter-spacing:0.1em;}
.logo-sub{font-size:.7rem;color:var(--text2);letter-spacing:.3em;margin-top:.4rem;}
.logo-icon{font-size:3rem;margin-bottom:.5rem;filter:drop-shadow(0 0 12px #00ff41);}

.card{background:var(--panel);border:1px solid var(--border);border-radius:4px;
  padding:2rem;box-shadow:0 0 40px rgba(0,255,65,0.08),inset 0 1px 0 rgba(0,255,65,0.1);}

label{display:block;font-size:.7rem;color:var(--text2);letter-spacing:.2em;margin-bottom:.4rem;margin-top:1.2rem;}
label:first-of-type{margin-top:0;}

input[type=password]{width:100%;background:#071007;border:1px solid var(--border);
  color:var(--green);font-family:'Share Tech Mono',monospace;font-size:.9rem;
  padding:.7rem 1rem;border-radius:3px;outline:none;transition:.2s;caret-color:var(--green);}
input[type=password]:focus{border-color:var(--green);box-shadow:var(--glow);}

.btn{width:100%;margin-top:1.5rem;padding:.8rem;background:transparent;
  border:1px solid var(--green);color:var(--green);font-family:'Orbitron',sans-serif;
  font-size:.75rem;letter-spacing:.2em;cursor:pointer;border-radius:3px;
  transition:.2s;text-transform:uppercase;}
.btn:hover{background:rgba(0,255,65,0.1);box-shadow:var(--glow);}

.error{background:rgba(255,51,51,0.1);border:1px solid #ff333355;color:#ff6666;
  padding:.7rem 1rem;border-radius:3px;font-size:.8rem;margin-bottom:1rem;text-align:center;}

.blink{animation:blink 1.2s step-end infinite;}
@keyframes blink{50%{opacity:0}}

.scanlines{pointer-events:none;position:fixed;inset:0;
  background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.08) 3px,rgba(0,0,0,0.08) 4px);
  z-index:9999;}
</style>
</head>
<body>
<div class="scanlines"></div>
<div class="login-wrap">
  <div class="logo">
    <div class="logo-icon">📡</div>
    <div class="logo-title">PHANTOM<span style="color:var(--amber)">SDR</span></div>
    <div class="logo-sub">ADMIN CONTROL PANEL</div>
  </div>
  <div class="card">
    {% if error %}<div class="error">⚠ {{ error }}</div>{% endif %}
    <form method="post">
      <label>ACCESS CODE</label>
      <input type="password" name="password" autofocus placeholder="••••••••">
      <button type="submit" class="btn">▶ AUTHENTICATE<span class="blink">_</span></button>
    </form>
  </div>
</div>
</body>
</html>"""

MAIN_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PhantomSDR Admin Panel</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --green:#00ff41;--green2:#00cc33;--amber:#ffb000;--red:#ff4040;--blue:#00ccff;
  --bg:#050a05;--panel:#0a150a;--panel2:#0d1a0d;--border:#1a3a1a;--dim:#1f3a1f;
  --text:#c8ffc8;--text2:#7ab87a;--text3:#4a8a4a;
  --glow:0 0 8px #00ff4155,0 0 20px #00ff4122;
  --glow-amber:0 0 8px #ffb00055,0 0 20px #ffb00022;
  --glow-red:0 0 8px #ff404055;
}
html,body{height:100%;background:var(--bg);font-family:'Share Tech Mono',monospace;
  color:var(--text);font-size:20px;}
body{background-image:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,65,0.01) 2px,rgba(0,255,65,0.01) 4px);}

/* Layout */
.layout{display:flex;height:100vh;overflow:hidden;}
.sidebar{width:220px;min-width:220px;background:var(--panel);border-right:1px solid var(--border);
  display:flex;flex-direction:column;overflow-y:auto;}
.main{flex:1;overflow:hidden;display:flex;flex-direction:column;}
.topbar{background:var(--panel);border-bottom:1px solid var(--border);
  padding:.7rem 1.2rem;display:flex;align-items:center;justify-content:space-between;}
.content{flex:1;overflow-y:auto;padding:1.4rem;}

/* Sidebar */
.sidebar-logo{padding:1.2rem 1rem;border-bottom:1px solid var(--border);text-align:center;}
.sidebar-logo .title{font-family:'Orbitron',sans-serif;font-weight:900;font-size:1rem;
  color:var(--green);text-shadow:var(--glow);}
.sidebar-logo .sub{font-size:.6rem;color:var(--text3);letter-spacing:.3em;margin-top:.2rem;}
.sidebar-logo .icon{font-size:1.8rem;margin-bottom:.3rem;filter:drop-shadow(0 0 8px #00ff41);}

.nav-section{padding:.5rem 0;}
.nav-label{font-size:.55rem;color:var(--text3);letter-spacing:.3em;padding:.4rem 1rem .2rem;}
.nav-item{display:flex;align-items:center;gap:.6rem;padding:.55rem 1rem;
  cursor:pointer;color:var(--text2);transition:.15s;border-left:2px solid transparent;
  text-decoration:none;font-size:.8rem;}
.nav-item:hover{color:var(--green);background:rgba(0,255,65,0.05);border-left-color:var(--green2);}
.nav-item.active{color:var(--green);background:rgba(0,255,65,0.08);
  border-left-color:var(--green);text-shadow:var(--glow);}
.nav-item .icon{font-size:1rem;width:1.2rem;text-align:center;}

.sidebar-footer{margin-top:auto;padding:.8rem 1rem;border-top:1px solid var(--border);
  font-size:.65rem;color:var(--text3);}

/* Topbar */
.topbar-title{font-family:'Orbitron',sans-serif;font-size:.85rem;color:var(--green);}
.status-pill{display:inline-flex;align-items:center;gap:.4rem;
  padding:.3rem .7rem;border-radius:2px;font-size:.7rem;}
.status-pill.online{background:rgba(0,255,65,0.1);border:1px solid #00ff4155;color:var(--green);}
.status-pill.offline{background:rgba(255,64,64,0.1);border:1px solid #ff404055;color:var(--red);}
.status-dot{width:6px;height:6px;border-radius:50%;animation:pulse 2s infinite;}
.status-dot.online{background:var(--green);box-shadow:0 0 6px var(--green);}
.status-dot.offline{background:var(--red);}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}

.topbar-right{display:flex;align-items:center;gap:1rem;}
.topbar-time{font-size:.7rem;color:var(--text3);}
.logout-btn{font-size:.65rem;color:var(--text3);text-decoration:none;
  padding:.2rem .5rem;border:1px solid var(--border);border-radius:2px;transition:.15s;}
.logout-btn:hover{color:var(--red);border-color:#ff404055;}

/* Cards */
.grid{display:grid;gap:1rem;}
.grid-2{grid-template-columns:1fr 1fr;}
.grid-3{grid-template-columns:1fr 1fr 1fr;}
.grid-4{grid-template-columns:repeat(4,1fr);}
.grid-5{grid-template-columns:repeat(5,1fr);}

.card{background:var(--panel);border:1px solid var(--border);border-radius:3px;padding:1rem;}
.card-header{font-family:'Orbitron',sans-serif;font-size:.7rem;color:var(--text2);
  letter-spacing:.15em;margin-bottom:.8rem;display:flex;align-items:center;gap:.5rem;}
.card-header .dot{width:6px;height:6px;border-radius:50%;background:var(--green);
  box-shadow:0 0 6px var(--green);}

/* Stat cards */
.stat-val{font-family:'Orbitron',sans-serif;font-size:1.6rem;font-weight:700;
  color:var(--green);text-shadow:var(--glow);}
.stat-label{font-size:.65rem;color:var(--text3);margin-top:.2rem;letter-spacing:.1em;}
.stat-sub{font-size:.7rem;color:var(--text2);margin-top:.3rem;}

/* Progress bars */
.bar-wrap{background:#071207;border-radius:2px;height:6px;margin-top:.5rem;overflow:hidden;}
.bar-fill{height:100%;border-radius:2px;transition:.5s;background:var(--green);}
.bar-fill.warn{background:var(--amber);}
.bar-fill.danger{background:var(--red);}

/* Buttons */
.btn{display:inline-flex;align-items:center;gap:.4rem;padding:.5rem .9rem;
  font-family:'Share Tech Mono',monospace;font-size:.75rem;cursor:pointer;
  border-radius:2px;transition:.15s;border:1px solid;background:transparent;letter-spacing:.05em;}
.btn-green{color:var(--green);border-color:#00ff4155;}
.btn-green:hover{background:rgba(0,255,65,0.1);box-shadow:var(--glow);}
.btn-red{color:var(--red);border-color:#ff404055;}
.btn-red:hover{background:rgba(255,64,64,0.1);box-shadow:var(--glow-red);}
.btn-amber{color:var(--amber);border-color:#ffb00055;}
.btn-amber:hover{background:rgba(255,176,0,0.1);box-shadow:var(--glow-amber);}
.btn-blue{color:var(--blue);border-color:#00ccff55;}
.btn-blue:hover{background:rgba(0,204,255,0.1);}
.btn-lg{padding:.7rem 1.4rem;font-size:.85rem;}
.btn:disabled{opacity:.4;cursor:not-allowed;}

/* Server control card */
.sdr-control{display:flex;gap:1rem;flex-wrap:wrap;align-items:flex-start;}
.sdr-info{flex:1;min-width:200px;}
.sdr-info p{margin:.3rem 0;font-size:.75rem;color:var(--text2);}
.sdr-info .val{color:var(--green);}
.sdr-btns{display:flex;flex-direction:column;gap:.5rem;}
.script-select{background:#071207;border:1px solid var(--border);color:var(--text);
  font-family:'Share Tech Mono',monospace;font-size:.75rem;padding:.4rem .6rem;
  border-radius:2px;width:100%;margin-bottom:.5rem;}
.script-select:focus{border-color:var(--green);outline:none;}

/* Editor */
.editor-toolbar{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-bottom:.7rem;}
.file-select{background:#071207;border:1px solid var(--border);color:var(--text);
  font-family:'Share Tech Mono',monospace;font-size:.75rem;padding:.4rem .7rem;
  border-radius:2px;flex:1;}
.file-select:focus{outline:none;border-color:var(--green);}
textarea.code{width:100%;background:#030803;border:1px solid var(--border);color:#c8ffc8;
  font-family:'Share Tech Mono',monospace;font-size:.75rem;line-height:1.6;
  padding:.8rem;border-radius:3px;resize:vertical;outline:none;
  min-height:400px;transition:.2s;}
textarea.code:focus{border-color:var(--green);box-shadow:var(--glow);}

/* Toast */
#toast{position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;display:flex;
  flex-direction:column;gap:.4rem;}
.toast{padding:.6rem 1rem;border-radius:3px;font-size:.75rem;
  animation:toastIn .3s ease;border:1px solid;}
.toast.ok{background:rgba(0,255,65,0.12);border-color:#00ff4155;color:var(--green);}
.toast.err{background:rgba(255,64,64,0.12);border-color:#ff404055;color:var(--red);}
@keyframes toastIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:none}}

/* Log viewer */
.log-box{background:#030803;border:1px solid var(--border);border-radius:3px;
  padding:.8rem;font-size:.7rem;line-height:1.8;height:400px;overflow-y:auto;
  color:var(--text2);word-break:break-all;}
.log-box::-webkit-scrollbar{width:4px;}
.log-box::-webkit-scrollbar-track{background:var(--bg);}
.log-box::-webkit-scrollbar-thumb{background:var(--dim);}
.log-line-err{color:var(--red);}
.log-line-warn{color:var(--amber);}
.log-line-ok{color:var(--green);}

/* Tabs inside sections */
.tab-bar{display:flex;border-bottom:1px solid var(--border);margin-bottom:1rem;}
.tab{padding:.5rem 1rem;font-size:.7rem;cursor:pointer;color:var(--text3);
  border-bottom:2px solid transparent;transition:.15s;letter-spacing:.1em;}
.tab.active{color:var(--green);border-bottom-color:var(--green);}
.tab-pane{display:none;}
.tab-pane.active{display:block;}

/* Section heading */
.section-head{font-family:'Orbitron',sans-serif;font-size:.8rem;color:var(--green);
  letter-spacing:.15em;margin-bottom:1rem;padding-bottom:.5rem;
  border-bottom:1px solid var(--border);}

/* JSON editor helpers */
.json-path{font-size:.65rem;color:var(--text3);margin-bottom:.5rem;}

input[type=text],input[type=password],input[type=number]{
  background:#071207;border:1px solid var(--border);color:var(--text);
  font-family:'Share Tech Mono',monospace;font-size:.8rem;padding:.4rem .7rem;
  border-radius:2px;outline:none;transition:.15s;}
input:focus{border-color:var(--green);box-shadow:0 0 6px #00ff4122;}

/* Chat history */
.chat-log{background:#030803;border:1px solid var(--border);border-radius:3px;
  padding:.8rem;font-size:.75rem;line-height:2;height:500px;overflow-y:auto;}
.chat-msg{border-bottom:1px solid #0a1a0a;padding:.3rem 0;}
.chat-nick{color:var(--amber);}
.chat-time{color:var(--text3);font-size:.65rem;}

/* Top processes table */
table.top-procs{width:100%;border-collapse:collapse;font-size:.72rem;}
table.top-procs th{color:var(--text3);font-weight:normal;letter-spacing:.1em;
  padding:.35rem .5rem;border-bottom:1px solid var(--border);text-align:left;white-space:nowrap;}
table.top-procs td{padding:.3rem .5rem;border-bottom:1px solid #0a1a0a;
  white-space:nowrap;overflow:hidden;max-width:200px;text-overflow:ellipsis;}
table.top-procs tr:hover td{background:rgba(0,255,65,0.04);}
table.top-procs .cpu-hi{color:var(--red);}
table.top-procs .cpu-med{color:var(--amber);}
table.top-procs .cpu-ok{color:var(--green);}
table.top-procs .mem-col{color:var(--blue);}

/* ── Mobile Bottom Nav Bar ──────────────────────────────────── */
.bottom-nav{display:none;}
.hamburger{display:none;}
.sidebar-backdrop{display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:199;}
.sidebar-backdrop.open{display:block;}

@media(max-width:768px){
  /* Hide desktop sidebar, show bottom nav */
  .sidebar{display:none !important;}
  .hamburger{display:none !important;}

  /* Layout: vertical stack, leave room for bottom nav */
  .layout{flex-direction:column;}
  .main{height:100vh;display:flex;flex-direction:column;}
  .content{flex:1;overflow-y:auto;padding:.6rem;padding-bottom:70px;}

  /* Topbar */
  .topbar{padding:.5rem .8rem;gap:.5rem;}
  .topbar-title{font-size:.8rem;flex:1;}
  .topbar-time{display:none;}
  .status-pill{padding:.2rem .5rem;font-size:.65rem;}

  /* Bottom navigation bar */
  .bottom-nav{
    display:flex;position:fixed;bottom:0;left:0;right:0;z-index:100;
    background:var(--panel);border-top:1px solid var(--border);
    height:58px;align-items:stretch;
    box-shadow:0 -4px 20px rgba(0,0,0,.5);
  }
  .bottom-nav a{
    flex:1;display:flex;flex-direction:column;align-items:center;
    justify-content:center;gap:2px;color:var(--text3);text-decoration:none;
    font-size:.5rem;letter-spacing:.05em;border-top:2px solid transparent;
    transition:.15s;padding:.3rem .1rem;min-width:0;
    -webkit-tap-highlight-color:transparent;
  }
  .bottom-nav a .bi{font-size:1.3rem;line-height:1;}
  .bottom-nav a span{font-size:.48rem;letter-spacing:.02em;white-space:nowrap;}
  .bottom-nav a.active{color:var(--green);border-top-color:var(--green);}
  .bottom-nav a:active{background:rgba(0,255,65,0.08);}

  /* Grids → single column */
  .grid-2,.grid-3,.grid-4,.grid-5{grid-template-columns:1fr !important;}

  /* Cards */
  .card{padding:.7rem;overflow-x:auto;}

  /* Stat values */
  .stat-val{font-size:1.3rem;}

  /* Buttons — full width on mobile for easy tapping */
  .btn{padding:.7rem 1rem;font-size:.85rem;min-height:44px;}
  .btn-lg{padding:.8rem 1.2rem;font-size:.9rem;}

  /* Form controls — larger for touch */
  .script-select,.file-select,
  input[type=text],input[type=password],input[type=number]{
    font-size:1rem;padding:.6rem .8rem;min-height:44px;}
  select{min-height:44px;}

  /* Log boxes */
  .log-box{height:220px !important;font-size:.7rem;}

  /* Tables: horizontal scroll */
  table.markers,table.top-procs{min-width:420px;}

  /* Textarea */
  textarea.code{min-height:200px;font-size:.8rem;}

  /* Toast position above bottom nav */
  #toast{bottom:70px;}

  /* Section heading */
  .section-head{font-size:.75rem;}
}

@media(max-width:390px){
  .bottom-nav a .bi{font-size:1.1rem;}
  .bottom-nav a span{display:none;}
  .bottom-nav{height:52px;}
  .content{padding-bottom:60px;}
}

.scanlines{pointer-events:none;position:fixed;inset:0;
  background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.06) 3px,rgba(0,0,0,0.06) 4px);
  z-index:9999;}

/* Pages */
.page{display:none;}
.page.active{display:block;}

/* Markers table */
table.markers{width:100%;border-collapse:collapse;font-size:.75rem;}
table.markers th{color:var(--text3);font-weight:normal;letter-spacing:.1em;
  padding:.4rem .6rem;border-bottom:1px solid var(--border);text-align:left;}
table.markers td{padding:.4rem .6rem;border-bottom:1px solid #0a1a0a;vertical-align:middle;}
table.markers tr:hover td{background:rgba(0,255,65,0.03);}
table.markers input{width:100%;background:transparent;border:none;
  color:var(--text);font-family:'Share Tech Mono',monospace;font-size:.75rem;}
table.markers input:focus{background:#071207;outline:1px solid var(--border);}
</style>
</head>
<body>
<div class="scanlines"></div>
<div class="layout">
  <!-- Sidebar -->
  <div class="sidebar">
    <div class="sidebar-logo">
      <div class="icon">📡</div>
      <div class="title">PHANTOM<span style="color:var(--amber)">SDR</span></div>
      <div class="sub">ADMIN v1.0</div>
    </div>
    <div class="nav-section">
      <div class="nav-label">MAIN</div>
      <a class="nav-item active" onclick="showPage('dashboard',this)" href="#">
        <span class="icon">⬡</span><span>Dashboard</span>
      </a>
    </div>
    <div class="nav-section">
      <div class="nav-label">CONFIGURATION</div>
      <a class="nav-item" onclick="showPage('config',this)" href="#">
        <span class="icon">⚙</span><span>Config Editor</span>
      </a>
      <a class="nav-item" onclick="showPage('siteinfo',this)" href="#">
        <span class="icon">◎</span><span>Site Info</span>
      </a>
      <a class="nav-item" onclick="showPage('markers',this)" href="#">
        <span class="icon">◉</span><span>Markers</span>
      </a>
    </div>
    <div class="nav-section">
      <div class="nav-label">MONITORING</div>
      <a class="nav-item" onclick="showPage('logs',this)" href="#">
        <span class="icon">▤</span><span>Log Viewer</span>
      </a>
      <a class="nav-item" onclick="showPage('chat',this)" href="#">
        <span class="icon">◫</span><span>Chat History</span>
      </a>
    </div>
    <div class="nav-section">
      <div class="nav-label">SYSTEM</div>
      <a class="nav-item" onclick="showPage('settings',this)" href="#">
        <span class="icon">◧</span><span>Settings</span>
      </a>
    </div>
    <div class="sidebar-footer">
      PhantomSDR-Plus<br>Admin Panel
    </div>
  </div>

  <!-- Main -->
  <div class="main">
    <div class="topbar">
      <div class="topbar-title" id="page-title">DASHBOARD</div>
      <div class="topbar-right">
        <div id="sdr-status" class="status-pill offline">
          <div class="status-dot offline"></div>
          <span>OFFLINE</span>
        </div>
        <div class="topbar-time" id="clock">--:--:--</div>
        <a class="logout-btn" href="/admin/logout">⏻ LOGOUT</a>
      </div>
    </div>

    <div class="content">

      <!-- ══════ DASHBOARD PAGE ══════ -->
      <div class="page active" id="page-dashboard">
        <div class="grid grid-5" style="margin-bottom:1rem;">
          <div class="card">
            <div class="card-header"><div class="dot"></div>SDR STATUS</div>
            <div class="stat-val" id="stat-status">--</div>
            <div class="stat-label">PROCESS STATE</div>
            <div class="stat-sub" id="stat-pid">PID: --</div>
          </div>
          <div class="card">
            <div class="card-header"><div class="dot" style="background:var(--amber);box-shadow:0 0 6px var(--amber)"></div>CPU USAGE</div>
            <div class="stat-val" id="stat-cpu">--%</div>
            <div class="stat-label">SYSTEM CPU</div>
            <div class="bar-wrap"><div class="bar-fill" id="bar-cpu" style="width:0%"></div></div>
          </div>
          <div class="card">
            <div class="card-header"><div class="dot" style="background:var(--blue);box-shadow:0 0 6px var(--blue)"></div>MEMORY</div>
            <div class="stat-val" id="stat-mem">-- GB</div>
            <div class="stat-label">USED / TOTAL</div>
            <div class="bar-wrap"><div class="bar-fill" id="bar-mem" style="width:0%"></div></div>
          </div>
          <div class="card">
            <div class="card-header"><div class="dot" style="background:#ff88ff;box-shadow:0 0 6px #ff88ff"></div>DISK</div>
            <div class="stat-val" id="stat-disk">-- GB</div>
            <div class="stat-label">USED / TOTAL</div>
            <div class="bar-wrap"><div class="bar-fill" id="bar-disk" style="width:0%"></div></div>
          </div>
          <div class="card">
            <div class="card-header"><div class="dot" style="background:#ff4444;box-shadow:0 0 6px #ff4444"></div>TEMPERATURE</div>
            <div class="stat-val" id="stat-temp">--&#176;C</div>
            <div class="stat-label">CPU TEMP</div>
            <div class="bar-wrap"><div class="bar-fill" id="bar-temp" style="width:0%;background:linear-gradient(90deg,#00ff41,#ffb000,#ff3333)"></div></div>
          </div>
        </div>

        <div class="card" style="margin-bottom:1rem;">
          <div class="card-header">
            <div class="dot" style="background:var(--green);box-shadow:0 0 6px var(--green)"></div>
            TERMINAL
            <span style="margin-left:.4rem;font-size:.6rem;color:var(--text3);" id="term-cwd">~</span>
            <span style="margin-left:auto;font-size:.6rem;color:var(--text3);cursor:pointer;" onclick="termClear()">&#10005; CLEAR</span>
          </div>
          <div id="term-output"
            style="font-family:'Share Tech Mono',monospace;font-size:.75rem;line-height:1.5;
                   background:#020902;border:1px solid var(--border);border-radius:3px;
                   padding:.5rem .7rem;height:300px;overflow-y:auto;color:var(--text);
                   white-space:pre-wrap;word-break:break-all;"></div>
          <div style="display:flex;align-items:center;gap:.4rem;margin-top:.4rem;
                      background:#020902;border:1px solid var(--border);border-radius:3px;padding:.3rem .6rem;">
            <span style="color:var(--green);font-size:.75rem;flex-shrink:0;">$</span>
            <input id="term-input" type="text" autocomplete="off" spellcheck="false"
              style="flex:1;background:transparent;border:none;outline:none;
                     color:var(--green);font-family:'Share Tech Mono',monospace;font-size:.75rem;"
              placeholder="type command and press Enter"
              onkeydown="termKey(event)">
            <button class="btn btn-green" style="padding:.2rem .6rem;font-size:.65rem;" onclick="termRun()">&#9654;</button>
          </div>
        </div>
        
        <div class="grid grid-2" style="margin-bottom:1rem;">
          <div class="card">
            <div class="card-header">
              <div class="dot"></div>RECENT LOG OUTPUT
              <span style="margin-left:auto;font-size:.6rem;color:var(--text3);cursor:pointer;" onclick="loadLogs('dash-log')">↻ refresh</span>
            </div>
            <div class="log-box" id="dash-log" style="height:280px;">Loading...</div>
          </div>
          <div class="card">
            <div class="card-header">
              <div class="dot" style="background:var(--amber);box-shadow:0 0 6px var(--amber)"></div>
              TOP PROCESSES
              <span style="margin-left:auto;font-size:.6rem;color:var(--text3);cursor:pointer;" onclick="updateStatus()">↻ refresh</span>
            </div>
            <table class="top-procs">
              <thead>
                <tr>
                  <th>PID</th><th>NAME</th><th>USER</th><th>CPU%</th><th>MEM%</th>
                </tr>
              </thead>
              <tbody id="top-procs-tbody">
                <tr><td colspan="5" style="color:var(--text3);text-align:center;">Loading...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ══════ CONFIG EDITOR PAGE ══════ -->
      <div class="page" id="page-config">
        <div class="section-head">FILE EDITOR</div>
        <div class="editor-toolbar">
          <select class="file-select" id="config-file-sel" onchange="loadConfigFile()" style="flex:1;min-width:0;"></select>
          <button class="btn btn-blue" onclick="loadConfigFile()">↻ RELOAD</button>
          <button class="btn btn-green" onclick="saveConfigFile()">💾 SAVE</button>
        </div>
        <div class="json-path" id="config-filepath">--</div>
        <textarea class="code" id="config-editor" rows="32" spellcheck="false" placeholder="Select a file to edit..."></textarea>
        <div style="margin-top:.5rem;display:flex;gap:.5rem;align-items:center;">
          <button class="btn btn-green" onclick="saveConfigFile()">💾 SAVE FILE</button>
          <span style="font-size:.65rem;color:var(--text3);margin-left:.5rem;" id="config-save-msg"></span>
        </div>
      </div>

      <!-- ══════ SITE INFO PAGE ══════ -->
      <div class="page" id="page-siteinfo">
        <div class="section-head">SITE INFORMATION EDITOR</div>
        <div class="editor-toolbar">
          <select class="file-select" id="json-file-sel" onchange="loadJsonFile()"></select>
          <button class="btn btn-blue" onclick="loadJsonFile()">↻ RELOAD</button>
        </div>
        <div class="tab-bar">
          <div class="tab active" onclick="switchJsonTab('form',this)">FORM VIEW</div>
          <div class="tab" onclick="switchJsonTab('raw',this)">RAW JSON</div>
        </div>
        <div class="tab-pane active" id="json-form-pane">
          <div id="json-form-fields" style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;"></div>
          <div style="margin-top:.8rem;display:flex;gap:.5rem;">
            <button class="btn btn-green" onclick="saveJsonForm()">💾 SAVE CHANGES</button>
            <span id="json-save-msg" style="font-size:.65rem;color:var(--text3);margin-left:.5rem;"></span>
          </div>
        </div>
        <div class="tab-pane" id="json-raw-pane">
          <textarea class="code" id="json-raw-editor" rows="25" spellcheck="false"></textarea>
          <div style="margin-top:.5rem;">
            <button class="btn btn-green" onclick="saveJsonRaw()">💾 SAVE RAW JSON</button>
          </div>
        </div>
      </div>

      <!-- ══════ MARKERS PAGE ══════ -->
      <div class="page" id="page-markers">
        <div class="section-head">FREQUENCY MARKERS EDITOR</div>
        <div style="margin-bottom:.8rem;display:flex;gap:.5rem;flex-wrap:wrap;">
          <button class="btn btn-green" onclick="addMarker()">+ ADD MARKER</button>
          <button class="btn btn-amber" onclick="saveMarkers()">💾 SAVE MARKERS</button>
          <button class="btn btn-blue" onclick="loadMarkers()">↻ RELOAD</button>
          <span id="markers-save-msg" style="font-size:.65rem;color:var(--text3);margin:auto 0;"></span>
        </div>
        <div class="card" style="overflow-x:auto;">
          <table class="markers">
            <thead>
              <tr>
                <th>FREQUENCY (Hz)</th><th>NAME</th><th>MODE</th><th>COLOR</th><th>ACTION</th>
              </tr>
            </thead>
            <tbody id="markers-tbody"></tbody>
          </table>
        </div>
        <div style="margin-top:.8rem;">
          <div class="card-header"><div class="dot"></div>RAW JSON PREVIEW</div>
          <textarea class="code" id="markers-raw" rows="10" readonly style="opacity:.7;"></textarea>
        </div>
      </div>

      <!-- ══════ LOG VIEWER PAGE ══════ -->
      <div class="page" id="page-logs">
        <div class="section-head">LOG VIEWER</div>
        <div style="display:flex;gap:.5rem;margin-bottom:.7rem;flex-wrap:wrap;">
          <button class="btn btn-blue" onclick="loadLogs()">↻ REFRESH LOGS</button>
          <button class="btn btn-green" id="auto-refresh-btn" onclick="toggleAutoRefresh()">⏵ AUTO REFRESH</button>
          <button class="btn btn-red" onclick="clearLogView()">✕ CLEAR LOGS</button>
        </div>
        <div class="log-box" id="main-log" style="height:550px;"></div>
      </div>

      <!-- ══════ CHAT HISTORY PAGE ══════ -->
      <div class="page" id="page-chat">
        <div class="section-head">CHAT HISTORY</div>
        <div style="display:flex;gap:.5rem;margin-bottom:.7rem;">
          <button class="btn btn-blue" onclick="loadChat()">↻ REFRESH</button>
          <button class="btn btn-red" onclick="clearChat()">✕ CLEAR HISTORY</button>
        </div>
        <div class="chat-log" id="chat-log">Loading...</div>
      </div>

      <!-- ══════ SETTINGS PAGE ══════ -->
      <div class="page" id="page-settings">
        <div class="section-head">ADMIN SETTINGS</div>
        <div class="grid grid-2" style="margin-bottom:1rem;">
          <div class="card">
            <div class="card-header"><div class="dot"></div>CHANGE PASSWORD</div>
            <form onsubmit="changePassword(event)">
              <div style="margin-bottom:.6rem;">
                <label style="font-size:.65rem;color:var(--text3);display:block;margin-bottom:.3rem;">CURRENT PASSWORD</label>
                <input type="password" id="old-pwd" style="width:100%;">
              </div>
              <div style="margin-bottom:.6rem;">
                <label style="font-size:.65rem;color:var(--text3);display:block;margin-bottom:.3rem;">NEW PASSWORD</label>
                <input type="password" id="new-pwd" style="width:100%;">
              </div>
              <div style="margin-bottom:.8rem;">
                <label style="font-size:.65rem;color:var(--text3);display:block;margin-bottom:.3rem;">CONFIRM NEW PASSWORD</label>
                <input type="password" id="new-pwd2" style="width:100%;">
              </div>
              <button type="submit" class="btn btn-green">🔑 UPDATE PASSWORD</button>
            </form>
          </div>
          <div class="card">
            <div class="card-header"><div class="dot"></div>SDR BASE DIRECTORY</div>
            <p style="color:var(--text2);font-size:.75rem;margin-bottom:.6rem;">Path to PhantomSDR-Plus installation:</p>
            <input type="text" id="sdr-dir" style="width:100%;margin-bottom:1rem;" placeholder="/path/to/PhantomSDR-Plus">
            <div class="card-header" style="margin:.4rem 0;">
              <div class="dot" style="background:var(--green);box-shadow:0 0 6px var(--green);"></div>
              DEFAULT START SCRIPT
            </div>
            <select class="script-select" id="default-start-sel" style="width:100%;margin-bottom:.8rem;"></select>
            <div class="card-header" style="margin:.4rem 0;">
              <div class="dot" style="background:var(--red);box-shadow:0 0 6px var(--red);"></div>
              DEFAULT STOP SCRIPT
            </div>
            <select class="script-select" id="default-stop-sel" style="width:100%;margin-bottom:.8rem;"></select>
            <button class="btn btn-amber" onclick="saveSettings()">💾 SAVE SETTINGS</button>
            <div id="settings-msg" style="margin-top:.5rem;font-size:.7rem;color:var(--text3);"></div>
          </div>
        </div>
      </div>

    </div><!-- /content -->
  </div><!-- /main -->
</div><!-- /layout -->

<!-- Mobile bottom navigation bar -->
<nav class="bottom-nav" id="bottom-nav">
  <a href="#" onclick="showPage('dashboard',this);return false;" class="active" data-page="dashboard">
    <span class="bi">⬡</span><span>DASH</span>
  </a>
  <a href="#" onclick="showPage('config',this);return false;" data-page="config">
    <span class="bi">⚙</span><span>CONFIG</span>
  </a>
  <a href="#" onclick="showPage('markers',this);return false;" data-page="markers">
    <span class="bi">◉</span><span>MARKERS</span>
  </a>
  <a href="#" onclick="showPage('logs',this);return false;" data-page="logs">
    <span class="bi">▤</span><span>LOGS</span>
  </a>
  <a href="#" onclick="showPage('settings',this);return false;" data-page="settings">
    <span class="bi">◧</span><span>MORE</span>
  </a>
</nav>

<div id="toast"></div>

<script>
// ─── State ──────────────────────────────────────────────────────────────────
let currentPage = 'dashboard';
let autoRefresh = false;
let autoRefreshTimer = null;
let statusTimer = null;

// ─── Page navigation ────────────────────────────────────────────────────────
function showPage(name, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  el.classList.add('active');
  // Get label from either sidebar nav-item or bottom-nav link
  const labelEl = el.querySelector('span:last-child') || el.querySelector('span.bi + span') || el;
  document.getElementById('page-title').textContent = (labelEl.textContent || name).toUpperCase();
  currentPage = name;
  // Sync bottom nav active state
  document.querySelectorAll('.bottom-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === name);
  });
  if (name === 'dashboard') { loadDashboard(); }
  if (name === 'config') { loadConfigList(); }
  if (name === 'siteinfo') { loadJsonList(); }
  if (name === 'markers') { loadMarkers(); }
  if (name === 'logs') { loadLogs(); }
  if (name === 'chat') { loadChat(); }
  if (name === 'settings') { loadSettingsPage(); }
  return false;
}

// ─── Toast ───────────────────────────────────────────────────────────────────
function toast(msg, type='ok') {
  const t = document.getElementById('toast');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = (type==='ok'?'✓ ':'✗ ') + msg;
  t.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ─── Clock ───────────────────────────────────────────────────────────────────
function updateClock() {
  document.getElementById('clock').textContent = new Date().toLocaleTimeString('en-GB');
}
setInterval(updateClock, 1000); updateClock();

// ─── Status polling ──────────────────────────────────────────────────────────
async function updateStatus() {
  try {
    const r = await fetch('/admin/api/status');
    const d = await r.json();
    const pill = document.getElementById('sdr-status');
    const dot  = pill ? pill.querySelector('.status-dot') : null;
    if (pill && dot) {
      if (d.process && d.process.running) {
        pill.className = 'status-pill online'; dot.className = 'status-dot online';
        pill.querySelector('span').textContent = 'ONLINE';
        document.getElementById('stat-status').textContent = 'RUNNING';
        document.getElementById('stat-status').style.color = 'var(--green)';
      } else {
        pill.className = 'status-pill offline'; dot.className = 'status-dot offline';
        pill.querySelector('span').textContent = 'OFFLINE';
        document.getElementById('stat-status').textContent = 'STOPPED';
        document.getElementById('stat-status').style.color = 'var(--red)';
      }
    }
    const pidEl = document.getElementById('stat-pid');
    if (pidEl && d.process) pidEl.textContent = 'PID: ' + (d.process.pid || '--');
    const s = d.system;
    if (s && s.cpu !== undefined && s.cpu !== 'N/A') {
      document.getElementById('stat-cpu').textContent  = s.cpu + '%';
      setBar('bar-cpu', s.cpu);
      document.getElementById('stat-mem').textContent  = s.mem_used + ' / ' + s.mem_total + ' GB';
      setBar('bar-mem', s.mem_pct);
      document.getElementById('stat-disk').textContent = s.disk_used + ' / ' + s.disk_total + ' GB';
      setBar('bar-disk', s.disk_pct);
      const tempEl = document.getElementById('stat-temp');
      if (tempEl) {
        if (s.temp !== null && s.temp !== undefined) {
          tempEl.textContent = s.temp + '\u00b0C';
          setBar('bar-temp', Math.min(100, Math.max(0, (s.temp - 20) / 80 * 100)));
        } else { tempEl.textContent = 'N/A'; }
      }
    }
    const tbody = document.getElementById('top-procs-tbody');
    if (tbody) {
      if (d.top_procs && d.top_procs.length > 0) {
        tbody.innerHTML = '';
        d.top_procs.forEach(proc => {
          const cc = proc.cpu > 50 ? 'cpu-hi' : proc.cpu > 20 ? 'cpu-med' : 'cpu-ok';
          const tr = document.createElement('tr');
          tr.innerHTML =
            `<td style="color:var(--text3)">${proc.pid}</td>` +
            `<td style="color:var(--text)">${proc.name}</td>` +
            `<td style="color:var(--text3)">${proc.user||''}</td>` +
            `<td class="${cc}">${proc.cpu}%</td>` +
            `<td class="mem-col">${proc.mem}%</td>`;
          tbody.appendChild(tr);
        });
      } else {
        tbody.innerHTML = '<tr><td colspan="5" style="color:var(--text3);text-align:center;">No data</td></tr>';
      }
    }
  } catch(e) { console.error('updateStatus:', e); }
}
function setBar(id, pct) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.width = pct + '%';
  el.className = 'bar-fill' + (pct>85?' danger':pct>65?' warn':'');
}

statusTimer = setInterval(updateStatus, 3000);
updateStatus();

// ─── Dashboard & Terminal ────────────────────────────────────────────────────
let _dashLogTimer = null;
let _termCwd  = '';
let _termHist = [];
let _termIdx  = -1;

async function loadDashboard() {
  updateStatus();
  loadLogs('dash-log');
  if (_dashLogTimer) clearInterval(_dashLogTimer);
  _dashLogTimer = setInterval(() => {
    if (currentPage === 'dashboard') loadLogs('dash-log');
    else { clearInterval(_dashLogTimer); _dashLogTimer = null; }
  }, 5000);
  // Set terminal cwd to sdr base dir
  if (!_termCwd) {
    try {
      const cfg = await fetch('/admin/api/settings').then(r => r.json());
      _termCwd = cfg.sdr_base_dir || '/home/sv1btl/PhantomSDR-Plus';
    } catch(e) { _termCwd = '/home/sv1btl/PhantomSDR-Plus'; }
    termUpdatePrompt();
  }
}

function termUpdatePrompt() {
  const el = document.getElementById('term-cwd');
  if (el && _termCwd) {
    const parts = _termCwd.replace(/\/+$/, '').split('/');
    el.textContent = parts.slice(-2).join('/') || _termCwd;
  }
}

function termPrint(text, cls) {
  const out = document.getElementById('term-output');
  if (!out) return;
  if (text === '__CLEAR__') { out.innerHTML = ''; return; }
  const div = document.createElement('div');
  if (cls === 'cmd') {
    div.style.cssText = 'color:var(--amber);margin-top:.3rem;font-weight:bold;';
  } else if (cls === 'err') {
    div.style.cssText = 'color:#ff6666;';
  } else {
    div.style.cssText = 'color:var(--text);';
  }
  div.textContent = text;
  out.appendChild(div);
  out.scrollTop = out.scrollHeight;
}

function termClear() {
  const out = document.getElementById('term-output');
  if (out) out.innerHTML = '';
}

async function termRun() {
  const inp = document.getElementById('term-input');
  if (!inp) return;
  const cmd = inp.value.trim();
  if (!cmd) return;
  inp.value = '';
  _termHist.unshift(cmd);
  if (_termHist.length > 100) _termHist.pop();
  _termIdx = -1;
  termPrint('$ ' + cmd, 'cmd');
  try {
    const r = await fetch('/admin/api/terminal/exec', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({cmd: cmd, cwd: _termCwd})
    });
    if (!r.ok) { termPrint('HTTP error: ' + r.status, 'err'); return; }
    const d = await r.json();
    if (d.cwd && d.cwd !== _termCwd) {
      _termCwd = d.cwd;
      termUpdatePrompt();
    }
    if (d.output) termPrint(d.output, d.ok ? '' : 'err');
  } catch(ex) {
    termPrint('Network error: ' + ex.message, 'err');
  }
}

function termKey(e) {
  const inp = document.getElementById('term-input');
  if (!inp) return;
  if (e.key === 'Enter') {
    e.preventDefault(); termRun();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (_termIdx < _termHist.length - 1) { _termIdx++; inp.value = _termHist[_termIdx]; }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (_termIdx > 0) { _termIdx--; inp.value = _termHist[_termIdx]; }
    else { _termIdx = -1; inp.value = ''; }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const out = document.getElementById('term-output');
  if (out) out.addEventListener('click', () => {
    const inp = document.getElementById('term-input');
    if (inp) inp.focus();
  });
});


// ─── File Editor ─────────────────────────────────────────────────────────────
let configFiles = {};

async function loadConfigList() {
  const r = await fetch('/admin/api/editable-files');
  configFiles = await r.json();
  const sel = document.getElementById('config-file-sel');
  sel.innerHTML = '<option value="">-- Select file --</option>';
  // Group by extension
  const groups = {};
  Object.keys(configFiles).forEach(rel => {
    const ext = rel.split('.').pop().toLowerCase();
    if (!groups[ext]) groups[ext] = [];
    groups[ext].push(rel);
  });
  const order = ['toml','sh','json','html','cpp','h','txt'];
  [...order, ...Object.keys(groups).filter(e => !order.includes(e))].forEach(ext => {
    if (!groups[ext]) return;
    const og = document.createElement('optgroup');
    og.label = '.' + ext.toUpperCase();
    groups[ext].forEach(rel => {
      const o = document.createElement('option');
      o.value = rel; o.textContent = rel;
      sel.appendChild(o);
    });
    sel.appendChild(og);
  });
}

async function loadConfigFile() {
  const sel = document.getElementById('config-file-sel');
  const name = sel.value;
  if (!name) return;
  document.getElementById('config-filepath').textContent = configFiles[name] || name;
  const r = await fetch('/admin/api/read-file?path=' + encodeURIComponent(configFiles[name]));
  const d = await r.json();
  document.getElementById('config-editor').value = d.content || '';
}

async function saveConfigFile() {
  const sel = document.getElementById('config-file-sel');
  const name = sel.value;
  const content = document.getElementById('config-editor').value;
  const r = await fetch('/admin/api/write-file', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({path: configFiles[name], content})
  });
  const d = await r.json();
  const msg = document.getElementById('config-save-msg');
  if (d.ok) { toast('Config saved'); msg.textContent = '✓ Saved at ' + new Date().toLocaleTimeString(); msg.style.color = 'var(--green)'; }
  else { toast(d.msg, 'err'); msg.textContent = '✗ ' + d.msg; msg.style.color = 'var(--red)'; }
}

// ─── JSON / Site Info Editor ─────────────────────────────────────────────────
let jsonFiles = {};
let currentJsonData = {};
let currentJsonPath = '';

async function loadJsonList() {
  const r = await fetch('/admin/api/json-files');
  jsonFiles = await r.json();
  const sel = document.getElementById('json-file-sel');
  sel.innerHTML = '';
  Object.keys(jsonFiles).forEach(name => {
    const o = document.createElement('option');
    o.value = name; o.textContent = name;
    sel.appendChild(o);
  });
  if (Object.keys(jsonFiles).length > 0) loadJsonFile();
}

async function loadJsonFile() {
  const sel = document.getElementById('json-file-sel');
  const name = sel.value;
  if (!name) return;
  currentJsonPath = jsonFiles[name];
  const r = await fetch('/admin/api/read-file?path=' + encodeURIComponent(currentJsonPath));
  const d = await r.json();
  const raw = d.content || '{}';
  document.getElementById('json-raw-editor').value = raw;
  try {
    currentJsonData = JSON.parse(raw);
    renderJsonForm(currentJsonData);
  } catch(e) {
    document.getElementById('json-form-fields').innerHTML = '<p style="color:var(--red)">Invalid JSON: ' + e.message + '</p>';
  }
}

function renderJsonForm(data) {
  const container = document.getElementById('json-form-fields');
  container.innerHTML = '';
  Object.entries(data).forEach(([key, val]) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:.2rem;';
    const label = document.createElement('label');
    label.style.cssText = 'font-size:.6rem;color:var(--text3);letter-spacing:.1em;';
    label.textContent = key.toUpperCase();

    let input;
    if (typeof val === 'boolean') {
      input = document.createElement('select');
      input.className = 'script-select';
      input.style.marginBottom = '0';
      input.innerHTML = `<option value="true" ${val?'selected':''}>true</option><option value="false" ${!val?'selected':''}>false</option>`;
    } else if (typeof val === 'number') {
      input = document.createElement('input');
      input.type = 'number'; input.value = val;
      input.style.width = '100%';
    } else if (typeof val === 'object') {
      input = document.createElement('textarea');
      input.className = 'code';
      input.style.minHeight = '60px';
      input.style.width = '100%';
      input.value = JSON.stringify(val, null, 2);
    } else {
      input = document.createElement('input');
      input.type = 'text'; input.value = val;
      input.style.width = '100%';
    }
    input.dataset.key = key;
    wrap.appendChild(label);
    wrap.appendChild(input);
    container.appendChild(wrap);
  });
}

function getJsonFormData() {
  const container = document.getElementById('json-form-fields');
  const result = {};
  container.querySelectorAll('[data-key]').forEach(el => {
    const key = el.dataset.key;
    const orig = currentJsonData[key];
    if (typeof orig === 'boolean') result[key] = el.value === 'true';
    else if (typeof orig === 'number') result[key] = Number(el.value);
    else if (typeof orig === 'object') { try { result[key] = JSON.parse(el.value); } catch { result[key] = el.value; } }
    else result[key] = el.value;
  });
  return result;
}

function switchJsonTab(tab, el) {
  document.querySelectorAll('#page-siteinfo .tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#page-siteinfo .tab-pane').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('json-' + tab + '-pane').classList.add('active');
  if (tab === 'raw') {
    // Sync form → raw
    try {
      const d = getJsonFormData();
      document.getElementById('json-raw-editor').value = JSON.stringify(d, null, 2);
    } catch(e) {}
  }
}

async function saveJsonForm() {
  const data = getJsonFormData();
  const content = JSON.stringify(data, null, 2);
  const r = await fetch('/admin/api/write-file', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({path: currentJsonPath, content})
  });
  const d = await r.json();
  const msg = document.getElementById('json-save-msg');
  if (d.ok) { toast('JSON saved'); msg.textContent = '✓ Saved'; msg.style.color = 'var(--green)'; }
  else { toast(d.msg, 'err'); msg.textContent = '✗ ' + d.msg; msg.style.color = 'var(--red)'; }
}

async function saveJsonRaw() {
  const content = document.getElementById('json-raw-editor').value;
  try { JSON.parse(content); } catch(e) { toast('Invalid JSON: ' + e.message, 'err'); return; }
  const r = await fetch('/admin/api/write-file', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({path: currentJsonPath, content})
  });
  const d = await r.json();
  if (d.ok) toast('JSON saved'); else toast(d.msg, 'err');
}

// ─── Markers Editor ──────────────────────────────────────────────────────────
let markersData = [];
let markersPath = '';

async function loadMarkers() {
  const r = await fetch('/admin/api/markers');
  const d = await r.json();
  markersData = d.data || [];
  markersPath = d.path || '';
  renderMarkersTable();
}

function renderMarkersTable() {
  const tbody = document.getElementById('markers-tbody');
  tbody.innerHTML = '';
  markersData.forEach((m, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" value="${m.frequency||m.freq||''}" data-i="${i}" data-f="frequency"></td>
      <td><input type="text" value="${m.name||m.label||''}" data-i="${i}" data-f="name"></td>
      <td><input type="text" value="${m.mode||m.modulation||''}" data-i="${i}" data-f="mode"></td>
      <td><input type="text" value="${m.color||''}" data-i="${i}" data-f="color" style="width:80px"></td>
      <td><button class="btn btn-red" style="padding:.2rem .5rem;font-size:.7rem;" onclick="deleteMarker(${i})">✕</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', () => {
      const i = parseInt(inp.dataset.i);
      const f = inp.dataset.f;
      if (!markersData[i]) return;
      markersData[i][f] = f === 'frequency' ? (isNaN(Number(inp.value)) ? inp.value : Number(inp.value)) : inp.value;
      document.getElementById('markers-raw').value = JSON.stringify(markersData, null, 2);
    });
  });
  document.getElementById('markers-raw').value = JSON.stringify(markersData, null, 2);
}

function addMarker() {
  markersData.push({frequency: 0, name: "New Marker", mode: "AM", color: "#00ff41"});
  renderMarkersTable();
}

function deleteMarker(i) {
  markersData.splice(i, 1);
  renderMarkersTable();
}

async function saveMarkers() {
  const r = await fetch('/admin/api/markers', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({data: markersData})
  });
  const d = await r.json();
  const msg = document.getElementById('markers-save-msg');
  if (d.ok) { toast('Markers saved'); msg.textContent = '✓ Saved'; msg.style.color = 'var(--green)'; }
  else { toast(d.msg, 'err'); msg.textContent = '✗ ' + d.msg; msg.style.color = 'var(--red)'; }
}

// ─── Logs ────────────────────────────────────────────────────────────────────
async function loadLogs(targetId) {
  const id = targetId || 'main-log';
  const r = await fetch('/admin/api/logs');
  const d = await r.json();
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '';
  (d.lines || []).forEach(line => {
    const div = document.createElement('div');
    div.className = line.match(/error|fail|crash/i) ? 'log-line-err' :
                    line.match(/warn/i) ? 'log-line-warn' :
                    line.match(/ok|success|started/i) ? 'log-line-ok' : '';
    div.textContent = line;
    el.appendChild(div);
  });
  el.scrollTop = el.scrollHeight;
}

async function clearLogView() {
  // Stop auto-refresh first
  if (autoRefresh) toggleAutoRefresh();
  // Clear server-side log buffer + log file
  await fetch('/admin/api/logs/clear', {method: 'POST'});
  // Clear both UI elements
  const el = document.getElementById('main-log');
  if (el) el.innerHTML = '';
  const dash = document.getElementById('dash-log');
  if (dash) dash.innerHTML = '';
  toast('Logs cleared');
}

function toggleAutoRefresh() {
  autoRefresh = !autoRefresh;
  const btn = document.getElementById('auto-refresh-btn');
  if (autoRefresh) {
    btn.textContent = '⏸ STOP AUTO';
    btn.className = 'btn btn-red';
    autoRefreshTimer = setInterval(() => loadLogs('main-log'), 3000);
  } else {
    btn.textContent = '⏵ AUTO REFRESH';
    btn.className = 'btn btn-green';
    clearInterval(autoRefreshTimer);
  }
}

// ─── Chat ────────────────────────────────────────────────────────────────────
async function loadChat() {
  const r = await fetch('/admin/api/chat');
  const d = await r.json();
  const el = document.getElementById('chat-log');
  el.innerHTML = '';
  (d.messages || []).forEach(m => {
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span class="chat-time">[${m.time||'?'}]</span> <span class="chat-nick">&lt;${m.nick||'?'}&gt;</span> ${escHtml(m.msg||'')}`;
    el.appendChild(div);
  });
  if (!d.messages?.length) el.textContent = 'No chat history found.';
  el.scrollTop = el.scrollHeight;
}

async function clearChat() {
  if (!confirm('Clear chat history?')) return;
  const r = await fetch('/admin/api/chat/clear', {method:'POST'});
  const d = await r.json();
  if (d.ok) { toast('Chat cleared'); loadChat(); } else toast(d.msg, 'err');
}

// ─── Settings ────────────────────────────────────────────────────────────────
async function loadSettingsPage() {
  const r = await fetch('/admin/api/settings');
  const d = await r.json();
  document.getElementById('sdr-dir').value = d.sdr_base_dir || '';
  // Populate start/stop script selectors
  const sh = await fetch('/admin/api/scripts').then(r => r.json());
  const all = sh.all || [];
  ['default-start-sel','default-stop-sel'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">-- None --</option>';
    all.forEach(s => {
      const o = document.createElement('option');
      o.value = s; o.textContent = s;
      sel.appendChild(o);
    });
  });
  if (document.getElementById('default-start-sel'))
    document.getElementById('default-start-sel').value = d.start_script || '';
  if (document.getElementById('default-stop-sel'))
    document.getElementById('default-stop-sel').value = d.stop_script || '';
}

async function saveSettings() {
  const dir   = document.getElementById('sdr-dir').value.trim();
  const start = document.getElementById('default-start-sel')?.value || '';
  const stop  = document.getElementById('default-stop-sel')?.value || '';
  const r = await fetch('/admin/api/settings', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({sdr_base_dir: dir, start_script: start, stop_script: stop})
  });
  const d = await r.json();
  if (d.ok) {
    toast('Settings saved');
    document.getElementById('settings-msg').textContent = 'Saved';
  } else toast(d.msg, 'err');
}

async function changePassword(e) {
  e.preventDefault();
  const old = document.getElementById('old-pwd').value;
  const n = document.getElementById('new-pwd').value;
  const n2 = document.getElementById('new-pwd2').value;
  if (n !== n2) { toast('Passwords do not match', 'err'); return; }
  if (n.length < 4) { toast('Password too short (min 4)', 'err'); return; }
  const r = await fetch('/admin/api/change-password', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({old, new_pwd: n})
  });
  const d = await r.json();
  if (d.ok) { toast('Password changed'); document.getElementById('old-pwd').value=''; document.getElementById('new-pwd').value=''; document.getElementById('new-pwd2').value=''; }
  else toast(d.msg, 'err');
}
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── Init ────────────────────────────────────────────────────────────────────
loadDashboard();
</script>
</body>
</html>"""

# ─── Routes ────────────────────────────────────────────────────────────────────

@app.route("/admin")
@app.route("/admin/")
def login():
    if session.get("authenticated"):
        return redirect(url_for("dashboard"))
    return render_template_string(LOGIN_HTML, error=None)

@app.route("/admin", methods=["POST"])
@app.route("/admin/", methods=["POST"])
def login_post():
    pwd = request.form.get("password", "")
    if check_password(pwd):
        session["authenticated"] = True
        session.permanent = True
        return redirect(url_for("dashboard"))
    return render_template_string(LOGIN_HTML, error="Invalid access code. Try again.")

@app.route("/admin/dashboard")
@login_required
def dashboard():
    from flask import make_response
    resp = make_response(render_template_string(MAIN_HTML))
    resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    resp.headers['Pragma'] = 'no-cache'
    return resp

@app.route("/admin/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))

# ── API: Status ──────────────────────────────────────────────────────────────
@app.route("/admin/api/status")
@login_required
def api_status():
    return jsonify({
        "process": get_process_status(),
        "system": get_system_stats(),
        "top_procs": get_top_processes(),
    })

# ── API: Scripts ─────────────────────────────────────────────────────────────
@app.route("/admin/api/scripts")
@login_required
def api_scripts():
    sh = get_allowed_scripts()
    return jsonify({"start": [k for k in sh if "start" in k.lower()],
                    "stop":  [k for k in sh if "stop"  in k.lower()],
                    "all":   sorted(sh.keys()), "paths": sh})

@app.route("/admin/api/scripts/all-discovered")
@login_required
def api_scripts_all():
    sh     = find_sh_files()
    result = [{"label": k, "path": v, "enabled": True} for k, v in sh.items()]
    return jsonify({"scripts": result})

@app.route("/admin/api/scripts/debug")
@login_required
def api_scripts_debug():
    """Shows exactly which scripts were found and where it looked."""
    base = get_sdr_dir()
    sh = find_sh_files()
    freq_dir = base / "frequencylist"
    return jsonify({
        "base_dir": str(base),
        "frequencylist_exists": freq_dir.exists(),
        "frequencylist_contents": [str(f.name) for f in sorted(freq_dir.glob("*"))] if freq_dir.exists() else [],
        "found_scripts": sh,
    })

# ── API: Server control ───────────────────────────────────────────────────────
@app.route("/admin/api/terminal/exec", methods=["POST"])
@login_required
def api_terminal_exec():
    data = request.get_json(silent=True) or {}
    cmd  = (data.get("cmd") or "").strip()
    # Use sdr_base_dir as default cwd, fallback to /tmp
    default_cwd = str(get_sdr_dir())
    cwd = (data.get("cwd") or "").strip() or default_cwd
    if not os.path.isdir(cwd):
        cwd = default_cwd
    if not cmd:
        return jsonify({"ok": True, "output": "", "cwd": cwd})
    if cmd == "cd" or cmd.startswith("cd ") or cmd == "cd~":
        target = cmd[2:].strip() or "~"
        # Expand ~ and env vars
        target = os.path.expanduser(target)
        target = os.path.expandvars(target)
        if target == "-":
            target = os.environ.get("OLDPWD", cwd)
        new_dir = os.path.realpath(os.path.join(cwd, target) if not os.path.isabs(target) else target)
        if os.path.isdir(new_dir):
            return jsonify({"ok": True, "output": "", "cwd": new_dir})
        return jsonify({"ok": False, "output": "cd: no such directory: " + target, "cwd": cwd})
    if cmd.strip() in ("clear", "cls"):
        return jsonify({"ok": True, "output": "__CLEAR__", "cwd": cwd})
    try:
        result = subprocess.run(
            cmd, shell=True, cwd=cwd,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, timeout=300, env={**os.environ, "TERM": "xterm"}
        )
        return jsonify({"ok": result.returncode == 0, "output": result.stdout or "(no output)", "cwd": cwd})
    except subprocess.TimeoutExpired:
        return jsonify({"ok": False, "output": "(command timed out after 300s)", "cwd": cwd})
    except Exception as ex:
        return jsonify({"ok": False, "output": str(ex), "cwd": cwd})
# ── API: Config files ─────────────────────────────────────────────────────────
@app.route("/admin/api/config-files")
@login_required
def api_config_files():
    return jsonify(get_allowed_configs())

@app.route("/admin/api/editable-files")
@login_required
def api_editable_files():
    return jsonify(find_editable_files())

@app.route("/admin/api/config-files/all-discovered")
@login_required
def api_config_files_all():
    cf     = find_config_files_all()
    result = [{"label": k, "path": v, "enabled": True} for k, v in cf.items()]
    return jsonify({"configs": result})

@app.route("/admin/api/json-files")
@login_required
def api_json_files():
    return jsonify(find_json_files())

@app.route("/admin/api/read-file")
@login_required
def api_read_file():
    path = request.args.get("path", "")
    if not path:
        return jsonify({"content": ""})
    # Security: must be within base dir
    base = get_sdr_dir()
    try:
        p = Path(path).resolve()
        p.relative_to(base)  # raises if outside
    except (ValueError, Exception):
        return jsonify({"error": "Access denied"}), 403
    content = read_file_safe(path)
    return jsonify({"content": content})

@app.route("/admin/api/write-file", methods=["POST"])
@login_required
def api_write_file():
    data = request.get_json(silent=True) or {}
    path = data.get("path", "")
    content = data.get("content", "")
    base = get_sdr_dir()
    try:
        p = Path(path).resolve()
        p.relative_to(base)
    except (ValueError, Exception):
        return jsonify({"ok": False, "msg": "Access denied"}), 403
    ok, msg = write_file_safe(path, content)
    return jsonify({"ok": ok, "msg": msg})

# ── API: Markers ──────────────────────────────────────────────────────────────
@app.route("/admin/api/markers", methods=["GET", "POST"])
@login_required
def api_markers():
    base = get_sdr_dir()
    markers_file = base / "markers.json"
    if request.method == "GET":
        try:
            raw = json.loads(read_file_safe(markers_file))
            # Support both {"markers": [...]} and plain [...] formats
            if isinstance(raw, dict) and "markers" in raw:
                data = raw["markers"]
            elif isinstance(raw, list):
                data = raw
            else:
                data = []
        except Exception:
            data = []
        return jsonify({"data": data, "path": str(markers_file)})
    else:
        req = request.get_json(silent=True) or {}
        data = req.get("data", [])
        # Preserve the {"markers": [...]} wrapper format
        output = json.dumps({"markers": data}, indent=2)
        ok, msg = write_file_safe(markers_file, output)
        return jsonify({"ok": ok, "msg": msg})

# ── API: Logs ─────────────────────────────────────────────────────────────────
@app.route("/admin/api/logs")
@login_required
def api_logs():
    lines = tail_log(150)
    return jsonify({"lines": lines})

@app.route("/admin/api/logs/clear", methods=["POST"])
@login_required
def api_logs_clear():
    global log_buffer
    # Clear in-memory buffer
    with log_lock:
        log_buffer.clear()
    # Truncate the log file on disk
    base = get_sdr_dir()
    log_candidates = [
        base / "logwebsdr.txt",
    ]
    cleared = []
    for lf in log_candidates:
        if lf.exists():
            try:
                with open(lf, "w") as f:
                    f.write("")
                cleared.append(str(lf))
            except Exception as e:
                cleared.append(str(lf) + " (error: " + str(e) + ")")
    return jsonify({"ok": True, "cleared": cleared})

# ── API: Chat ─────────────────────────────────────────────────────────────────
@app.route("/admin/api/chat")
@login_required
def api_chat():
    base = get_sdr_dir()
    chat_file = base / "chat_history.txt"
    messages = []
    if chat_file.exists():
        try:
            with open(chat_file, encoding="utf-8", errors="replace") as f:
                for line in f.readlines()[-200:]:
                    line = line.strip()
                    if not line:
                        continue
                    # Try parse: [time] <nick> msg  or  nick: msg
                    m = re.match(r'\[([^\]]+)\]\s+<([^>]+)>\s+(.*)', line)
                    if m:
                        messages.append({"time": m.group(1), "nick": m.group(2), "msg": m.group(3)})
                    else:
                        m2 = re.match(r'(\S+):\s+(.*)', line)
                        if m2:
                            messages.append({"time": "", "nick": m2.group(1), "msg": m2.group(2)})
                        else:
                            messages.append({"time": "", "nick": "system", "msg": line})
        except Exception as e:
            messages = [{"time": "", "nick": "error", "msg": str(e)}]
    return jsonify({"messages": messages})

@app.route("/admin/api/chat/clear", methods=["POST"])
@login_required
def api_chat_clear():
    base = get_sdr_dir()
    chat_file = base / "chat_history.txt"
    try:
        with open(chat_file, "w") as f:
            f.write("")
        return jsonify({"ok": True, "msg": "Chat history cleared"})
    except Exception as e:
        return jsonify({"ok": False, "msg": str(e)})

# ── API: Settings ─────────────────────────────────────────────────────────────
@app.route("/admin/api/settings", methods=["GET", "POST"])
@login_required
def api_settings():
    cfg = load_admin_config()
    if request.method == "GET":
        return jsonify({
            "sdr_base_dir":  cfg.get("sdr_base_dir", str(BASE_DIR)),
            "start_script":  cfg.get("start_script", ""),
            "stop_script":   cfg.get("stop_script", ""),
        })
    data = request.get_json(silent=True) or {}
    if "sdr_base_dir" in data:
        cfg["sdr_base_dir"] = data["sdr_base_dir"]
    if "start_script" in data:
        cfg["start_script"] = data["start_script"]
    if "stop_script" in data:
        cfg["stop_script"] = data["stop_script"]
    save_admin_config(cfg)
    return jsonify({"ok": True})

@app.route("/admin/api/change-password", methods=["POST"])
@login_required
def api_change_password():
    data = request.get_json(silent=True) or {}
    old = data.get("old", "")
    new_pwd = data.get("new_pwd", "")
    if not check_password(old):
        return jsonify({"ok": False, "msg": "Current password incorrect"})
    if len(new_pwd) < 4:
        return jsonify({"ok": False, "msg": "Password too short"})
    cfg = load_admin_config()
    cfg["password_hash"] = hash_password(new_pwd)
    save_admin_config(cfg)
    return jsonify({"ok": True})

# ─── Startup ───────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    if not ADMIN_CONFIG_FILE.exists():
        save_admin_config(DEFAULT_CONFIG)
        print("[PhantomSDR Admin] Created admin_config.json with default password 'admin'")

    cfg = load_admin_config()
    port = cfg.get("port", ADMIN_PORT)
    bind = ADMIN_BIND

    print("=" * 60)
    print("  PhantomSDR-Plus Admin Panel  [INTERNAL SERVICE]")
    print(f"  Listening : http://{bind}:{port}/admin")
    print(f"  Public URL: via proxy.py -> http://SERVER_IP:8900/admin")
    print(f"  Password  : admin  (CHANGE THIS IMMEDIATELY)")
    print(f"  Dir       : {BASE_DIR}")
    print("=" * 60)
    print("  NOTE: Run proxy.py separately to share the main SDR port.")
    print("        spectrumserver must use port 8902 in your .toml")
    print("=" * 60)

    if not HAS_PSUTIL:
        print("[WARN] psutil not installed - system stats limited. pip3 install psutil")
    if tomllib is None:
        print("[WARN] tomllib unavailable - TOML editing is text-only")

    app.run(host=bind, port=port, debug=False, threaded=True)
