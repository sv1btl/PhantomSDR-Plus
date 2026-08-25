// ref_frames.cpp — ground truth for frontend/src/modules/js8.js.
//
// The thing under test is the UNPACK direction, so the frames do not have to
// come from JS8Call's packers (whose regex front-ends are awkward to drive
// headlessly). Instead we feed frames -- both realistic packed ones and a large
// batch of pseudorandom ones -- to JS8Call's OWN unpackers and print what they
// produce. js8.js must agree, given the identical 12-character frame.
//
// Dispatch mirrors what a caller actually does: i3bit's JS8CallData flag wins,
// otherwise the first three payload bits select the frame type.
#include "varicode.h"
#include <QString>
#include <QStringList>
#include <cstdio>
#include <cstdint>
#include <cstdlib>

static QString unpackRow(const QString& frame, int i3bit, const char** kind)
{
    if (i3bit & Varicode::JS8CallData) {
        *kind = "data";
        return Varicode::unpackFastDataMessage(frame);
    }

    quint8 rem = 0;
    auto bits = Varicode::intToBits(Varicode::unpack72bits(frame, &rem), 64);
    int type = (int)Varicode::bitsToInt(bits.mid(0, 3));

    quint8 t = 0, bits3 = 0;
    bool isAlt = false;
    QStringList parts;

    if (type >= 4) {
        *kind = "data";
        return Varicode::unpackDataMessage(frame);
    }
    if (type == Varicode::FrameDirected) {
        *kind = "directed";
        parts = Varicode::unpackDirectedMessage(frame, &t);
        return parts.join(",");
    }
    if (type == Varicode::FrameHeartbeat) {
        *kind = "heartbeat";
        parts = Varicode::unpackHeartbeatMessage(frame, &t, &isAlt, &bits3);
        return parts.join(",");
    }
    *kind = "compound";
    parts = Varicode::unpackCompoundMessage(frame, &t, &bits3);
    return parts.join(",");
}

static void row(const char* label, const QString& frame, int i3bit)
{
    if (frame.length() != 12) return;
    const char* kind = "?";
    QString out = unpackRow(frame, i3bit, &kind);

    // The JSC dictionary holds arbitrary Latin-1 bytes, newlines included, so
    // the decoded text cannot be printed raw into a line-based format. Hex it.
    QByteArray raw = out.toLatin1();
    printf("%s|%s|%d|%s|", label, qPrintable(frame), i3bit, kind);
    for (int i = 0; i < raw.size(); i++)
        printf("%02x", (unsigned char)raw.at(i));
    printf("\n");
}

int main(int argc, char** argv)
{
    const int nrandom = (argc > 1) ? atoi(argv[1]) : 5000;
    extern QString alphabet72;
    // Only the FIRST 64 characters of alphabet72 can appear in a real frame:
    // pack72bits() masks each group to 6 bits, so '/', '?' and '.' (indices
    // 64..66) are unreachable. Generating them would produce frames that
    // unpack72bits() -- which ORs the index in without masking -- decodes by
    // corrupting the neighbouring field, which is not behaviour worth matching.
    const QString A = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                      "abcdefghijklmnopqrstuvwxyz-+";

    // ── Realistic packed frames ─────────────────────────────────────────────
    int n = 0;
    const char* hbs[][2] = {
        {"KN4CRD",     "@HB HEARTBEAT EM73"},
        {"SV1BTL",     "@HB HEARTBEAT KM17"},
        {"VE7/KN4CRD", "@HB HEARTBEAT CN89"},
    };
    for (auto& hb : hbs) {
        n = 0;
        row("HB", Varicode::packHeartbeatMessage(QString(hb[1]), QString(hb[0]), &n),
            Varicode::JS8CallFirst | Varicode::JS8CallLast);
    }

    const char* datas[] = {
        "HELLO WORLD", "TEST MESSAGE", "THE QUICK BROWN FOX",
        "GOOD MORNING FROM GREECE", "73 SK", "ABCDEFGHIJ",
        "QSL AND THANKS FOR THE CONTACT", "1234567890",
    };
    for (auto& d : datas) {
        n = 0;
        row("DATA", Varicode::packDataMessage(QString(d), &n), 0);
    }
    for (auto& d : datas) {
        n = 0;
        row("FASTDATA", Varicode::packFastDataMessage(QString(d), &n),
            Varicode::JS8CallData);
    }

    // JS8Call's own in-source example: "KN4CRD: K0OG"
    row("KNOWN", "SN5-lUuJkby0", Varicode::JS8CallFirst);

    // ── Multi-frame messages ────────────────────────────────────────────────
    // buildMessageFrames() is JS8Call's real transmit path: it splits a message
    // into frames and sets the first/last flags in i3bit. That makes it exactly
    // the ground truth js8-reassembler.js needs -- these are the frame
    // sequences a real station would put on the air.
    {
        const char* msgs[] = {
            "HELLO BRAVE NEW WORLD THIS IS A LONG MESSAGE THAT MUST SPAN SEVERAL FRAMES",
            "THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG",
            "GOOD MORNING FROM GREECE THE WEATHER IS FINE TODAY AND THE BANDS ARE OPEN",
            "SHORT",
            "TESTING 123 TESTING 456 TESTING 789 END OF TEST TRANSMISSION",
        };
        for (auto& m : msgs) {
            auto frames = Varicode::buildMessageFrames("SV1BTL", "KM17", "", QString(m),
                                                       false, false, 0, nullptr);
            QByteArray raw = QString(m).toLatin1();
            printf("MULTI|");
            for (int i = 0; i < raw.size(); i++)
                printf("%02x", (unsigned char)raw.at(i));
            printf("|");
            for (int i = 0; i < frames.size(); i++)
                printf("%s%s:%d", i ? ";" : "",
                       qPrintable(frames.at(i).first), frames.at(i).second);
            printf("\n");
        }
    }

    // ── Checksums for buffered commands (CRC-16/KERMIT, base-41 packed) ─────
    // js8-reassembler.js reimplements these; they gate whether a multi-frame
    // MSG or relay is accepted, so a wrong CRC silently drops real traffic.
    {
        const char* texts[] = {
            "", "A", "HELLO WORLD", "THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG",
            "73 SK", "MSG FOR KN4CRD", "0123456789", "  LEADING AND TRAILING  ",
            "SV1BTL DE KN4CRD", "@ALLCALL QSL?",
        };
        for (auto& t : texts) {
            QString s = QString(t);
            QByteArray raw = s.toLatin1();
            printf("CHECKSUM16|");
            for (int i = 0; i < raw.size(); i++)
                printf("%02x", (unsigned char)raw.at(i));
            printf("|%s\n", qPrintable(Varicode::checksum16(s)));
        }
        // Plus a batch of pseudorandom strings over the packing alphabet.
        uint32_t cr = 987654321u;
        for (int i = 0; i < 500; i++) {
            int len = (int)((cr >> 16) % 40) + 1;
            QString s;
            for (int k = 0; k < len; k++) {
                cr = cr * 1103515245u + 12345u;
                s.append(A.at((cr >> 16) % A.length()));
            }
            cr = cr * 1103515245u + 12345u;
            QByteArray raw = s.toLatin1();
            printf("CHECKSUM16|");
            for (int j = 0; j < raw.size(); j++)
                printf("%02x", (unsigned char)raw.at(j));
            printf("|%s\n", qPrintable(Varicode::checksum16(s)));
        }
    }

    // ── Pseudorandom frames, deterministic so the JS side can regenerate ────
    uint32_t r = 20260819u;
    for (int i = 0; i < nrandom; i++) {
        QString f;
        for (int k = 0; k < 12; k++) {
            r = r * 1103515245u + 12345u;
            f.append(A.at((r >> 16) % A.length()));
        }
        r = r * 1103515245u + 12345u;
        int i3 = (int)((r >> 16) % 8);
        row("RANDOM", f, i3);
    }
    return 0;
}
