/*
 * js8_subtract.c — coherent subtraction of a decoded JS8 signal.
 *
 * A strong station masks weaker ones sharing its slot: the sync search finds
 * the strong one, and the weak one never rises far enough above it to be
 * decoded. Removing what has already been decoded and searching again is how
 * JS8Call gets several signals out of one crowded slot, and it is the half of
 * the sensitivity story that order-1 OSD did not deliver (see js8_osd.c).
 *
 * Ported from JS8Call's subtractjs8.f90, whose method is:
 *
 *     measured   dd(t)    = a(t)·cos(2πf0·t + θ(t))
 *     reference  cref(t)  = exp(j·(2πf0·t + φ(t)))
 *     amplitude  cfilt(t) = LPF[ dd(t)·conj(cref(t)) ]
 *     subtract   dd(t)   -= 2·Re{ cref(t)·cfilt(t) }
 *
 * The point of the low-pass is that it *measures* the signal's amplitude and
 * phase over the transmission instead of assuming them, so fading, a small
 * frequency error and the difference between the hard-keyed reference and the
 * GFSK actually transmitted are all absorbed into cfilt rather than left behind
 * as residue.
 *
 * Two deliberate differences from upstream:
 *
 *   - the reference is generated at the caller's sample rate rather than a
 *     hardcoded 12 kHz
 *   - the low-pass is two cascaded box filters (a triangular window) computed
 *     with running sums, rather than a 1400-tap raised cosine applied by FFT.
 *     Same ~9 Hz corner, O(n) instead of O(n log n), and no FFT plan to carry
 *     around. The filtered quantity is a slowly-varying envelope; the exact
 *     window shape does not matter to it.
 */

#include "js8_subtract.h"

#include <math.h>
#include <stdlib.h>
#include <string.h>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

/** Corner frequency of the amplitude tracker, Hz. Upstream's 1400-tap filter
 *  at 12 kHz works out at roughly this. Low enough to reject the tone
 *  modulation, high enough to follow fading. */
#define AMP_LPF_HZ 8.6f

/** In-place moving average of length `w` over a complex sequence held as
 *  interleaved re/im. Running sums, so cost does not depend on `w`. */
static void boxcar(float* re, float* im, int n, int w)
{
    if (w < 2 || n <= 0) return;

    float* ore = (float*)malloc((size_t)n * sizeof(float));
    float* oim = (float*)malloc((size_t)n * sizeof(float));
    if (!ore || !oim) { free(ore); free(oim); return; }

    double sr = 0.0, si = 0.0;
    int half = w / 2;

    /* Prime the window over [0, half). */
    int hi = 0;
    for (; hi < half && hi < n; ++hi) { sr += re[hi]; si += im[hi]; }
    int lo = 0;

    for (int i = 0; i < n; ++i)
    {
        int want_hi = i + half;
        while (hi <= want_hi && hi < n) { sr += re[hi]; si += im[hi]; ++hi; }
        int want_lo = i - half;
        while (lo < want_lo && lo < n) { sr -= re[lo]; si -= im[lo]; ++lo; }

        int count = hi - lo;
        if (count < 1) count = 1;
        ore[i] = (float)(sr / count);
        oim[i] = (float)(si / count);
    }

    memcpy(re, ore, (size_t)n * sizeof(float));
    memcpy(im, oim, (size_t)n * sizeof(float));
    free(ore);
    free(oim);
}

bool js8_subtract(float* pcm, int num_samples, int sample_rate,
                  const js8_submode_t* sub, const uint8_t tones[JS8_NN],
                  float f0_hz, float start_sec)
{
    if (!pcm || !sub || sample_rate <= 0) return false;

    const int sps = (int)((double)sample_rate * sub->nsps / 12000.0);
    if (sps <= 0) return false;

    const int nframe = JS8_NN * sps;
    const int nstart = (int)(start_sec * sample_rate);

    /* Require most of the transmission to be present; subtracting a fragment
     * leaves more residue than it removes. */
    if (nstart + nframe <= 0 || nstart >= num_samples) return false;

    float* cre = (float*)malloc((size_t)nframe * sizeof(float));
    float* cim = (float*)malloc((size_t)nframe * sizeof(float));
    float* are = (float*)malloc((size_t)nframe * sizeof(float));
    float* aim = (float*)malloc((size_t)nframe * sizeof(float));
    if (!cre || !cim || !are || !aim)
    {
        free(cre); free(cim); free(are); free(aim);
        return false;
    }

    /* Reference: hard-keyed CPFSK at f0 with the decoded tones. Upstream does
     * the same -- the shaping difference lands in cfilt. */
    const double twopi = 2.0 * M_PI;
    double phi = 0.0;
    int k = 0;
    for (int i = 0; i < JS8_NN; ++i)
    {
        double f = f0_hz + tones[i] * (double)sub->baud;
        double dphi = twopi * f / sample_rate;
        for (int s = 0; s < sps; ++s, ++k)
        {
            cre[k] = (float)cos(phi);
            cim[k] = (float)sin(phi);
            phi += dphi;
            if (phi > twopi) phi -= twopi;
        }
    }

    /* Mix to baseband: camp = dd · conj(cref). Samples outside the buffer
     * contribute zero, which lets a transmission that starts slightly before
     * the capture still be removed. */
    for (int i = 0; i < nframe; ++i)
    {
        int id = nstart + i;
        float d = (id >= 0 && id < num_samples) ? pcm[id] : 0.0f;
        are[i] = d * cre[i];
        aim[i] = -d * cim[i];
    }

    /* Low-pass to recover the complex amplitude. Two boxcars of half the
     * length cascade into a triangular window of the intended width. */
    int w = (int)(sample_rate / AMP_LPF_HZ);
    if (w > nframe) w = nframe;
    if (w > 1)
    {
        boxcar(are, aim, nframe, w / 2);
        boxcar(are, aim, nframe, w / 2);
    }

    /* dd -= 2·Re{cref · cfilt} */
    for (int i = 0; i < nframe; ++i)
    {
        int id = nstart + i;
        if (id < 0 || id >= num_samples) continue;
        float rr = cre[i] * are[i] - cim[i] * aim[i];
        pcm[id] -= 2.0f * rr;
    }

    free(cre); free(cim); free(are); free(aim);
    return true;
}
