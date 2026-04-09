#include "compression.h"
#include "spectrumserver.h"

#include <filesystem>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>
#include <algorithm>
#include <cctype>
#include <chrono>
#include <mutex>
#include <curl/curl.h>
#include <nlohmann/json.hpp>

#include <boost/algorithm/string.hpp>

std::unordered_map<std::string, std::string> mime_types{
    {".html", "text/html"},
    {".js", "text/javascript"},
    {".css", "text/css"},
    {".wasm", "application/wasm"},
};

static size_t dxspots_write_cb(char *ptr, size_t size, size_t nmemb, void *userdata) {
    if (!userdata) return 0;
    auto *out = static_cast<std::string *>(userdata);
    out->append(ptr, size * nmemb);
    return size * nmemb;
}

static std::string trim_copy(const std::string &s) {
    const auto b = std::find_if_not(s.begin(), s.end(), [](unsigned char c){ return std::isspace(c); });
    const auto e = std::find_if_not(s.rbegin(), s.rend(), [](unsigned char c){ return std::isspace(c); }).base();
    if (b >= e) return "";
    return std::string(b, e);
}

static std::string url_decode(const std::string &src) {
    std::string out;
    out.reserve(src.size());
    for (size_t i = 0; i < src.size(); ++i) {
        if (src[i] == '%' && i + 2 < src.size()) {
            const std::string hex = src.substr(i + 1, 2);
            char *end = nullptr;
            long v = std::strtol(hex.c_str(), &end, 16);
            if (end && *end == '\0') {
                out.push_back(static_cast<char>(v));
                i += 2;
                continue;
            }
        } else if (src[i] == '+') {
            out.push_back(' ');
            continue;
        }
        out.push_back(src[i]);
    }
    return out;
}

static std::string get_query_param(const std::string &resource, const std::string &key) {
    const auto qpos = resource.find('?');
    if (qpos == std::string::npos || qpos + 1 >= resource.size()) return "";

    const std::string query = resource.substr(qpos + 1);
    std::stringstream ss(query);
    std::string part;
    while (std::getline(ss, part, '&')) {
        const auto eq = part.find('=');
        const std::string k = url_decode(part.substr(0, eq));
        if (k != key) continue;
        if (eq == std::string::npos) return "";
        return url_decode(part.substr(eq + 1));
    }
    return "";
}

static bool looks_like_json(const std::string &s) {
    for (char c : s) {
        if (std::isspace(static_cast<unsigned char>(c))) continue;
        return c == '[' || c == '{';
    }
    return false;
}

static std::string normalize_band(std::string band) {
    band = trim_copy(band);
    boost::algorithm::to_upper(band);
    if (band == "ALL" || band == "*" || band.empty()) return "ALL";
    if (!band.empty() && band.back() == 'M') band.pop_back();
    return band;
}

static bool band_matches(double f, const std::string &band_in) {
    const std::string band = normalize_band(band_in);
    if (band.empty() || band == "ALL") return true;
    if (band == "160") return f >= 1800  && f <= 2000;
    if (band == "80")  return f >= 3500  && f <= 4000;
    if (band == "60")  return f >= 5300  && f <= 5410;
    if (band == "40")  return f >= 7000  && f <= 7300;
    if (band == "30")  return f >= 10100 && f <= 10150;
    if (band == "20")  return f >= 14000 && f <= 14350;
    if (band == "17")  return f >= 18068 && f <= 18168;
    if (band == "15")  return f >= 21000 && f <= 21450;
    if (band == "12")  return f >= 24890 && f <= 24990;
    if (band == "10")  return f >= 28000 && f <= 29700;
    if (band == "6")   return f >= 50000 && f <= 54000;
    return true;
}

static bool json_value_to_double(const nlohmann::json &j, double &out) {
    try {
        if (j.is_number_float() || j.is_number_integer() || j.is_number_unsigned()) {
            out = j.get<double>();
            return true;
        }
        if (j.is_string()) {
            const auto s = trim_copy(j.get<std::string>());
            if (s.empty()) return false;
            out = std::stod(s);
            return true;
        }
    } catch (...) {}
    return false;
}

static std::string json_value_to_string(const nlohmann::json &obj, const std::vector<std::string> &keys) {
    for (const auto &key : keys) {
        try {
            if (!obj.contains(key)) continue;
            const auto &v = obj.at(key);
            if (v.is_string()) return v.get<std::string>();
            if (v.is_number_integer()) return std::to_string(v.get<long long>());
            if (v.is_number_unsigned()) return std::to_string(v.get<unsigned long long>());
            if (v.is_number_float()) {
                std::ostringstream os;
                os << v.get<double>();
                return os.str();
            }
        } catch (...) {}
    }
    return "";
}

static std::string extract_utc_hhmm(const std::string &time_str) {
    if (time_str.size() >= 4) {
        if (std::isdigit(static_cast<unsigned char>(time_str[0])) &&
            std::isdigit(static_cast<unsigned char>(time_str[1])) &&
            std::isdigit(static_cast<unsigned char>(time_str[2])) &&
            std::isdigit(static_cast<unsigned char>(time_str[3]))) {
            return time_str.substr(0, 4);
        }
    }
    for (size_t i = 0; i + 4 < time_str.size(); ++i) {
        if (std::isdigit(static_cast<unsigned char>(time_str[i])) &&
            std::isdigit(static_cast<unsigned char>(time_str[i + 1])) &&
            time_str[i + 2] == ':' &&
            std::isdigit(static_cast<unsigned char>(time_str[i + 3])) &&
            std::isdigit(static_cast<unsigned char>(time_str[i + 4]))) {
            return time_str.substr(i, 2) + time_str.substr(i + 3, 2);
        }
    }
    return "";
}

static nlohmann::json normalize_json_spots(const nlohmann::json &in, const std::string &band, int limit_num) {
    nlohmann::json out = nlohmann::json::array();
    if (!in.is_array()) return out;

    for (const auto &s : in) {
        try {
            if (!s.is_object()) continue;

            std::string dx_call = json_value_to_string(s, {"dx_call", "dx", "call", "callsign"});
            std::string de_call = json_value_to_string(s, {"de_call", "spotter", "de", "spotter_call"});
            std::string info = json_value_to_string(s, {"info", "comment", "remarks", "message"});
            std::string time = json_value_to_string(s, {"time", "spot_time", "timestamp", "utc"});
            std::string dx_country = json_value_to_string(s, {"dx_country", "country"});

            double frequency = 0.0;
            bool have_freq = false;
            if (s.contains("frequency")) have_freq = json_value_to_double(s["frequency"], frequency);
            if (!have_freq && s.contains("freq")) have_freq = json_value_to_double(s["freq"], frequency);
            if (!have_freq && s.contains("mhz")) {
                double mhz = 0.0;
                if (json_value_to_double(s["mhz"], mhz)) {
                    frequency = mhz * 1000.0;
                    have_freq = true;
                }
            }

            if (dx_call.empty() || !have_freq || frequency <= 0.0 || !band_matches(frequency, band)) continue;

            out.push_back({
                {"dx_call", dx_call},
                {"de_call", de_call},
                {"frequency", frequency},
                {"time", time},
                {"time_utc_hhmm", extract_utc_hhmm(time)},
                {"info", info},
                {"dx_country", dx_country}
            });

            if ((int)out.size() >= limit_num) break;
        } catch (...) {}
    }
    return out;
}

static nlohmann::json parse_dxsummit_text(const std::string &text, const std::string &band, int limit_num) {
    nlohmann::json out = nlohmann::json::array();
    std::stringstream ss(text);
    std::string line;

    while (std::getline(ss, line)) {
        line = trim_copy(line);
        if (line.empty()) continue;

        std::istringstream ls(line);
        std::vector<std::string> tokens;
        std::string tok;
        while (ls >> tok) tokens.push_back(tok);
        if (tokens.size() < 3) continue;

        double freq = 0.0;
        size_t freq_idx = std::string::npos;
        for (size_t i = 1; i < tokens.size(); ++i) {
            try {
                double v = std::stod(tokens[i]);
                if (v > 1000.0 && v < 60000.0) {
                    freq = v;
                    freq_idx = i;
                    break;
                }
            } catch (...) {}
        }
        if (freq_idx == std::string::npos || freq_idx == 0 || freq_idx + 1 >= tokens.size()) continue;
        if (!band_matches(freq, band)) continue;

        std::string de_call = tokens[0];
        std::string dx_call = tokens[freq_idx + 1];
        std::string time = "";
        std::string comment = "";

        const size_t n = tokens.size();
        if (n >= 3 &&
            tokens[n - 3].size() == 4 &&
            std::all_of(tokens[n - 3].begin(), tokens[n - 3].end(),
                        [](unsigned char c) { return std::isdigit(c); })) {
            time = tokens[n - 3] + " " + tokens[n - 2] + " " + tokens[n - 1];
            for (size_t i = freq_idx + 2; i + 3 < n; ++i) {
                if (!comment.empty()) comment += " ";
                comment += tokens[i];
            }
        } else {
            for (size_t i = freq_idx + 2; i < n; ++i) {
                if (!comment.empty()) comment += " ";
                comment += tokens[i];
            }
        }

        out.push_back({
            {"dx_call", dx_call},
            {"de_call", de_call},
            {"frequency", freq},
            {"time", time},
            {"time_utc_hhmm", extract_utc_hhmm(time)},
            {"info", comment},
            {"dx_country", ""}
        });

        if ((int)out.size() >= limit_num) break;
    }

    return out;
}

std::string get_mime_type(std::string &extension) {
    auto it = mime_types.find(extension);
    std::string mime_type;
    if (it == mime_types.end()) {
        mime_type = "text/plain";
    } else {
        mime_type = it->second;
    }
    return mime_type;
}

void broadcast_server::on_http(connection_hdl hdl) {
    m_server.set_access_channels(websocketpp::log::alevel::none);
    server::connection_ptr con = m_server.get_con_from_hdl(hdl);
    std::string resource = con->get_resource();

    if (resource.rfind("/api/dxspots", 0) == 0) {
        std::string band = normalize_band(get_query_param(resource, "band"));
        std::string limit = get_query_param(resource, "limit");

        int limit_num = 30;
        try {
            if (!limit.empty()) limit_num = std::stoi(limit);
        } catch (...) {
            limit_num = 30;
        }
        if (limit_num < 1) limit_num = 1;
        if (limit_num > 200) limit_num = 200;

        static std::mutex cache_mtx;
        static std::string cached_band = "";
        static int cached_limit = 0;
        static std::string cached_body = "[]";
        static auto cached_at = std::chrono::steady_clock::time_point{};
        {
            std::scoped_lock lk(cache_mtx);
            const auto now = std::chrono::steady_clock::now();
            if (cached_limit == limit_num &&
                cached_band == band &&
                cached_at.time_since_epoch().count() != 0 &&
                std::chrono::duration_cast<std::chrono::seconds>(now - cached_at).count() < 10) {
                con->append_header("Content-Type", "application/json");
                con->append_header("Cache-Control", "no-store");
                con->append_header("Access-Control-Allow-Origin", "*");
                con->set_body(cached_body);
                con->set_status(websocketpp::http::status_code::ok);
                return;
            }
        }

        const std::vector<std::string> urls = {
            "https://www.dxsummit.fi/text/dx25.html",
            "http://www.dxsummit.fi/text/dx25.html",
            "https://new.dxsummit.fi/api/v1/spots?limit=" + std::to_string(limit_num),
            "http://new.dxsummit.fi/api/v1/spots?limit=" + std::to_string(limit_num),
            "http://www.dxsummit.fi/api/v1/spots?limit=" + std::to_string(limit_num)
        };

        CURL *curl = curl_easy_init();
        nlohmann::json normalized = nlohmann::json::array();

        if (curl) {
            for (const auto &url : urls) {
                std::string response_data;
                long http_code = 0;

                curl_easy_reset(curl);
                curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
                curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, dxspots_write_cb);
                curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response_data);
                curl_easy_setopt(curl, CURLOPT_TIMEOUT, 10L);
                curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 5L);
                curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
                curl_easy_setopt(curl, CURLOPT_MAXREDIRS, 5L);
                curl_easy_setopt(curl, CURLOPT_ACCEPT_ENCODING, "");
                curl_easy_setopt(curl, CURLOPT_USERAGENT, "PhantomSDR-Plus/1.0");
                curl_easy_setopt(curl, CURLOPT_NOSIGNAL, 1L);

                struct curl_slist *headers = nullptr;
                headers = curl_slist_append(headers, "Accept: application/json, text/plain, text/html, */*");
                curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

                CURLcode rc = curl_easy_perform(curl);
                if (rc == CURLE_OK) {
                    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &http_code);
                    if (http_code < 400 && !response_data.empty()) {
                        try {
                            if (looks_like_json(response_data)) {
                                normalized = normalize_json_spots(nlohmann::json::parse(response_data), band, limit_num);
                            } else {
                                normalized = parse_dxsummit_text(response_data, band, limit_num);
                            }
                        } catch (...) {
                            normalized = parse_dxsummit_text(response_data, band, limit_num);
                        }

                        if (normalized.is_array()) {
                            curl_slist_free_all(headers);
                            break;
                        }
                    }
                }

                curl_slist_free_all(headers);
            }

            curl_easy_cleanup(curl);
        }

        if (!normalized.is_array()) normalized = nlohmann::json::array();

        const std::string body = normalized.dump();
        {
            std::scoped_lock lk(cache_mtx);
            cached_band = band;
            cached_limit = limit_num;
            cached_body = body;
            cached_at = std::chrono::steady_clock::now();
        }

        con->append_header("Content-Type", "application/json");
        con->append_header("Cache-Control", "no-store");
        con->append_header("Access-Control-Allow-Origin", "*");
        con->set_body(body);
        con->set_status(websocketpp::http::status_code::ok);
        return;
    }

    std::ifstream file;
    std::string filename = std::filesystem::weakly_canonical(std::filesystem::path("/" + resource)).string();
    std::string response;

    filename = filename.substr(0, filename.find("?"));
    if (filename == "/") {
        filename = m_docroot + "/" + "index.html";
    } else {
        filename = m_docroot + "/" + filename.substr(1);
    }

    std::string extension = std::filesystem::path(filename).extension();
    std::string mime_type = get_mime_type(extension);
    con->append_header("content-type", mime_type);
    con->append_header("Connection", "close");

    file.open(filename.c_str(), std::ios::in);
    if (!file) {
        std::stringstream ss;
        ss << "<!doctype html><html><head>"
           << "<title>Error 404 (Resource not found)</title><body>"
           << "<h1>Error 404</h1>"
           << "<p>The requested URL " << resource
           << " was not found on this server.</p>"
           << "</body></head></html>";

        con->append_header("content-type", "text/html");
        con->set_body(ss.str());
        con->set_status(websocketpp::http::status_code::not_found);
        return;
    }

    file.seekg(0, std::ios::end);
    response.reserve(file.tellg());
    file.seekg(0, std::ios::beg);
    response.assign(std::istreambuf_iterator<char>(file), std::istreambuf_iterator<char>());

    std::set<std::string> encodings;
    boost::algorithm::split(encodings, con->get_request_header("accept-encoding"),
                            boost::is_any_of(", "), boost::token_compress_on);
    if (encodings.find("gzip") != encodings.end()) {
        response = Gzip::compress(response);
        con->append_header("Content-Encoding", "gzip");
    }

    con->append_header("Cache-Control", "max-age=30");
    con->set_body(response);
    con->set_status(websocketpp::http::status_code::ok);
}
