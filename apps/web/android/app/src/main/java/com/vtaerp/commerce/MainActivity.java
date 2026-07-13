package com.vtaerp.commerce;

import android.app.AlertDialog;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(VtaNativePrintPlugin.class);
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                handleAndroidBack();
            }
        });
    }

    private void handleAndroidBack() {
        WebView webView = bridge != null ? bridge.getWebView() : null;
        if (webView == null) {
            confirmExit();
            return;
        }

        webView.evaluateJavascript(buildBackScript(), result -> {
            if (result != null && result.contains("exit")) {
                confirmExit();
            }
        });
    }

    private void confirmExit() {
        new AlertDialog.Builder(this)
            .setTitle("Quitter VTA Commerce ?")
            .setMessage("Voulez-vous fermer l'application ?")
            .setNegativeButton("Annuler", null)
            .setPositiveButton("Quitter", (dialog, which) -> moveTaskToBack(true))
            .show();
    }

    private String buildBackScript() {
        return "(function(){"
            + "try{"
            + "var closeSelectors=['[aria-label=\"Fermer\"]','button[title=\"Fermer\"]'];"
            + "var modal=document.querySelector('[role=\"dialog\"],.fixed.inset-0,.modal,.bottom-sheet');"
            + "if(modal){for(var i=0;i<closeSelectors.length;i++){var c=modal.querySelector(closeSelectors[i]);if(c){c.click();return 'handled';}}"
            + "var buttons=[].slice.call(modal.querySelectorAll('button'));var close=buttons.find(function(b){return /Fermer|Annuler|Retour/i.test(b.textContent||'');});if(close){close.click();return 'handled';}}"
            + "var openMenu=document.querySelector('[data-mobile-menu-open=\"true\"],[data-sidebar-open=\"true\"]');"
            + "if(openMenu){var menuClose=document.querySelector('[aria-label=\"Fermer le menu\"],[aria-label=\"Fermer\"]');if(menuClose){menuClose.click();return 'handled';}}"
            + "var path=location.pathname;"
            + "if(path==='/'||path==='/login'||path==='/dashboard'){return 'exit';}"
            + "if(window.__vtaBackStack&&window.__vtaBackStack.length>1){while(window.__vtaBackStack.length>1&&window.__vtaBackStack[window.__vtaBackStack.length-1]===location.href){window.__vtaBackStack.pop();}var target=window.__vtaBackStack[window.__vtaBackStack.length-1];if(target&&target!==location.href){location.href=target;return 'handled';}}"
            + "if(history.length>1){history.back();return 'handled';}"
            + "location.href='/dashboard';return 'handled';"
            + "}catch(e){return 'exit';}"
            + "})();";
    }
}
