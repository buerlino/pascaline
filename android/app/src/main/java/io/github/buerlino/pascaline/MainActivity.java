// SPDX-License-Identifier: GPL-3.0-or-later
package io.github.buerlino.pascaline;

import android.os.Bundle;
import android.os.Process;
import android.os.SystemClock;
import android.util.Log;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
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
        registerPlugin(PascalineFilesPlugin.class);
        if (!BuildConfig.MEASURE) {
            super.onCreate(savedInstanceState);
            installBack();
            return;
        }
        long procStartEpoch = System.currentTimeMillis() - (SystemClock.elapsedRealtime() - Process.getStartElapsedRealtime());
        long t0 = System.currentTimeMillis();
        Log.i(TAG, "proc-start epoch=" + procStartEpoch);
        super.onCreate(savedInstanceState);
        installBack();
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

    /**
     * Android back acts as Esc for the open layer (R21b, backlog C8). Capacitor has no back handling of its own: the page
     * pushes a history entry while Settings or a sheet is open (app/src/input/backLayer.ts), and back pops it with the
     * WebView's goBack(); with nothing open canGoBack() is false and the default runs, so the app leaves.
     */
    private void installBack() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView wv = getBridge() != null ? getBridge().getWebView() : null;
                if (wv != null && wv.canGoBack()) {
                    wv.goBack();
                    return;
                }
                // Re-enable afterwards: since Android 12 back on the root activity only moves the task to the
                // background, so the activity lives on and must handle back again after it returns from recents.
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });
    }
}
