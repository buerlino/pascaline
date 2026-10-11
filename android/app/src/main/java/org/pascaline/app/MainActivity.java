// SPDX-License-Identifier: GPL-3.0-or-later
package org.pascaline.app;

import android.os.Bundle;
import android.os.Process;
import android.os.SystemClock;
import android.util.Log;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

/**
 * Plain Capacitor shell. In measurement builds only (BuildConfig.MEASURE, set by PASCALINE_MEASURE=1) it logs
 * Java-side timing marks under the logcat tag PASCALINE_T, which tools/device_run.py lines up with the JS marks.
 */
public class MainActivity extends BridgeActivity {
    private static final String TAG = "PASCALINE_T";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PascalineHapticsPlugin.class); // local plugin; must come before super.onCreate
        if (!BuildConfig.MEASURE) {
            super.onCreate(savedInstanceState);
            return;
        }
        long procStartEpoch = System.currentTimeMillis() - (SystemClock.elapsedRealtime() - Process.getStartElapsedRealtime());
        long t0 = System.currentTimeMillis();
        Log.i(TAG, "proc-start epoch=" + procStartEpoch);
        super.onCreate(savedInstanceState);
        long t1 = System.currentTimeMillis();
        Log.i(TAG, "activity-created epoch=" + t1 + " sinceProc=" + (t1 - procStartEpoch) + " superOnCreateMs=" + (t1 - t0));
        // `am start --es path "/?bench=1"` loads that page instead (device_run.py bench)
        String path = getIntent() != null ? getIntent().getStringExtra("path") : null;
        if (path != null && getBridge() != null) {
            final WebView wv = getBridge().getWebView();
            final String url = getBridge().getAppUrl() + (path.startsWith("/") ? path : "/" + path);
            wv.post(() -> wv.loadUrl(url));
        }
    }
}
