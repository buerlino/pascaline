// SPDX-License-Identifier: GPL-3.0-or-later
package io.github.buerlino.pascaline;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * A file leaves the app (docs/research/r11-files.md section 1): save({name, mime, text}) opens Android's own "Save to"
 * screen (ACTION_CREATE_DOCUMENT) and writes the UTF-8 text where the user picked. Resolves {result: "saved" |
 * "cancelled"}, rejects on an I/O error. No permission and no manifest entry.
 */
@CapacitorPlugin(name = "PascalineFiles")
public class PascalineFilesPlugin extends Plugin {
    @PluginMethod
    public void save(PluginCall call) {
        String name = call.getString("name");
        String mime = call.getString("mime", "application/octet-stream");
        String text = call.getString("text");
        if (name == null || text == null) {
            call.reject("name and text are required");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mime);
        intent.putExtra(Intent.EXTRA_TITLE, name);
        startActivityForResult(call, intent, "saveResult");
    }

    @ActivityCallback
    private void saveResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        Uri uri = data != null ? data.getData() : null;
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            call.resolve(new JSObject().put("result", "cancelled"));
            return;
        }
        try (OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            if (out == null) throw new IOException("no output stream for " + uri);
            out.write(call.getString("text", "").getBytes(StandardCharsets.UTF_8));
        } catch (IOException | RuntimeException e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "write failed");
            return;
        }
        call.resolve(new JSObject().put("result", "saved"));
    }
}
