#ifndef KIWI_BRIDGE_H
#define KIWI_BRIDGE_H

// ============================================================================
// kiwi_bridge.h — VERSION AVEC RÉACCORDAGE + JOURNALISATION
//
// Leurre protocolaire KiwiSDR pour PhantomSDR-Plus. Format des trames
// validé octet par octet contre un vrai KiwiSDR et re-vérifié avec un
// client tiers réel (AetherSDR) — connexion, handshake, audio, waterfall
// confirmés fonctionnels sur une base 3.8.0 vierge.
//
// RÉACCORDABILITÉ (SND) : "SET mod=<mode> low_cut=<lc> high_cut=<hc>
// freq=<khz>" est traduit en set_audio_range()/set_audio_demodulation(),
// UNIQUEMENT pour une entrée réelle (is_real == true, signal="real" dans
// config.toml). Pour une entrée IQ, la formule bin<->fréquence diffère et
// n'est pas implémentée ici — voir TODO_KIWI_RETUNE_IQ.
//
// JOURNALISATION : chaque étape du réaccordage est tracée dans
// /tmp/kiwi_retune.log via kiwi_debug_log(), sans besoin de terminal
// visible — consultez le fichier après coup avec `cat /tmp/kiwi_retune.log`.
// Coût négligeable, peut rester en place en permanence.
//
// RÉACCORDAGE WATERFALL : "SET zoom=<z> cf=<khz>" ou "SET zoom=<z>
// start=<compteur>" (les deux formats du protocole Kiwi réel sont gérés)
// sont traduits en WaterfallClient::on_window_message(), qui réutilise la
// logique existante de sélection de niveau de sous-échantillonnage.
// ============================================================================

#include "audio.h"
#include "waterfallcompression.h"
#include "client.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <ctime>
#include <fstream>
#include <functional>
#include <iomanip>
#include <sstream>
#include <string>
#include <unordered_map>
#include <vector>

// ----------------------------------------------------------------------------
// Journalisation de debug — /tmp/kiwi_retune.log
// ----------------------------------------------------------------------------

inline void kiwi_debug_log(const std::string &msg) {
    std::ofstream log("/tmp/kiwi_retune.log", std::ios::app);
    if (!log) return;
    auto now = std::chrono::system_clock::now();
    std::time_t t = std::chrono::system_clock::to_time_t(now);
    char buf[32];
    std::strftime(buf, sizeof(buf), "%H:%M:%S", std::localtime(&t));
    log << "[" << buf << "] " << msg << std::endl;
}

// ----------------------------------------------------------------------------
// S-meter calibration
// ----------------------------------------------------------------------------
// Kiwi clients render the meter as dBm = -127 + raw * 0.1, so whatever this
// encoder puts on the wire is displayed verbatim as dBm. Uncalibrated it fed
// raw dBFS into that field, which read S9+ on weak signals.
//
// The meter now uses the SAME quantity the PhantomSDR web UI meter uses --
// the per-packet `pwr` the demodulator hands to every AudioEncoder via
// set_data() -- through the frontend's own formula (audio.js):
//
//     dB = 20 * log10(sqrt(pwr) / 2) + smeter_offset
//
// but that is only the number the web UI starts from, not the one it shows.
// The figure on the page goes through three more stages before a listener
// reads it, and matching them is the whole point of this block:
//
//   App.svelte::_smeterTick()      + input.analog_smeter_offset
//                                  then expanded about -130 dBm by visualGain
//   SMeterDigital.svelte           + VISUAL_DBM_OFFSET
//
// Skipping them left the Kiwi meter reading the raw scale while the page read
// the expanded one. Because visualGain is a SLOPE, the two disagreed by an
// amount that moved with signal strength -- about 13 dB on a strong carrier and
// 6 dB near the noise floor -- so no single offset could have reconciled them.
//
// The constants below mirror the frontend. If the look of the web meter is ever
// retuned, these have to move with it: App.svelte's visualGain and
// SMeterDigital.svelte's VISUAL_DBM_OFFSET are the two to watch.
//
// Note this scale is the web page's, not a physical one: a 10 dB change in
// signal is displayed as 11. That is deliberate -- the receiver's own meter is
// the reference the operator compares against.
//
// The offset is set at startup from input.analog_smeter_offset, the value the
// page's own chain uses; [kiwi_emulation] smeter_offset overrides it if the
// Kiwi meter should differ. Nothing here touches the web UI's own path.
inline double kiwi_smeter_offset_db = 0.0;

inline constexpr double kKiwiSmeterFloorDb  = -130.0;  // App.svelte minDb
inline constexpr double kKiwiSmeterSlope    = 1.1;     // App.svelte visualGain
inline constexpr double kKiwiSmeterVisualDb = 5.0;     // SMeterDigital.svelte

// ----------------------------------------------------------------------------
// Output gain, for Kiwi clients only
//
// The demodulator hands every encoder the same buffer, so a Kiwi client gets
// exactly the PCM a browser gets — measured identical, 57 counts peak on both
// paths at the same frequency and passband. What a browser then does with it,
// and a Kiwi client cannot, is audio.js's whole chain: bass boost, bandpass,
// presence, a compressor with makeup gain and the volume slider. That is the
// entire reason the web page sounds loud and a raw Kiwi stream sounds thin.
//
// This gain closes that gap for Kiwi clients without touching the web path.
// It is applied before the int16 clamp, so it uses the real headroom rather
// than amplifying an already-clamped value; peaks sit around -55 dBFS, so
// there is plenty. 0 dB (no change) unless [kiwi_emulation] audio_gain is set.
// Echelle dB du waterfall Kiwi.
//   kiwi_wf_size_log2 = log2(fft_size) + brightness_offset, c.-a-d. exactement
//   le "power_offset" que power_and_quantize() ajoute au log2 de la puissance.
//   Il faut le retrancher pour retrouver une puissance absolue.
//   kiwi_wf_cal_db est la calibration finale, mesuree contre le S-metre du GUI
//   (deja calibre) — voir la note dans KiwiWfEncoder::send().
inline int    kiwi_wf_size_log2 = 0;
inline double kiwi_wf_cal_db    = 0.0;

// Ceiling on the waterfall rate offered to a Kiwi client, in frames per
// second. 23 is what the KiwiSDR protocol declares as its maximum and what
// clients are built around, so it is the default; the receiver can only
// deliver 2*sps/fft_size anyway and the lower of the two wins. Raise it with
// [kiwi_emulation] wf_fps_max if your client is happy to render faster than
// the protocol promises -- it is the client, not the wire, that decides
// whether that helps or just fills its buffer.
inline double kiwi_wf_fps_cap = 23.0;

inline double kiwi_audio_gain_db = 0.0;
inline double kiwi_audio_gain_lin = 1.0;   // derived from the dB at startup

// ----------------------------------------------------------------------------
// Reconnaissance de chemin d'URL
// ----------------------------------------------------------------------------

inline bool kiwi_path_ends_with(const std::string &path,
                                 const std::string &suffix) {
    return path.size() >= suffix.size() &&
           path.compare(path.size() - suffix.size(), suffix.size(), suffix) == 0;
}

inline bool is_kiwi_snd_path(const std::string &path) {
    return path.find("/kiwi/") != std::string::npos &&
           kiwi_path_ends_with(path, "/SND");
}

inline bool is_kiwi_wf_path(const std::string &path) {
    if (path.find("/kiwi/") == std::string::npos) return false;
    return kiwi_path_ends_with(path, "/W/F") ||
           kiwi_path_ends_with(path, "W%2FF") ||
           kiwi_path_ends_with(path, "W%2fF");
}

// ----------------------------------------------------------------------------
// Look-ahead peak limiter
//
// audio_gain is what makes a Kiwi client as loud as the web page, but the two
// are not free of each other: past about 50 dB on this receiver the peaks reach
// full scale, and the int16 clamp then flattens them. That is hard clipping --
// measured at 60 dB it destroyed 1-2% of samples, and a client's own AGC cannot
// put back what the clamp threw away.
//
// This limiter lets the gain go where the operator wants it without that.
// Every sample is delayed by kLookahead while the gain is computed from the
// sample that has NOT been emitted yet, so by the time a loud one comes out the
// gain has already come down to meet it -- peaks fold instead of flattening.
//
// Below the threshold the gain is exactly 1.0 and the multiply is exact for
// every value an int16 can hold, so a receiver that is not driving the audio
// hard gets bit-for-bit what it got before the limiter existed.
class KiwiPeakLimiter {
  public:
    KiwiPeakLimiter() : delay_(kLookahead, 0.0) {}

    double process(double x) {
        // Emit the oldest sample; the newest one, still kLookahead away from
        // being heard, is what sets the gain.
        const double out = delay_[pos_];
        delay_[pos_] = x;
        pos_ = (pos_ + 1) % kLookahead;

        // Peak-hold envelope, not the bare sample. Following one sample lets
        // the envelope fall again the instant a loud one has passed, so the
        // gain starts releasing while that sample is still inside the delay
        // line and has not been heard yet -- which is how peaks escaped. Holding
        // the peak and bleeding it away keeps the gain down until the loud
        // passage has actually been emitted.
        const double a = std::fabs(x);
        env_ = std::max(a, env_ * kEnvDecay);
        const double target = (env_ > kThreshold) ? kThreshold / env_ : 1.0;

        // Down fast enough to converge well inside the look-ahead window, back
        // up slowly so speech is not pumped. One-pole either way.
        gain_ += (target - gain_) * (target < gain_ ? kAttack : kRelease);
        return out * gain_;
    }

  private:
    // 4 ms at the 12 kHz the bridge announces. The attack constant converges to
    // ~98% of the target within that window, so overshoot stays well inside the
    // headroom the threshold leaves.
    // 4 ms at the 12 kHz the bridge announces.
    //
    // kAttack matters more than it looks: the gain moves toward its target by
    // that fraction per sample, so it must converge within the 48-sample window
    // or a loud sample is emitted before the gain has come down to meet it. At
    // 0.08 a 4x overshoot still arrived ~5% high and hit the clamp. At 0.20 the
    // residual after 48 samples is 0.8^48, about one part in 70000.
    static constexpr size_t kLookahead = 48;
    static constexpr double kThreshold = 30800.0;    // -0.55 dBFS
    static constexpr double kAttack    = 0.20;
    static constexpr double kRelease   = 0.000833;   // ~100 ms
    static constexpr double kEnvDecay  = 0.999167;   // peak hold, ~100 ms

    std::vector<double> delay_;
    size_t pos_  = 0;
    double gain_ = 1.0;
    double env_  = 0.0;
};

// ----------------------------------------------------------------------------
// KiwiSndEncoder — emballe le PCM démodulé au format de trame "SND" Kiwi
// ----------------------------------------------------------------------------

class KiwiSndEncoder : public AudioEncoder {
  public:
    KiwiSndEncoder(websocketpp::connection_hdl hdl, PacketSender &sender)
        : AudioEncoder(hdl, sender) {
        codec_name = "kiwi_pcm";
    }
    ~KiwiSndEncoder() override = default;

  protected:
    int process(int32_t *data, size_t size) override {
        // ------------------------------------------------------------------
        // TAILLE DE TRAME FIXE POUR LE S-METRE
        //
        // Trouve en lisant le vrai code source d'AetherSDR
        // (src/core/KiwiSdrProtocol.cpp, classifySoundFrame()) :
        //
        //   constexpr int kObservedExtendedSoundFrameBytes = 1034;
        //   constexpr int kServerSoundHeaderBytes = 10;
        //   ...
        //   observation.layout = frame.size() == kObservedExtendedSoundFrameBytes
        //       ? FrameLayout::SndObservedPcm16WithMeter
        //       : FrameLayout::SndPcm16;
        //
        // Autrement dit : AetherSDR n'affiche "observed"/"meter" QUE si la
        // trame SND fait EXACTEMENT 1034 octets (10 octets d'en-tete + 512
        // echantillons 16 bits = 1024 octets de PCM). Toute autre taille est
        // toujours parfaitement lue et jouee (d'ou l'audio impeccable), mais
        // n'est jamais etiquetee comme ayant un S-metre.
        //
        // On accumule donc les echantillons recus (taille variable selon le
        // pipeline PhantomSDR) dans un tampon interne, et on n'emet une trame
        // SND que lorsqu'on a exactement 512 echantillons prets a partir —
        // le format de la trame elle-meme ne change pas du tout.
        // ------------------------------------------------------------------
        for (size_t i = 0; i < size; i++) {
            // Gain first, clamp second: clamping and then amplifying would
            // waste the headroom the clamp just threw away. At unity the
            // multiply is exact for every value an int16 can hold, so a
            // receiver left at 0 dB behaves precisely as it did before.
            double g = static_cast<double>(data[i]) * kiwi_audio_gain_lin;
            // The clamp stays as the last line of defence, but with the limiter
            // ahead of it there should be nothing left for it to cut.
            g = limiter_.process(g);
            int32_t v = std::clamp(static_cast<int32_t>(std::lround(g)),
                                   -32768, 32767);
            pending_samples.push_back(static_cast<int16_t>(v));
        }

        static constexpr size_t SAMPLES_PER_FRAME = 512;
        while (pending_samples.size() >= SAMPLES_PER_FRAME) {
            emit_frame(SAMPLES_PER_FRAME);
        }
        return 0;
    }

    int finish_encoder() override { return 0; }

  private:
    void emit_frame(size_t n) {
        // `pwr` is the demodulator's average power for this block, the exact
        // value the browser meter is driven from; set_data() refreshes it
        // immediately before process() on every call. Reuse it with the
        // frontend's formula so both meters read the same number. Falls back
        // to the old PCM-RMS estimate only if the field is missing.
        double pwr = 0.0;
        if (packet.contains("pwr") && packet["pwr"].is_number()) {
            pwr = packet["pwr"].get<double>();
        }

        double raw_db;
        if (pwr > 0.0) {
            raw_db = 20.0 * std::log10(std::sqrt(pwr) / 2.0);
        } else {
            // Fallback for the case where the demodulator sent no `pwr`.
            // pending_samples has already been through audio_gain and the
            // limiter, so the gain has to come back off or this reads as much
            // too high as the operator has turned the audio up. It is an
            // estimate either way -- limiting is not undone -- but a wrong
            // meter is worse than a rough one.
            double sum_sq = 0.0;
            for (size_t i = 0; i < n; i++) {
                sum_sq += double(pending_samples[i]) * double(pending_samples[i]);
            }
            double rms = n ? std::sqrt(sum_sq / double(n)) : 0.0;
            raw_db = rms > 0.0 ? 20.0 * std::log10(rms / 32768.0) -
                                     kiwi_audio_gain_db
                               : -120.0;
        }

        // The web page's own display chain, reproduced. See the note above.
        const double approx_dbfs =
            kKiwiSmeterFloorDb +
            (raw_db + kiwi_smeter_offset_db - kKiwiSmeterFloorDb) *
                kKiwiSmeterSlope +
            kKiwiSmeterVisualDb;

        // Lissage du S-metre (ballistique façon AGC materiel) — deja en
        // place avant la decouverte de la taille fixe, laisse actif : il
        // n'a rien a voir avec le probleme "observed/meter" (qui ne tenait
        // qu'a la taille de trame) mais reste une amelioration valable en
        // lui-meme, et il est sans risque.
        static constexpr double METER_SMOOTHING_ALPHA = 0.85;
        if (!meter_initialized) {
            smoothed_dbfs = approx_dbfs;
            meter_initialized = true;
        } else {
            smoothed_dbfs = METER_SMOOTHING_ALPHA * smoothed_dbfs +
                            (1.0 - METER_SMOOTHING_ALPHA) * approx_dbfs;
        }

        uint16_t smeter_raw = static_cast<uint16_t>(
            std::clamp((smoothed_dbfs + 127.0) * 10.0, 0.0, 65535.0));

        call_count++;
        if (call_count % 200 == 0) {
            kiwi_debug_log("KiwiSndEncoder::process appele #" +
                           std::to_string(call_count) +
                           " n=" + std::to_string(n) +
                           " pwr=" + [pwr] {
                               // std::to_string gives 6 decimals, and
                               // pwr runs around 1e-9: it would print
                               // a misleading 0.000000.
                               std::ostringstream o;
                               o << std::scientific << std::setprecision(3)
                                 << pwr;
                               return o.str();
                           }() +
                           " approx_dbfs_brut=" + std::to_string(approx_dbfs) +
                           " approx_dbfs_lisse=" + std::to_string(smoothed_dbfs) +
                           " smeter_raw=" + std::to_string(smeter_raw) +
                           " sample0=" + std::to_string(n ? pending_samples[0] : 0));
        }

        std::vector<uint8_t> frame;
        frame.reserve(10 + n * 2);
        frame.push_back('S');
        frame.push_back('N');
        frame.push_back('D');
        frame.push_back(0x00);

        uint32_t seq = seq_counter++;
        frame.push_back(static_cast<uint8_t>(seq & 0xFF));
        frame.push_back(static_cast<uint8_t>((seq >> 8) & 0xFF));
        frame.push_back(static_cast<uint8_t>((seq >> 16) & 0xFF));
        frame.push_back(static_cast<uint8_t>((seq >> 24) & 0xFF));

        frame.push_back(static_cast<uint8_t>((smeter_raw >> 8) & 0xFF));
        frame.push_back(static_cast<uint8_t>(smeter_raw & 0xFF));

        // PCM byte order. Kiwi sound payloads are BIG-endian on the wire
        // unless bit 0x80 of the flags byte is set, and the flags byte above
        // is 0x00. Verified in both clients this bridge targets:
        //   AetherSDR  src/core/KiwiSdrProtocol.cpp
        //              soundFrameLittleEndian(flags) = (flags & 0x80) != 0,
        //              else sample = (p[2i] << 8) | p[2i+1]
        //   kiwiclient kiwi/client.py, SND_FLAG_LITTLE_ENDIAN = 0x80
        //              dtype = '<h' if (camping and LE flag) else '>h'
        // Setting the flag instead would not be portable: kiwiclient honours
        // it only while camping, so it would still read these big-endian.
        for (size_t i = 0; i < n; i++) {
            uint16_t u = static_cast<uint16_t>(pending_samples[i]);
            frame.push_back(static_cast<uint8_t>((u >> 8) & 0xFF));
            frame.push_back(static_cast<uint8_t>(u & 0xFF));
        }

        if (frames_hex_logged < 20) {
            std::ostringstream hex;
            hex << std::hex << std::setfill('0');
            for (size_t i = 0; i < 10 && i < frame.size(); i++) {
                hex << std::setw(2) << static_cast<int>(frame[i]) << " ";
            }
            kiwi_debug_log("SND #" + std::to_string(frames_hex_logged) +
                           "  frame_bytes=" + std::to_string(frame.size()) +
                           "  seq=" + std::to_string(seq) +
                           "  smeter=" + std::to_string(smeter_raw) +
                           "  hex[0:10]=" + hex.str());
            frames_hex_logged++;
        }

        sender.send_binary_packet(hdl, frame.data(), frame.size());

        // Retire les n echantillons qu'on vient d'envoyer, garde le reste
        // (le "reliquat" sous 512 echantillons) pour le prochain appel.
        pending_samples.erase(pending_samples.begin(),
                               pending_samples.begin() + static_cast<long>(n));
    }

    std::vector<int16_t> pending_samples;
    KiwiPeakLimiter      limiter_;
    uint32_t seq_counter{0};
    uint64_t call_count{0};
    double smoothed_dbfs{-120.0};
    bool meter_initialized{false};
    int frames_hex_logged{0};
};

// ----------------------------------------------------------------------------
// KiwiWfEncoder — emballe les magnitudes de waterfall au format "W/F" Kiwi
// ----------------------------------------------------------------------------

class KiwiWfEncoder : public WaterfallEncoder {
  public:
    KiwiWfEncoder(connection_hdl hdl, PacketSender &sender)
        : WaterfallEncoder(hdl, sender) {}
    ~KiwiWfEncoder() override = default;

    int send(const void *buffer, size_t bytes, uint64_t frame_num, int start,
             int stop) override {
        std::vector<uint8_t> frame;
        frame.reserve(16 + bytes);

        frame.push_back('W');
        frame.push_back('/');
        frame.push_back('F');
        frame.push_back(0x20);

        auto push_u32le = [&](uint32_t v) {
            frame.push_back(static_cast<uint8_t>(v & 0xFF));
            frame.push_back(static_cast<uint8_t>((v >> 8) & 0xFF));
            frame.push_back(static_cast<uint8_t>((v >> 16) & 0xFF));
            frame.push_back(static_cast<uint8_t>((v >> 24) & 0xFF));
        };
        push_u32le(0);
        push_u32le(0);
        push_u32le(static_cast<uint32_t>(frame_num));

        // --------------------------------------------------------------
        // Conversion vers l'echelle dB du Kiwi.
        //
        // PhantomSDR stocke chaque bin en int8 :
        //     v = 20*log10(P) + 6.0206*power_offset + 127
        // (power_and_quantize() dans fft_impl.cpp — noter le 20*log10 d'une
        // PUISSANCE, soit le double des dB usuels), avec
        //     power_offset = kiwi_wf_size_log2 - niveau_de_decimation.
        //
        // Un client Kiwi lit un OCTET NON SIGNE et affiche (b - 255) dBm.
        // On recopiait v tel quel : le cast int8 -> uint8 repliait l'echelle
        // (v=-20 devenait 236, soit -19 dBm, tandis qu'un vrai porteur a
        // v=77 restait 77, soit -178 dBm). L'affichage etait donc a la fois
        // sature et inverse. On refait ici le calcul complet :
        //   1. retirer le +127 et le facteur 2 des dB       -> v/2 - 63.5
        //   2. retirer le power_offset, dependant du zoom   -> echelle absolue
        //   3. appliquer la meme calibration que le S-metre -> dBm affichables
        //   4. encoder en b = dBm + 255, borne a [0, 255]   -> monotone
        // --------------------------------------------------------------
        double level = 0.0;
        const double full_span = static_cast<double>(stop - start);
        if (bytes > 0 && full_span > 0.0)
            level = std::round(std::log2(full_span / static_cast<double>(bytes)));
        const double power_offset_db =
            3.0103 * (static_cast<double>(kiwi_wf_size_log2) - level);

        const int8_t *src = static_cast<const int8_t *>(buffer);
        for (size_t i = 0; i < bytes; i++) {
            const double dbm = static_cast<double>(src[i]) * 0.5 - 63.5 -
                               power_offset_db - 6.0206 +
                               kiwi_smeter_offset_db + kiwi_wf_cal_db;
            const long b = std::lround(dbm) + 255;
            frame.push_back(static_cast<uint8_t>(std::clamp(b, 0L, 255L)));
        }

        sender.send_binary_packet(hdl, frame.data(), frame.size());
        return 0;
    }
};

// ----------------------------------------------------------------------------
// Utilitaires de parsing des commandes Kiwi et de correspondance de mode
// ----------------------------------------------------------------------------

inline std::unordered_map<std::string, std::string>
kiwi_parse_set_params(const std::string &msg) {
    std::unordered_map<std::string, std::string> params;
    std::istringstream iss(msg);
    std::string token;
    while (iss >> token) {
        auto eq = token.find('=');
        if (eq != std::string::npos) {
            params[token.substr(0, eq)] = token.substr(eq + 1);
        }
    }
    return params;
}

inline demodulation_mode kiwi_mode_to_demod(const std::string &mode,
                                            bool &recognized) {
    recognized = true;
    if (mode == "usb" || mode == "usn" || mode == "cw") return USB;
    if (mode == "lsb" || mode == "lsn" || mode == "cwn") return LSB;
    if (mode == "am" || mode == "amn" || mode == "sam") return AM;
    if (mode == "nbfm" || mode == "nnfm" || mode == "fm") return FM;
    recognized = false;
    return USB;
}

// ----------------------------------------------------------------------------
// KiwiCommandParser
// ----------------------------------------------------------------------------

class KiwiCommandParser {
  public:
    using RetuneCallback =
        std::function<void(const std::string &, double, double, double)>;

    static void handle_snd_message(
        const std::string &msg, bool &auth_acked,
        const std::function<void(const std::string &)> &send_binary_text,
        const RetuneCallback &on_retune, double bandwidth_hz,
        double center_freq_hz, double adc_clk_hz) {
        if (msg.rfind("SET auth", 0) == 0) {
            if (auth_acked) return;
            auth_acked = true;
            send_binary_text("MSG sample_rate=11998.992747");
            send_binary_text("MSG audio_rate=12000");
            // Un vrai KiwiSDR annonce les trois champs sur la MEME ligne :
            //   MSG center_freq=15000000 bandwidth=30000000 adc_clk_nom=66666600
            // "bandwidth" seul dit au client quelle LARGEUR on couvre mais
            // pas OU elle se trouve ; un client qui construit sa plage de
            // dezoom a partir de "center_freq" n'a alors aucun point
            // d'ancrage et se limite a une fenetre etroite autour de la
            // frequence courante (symptome observe avec AetherSDR, qui ne
            // demandait jamais un zoom < 5, soit 937 kHz sur 30 MHz).
            auto as_int = [](double v) {
                return std::to_string(static_cast<long long>(std::llround(v)));
            };
            send_binary_text("MSG center_freq=" + as_int(center_freq_hz) +
                             " bandwidth=" + as_int(bandwidth_hz) +
                             " adc_clk_nom=" + as_int(adc_clk_hz));
            return;
        }

        if (msg.rfind("SET mod=", 0) == 0) {
            kiwi_debug_log("SET mod recu (brut): " + msg);
            auto params = kiwi_parse_set_params(msg);
            auto it_mod = params.find("mod");
            auto it_freq = params.find("freq");
            if (it_mod == params.end() || it_freq == params.end()) {
                kiwi_debug_log("REJETE: mod ou freq absent du message");
                return;
            }
            try {
                double freq_khz = std::stod(it_freq->second);
                double low_cut = params.count("low_cut")
                                     ? std::stod(params.at("low_cut"))
                                     : -3000.0;
                double high_cut = params.count("high_cut")
                                      ? std::stod(params.at("high_cut"))
                                      : 3000.0;
                kiwi_debug_log("SET mod parse: mod=" + it_mod->second +
                               " freq=" + std::to_string(freq_khz) + "kHz" +
                               " low_cut=" + std::to_string(low_cut) +
                               " high_cut=" + std::to_string(high_cut));
                on_retune(it_mod->second, low_cut, high_cut, freq_khz);
            } catch (const std::exception &e) {
                kiwi_debug_log(std::string("REJETE: exception de parsing: ") +
                               e.what());
            }
            return;
        }

        // ------------------------------------------------------------------
        // CAPTURE DE TOUTE COMMANDE NON RECONNUE (SND)
        //
        // On ne gérait jusqu'ici que "SET auth" et "SET mod=". Un vrai
        // KiwiSDR exige par exemple "SET agc=..." avant de servir l'audio
        // (confirmé par le développeur du KiwiSDR sur le forum officiel) ;
        // un client comme AetherSDR peut envoyer cette commande, ou
        // d'autres, sans qu'on le sache puisqu'on les ignorait en silence.
        // On les journalise ici pour voir la séquence complète, sans rien
        // changer au comportement (on ne fait toujours qu'ignorer ce qu'on
        // ne traite pas).
        // ------------------------------------------------------------------
        kiwi_debug_log("[SND] commande non geree: " + msg);
    }

    // wf_speed -> frames per second, following the KiwiSDR menu
    //   0 = off, 1 = 1 fps, 2 = slow, 3 = medium, 4 = fast (the maximum).
    // A real Kiwi's maximum is 23; ours is whatever the FFT loop produces
    // (2*sps/fft_size), capped at 23 so a client that paces itself from the
    // advertised figure is never fed faster than it expects.
    static double kiwi_wf_speed_to_fps(int speed, double max_fps) {
        switch (speed) {
        case 0:  return 0.0;
        case 1:  return 1.0;
        case 2:  return max_fps / 4.0;
        case 3:  return max_fps / 2.0;
        default: return max_fps;
        }
    }

    static void handle_wf_message(
        const std::string &msg, bool &auth_acked,
        const std::function<void(const std::string &)> &send_binary_text,
        const std::function<void(int, double, bool)> &on_retune_wf,
        double max_fps,
        const std::function<void(double)> &on_wf_speed) {
        if (msg.rfind("SET auth", 0) == 0) {
            if (auth_acked) return;
            auth_acked = true;
            // Advertise the rate we can actually sustain. Claiming 23 while
            // delivering 14 is what made the waterfall and the spectrum look
            // sluggish: a client that scrolls on the advertised cadence runs
            // out of lines and stalls between them.
            const std::string fps =
                std::to_string(static_cast<int>(std::floor(max_fps)));
            send_binary_text(
                "MSG wf_fft_size=1024 wf_fps=" + fps + " wf_fps_max=" + fps +
                " zoom_max=14 "
                "zoom_cap=11 rx_chans=8 wf_chans=3 wf_chans_real=3 "
                "wf_share=1 wf_cal=0 wf_setup");
            return;
        }

        if (msg.rfind("SET wf_speed=", 0) == 0) {
            auto params = kiwi_parse_set_params(msg);
            auto it_speed = params.find("wf_speed");
            if (it_speed == params.end()) return;
            try {
                int speed = std::stoi(it_speed->second);
                double fps = kiwi_wf_speed_to_fps(speed, max_fps);
                kiwi_debug_log("[WF] SET wf_speed=" + std::to_string(speed) +
                               " -> " + std::to_string(fps) + " fps");
                on_wf_speed(fps);
            } catch (const std::exception &e) {
                kiwi_debug_log(std::string("[WF] REJETE: wf_speed illisible: ") +
                               e.what());
            }
            return;
        }

        if (msg.rfind("SET zoom=", 0) == 0) {
            kiwi_debug_log("[WF] SET zoom recu (brut): " + msg);
            auto params = kiwi_parse_set_params(msg);
            auto it_zoom = params.find("zoom");
            if (it_zoom == params.end()) {
                kiwi_debug_log("[WF] REJETE: zoom absent du message");
                return;
            }
            try {
                int zoom = std::stoi(it_zoom->second);
                // Deux formats possibles selon la version Kiwi que le
                // client suppose (on n'annonce pas de version nous-mêmes,
                // donc on gère les deux et on journalise lequel arrive) :
                //   - "cf=<kHz>"      : fréquence centrale, format récent
                //   - "start=<compteur>" : ancien format, nécessite une
                //     conversion via MAX_FREQ/MAX_ZOOM/WF_BINS
                if (params.count("cf")) {
                    double cf_khz = std::stod(params.at("cf"));
                    kiwi_debug_log("[WF] format cf: zoom=" +
                                   std::to_string(zoom) + " cf=" +
                                   std::to_string(cf_khz) + "kHz");
                    on_retune_wf(zoom, cf_khz, true);
                } else if (params.count("start")) {
                    double start_counter = std::stod(params.at("start"));
                    kiwi_debug_log("[WF] format start: zoom=" +
                                   std::to_string(zoom) + " start=" +
                                   std::to_string(start_counter));
                    on_retune_wf(zoom, start_counter, false);
                } else {
                    kiwi_debug_log("[WF] REJETE: ni cf ni start present");
                }
            } catch (const std::exception &e) {
                kiwi_debug_log(std::string("[WF] REJETE: exception de parsing: ") +
                               e.what());
            }
            return;
        }

        // Meme capture que cote SND : voir le commentaire au-dessus de
        // "[SND] commande non geree" pour le pourquoi.
        kiwi_debug_log("[WF] commande non geree: " + msg);
    }
};

#endif
