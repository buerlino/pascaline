// SPDX-License-Identifier: GPL-3.0-or-later
package io.github.buerlino.pascaline;

import android.content.Context;
import android.os.Build;
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
                vibrator.vibrate(VibrationEffect.createOneShot(ms, ctl ? amp : VibrationEffect.DEFAULT_AMPLITUDE));
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
