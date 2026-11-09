package com.testgame.gravityjanitor;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;

/** Thin fullscreen shell: the whole game is the HTML5 page in assets/. */
public class MainActivity extends Activity {
    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        web.setBackgroundColor(0xFF070B1A);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // saved progress lives in localStorage
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportZoom(false);
        s.setTextZoom(100);
        setContentView(web);
        if (savedInstanceState == null) {
            web.loadUrl("file:///android_asset/index.html");
        } else {
            web.restoreState(savedInstanceState);
        }
        goImmersive();
    }

    @SuppressWarnings("deprecation")
    private void goImmersive() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) goImmersive();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onPause() {
        web.evaluateJavascript("window.gjPause && window.gjPause(true)", null);
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        web.evaluateJavascript("window.gjPause && window.gjPause(false)", null);
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        // Let the game close its own screens first; leave the app from the title screen.
        web.evaluateJavascript("!!(window.gjBack && window.gjBack())", value -> {
            if (!"true".equals(value)) finish();
        });
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }
}
