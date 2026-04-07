#include "audio.h"

#include <boost/container/small_vector.hpp>
#include <iostream>
#include <cstdlib>
#include <algorithm>


AudioEncoder::AudioEncoder(websocketpp::connection_hdl hdl,
                           PacketSender &sender)
    : hdl{hdl}, sender{sender} {
    set_data(0, 0, 0, 0, 0, 1);
}

AudioEncoder::~AudioEncoder() = default;

void AudioEncoder::set_data(uint64_t frame_num, int l, double m, int r,
                            double pwr, int channels) {
    packet["frame_num"] = frame_num;
    packet["l"] = l;
    packet["m"] = m;
    packet["r"] = r;
    packet["pwr"] = pwr;
    packet["channels"] = channels;
}

int AudioEncoder::send(const void *buffer, size_t bytes, unsigned) {
    try {
        packet["data"] = json::binary(
            std::vector<uint8_t>((uint8_t *)buffer, (uint8_t *)buffer + bytes));
        auto cbor = json::to_cbor(packet);
        sender.send_binary_packet(hdl, cbor.data(), cbor.size());


        
        return 0;
    } catch (...) {
        return 1;
    }
}

FLAC__StreamEncoderWriteStatus
FlacEncoder::write_callback(const FLAC__byte buffer[], size_t bytes, unsigned,
                            unsigned current_frame) {
    return send(buffer, bytes, current_frame)
               ? FLAC__STREAM_ENCODER_WRITE_STATUS_FATAL_ERROR
               : FLAC__STREAM_ENCODER_WRITE_STATUS_OK;
}

int FlacEncoder::process(int32_t *data, size_t size) {
    return this->process_interleaved(data, size);
}

int FlacEncoder::finish_encoder() { return this->finish(); }

FlacEncoder::~FlacEncoder() { this->finish(); }

#ifdef HAS_LIBOPUS

OpusAudioEncoder::OpusAudioEncoder(websocketpp::connection_hdl hdl,
                                   PacketSender &sender,
                                   int samplerate,
                                   int channels)
    : AudioEncoder(hdl, sender)
{
    opus_channels = (channels == 2) ? 2 : 1;
    int err = 0;

    // Opus accepts 8k–48k; clamp to be safe (valid values: 8k, 12k, 16k, 24k, 48k)
    samplerate = std::clamp(samplerate, 8000, 48000);
    opus_samplerate = samplerate;

    encoder = opus_encoder_create(opus_samplerate, opus_channels, OPUS_APPLICATION_AUDIO, &err);
    if (!encoder || err != OPUS_OK) {
        std::cerr << "OpusAudioEncoder: failed to create encoder, err=" << err << "\n";
        encoder = nullptr;
        frame_size = 0;
        return;
    }

    // 20 ms frame (or 10ms = 480 samples at 48kHz)
    frame_size = opus_samplerate / 50;  // 20ms frames

    // Bitrate: 128 kbps for stereo, 80 kbps for mono
    int bitrate = (opus_channels == 2) ? 128000 : 80000;
    err = opus_encoder_ctl(encoder, OPUS_SET_BITRATE(bitrate));
    if (err != OPUS_OK) {
        std::cerr << "OpusAudioEncoder: failed to set bitrate, err=" << err << "\n";
    }
    
    // Initialization message commented out - uncomment to debug
    /*
    std::cout << "OpusAudioEncoder initialized: " 
              << opus_samplerate << " Hz, " 
              << opus_channels << " channel(s), "
              << bitrate << " bps\n";
    */
}

int OpusAudioEncoder::process(int32_t *data, size_t size)
{
    if (!encoder || frame_size == 0) {
        return 1;
    }

    // Convert int32 -> int16 with clipping and queue it
    // `size` is frames-per-channel; input is interleaved if opus_channels==2.
    const size_t total = size * (size_t)opus_channels;
    for (size_t i = 0; i < total; ++i) {
        int32_t s = data[i];
        s = std::clamp(s, -32768, 32767);
        partial_frames.emplace_back(static_cast<opus_int16>(s));
    }

    unsigned char packet[4096];  // Increased packet buffer size for stereo

    // Encode as many full frames as we have buffered
    while (partial_frames.size() >= frame_size * (size_t)opus_channels) {
        std::vector<opus_int16> frame(
            partial_frames.begin(),
            partial_frames.begin() + frame_size * (size_t)opus_channels
        );

        opus_int32 packet_sz =
            opus_encode(encoder,
                        frame.data(),
                        static_cast<int>(frame_size),
                        packet,
                        static_cast<opus_int32>(sizeof(packet)));

        if (packet_sz > 1) {
            // Use AudioEncoder base to send over WebSocket/CBOR
            send(packet, static_cast<size_t>(packet_sz), 0);
        } else if (packet_sz < 0) {
            std::cerr << "OpusAudioEncoder: encode error " << packet_sz << "\n";
        }

        partial_frames.erase(
            partial_frames.begin(),
            partial_frames.begin() + frame_size * (size_t)opus_channels
        );
    }

    return 0;
}

OpusAudioEncoder::~OpusAudioEncoder()
{
    if (encoder) {
        opus_encoder_destroy(encoder);
        encoder = nullptr;
    }
}

int OpusAudioEncoder::finish_encoder()
{
    // Could flush remaining samples here if you really want
    return 0;
}

#endif // HAS_LIBOPUS


void FlacEncoder::configure_flac(FlacMode mode) {
    int blocksize = 1024;   // Default Balanced 1024; ~21ms @48k
    int level = 5;          // Default Balanced 5;
    int max_lpc = 10;       // Default Balanced 10;
    int min_part = 2;       // Default Balanced 2;
    int max_part = 4;       // Default Balanced 4;;
    bool verify = false;
    const char* apod = "tukey(0.5);partial_tukey(0.5);punchout_tukey(0.3)";
    bool mid_side = true;
    bool loose_ms = true;

    switch (mode) {
        case FlacMode::UltraLowLatency:
            blocksize = 256; // ~5.3ms @48k
            level = 3;
            max_lpc = 8;
            min_part = 2;
            max_part = 3;
            apod = "tukey(0.5);partial_tukey(0.5)";
            break;
        case FlacMode::LowBandwidth:
            blocksize = 4096; // ~85ms @48k
            level = 8;
            max_lpc = 12;
            min_part = 3;
            max_part = 6;
            apod = "tukey(0.5);partial_tukey(0.5);punchout_tukey(0.3);bartlett;flattop";
            break;
        case FlacMode::Balanced:
        default:
            break;
    }

    this->set_verify(verify);
    this->set_streamable_subset(true);
    this->set_compression_level(level);
    this->set_blocksize(blocksize);
    this->set_do_mid_side_stereo(mid_side);
    this->set_loose_mid_side_stereo(loose_ms);
    this->set_apodization(apod);
    this->set_max_lpc_order(max_lpc);
    this->set_min_residual_partition_order(min_part);
    this->set_max_residual_partition_order(max_part);
}