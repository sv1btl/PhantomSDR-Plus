#include "compression.h"
#include "spectrumserver.h"

#include <filesystem>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>
#include <algorithm>
#include <cctype>
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

static bool band_matches(double f, const std::string &band) {
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

static nlohmann::json normalize_json_spots(const nlohmann::json &in, const std::string &band, int limit_num) {
    nlohmann::json out = nlohmann::json::array();
    if (!in.is_array()) return out;

    for (const auto &s : in) {
        try {
            std::string dx_call, de_call, info, time, dx_country;
            double frequency = 0.0;

            if (s.is_object()) {
                dx_call = s.value("dx_call", s.value("dx", ""));
                de_call = s.value("de_call", s.value("spotter", ""));
                info = s.value("info", s.value("comment", ""));
                time = s.value("time", "");
                dx_country = s.value("dx_country", s.value("country", ""));
                if (s.contains("frequency")) frequency = s["frequency"].get<double>();
                else if (s.contains("freq")) frequency = std::stod(s["freq"].get<std::string>());
            }

            if (dx_call.empty() || frequency <= 0.0 || !band_matches(frequency, band)) continue;

            out.push_back({
                {"dx_call", dx_call},
                {"de_call", de_call},
                {"frequency", frequency},
                {"time", time},
                {"info", info},
                {"dx_country", dx_country}
            });
            if ((int)out.size() >= limit_num) break;
        } catch (...) {}
    }
    return out;
}

// Parse classic DX Summit text lines, e.g.
// F4GYI-@ 7074.0 DB5KV ft8 tnx qso 0819 04 Apr
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
        if (tokens.size() < 6) continue;

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

        if (tokens.size() < 3) continue;
        std::string time = "";
        std::string comment = "";

        // assume trailing "... HHMM DD Mon"
        if (tokens.size() >= 3) {
            const size_t n = tokens.size();
            if (n >= 3 &&
                tokens[n-3].size() == 4 &&
                std::all_of(tokens[n-3].begin(), tokens[n-3].end(), ::isdigit)) {
                time = tokens[n-3] + " " + tokens[n-2] + " " + tokens[n-1];
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
        }

        out.push_back({
            {"dx_call", dx_call},
            {"de_call", de_call},
            {"frequency", freq},
            {"time", time},
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
        std::string band = get_query_param(resource, "band");
        std::string limit = get_query_param(resource, "limit");

        int limit_num = 30;
        try {
            if (!limit.empty()) limit_num = std::stoi(limit);
        } catch (...) {
            limit_num = 30;
        }
        if (limit_num < 1) limit_num = 1;
        if (limit_num > 200) limit_num = 200;

        const std::vector<std::string> urls = {
            "https://www.dxsummit.fi/text/dx25.html",
            "http://www.dxsummit.fi/text/dx25.html",
            "https://new.dxsummit.fi/api/v1/spots?limit=" + std::to_string(limit_num),
            "http://new.dxsummit.fi/api/v1/spots?limit=" + std::to_string(limit_num),
            "http://www.dxsummit.fi/api/v1/spots?limit=" + std::to_string(limit_num)
        };

        CURL *curl = curl_easy_init();
        if (!curl) {
            con->append_header("Content-Type", "application/json");
            con->append_header("Cache-Control", "no-store");
            con->set_body("{\"error\":\"curl init failed\"}");
            con->set_status(websocketpp::http::status_code::internal_server_error);
            return;
        }

        nlohmann::json normalized = nlohmann::json::array();
        CURLcode last_rc = CURLE_OK;
        long last_http_code = 0;

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

            last_rc = curl_easy_perform(curl);
            if (last_rc == CURLE_OK) {
                curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &http_code);
                last_http_code = http_code;

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

                    if (normalized.is_array() && !normalized.empty()) {
                        curl_slist_free_all(headers);
                        break;
                    }
                }
            }

            curl_slist_free_all(headers);
        }

        curl_easy_cleanup(curl);

        if (!normalized.is_array() || normalized.empty()) {
            con->append_header("Content-Type", "application/json");
            con->append_header("Cache-Control", "no-store");
            std::stringstream err;
            err << "{\"error\":\"dx spots unavailable\",\"curl_code\":" << static_cast<int>(last_rc)
                << ",\"http_status\":" << last_http_code << "}";
            con->set_body(err.str());
            con->set_status(websocketpp::http::status_code::bad_gateway);
            return;
        }

        con->append_header("Content-Type", "application/json");
        con->append_header("Cache-Control", "no-store");
        con->append_header("Access-Control-Allow-Origin", "*");
        con->set_body(normalized.dump());
        con->set_status(websocketpp::http::status_code::ok);
        return;
    }

    std::ifstream file;
    std::string filename = std::filesystem::weakly_canonical(
                               std::filesystem::path("/" + resource))
                               .string();
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
    response.assign(std::istreambuf_iterator<char>(file),
                    std::istreambuf_iterator<char>());

    std::set<std::string> encodings;
    boost::algorithm::split(encodings,
                            con->get_request_header("accept-encoding"),
                            boost::is_any_of(", "), boost::token_compress_on);
    if (encodings.find("gzip") != encodings.end()) {
        response = Gzip::compress(response);
        con->append_header("Content-Encoding", "gzip");
    }

    con->append_header("Cache-Control", "max-age=30");
    con->set_body(response);
    con->set_status(websocketpp::http::status_code::ok);
}
