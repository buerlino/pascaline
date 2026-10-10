// SPDX-License-Identifier: GPL-3.0-or-later
package org.pascaline.app;

import android.os.Bundle;
import android.os.Process;
import android.os.SystemClock;
import android.util.Log;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

/**
 * Spike shell. Logs Java-side timing marks under the logcat tag PASCALINE_T and, when started with
 * `--es path "/other.html?x=1"`, loads that path instead of the default page (used by the device queue).
 */
public class MainActivity extends BridgeActivity {
    private static final String TAG = "PASCALINE_T";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        long procStartEpoch = System.currentTimeMillis() - (SystemClock.elapsedRealtime() - Process.getStartElapsedRealtime());
        long t0 = System.currentTimeMillis();
        Log.i(TAG, "proc-start epoch=" + procStartEpoch);
        super.onCreate(savedInstanceState);
        long t1 = System.currentTimeMillis();
        Log.i(TAG, "activity-created epoch=" + t1 + " sinceProc=" + (t1 - procStartEpoch) + " superOnCreateMs=" + (t1 - t0));
        String path = getIntent() != null ? getIntent().getStringExtra("path") : null;
        if (path != null && getBridge() != null) {
            final WebView wv = getBridge().getWebView();
            final String url = getBridge().getAppUrl() + (path.startsWith("/") ? path : "/" + path);
            Log.i(TAG, "load-path " + url);
            wv.post(() -> wv.loadUrl(url));
        }
    }
}
