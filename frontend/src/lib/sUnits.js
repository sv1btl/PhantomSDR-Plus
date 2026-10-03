// S-unit reference by frequency — IARU Region 1 Technical Recommendation R.1:
// S9 is -73 dBm below 30 MHz and -93 dBm above, 6 dB per S-unit on both.
//
// The S-meters are drawn on the HF scale (S9 = -73 dBm). Above 30 MHz the
// signal is lifted by the 20 dB difference before it is placed on that scale,
// so the needle and the bar read VHF S-units. The dBm and dBuV figures are
// not touched: they stay as measured, and the per-receiver offsets in
// config.toml remain the dBm calibration.
export const VHF_S9_LIFT_DB = 20

/** dB to add to a level before mapping it to S-units at this frequency. */
export function sUnitLiftDb (frequencyHz) {
  return Number(frequencyHz) > 30e6 ? VHF_S9_LIFT_DB : 0
}

// ── The VHF/UHF meter gate ───────────────────────────────────────────────────
// A VHF/UHF transceiver's meter rests at 0 on an empty channel: its scale
// starts above the noise floor. A receiver can do the same here: above 60 MHz
// the needle and the bar then stay at 0 until a signal stands GATE_DB above
// the noise in the passband, and read the signal as usual after that. The dBm, dBuV, SNR and NF
// figures always show the measured values. Below 60 MHz, and whenever the SNR
// is not known, the meters are never gated.
//
// OFF by default: a calibrated meter showing the real band noise is the more
// honest reading. siteSMeterGateDb in the receiver's site_information.json
// switches it on with that threshold in dB (6 is a good value); absent or 0 =
// off.
import { siteInfo } from '../siteInfo.js'

export const METER_GATE_ABOVE_HZ = 60e6
const gateSetting = Number(siteInfo.siteSMeterGateDb)
export const METER_GATE_DB = Number.isFinite(gateSetting) ? gateSetting : 0

/**
 * Should the meters show 0? `wasGated` is the previous answer: the gate opens
 * at METER_GATE_DB and closes 2 dB lower, so a signal right at the threshold
 * does not make the needle flicker.
 */
export function meterGated (wasGated, frequencyHz, snrDb) {
  if (!(METER_GATE_DB > 0)) return false
  if (!(Number(frequencyHz) > METER_GATE_ABOVE_HZ)) return false
  if (!Number.isFinite(snrDb)) return false
  return wasGated ? snrDb < METER_GATE_DB : snrDb < METER_GATE_DB - 2
}
