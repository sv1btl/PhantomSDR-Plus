#include "utils.h"

#include <algorithm>
#include <cctype>
#include <cstring>
#include <string>

#include <boost/uuid/uuid.hpp>
#include <boost/uuid/uuid_generators.hpp>
#include <boost/uuid/uuid_io.hpp>

static boost::uuids::random_generator uuid_generator =
    boost::uuids::random_generator();

std::string generate_unique_id() {
    return boost::uuids::to_string(uuid_generator());
}
// ── Client address helpers ──────────────────────────────────────────────────
// Declared in utils.h; these used to be file-static copies in signal.cpp and
// events.cpp. They are shared now because the per-IP connection limiter in
// websocket.cpp has to key on exactly the same string the stats log records.

std::string strip_port(const std::string &endpoint) {
    if (endpoint.empty()) return endpoint;
    // IPv6 bracketed form: [2001:db8::1]:12345
    if (endpoint.front() == '[') {
        const auto close = endpoint.find(']');
        if (close != std::string::npos)
            return endpoint.substr(1, close - 1);
        return endpoint; // malformed — return as-is
    }
    // IPv4 (or bare IPv6): strip everything after the last colon that is followed
    // only by digits (i.e. the port), but leave a bare IPv6 address intact.
    const auto colon = endpoint.rfind(':');
    if (colon == std::string::npos) return endpoint;
    const std::string after = endpoint.substr(colon + 1);
    const bool all_digits = !after.empty() &&
        std::all_of(after.begin(), after.end(),
                    [](unsigned char c){ return std::isdigit(c); });
    return all_digits ? endpoint.substr(0, colon) : endpoint;
}

bool is_loopback_ip(const std::string &ip) {
    if (ip == "127.0.0.1" || ip == "::1") return true;
    // IPv4-mapped form: "::ffff:127." covers the entire 127.0.0.0/8 range
    if (ip.find("::ffff:127.") == 0)      return true;
    return false;
}

std::string normalize_client_ip(const std::string &endpoint) {
    std::string ip = strip_port(endpoint);
    // "::ffff:1.2.3.4" is the same host as "1.2.3.4" — a dual-stack listener
    // sees IPv4 clients in the mapped form, and both spellings reach this
    // server depending on whether the client came through proxy.py (which
    // passes X-Forwarded-For unmapped) or straight to the listening port.
    if (ip.rfind("::ffff:", 0) == 0 && ip.find('.') != std::string::npos)
        ip = ip.substr(7);
    return ip;
}

// Chat text goes out as WebSocket TEXT frames, which must be valid UTF-8 —
// browsers fail the whole /chat socket on a bad byte, so one broken line in
// the history blanks the chat window for every listener. A plain byte
// substr() at the length limit used to cut an emoji in half and do exactly
// that. These helpers keep every string we store or send well-formed.
// Drop any byte that is not part of a well-formed UTF-8 sequence
// (stray continuation bytes, truncated sequences, overlongs, surrogates).
std::string utf8_sanitize(const std::string& in) {
    std::string out;
    out.reserve(in.size());
    const auto* p = reinterpret_cast<const unsigned char*>(in.data());
    const size_t n = in.size();
    size_t i = 0;
    while (i < n) {
        unsigned char c = p[i];
        size_t len = 0;
        unsigned char lo = 0x80, hi = 0xBF;   // allowed range of the 2nd byte
        if (c < 0x80)                 len = 1;
        else if (c >= 0xC2 && c <= 0xDF) len = 2;
        else if (c == 0xE0)           { len = 3; lo = 0xA0; }
        else if (c == 0xED)           { len = 3; hi = 0x9F; }
        else if (c >= 0xE1 && c <= 0xEF) len = 3;
        else if (c == 0xF0)           { len = 4; lo = 0x90; }
        else if (c == 0xF4)           { len = 4; hi = 0x8F; }
        else if (c >= 0xF1 && c <= 0xF3) len = 4;
        bool ok = len > 0 && i + len <= n;
        for (size_t k = 1; ok && k < len; ++k) {
            unsigned char b = p[i + k];
            ok = (k == 1) ? (b >= lo && b <= hi) : (b >= 0x80 && b <= 0xBF);
        }
        if (ok) {
            out.append(in, i, len);
            i += len;
        } else {
            ++i;   // skip the bad lead byte and resync on the next one
        }
    }
    return out;
}

// Cut a well-formed UTF-8 string to at most max_chars characters (code
// points, not bytes), so a Greek message gets the same length as an English
// one and a character is never split.
std::string utf8_truncate(const std::string& s, size_t max_chars) {
    size_t chars = 0;
    for (size_t i = 0; i < s.size(); ++i) {
        if ((static_cast<unsigned char>(s[i]) & 0xC0) == 0x80) continue;
        if (chars++ == max_chars) return s.substr(0, i);
    }
    return s;
}

// ── Listener identity ───────────────────────────────────────────────────────
// The name or callsign a listener types into the page. It is shown to
// everyone in /users and on the waterfall, so it is cleaned to plain text
// here, once, and every page can print it as it comes.

bool is_reserved_name(const std::string &name) {
    static const char *const reserved[] = {
        "admin", "operator", "host", "root", "system", "moderator"};
    std::string lower;
    for (unsigned char c : name) lower += static_cast<char>(std::tolower(c));
    for (const char *r : reserved)
        if (lower == r) return true;
    return false;
}

std::string clean_listener_name(const std::string &raw) {
    // Control characters, quotes, backslash and HTML brackets are dropped, so
    // the name is safe inside a JSON string and in any page that shows it.
    std::string out;
    for (unsigned char c : utf8_sanitize(raw)) {
        if (c < 0x20 || c == 0x7F) continue;
        if (c == '"' || c == '\\' || c == '<' || c == '>' || c == '&') continue;
        out += static_cast<char>(c);
    }
    const auto first = out.find_first_not_of(' ');
    if (first == std::string::npos) return "";
    out = out.substr(first, out.find_last_not_of(' ') - first + 1);
    // The WebSDR's rule: a name or callsign of at most 10 characters with no
    // spaces, otherwise none at all (never cut short). It must also hold a
    // letter or digit, so "***" or "---" is no name either.
    if (out.find(' ') != std::string::npos) return "";
    if (utf8_truncate(out, 10) != out) return "";
    bool has_alnum = false;
    for (unsigned char c : out)
        if (std::isalnum(c) || c >= 0x80) { has_alnum = true; break; }
    if (!has_alnum) return "";
    // The page's placeholder names ("anonymous1234", the old "user1234") mean
    // nobody typed anything, and a reserved name is refused as in the chat.
    if (is_reserved_name(out)) return "";
    auto numbered = [&](const char *prefix) {
        const size_t n = std::strlen(prefix);
        if (out.size() <= n) return false;
        for (size_t i = 0; i < n; ++i)
            if (std::tolower(static_cast<unsigned char>(out[i])) != prefix[i]) return false;
        for (size_t i = n; i < out.size(); ++i)
            if (!std::isdigit(static_cast<unsigned char>(out[i]))) return false;
        return true;
    };
    if (numbered("anonymous") || numbered("user")) return "";
    return out;
}
