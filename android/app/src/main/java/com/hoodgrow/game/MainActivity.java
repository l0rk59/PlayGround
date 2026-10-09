package com.hoodgrow.game;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Hood Grow — application Android.
 *
 * Le jeu (Three.js) est embarqué dans les assets et servi depuis une origine
 * https factice (appassets.androidplatform.net) : la sauvegarde localStorage
 * fonctionne donc exactement comme sur le web, et aucune permission INTERNET
 * n'est nécessaire. L'APK est 100 % hors-ligne.
 */
public class MainActivity extends Activity {

    /** origine virtuelle servie par shouldInterceptRequest */
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final String START_URL = ORIGIN + "/assets/game/index.html";
    private static final String UA_APP = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 HGApp";

    private WebView web;
    private AudioManager audio;
    private AudioFocusRequest focusRequest;
    private boolean pageReady = false;

    private static final Map<String, String> MIME = new HashMap<>();
    static {
        MIME.put("html", "text/html");
        MIME.put("js", "application/javascript");
        MIME.put("mjs", "application/javascript");
        MIME.put("css", "text/css");
        MIME.put("json", "application/json");
        MIME.put("png", "image/png");
        MIME.put("jpg", "image/jpeg");
        MIME.put("svg", "image/svg+xml");
        MIME.put("ico", "image/x-icon");
        MIME.put("woff2", "font/woff2");
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_FULL_USER);
        else setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_USER);
        goImmersive();

        audio = (AudioManager) getSystemService(Context.AUDIO_SERVICE);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF0A0E1A);
        root.setFitsSystemWindows(false);

        web = new WebView(this);
        web.setBackgroundColor(0xFF0A0E1A);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setLongClickable(false);
        web.setOnLongClickListener(v -> true);
        web.setHapticFeedbackEnabled(true);
        web.setHorizontalScrollBarEnabled(false);
        web.setVerticalScrollBarEnabled(false);
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // sauvegarde localStorage
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false); // musique dès le premier geste
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);                     //ignore le grossissement système
        s.setUseWideViewPort(false);
        s.setLoadWithOverviewMode(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setGeolocationEnabled(false);
        s.setSaveFormData(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) s.setSafeBrowsingEnabled(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri url = req.getUrl();
                if (url != null && ORIGIN.equals(url.getScheme() + "://" + url.getAuthority())) {
                    WebResourceResponse r = serve(url.getPath());
                    if (r != null) return r;
                }
                // toute autre origine est bloquée : l'application reste hors-ligne
                return new WebResourceResponse("text/plain", "utf-8", null);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return true; // aucune navigation externe
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pageReady = true;
                view.evaluateJavascript("window.HG_NATIVE=true;", null);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                request.deny(); // aucune caméra / micro nécessaire
            }
            @Override public boolean onConsoleMessage(ConsoleMessage m) {
                if (m.messageLevel() == ConsoleMessage.MessageLevel.ERROR)
                    android.util.Log.e("HoodGrow", m.message() + " @" + m.lineNumber());
                return true;
            }
        });
        s.setUserAgentString(UA_APP);

        root.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);
        web.loadUrl(START_URL);
    }

    /** sert un fichier depuis les assets de l'APK */
    private WebResourceResponse serve(String path) {
        if (path == null || !path.startsWith("/assets/")) return null;
        String rel = path.substring("/assets/".length());
        if (rel.contains("..")) return null; // pas de remontée de chemin
        try {
            InputStream in = getAssets().open(rel);
            WebResourceResponse r = new WebResourceResponse(mimeOf(rel), "utf-8", in);
            Map<String, String> h = new HashMap<>();
            h.put("Cache-Control", "no-cache");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) r.setResponseHeaders(h);
            return r;
        } catch (IOException e) {
            return new WebResourceResponse("text/plain", "utf-8", null);
        }
    }

    private static String mimeOf(String path) {
        int i = path.lastIndexOf('.');
        String ext = i < 0 ? "" : path.substring(i + 1).toLowerCase();
        String m = MIME.get(ext);
        return m != null ? m : "application/octet-stream";
    }

    /* ---------------- bouton retour Android ---------------- */
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            handleBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        handleBack();
    }

    /** le jeu répond d'abord (fermer un panneau, mettre en pause) puis on quitte */
    private void handleBack() {
        if (!pageReady || web == null) { super.onBackPressed(); return; }
        web.evaluateJavascript(
                "(function(){try{return !!(window.HG_back&&window.HG_back());}catch(e){return false;}})();",
                value -> {
                    if (!"true".equals(value)) finish();
                });
    }

    /* ---------------- cycle de vie ---------------- */
    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
        requestAudioFocus();
        goImmersive();
        js("window.HG_appResume&&window.HG_appResume();");
    }

    @Override
    protected void onPause() {
        js("window.HG_appPause&&window.HG_appPause();"); // met en pause + sauvegarde
        if (web != null) web.onPause();
        abandonAudioFocus();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            ViewGroupHelper.remove(web);
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    private void js(String code) {
        if (web == null) return;
        try { web.evaluateJavascript(code, null); } catch (Exception ignored) {}
    }

    /* ---------------- plein écran + focus audio ---------------- */
    private void goImmersive() {
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
        if (hasFocus) goImmersive();
    }

    private void requestAudioFocus() {
        if (audio == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (focusRequest == null) {
                focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                        .setAudioAttributes(new AudioAttributes.Builder()
                                .setUsage(AudioAttributes.USAGE_GAME)
                                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
                        .setOnAudioFocusChangeListener(f -> { })
                        .build();
            }
            audio.requestAudioFocus(focusRequest);
        } else {
            audio.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
        }
    }

    private void abandonAudioFocus() {
        if (audio == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (focusRequest != null) audio.abandonAudioFocusRequest(focusRequest);
        } else {
            audio.abandonAudioFocus(null);
        }
    }

    /** petit utilitaire pour détacher la WebView de son parent */
    private static final class ViewGroupHelper {
        static void remove(View v) {
            if (v.getParent() instanceof android.view.ViewGroup)
                ((android.view.ViewGroup) v.getParent()).removeView(v);
        }
    }
}