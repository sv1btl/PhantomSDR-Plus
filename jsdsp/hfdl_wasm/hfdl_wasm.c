/* SPDX-License-Identifier: GPL-3.0-or-later */
/*
 * hfdl_wasm.c — décodeur HFDL pour PhantomSDR-Plus (WebAssembly)
 *
 * Construit sur le démodulateur et les décodeurs de protocole de dumphfdl
 * (Tomasz Lemiech, https://github.com/szpajder/dumphfdl, GPL-3.0-or-later)
 * et sur libacars. Différence avec dumphfdl : l'entrée n'est pas un flux I/Q
 * de SDR mais l'audio USB démodulé par PhantomSDR (réel, 12 kHz en général),
 * pris par le navigateur AVANT les aides d'écoute (NR/NB/NS/AN), comme les
 * autres décodeurs de PhantomSDR.
 *
 * Chaîne d'entrée :
 *   audio réel (fs) → mélangeur −1440 Hz (sous-porteuse HFDL en USB)
 *   → filtre passe-bas complexe ±1300 Hz → rééchantillonnage vers 5400 éch./s
 *   (1800 symboles/s × 3) → hfdl_channel_process() (dumphfdl)
 *
 * Recherche du rythme : à 1800 symboles/s, le démodulateur ne tolère
 * qu'environ ±0,1 % d'erreur sur la fréquence d'échantillonnage, alors que
 * celle de l'audio reçu par le navigateur n'est connue qu'à quelques dixièmes
 * de pour cent près (le serveur produit ~12016 Hz, ramenés à 12000 Hz côté
 * client). Le décodeur fait donc tourner RATE_CNT démodulateurs en parallèle,
 * sur des rythmes espacés de RATE_STEP, et se verrouille sur celui qui décode
 * une trame ; sans trame pendant UNLOCK_SAMPLES, il reprend la recherche.
 * Une même trame décodée par deux démodulateurs n'est sortie qu'une fois.
 *
 * Recherche de la fréquence : la boucle de Costas de dumphfdl ne rattrape
 * qu'environ ±50 Hz d'écart. Or un récepteur réel peut être décalé de
 * plusieurs dizaines de ppm (100 à 200 Hz vers 9 MHz), et l'auditeur n'est
 * pas toujours calé au hertz près. Chaque rythme est donc décliné sur
 * FREQ_CNT décalages espacés de FREQ_STEP_HZ (±FREQ_SPAN_HZ), appliqués après
 * le rééchantillonnage ; le verrouillage fixe le couple rythme + fréquence.
 *
 * API exportée (appelée depuis hfdl.worker.js) :
 *   hfdl_init(sample_rate, dial_hz)      → 0 si OK
 *   hfdl_set_dial(dial_hz)               fréquence affichée (USB) du canal
 *   hfdl_set_offset(audio_hz)            sous-porteuse dans l'audio (1440 par défaut)
 *   hfdl_input_ptr(n)                    tampon float32 de n échantillons à remplir
 *   hfdl_process(n)                      décode les n échantillons du tampon
 *   hfdl_output_ptr(), hfdl_output_len() messages décodés (JSON, un par ligne)
 *   hfdl_output_clear()
 *   hfdl_noise_floor_db(), hfdl_state()  indicateurs pour l'interface
 *   hfdl_reset()
 */
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <complex.h>
#include <math.h>
#include <liquid/liquid.h>
#include <libacars/libacars.h>
#include <libacars/list.h>
#include <libacars/reassembly.h>
#include <libacars/vstring.h>
#include "dumphfdl/util.h"
#include "dumphfdl/crc.h"
#include "dumphfdl/mpdu.h"
#include "dumphfdl/spdu.h"
#include "dumphfdl/pdu.h"
#include "dumphfdl/globals.h"
#include "dumphfdl/fmtr-json.h"
#include "dumphfdl/fmtr-text.h"
#include "dumphfdl/ac_cache.h"
#include "dumphfdl/systable.h"
#include <stdio.h>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#define EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define EXPORT
#endif

char const * const DUMPHFDL_VERSION = "1.7.0-phantomsdr";

#define HFDL_OUT_RATE 5400.0f           // HFDL_SYMBOL_RATE * SPS
#define HFDL_AUDIO_OFFSET_HZ 1440.0f
#define FRONTEND_LPF_HZ 1650.0f        // signal ±1200 Hz + recherche de fréquence

struct hfdl_channel;
struct hfdl_channel *hfdl_channel_new(int32_t frequency);
void hfdl_channel_free(struct hfdl_channel *c);
void hfdl_channel_set_freq(struct hfdl_channel *c, int32_t frequency);
void hfdl_channel_process(struct hfdl_channel *c, float complex const *in, size_t n);
float hfdl_channel_noise_floor_db(struct hfdl_channel *c);
int32_t hfdl_channel_state(struct hfdl_channel *c);
void hfdl_init_globals(void);

/******************************************
 * PDU helpers (from dumphfdl pdu.c)
 ******************************************/

static struct metadata *hfdl_pdu_metadata_copy(struct metadata const *m) {
	struct hfdl_pdu_metadata *hm = container_of(m, struct hfdl_pdu_metadata, metadata);
	NEW(struct hfdl_pdu_metadata, copy);
	memcpy(copy, hm, sizeof(struct hfdl_pdu_metadata));
	return &copy->metadata;
}

static void hfdl_pdu_metadata_destroy(struct metadata *m) {
	if(m == NULL) {
		return;
	}
	struct hfdl_pdu_metadata *hm = container_of(m, struct hfdl_pdu_metadata, metadata);
	XFREE(hm);
}

static struct metadata_vtable hfdl_pdu_metadata_vtable = {
	.copy = hfdl_pdu_metadata_copy,
	.destroy = hfdl_pdu_metadata_destroy
};

bool hfdl_pdu_fcs_check(uint8_t *buf, uint32_t hdr_len) {
	uint16_t fcs_check = buf[hdr_len] | (buf[hdr_len + 1] << 8);
	uint16_t fcs_computed = crc16_ccitt(buf, hdr_len, 0xFFFFu) ^ 0xFFFFu;
	return fcs_check == fcs_computed;
}

struct metadata *hfdl_pdu_metadata_create() {
	NEW(struct hfdl_pdu_metadata, m);
	m->metadata.vtable = &hfdl_pdu_metadata_vtable;
	return &m->metadata;
}

/******************************************
 * State
 ******************************************/

#define RATE_CNT 11                    // rates, ±1 % in RATE_STEP steps
#define RATE_STEP 0.002f
#define FREQ_CNT 7                     // frequency offsets per rate
#define FREQ_STEP_HZ 80.0f             // Costas pull-in is about ±50 Hz
#define DEMOD_CNT (RATE_CNT * FREQ_CNT)
#define UNLOCK_SAMPLES (5400 * 180)     // 3 min without a frame → search again
#define DEDUP_CNT 32
#define DEDUP_WINDOW_SAMPLES (5400 * 8)

static struct {
	float sample_rate;
	float offset_hz;
	int32_t dial_hz;
	struct hfdl_channel *chan[DEMOD_CNT];       // index = rate * FREQ_CNT + freq
	double phase[DEMOD_CNT];                    // frequency-offset rotators
	msresamp_crcf resamp[RATE_CNT];
	nco_crcf nco;
	firfilt_crcf lpf;
	float *in;
	size_t in_cap;
	float complex *mixed;
	float complex *resampled;
	float complex *shifted;
	size_t work_cap;
	la_reasm_ctx *reasm;
	la_vstring *out;
	uint32_t frames;
	int32_t locked;                 // index into chan[], -1 = searching
	int32_t current;                // channel being processed (for the PDU sink)
	uint64_t clock;                 // output samples processed (5400/s)
	uint64_t last_frame_clock;
	struct { uint32_t hash; uint64_t clock; } seen[DEDUP_CNT];
	uint32_t seen_idx;
} W = { .locked = -1 };

static float rate_factor(int32_t i) {
	return 1.0f + (float)(i - RATE_CNT / 2) * RATE_STEP;
}

static float freq_offset_hz(int32_t f) {
	return (float)(f - FREQ_CNT / 2) * FREQ_STEP_HZ;
}

static void frontend_destroy(void) {
	if(W.nco) { nco_crcf_destroy(W.nco); W.nco = NULL; }
	if(W.lpf) { firfilt_crcf_destroy(W.lpf); W.lpf = NULL; }
	for(int32_t i = 0; i < RATE_CNT; i++) {
		if(W.resamp[i]) { msresamp_crcf_destroy(W.resamp[i]); W.resamp[i] = NULL; }
	}
}

static uint32_t fnv1a(uint8_t const *b, size_t len) {
	uint32_t h = 2166136261u;
	for(size_t i = 0; i < len; i++) {
		h ^= b[i];
		h *= 16777619u;
	}
	return h;
}

// True if this PDU was already output recently (decoded by another demodulator).
static bool seen_recently(uint8_t const *buf, size_t len) {
	uint32_t h = fnv1a(buf, len);
	for(int32_t i = 0; i < DEDUP_CNT; i++) {
		if(W.seen[i].hash == h && W.seen[i].clock != 0 &&
				W.clock - W.seen[i].clock < DEDUP_WINDOW_SAMPLES) {
			return true;
		}
	}
	W.seen[W.seen_idx].hash = h;
	W.seen[W.seen_idx].clock = W.clock ? W.clock : 1;
	W.seen_idx = (W.seen_idx + 1) % DEDUP_CNT;
	return false;
}

static void frontend_create(void) {
	frontend_destroy();
	W.nco = nco_crcf_create(LIQUID_NCO);
	nco_crcf_set_frequency(W.nco, 2.0f * (float)M_PI * W.offset_hz / W.sample_rate);
	// Kaiser low-pass, ±FRONTEND_LPF_HZ around the sub-carrier
	float fc = FRONTEND_LPF_HZ / W.sample_rate;
	unsigned int taps = 2 * (unsigned int)(W.sample_rate / 250.0f) + 1;   // ~250 Hz transition
	W.lpf = firfilt_crcf_create_kaiser(taps, fc, 60.0f, 0.0f);
	firfilt_crcf_set_scale(W.lpf, 2.0f * fc);
	for(int32_t i = 0; i < RATE_CNT; i++) {
		W.resamp[i] = msresamp_crcf_create(HFDL_OUT_RATE / (W.sample_rate * rate_factor(i)), 60.0f);
	}
}

/******************************************
 * PDU sink (called by hfdl_core.c)
 ******************************************/

void hfdl_wasm_pdu_ready(struct metadata *m, struct octet_string *pdu, uint32_t flags) {
	(void)flags;
	struct hfdl_pdu_metadata *hm = container_of(m, struct hfdl_pdu_metadata, metadata);
	if(seen_recently(pdu->buf, pdu->len)) {
		octet_string_destroy(pdu);
		XFREE(hm);
		return;
	}
	la_list *lpdu_list = NULL;
	if(pdu->len > 0 && (((uint8_t *)pdu->buf)[0] & 1)) {
		lpdu_list = mpdu_parse(pdu, W.reasm, m->rx_timestamp, hm->freq);
	} else {
		lpdu_list = spdu_parse(pdu, hm->freq);
	}
	if(lpdu_list != NULL) {
		// A frame that parses is the proof that this demodulator's rate is right.
		W.locked = W.current;
		W.last_frame_clock = W.clock;
		W.frames++;
	}
	for(la_list *l = lpdu_list; l != NULL; l = la_list_next(l)) {
		if(l->data == NULL) {
			continue;
		}
		struct octet_string *json = fmtr_DEF_json.format_decoded_msg(m, l->data);
		struct octet_string *text = fmtr_DEF_text.format_decoded_msg(m, l->data);
		if(json != NULL) {
			while(json->len > 0 && (((char *)json->buf)[json->len - 1] == '\n' || ((char *)json->buf)[json->len - 1] == '\r')) {
				json->len--;
			}
			// One message per line: {"json": {...}, "text": "..."}
			la_vstring_append_sprintf(W.out, "{\"json\":%.*s,\"text\":\"", (int)json->len, (char *)json->buf);
			if(text != NULL) {
				for(size_t i = 0; i < text->len; i++) {
					char ch = ((char *)text->buf)[i];
					switch(ch) {
						case '"':  la_vstring_append_sprintf(W.out, "\\\""); break;
						case '\\': la_vstring_append_sprintf(W.out, "\\\\"); break;
						case '\n': la_vstring_append_sprintf(W.out, "\\n"); break;
						case '\r': break;
						case '\t': la_vstring_append_sprintf(W.out, "\\t"); break;
						default:
							if((unsigned char)ch < 0x20) {
								la_vstring_append_sprintf(W.out, "\\u%04x", (unsigned char)ch);
							} else {
								la_vstring_append_sprintf(W.out, "%c", ch);
							}
					}
				}
			}
			la_vstring_append_sprintf(W.out, "\"}\n");
		}
		if(json) octet_string_destroy(json);
		if(text) octet_string_destroy(text);
	}
	la_list_free_full(lpdu_list, la_proto_tree_destroy);
	octet_string_destroy(pdu);
	XFREE(hm);
}

/******************************************
 * Exported API
 ******************************************/

EXPORT int32_t hfdl_init(int32_t sample_rate, int32_t dial_hz) {
	static bool globals_done = false;
	if(!globals_done) {
		hfdl_init_globals();
		Config.utc = true;
		Config.milliseconds = false;
		Config.ac_cache_ttl = 3600;
		Config.station_id = NULL;
		AC_cache = ac_cache_create();
		Systable = NULL;
		AC_data = NULL;
		W.reasm = la_reasm_ctx_new();
		W.out = la_vstring_new();
		globals_done = true;
	}
	W.sample_rate = sample_rate > 0 ? (float)sample_rate : 12000.0f;
	if(W.offset_hz <= 0.0f) {
		W.offset_hz = HFDL_AUDIO_OFFSET_HZ;
	}
	W.dial_hz = dial_hz;
	for(int32_t i = 0; i < DEMOD_CNT; i++) {
		if(W.chan[i]) {
			hfdl_channel_free(W.chan[i]);
		}
		W.chan[i] = hfdl_channel_new(dial_hz);
		W.phase[i] = 0.0;
	}
	W.locked = -1;
	W.clock = 0;
	W.last_frame_clock = 0;
	memset(W.seen, 0, sizeof(W.seen));
	frontend_create();
	return W.chan[0] != NULL ? 0 : -1;
}

EXPORT void hfdl_set_dial(int32_t dial_hz) {
	W.dial_hz = dial_hz;
	for(int32_t i = 0; i < DEMOD_CNT; i++) {
		if(W.chan[i]) {
			hfdl_channel_set_freq(W.chan[i], dial_hz);
		}
	}
}

EXPORT void hfdl_set_offset(float audio_hz) {
	W.offset_hz = audio_hz > 0.0f ? audio_hz : HFDL_AUDIO_OFFSET_HZ;
	if(W.nco) {
		nco_crcf_set_frequency(W.nco, 2.0f * (float)M_PI * W.offset_hz / W.sample_rate);
	}
}

EXPORT void hfdl_reset(void) {
	if(W.chan[0] == NULL) {
		return;
	}
	hfdl_init((int32_t)W.sample_rate, W.dial_hz);
}

EXPORT float *hfdl_input_ptr(int32_t n) {
	if(n <= 0) {
		return NULL;
	}
	if((size_t)n > W.in_cap) {
		W.in = realloc(W.in, n * sizeof(float));
		W.in_cap = n;
	}
	if((size_t)n > W.work_cap) {
		W.mixed = realloc(W.mixed, n * sizeof(float complex));
		W.resampled = realloc(W.resampled, (n + 64) * sizeof(float complex));
		W.shifted = realloc(W.shifted, (n + 64) * sizeof(float complex));
		W.work_cap = n;
	}
	return W.in;
}

EXPORT int32_t hfdl_process(int32_t n) {
	if(W.chan[0] == NULL || n <= 0 || (size_t)n > W.in_cap) {
		return -1;
	}
	for(int32_t i = 0; i < n; i++) {
		float complex x = W.in[i];
		float complex y, z;
		nco_crcf_mix_down(W.nco, x, &y);
		nco_crcf_step(W.nco);
		firfilt_crcf_push(W.lpf, y);
		firfilt_crcf_execute(W.lpf, &z);
		W.mixed[i] = z;
	}
	if(W.locked >= 0 && W.clock - W.last_frame_clock > UNLOCK_SAMPLES) {
		W.locked = -1;              // signal gone or rate drifted: search again
	}
	unsigned int produced = 0;
	for(int32_t k = 0; k < RATE_CNT; k++) {
		// Every resampler keeps running so that a demodulator rejoining the
		// search has a continuous input; only the demodulators are skipped.
		msresamp_crcf_execute(W.resamp[k], W.mixed, n, W.resampled, &produced);
		if(produced == 0) {
			continue;
		}
		for(int32_t f = 0; f < FREQ_CNT; f++) {
			int32_t d = k * FREQ_CNT + f;
			if(W.locked >= 0 && W.locked != d) {
				continue;
			}
			float complex *buf = W.resampled;
			float off = freq_offset_hz(f);
			if(off != 0.0f) {
				double dph = -2.0 * M_PI * off / HFDL_OUT_RATE;
				double ph = W.phase[d];
				for(unsigned int i = 0; i < produced; i++) {
					W.shifted[i] = W.resampled[i] * (float complex)(cos(ph) + I * sin(ph));
					ph += dph;
				}
				W.phase[d] = fmod(ph, 2.0 * M_PI);
				buf = W.shifted;
			}
			W.current = d;
			hfdl_channel_process(W.chan[d], buf, produced);
		}
	}
	W.clock += produced;
	return (int32_t)W.out->len;
}

EXPORT char *hfdl_output_ptr(void) {
	return W.out ? W.out->str : NULL;
}

EXPORT int32_t hfdl_output_len(void) {
	return W.out ? (int32_t)W.out->len : 0;
}

EXPORT void hfdl_output_clear(void) {
	if(W.out) {
		la_vstring_destroy(W.out, true);
		W.out = la_vstring_new();
	}
}

EXPORT float hfdl_noise_floor_db(void) {
	int32_t k = W.locked >= 0 ? W.locked : DEMOD_CNT / 2;
	return W.chan[k] ? hfdl_channel_noise_floor_db(W.chan[k]) : 0.0f;
}

EXPORT int32_t hfdl_state(void) {
	int32_t best = 0;
	for(int32_t k = 0; k < DEMOD_CNT; k++) {
		if(W.chan[k] && (W.locked < 0 || W.locked == k)) {
			int32_t st = hfdl_channel_state(W.chan[k]);
			if(st > best) best = st;
		}
	}
	return best;
}

EXPORT uint32_t hfdl_frames(void) {
	return W.frames;
}

/** Rate correction the decoder locked onto, in parts per million (0 while searching). */
EXPORT int32_t hfdl_rate_ppm(void) {
	if(W.locked < 0) {
		return 0;
	}
	return (int32_t)lroundf((rate_factor(W.locked / FREQ_CNT) - 1.0f) * 1e6f);
}

/** Frequency offset of the locked demodulator, in Hz (0 while searching). */
EXPORT int32_t hfdl_freq_offset(void) {
	if(W.locked < 0) {
		return 0;
	}
	return (int32_t)lroundf(freq_offset_hz(W.locked % FREQ_CNT));
}

EXPORT int32_t hfdl_locked(void) {
	return W.locked >= 0 ? 1 : 0;
}

/*
 * Table des stations sol (systable.conf de dumphfdl) : donne les noms des
 * stations et convertit les numéros de fréquence en kHz dans les messages.
 * Le texte est écrit dans le système de fichiers virtuel puis lu par libconfig.
 * Retourne 1 si la table est chargée.
 */
EXPORT int32_t hfdl_load_systable(char const *text, int32_t len) {
	if(text == NULL || len <= 0) {
		return 0;
	}
	FILE *f = fopen("/systable.conf", "wb");
	if(f == NULL) {
		return 0;
	}
	fwrite(text, 1, (size_t)len, f);
	fclose(f);
	systable *st = systable_create(NULL);
	if(!systable_read_from_file(st, "/systable.conf")) {
		systable_destroy(st);
		return 0;
	}
	if(Systable != NULL) {
		systable_destroy(Systable);
	}
	Systable = st;
	return 1;
}

