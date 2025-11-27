#include "audio.h"

#include <boost/container/small_vector.hpp>
#include <iostream>
#include <cstdlib>
#include <algorithm>   // ← add this


AudioEncoder::AudioEncoder(websocketpp::connection_hdl hdl,
                           PacketSender &sender)
    : hdl{hdl}, sender{sender} {
    set_data(0, 0, 0, 0, 0);
}

AudioEncoder::~AudioEncoder() = default;

void AudioEncoder::set_data(uint64_t frame_num, int l, double m, int r,
                            double pwr) {
    packet["frame_num"] = frame_num;
    packet["l"] = l;
    packet["m"] = m;
    packet["r"] = r;
    packet["pwr"] = pwr;
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
                                   int samplerate)
    : AudioEncoder(hdl, sender)
{
    int err = 0;

    // Opus accepts 8k–48k; clamp to be safe (valid values: 8k, 12k, 16k, 24k, 48k)
    samplerate = std::min(samplerate, 48000);
    opus_samplerate = samplerate;

    encoder = opus_encoder_create(opus_samplerate, 1, OPUS_APPLICATION_AUDIO, &err);
    if (!encoder || err != OPUS_OK) {
        std::cerr << "OpusAudioEncoder: failed to create encoder, err=" << err << "\n";
        encoder = nullptr;
        frame_size = 0;
        return;
    }

    // 20 ms frame
    frame_size = opus_samplerate / 100;

    // 80 kbps mono – fine for voice / SDR audio
    err = opus_encoder_ctl(encoder, OPUS_SET_BITRATE(80000));
    if (err != OPUS_OK) {
        std::cerr << "OpusAudioEncoder: failed to set bitrate, err=" << err << "\n";
    }

    std::cerr << "OpusAudioEncoder: created, samplerate=" << opus_samplerate
              << " Hz, frame_size=" << frame_size << "\n";
}

int OpusAudioEncoder::process(int32_t *data, size_t size)
{
    if (!encoder || frame_size == 0) {
        return 1;
    }

    // Convert int32 -> int16 with clipping and queue it
    for (size_t i = 0; i < size; ++i) {
        int32_t s = data[i];
        if (s > 32767)  s = 32767;
        if (s < -32768) s = -32768;
        partial_frames.emplace_back(static_cast<opus_int16>(s));
    }

    unsigned char packet[1024];

    // Encode as many full frames as we have buffered
    while (partial_frames.size() >= frame_size) {
        std::vector<opus_int16> frame(
            partial_frames.begin(),
            partial_frames.begin() + frame_size
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
        }

        partial_frames.erase(
            partial_frames.begin(),
            partial_frames.begin() + frame_size
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

