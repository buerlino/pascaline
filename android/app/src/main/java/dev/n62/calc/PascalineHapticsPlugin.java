// SPDX-License-Identifier: GPL-3.0-or-later
package dev.n62.calc;

import android.content.Context;
import android.os.Build;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Key vibration with a settable strength (app/src/input/haptics.ts). vibrate({ms, amplitude 1..255}) uses
 * VibrationEffect.createOneShot on API 26+ when the motor has amplitude control, and plain vibrate(ms) otherwise.
 * Needs only the normal permission android.permission.VIBRATE.
 *
 * A9 (F41): from API 33 the pulse names its usage, USAGE_PHYSICAL_EMULATION (a key that feels like a key). A pulse
 * without attributes has the usage UNKNOWN, and Android 13+ plays each usage at its own intensity setting: on the
 * owner's Fairphone 6 (Android 16) UNKNOWN and TOUCH were OFF, and dumpsys listed every pulse as ignored_for_settings.
 * The app's own Key vibration switch is the user's choice here, so the system's touch-feedback switch does not mute it.
 */
@CapacitorPlugin(name = "PascalineHaptics")
public class PascalineHapticsPlugin extends Plugin {
    private Vibrator vibrator;

    @Override
    public void load() {
        vibrator = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
    }

    @PluginMethod
    public void vibrate(PluginCall call) {
        if (vibrator == null || !vibrator.hasVibrator()) {
            call.resolve();
            return;
        }
        long ms = Math.max(1, Math.min(1000, call.getInt("ms", 20)));
        int amp = Math.max(1, Math.min(255, call.getInt("amplitude", 255)));
        try {
            boolean ctl = Build.VERSION.SDK_INT >= 26 && vibrator.hasAmplitudeControl();
            if (Build.VERSION.SDK_INT >= 26) {
                VibrationEffect effect = VibrationEffect.createOneShot(ms, ctl ? amp : VibrationEffect.DEFAULT_AMPLITUDE);
                if (Build.VERSION.SDK_INT >= 33) {
                    VibrationAttributes attrs = VibrationAttributes.createForUsage(VibrationAttributes.USAGE_PHYSICAL_EMULATION);
                    vibrator.vibrate(effect, attrs);
                } else {
                    vibrator.vibrate(effect);
                }
            } else {
                vibrator.vibrate(ms);
            }
            if (BuildConfig.MEASURE) {
                Log.i("PASCALINE_HAPTICS", "vibrate ms=" + ms + " amplitude=" + amp + " ampControl=" + ctl);
            }
            call.resolve();
        } catch (RuntimeException e) {
            call.reject(e.getMessage());
        }
    }
}
