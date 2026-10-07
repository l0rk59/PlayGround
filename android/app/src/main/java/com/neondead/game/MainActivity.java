// NEON DEAD — application Android (WebView plein écran)
//
// ⚠️ Point clé : le jeu utilise des MODULES ES + une importmap.
//    Or Chrome bloque les modules ES sur file:// (origine "null" → CORS).
//    On sert donc les assets depuis une origine HTTPS virtuelle
//    (https://appassets.androidplatform.net/) via shouldInterceptRequest.
//    L'origine est ainsi légitime et les modules se chargent normalement.
package com.neondead.game;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.res.AssetManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {

    /** origine virtuelle : donne une vraie identité au site (indispensable pour les modules ES) */
    private static final String BASE = "https://appassets.androidplatform.net/";
    private static final String START = BASE + "asset/index.html";
    private static final String ASSET_ROOT = "www";

    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        FrameLayout root = new FrameLayout(this);
        web = new WebView(this);
        web.setBackgroundColor(0xFF05050F);
        root.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);            // sauvegarde du jeu (localStorage)
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setTextZoom(100);

        // On n'utilise PLUS file:// : on sert tout via l'origine HTTPS virtuelle.
        // On désactive donc les accès fichiers (sécurité).
        s.setAllowFileAccess(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
            s.setAllowFileAccessFromFileURLs(false);
            s.setAllowUniversalAccessFromFileURLs(false);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            s.setSafeBrowsingEnabled(false);       // jeu hors-ligne : pas de recherche d'URL
        }

        web.setWebViewClient(new AssetWebViewClient());
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setLongClickable(false);
        web.setHapticFeedbackEnabled(true);

        // WebGL : couche matérielle explicite
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        setContentView(root);

        if (state != null) web.restoreState(state);
        else web.loadUrl(START);

        hideSystemUI();
    }

    // ------------------------------------------------------------------
    //  Sert les fichiers du dossier assets/www depuis l'origine HTTPS
    // ------------------------------------------------------------------
    private class AssetWebViewClient extends WebViewClient {

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (uri == null) return null;
            String host = uri.getHost();
            if (host == null || !host.equals("appassets.androidplatform.net")) return null;
            return serve(uri.getPath());
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (uri != null && uri.getHost() != null
                    && uri.getHost().equals("appassets.androidplatform.net")) return false;
            // aucune navigation externe : tout reste dans le jeu
            return true;
        }
    }

    private WebResourceResponse serve(String rawPath) {
        if (rawPath == null) return notFound();
        String rel = rawPath.startsWith("/") ? rawPath.substring(1) : rawPath;
        if (rel.isEmpty()) rel = "index.html";
        // "asset/xxx" ou "xxx"
        if (rel.startsWith("asset/")) rel = rel.substring("asset/".length());
        // sécurité : pas de remontée de chemin
        if (rel.contains("..") || rel.startsWith("/")) return notFound();

        String assetPath = ASSET_ROOT + "/" + rel;
        AssetManager am = getAssets();
        try {
            InputStream is = am.open(assetPath, AssetManager.ACCESS_STREAMING);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-cache");
            headers.put("Access-Control-Allow-Origin", "*");
            String mime = mimeOf(rel);
            // encodage : null pour les binaires, utf-8 pour le texte
            String enc = isText(mime) ? "utf-8" : null;
            return new WebResourceResponse(mime, enc, 200, "OK", headers, is);
        } catch (IOException e) {
            return notFound();
        }
    }

    private WebResourceResponse notFound() {
        byte[] body = "404".getBytes();
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found",
                new HashMap<String, String>(), new ByteArrayInputStream(body));
    }

    private static boolean isText(String mime) {
        return mime.startsWith("text/") || mime.contains("javascript")
                || mime.contains("json") || mime.contains("xml");
    }

    private static String mimeOf(String p) {
        if (p.endsWith(".html") || p.endsWith(".htm")) return "text/html";
        if (p.endsWith(".js") || p.endsWith(".mjs")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".ico")) return "image/x-icon";
        if (p.endsWith(".glb")) return "model/gltf-binary";
        if (p.endsWith(".wasm")) return "application/wasm";
        if (p.endsWith(".ttf")) return "font/ttf";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".woff")) return "font/woff";
        if (p.endsWith(".map")) return "application/json";
        return "application/octet-stream";
    }

    // ------------------------------------------------------------------
    private void hideSystemUI() {
        View d = getWindow().getDecorView();
        d.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUI();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            web.evaluateJavascript("(window.__ndBack && window.__ndBack())", null);
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.__ndBack && window.__ndBack())", null);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.evaluateJavascript("(window.__ndPause && window.__ndPause())", null);
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        hideSystemUI();
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }
}