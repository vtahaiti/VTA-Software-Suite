package com.vtaerp.commerce;

import android.content.Context;
import android.content.Intent;
import android.graphics.Canvas;
import android.graphics.pdf.PdfDocument;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.util.Base64;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.WebViewListener;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.util.Locale;

@CapacitorPlugin(name = "VtaNativePrint")
public class VtaNativePrintPlugin extends Plugin {
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Runnable bridgeInstaller = new Runnable() {
        @Override
        public void run() {
            injectPrintBridge();
            mainHandler.postDelayed(this, 1000);
        }
    };

    @Override
    public void load() {
        bridge.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                webView.evaluateJavascript(buildPrintBridgeScript(), null);
            }
        });
        mainHandler.postDelayed(bridgeInstaller, 1000);
    }

    private void injectPrintBridge() {
        if (bridge == null || bridge.getWebView() == null) {
            return;
        }
        bridge.getWebView().evaluateJavascript(buildPrintBridgeScript(), null);
    }

    @PluginMethod
    public void printHtml(PluginCall call) {
        String html = call.getString("html");
        if (html == null || html.trim().isEmpty()) {
            call.reject("HTML_REQUIRED");
            return;
        }

        String title = safeDocumentName(call.getString("title", "VTA Commerce"));
        String format = call.getString("format", "80");
        String orientation = call.getString("orientation", "portrait");

        mainHandler.post(() -> {
            WebView webView = createPrintWebView();
            webView.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    mainHandler.postDelayed(() -> {
                        try {
                            PrintManager printManager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                            PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(title);
                            printManager.print(title, adapter, buildPrintAttributes(format, orientation));
                            JSObject result = new JSObject();
                            result.put("status", "opened");
                            call.resolve(result);
                            destroyLater(view);
                        } catch (Exception exception) {
                            view.destroy();
                            call.reject("PRINT_FAILED", exception);
                        }
                    }, 350);
                }
            });
            webView.loadDataWithBaseURL("https://vtaerp.com/", html, "text/html", "UTF-8", null);
        });
    }

    @PluginMethod
    public void sharePdf(PluginCall call) {
        String html = call.getString("html");
        if (html == null || html.trim().isEmpty()) {
            call.reject("HTML_REQUIRED");
            return;
        }

        String title = safeDocumentName(call.getString("title", "VTA Commerce"));
        String fileName = safeFileName(call.getString("fileName", "vta-commerce.pdf"));
        String format = call.getString("format", "80");
        String orientation = call.getString("orientation", "portrait");

        mainHandler.post(() -> {
            cleanupOldPrintFiles();
            File outputFile = new File(getContext().getCacheDir(), fileName);
            WebView webView = createPrintWebView();
            webView.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    mainHandler.postDelayed(() -> writePdfAndShare(call, view, outputFile, title, format, orientation), 350);
                }
            });
            webView.loadDataWithBaseURL("https://vtaerp.com/", html, "text/html", "UTF-8", null);
        });
    }

    @PluginMethod
    public void shareBase64File(PluginCall call) {
        String base64 = call.getString("base64");
        if (base64 == null || base64.trim().isEmpty()) {
            call.reject("FILE_REQUIRED");
            return;
        }

        String fileName = safeFileName(call.getString("fileName", "vta-commerce-export.bin"), false);
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String title = safeDocumentName(call.getString("title", fileName));

        mainHandler.post(() -> {
            try {
                cleanupOldExportFiles();
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                File outputFile = new File(getContext().getCacheDir(), fileName);
                try (FileOutputStream output = new FileOutputStream(outputFile)) {
                    output.write(bytes);
                }
                shareFile(call, outputFile, title, mimeType);
            } catch (Exception exception) {
                call.reject("FILE_SHARE_FAILED", exception);
            }
        });
    }

    private WebView createPrintWebView() {
        WebView webView = new WebView(getActivity());
        webView.getSettings().setJavaScriptEnabled(false);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(false);
        return webView;
    }

    private void writePdfAndShare(
        PluginCall call,
        WebView webView,
        File outputFile,
        String title,
        String format,
        String orientation
    ) {
        try {
            PdfPageSize pageSize = resolvePdfPageSize(format, orientation);
            int contentHeight = Math.max(pageSize.height, webView.getContentHeight() * Math.max(1, (int) webView.getScale()));
            webView.measure(
                WebView.MeasureSpec.makeMeasureSpec(pageSize.width, WebView.MeasureSpec.EXACTLY),
                WebView.MeasureSpec.makeMeasureSpec(contentHeight, WebView.MeasureSpec.AT_MOST)
            );
            webView.layout(0, 0, pageSize.width, contentHeight);

            PdfDocument document = new PdfDocument();
            int top = 0;
            int pageNumber = 1;
            while (top < contentHeight) {
                PdfDocument.PageInfo pageInfo = new PdfDocument.PageInfo.Builder(pageSize.width, pageSize.height, pageNumber).create();
                PdfDocument.Page page = document.startPage(pageInfo);
                Canvas canvas = page.getCanvas();
                canvas.translate(0, -top);
                webView.draw(canvas);
                document.finishPage(page);
                top += pageSize.height;
                pageNumber += 1;
            }

            try (FileOutputStream output = new FileOutputStream(outputFile)) {
                document.writeTo(output);
            }
            document.close();
            sharePdfFile(call, outputFile, title);
            destroyLater(webView);
        } catch (Exception exception) {
            webView.destroy();
            call.reject("PDF_CREATE_FAILED", exception);
        }
    }

    private void sharePdfFile(PluginCall call, File outputFile, String title) {
        shareFile(call, outputFile, title, "application/pdf");
    }

    private void shareFile(PluginCall call, File outputFile, String title, String mimeType) {
        Uri uri = FileProvider.getUriForFile(getActivity(), getContext().getPackageName() + ".fileprovider", outputFile);
        Intent intent = new Intent(Intent.ACTION_SEND);
        intent.setType(mimeType == null || mimeType.trim().isEmpty() ? "application/octet-stream" : mimeType);
        intent.putExtra(Intent.EXTRA_STREAM, uri);
        intent.putExtra(Intent.EXTRA_SUBJECT, title);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        Intent chooser = Intent.createChooser(intent, "Partager le fichier");
        getActivity().startActivity(chooser);

        JSObject result = new JSObject();
        result.put("status", "shared");
        result.put("uri", uri.toString());
        call.resolve(result);
    }

    private PrintAttributes buildPrintAttributes(String format, String orientation) {
        PrintAttributes.MediaSize mediaSize;
        switch (format == null ? "" : format.toUpperCase(Locale.US)) {
            case "58":
                mediaSize = new PrintAttributes.MediaSize("VTA_TICKET_58", "Ticket 58 mm", 2283, 12000);
                break;
            case "A4":
                mediaSize = PrintAttributes.MediaSize.ISO_A4;
                break;
            case "LETTER":
                mediaSize = PrintAttributes.MediaSize.NA_LETTER;
                break;
            case "80":
            default:
                mediaSize = new PrintAttributes.MediaSize("VTA_TICKET_80", "Ticket 80 mm", 3150, 12000);
                break;
        }

        if ("landscape".equalsIgnoreCase(orientation)) {
            mediaSize = mediaSize.asLandscape();
        } else {
            mediaSize = mediaSize.asPortrait();
        }

        return new PrintAttributes.Builder()
            .setMediaSize(mediaSize)
            .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
            .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
            .setResolution(new PrintAttributes.Resolution("vta_pdf", "VTA Commerce", 300, 300))
            .build();
    }

    private PdfPageSize resolvePdfPageSize(String format, String orientation) {
        PdfPageSize size;
        switch (format == null ? "" : format.toUpperCase(Locale.US)) {
            case "58":
                size = new PdfPageSize(228, 1200);
                break;
            case "A4":
                size = new PdfPageSize(595, 842);
                break;
            case "LETTER":
                size = new PdfPageSize(612, 792);
                break;
            case "80":
            default:
                size = new PdfPageSize(315, 1200);
                break;
        }
        if ("landscape".equalsIgnoreCase(orientation) && size.height > size.width) {
            return new PdfPageSize(size.height, size.width);
        }
        return size;
    }

    private static class PdfPageSize {
        final int width;
        final int height;

        PdfPageSize(int width, int height) {
            this.width = width;
            this.height = height;
        }
    }

    private void destroyLater(WebView webView) {
        mainHandler.postDelayed(webView::destroy, 180000);
    }

    private void cleanupOldPrintFiles() {
        File cacheDir = getContext().getCacheDir();
        File[] files = cacheDir.listFiles((dir, name) -> name.startsWith("ticket-vta-") || name.startsWith("vta-commerce"));
        if (files == null) return;
        long cutoff = System.currentTimeMillis() - 24L * 60L * 60L * 1000L;
        for (File file : files) {
            if (file.lastModified() < cutoff) {
                file.delete();
            }
        }
    }

    private void cleanupOldExportFiles() {
        File cacheDir = getContext().getCacheDir();
        File[] files = cacheDir.listFiles((dir, name) -> name.startsWith("vta-export-") || name.startsWith("ticket-vta-") || name.startsWith("vta-commerce"));
        if (files == null) return;
        long cutoff = System.currentTimeMillis() - 24L * 60L * 60L * 1000L;
        for (File file : files) {
            if (file.lastModified() < cutoff) {
                file.delete();
            }
        }
    }

    private String safeDocumentName(String value) {
        String cleaned = value == null ? "VTA Commerce" : value.replaceAll("[\\r\\n\\t]+", " ").trim();
        return cleaned.isEmpty() ? "VTA Commerce" : cleaned;
    }

    private String safeFileName(String value) {
        return safeFileName(value, true);
    }

    private String safeFileName(String value, boolean forcePdf) {
        String cleaned = value == null ? "vta-commerce.pdf" : value.replaceAll("[^a-zA-Z0-9._-]", "-");
        if (cleaned.isEmpty()) {
            cleaned = "vta-export.bin";
        }
        if (forcePdf && !cleaned.toLowerCase(Locale.US).endsWith(".pdf")) {
            cleaned += ".pdf";
        }
        return cleaned;
    }

    private String buildPrintBridgeScript() {
        return "(function(){"
            + "if(window.__vtaNativePrintBridgeInstalled)return;"
            + "window.__vtaNativePrintBridgeInstalled=true;"
            + "window.__vtaBackStack=window.__vtaBackStack||[location.href];"
            + "setInterval(function(){try{var s=window.__vtaBackStack;if(s[s.length-1]!==location.href)s.push(location.href);if(s.length>25)s.splice(0,s.length-25);}catch(e){}},500);"
            + "function restoreNativeSession(){try{if(location.pathname==='/'&&localStorage.getItem('vta_access_token')&&localStorage.getItem('vta_refresh_token')){location.replace('/dashboard');}}catch(e){}}"
            + "restoreNativeSession();"
            + "var originalOpen=window.open;"
            + "window.open=function(url,target,features){"
            + "try{if(url&&String(url).indexOf('/dashboard/pos/print')!==-1){window.location.href=new URL(String(url),window.location.origin).href;return{focus:function(){}};}}catch(e){}"
            + "return originalOpen?originalOpen.apply(window,arguments):null;"
            + "};"
            + "function ticketWidth(){try{return new URLSearchParams(window.location.search).get('width')==='58'?'58':'80';}catch(e){return'80';}}"
            + "function ticketHtml(){var f=document.querySelector('iframe[title=\"Ticket POS\"]');if(!f)return'';try{return f.srcdoc||(f.contentDocument&&f.contentDocument.documentElement&&f.contentDocument.documentElement.outerHTML)||'';}catch(e){return f.srcdoc||'';}}"
            + "function nativePrint(){var html=ticketHtml();if(!html||!window.Capacitor||!window.Capacitor.Plugins||!window.Capacitor.Plugins.VtaNativePrint)return false;var w=ticketWidth();window.Capacitor.Plugins.VtaNativePrint.printHtml({html:html,title:'Ticket VTA Commerce '+w+' mm',format:w});return true;}"
            + "function nativeShare(){var html=ticketHtml();if(!html||!window.Capacitor||!window.Capacitor.Plugins||!window.Capacitor.Plugins.VtaNativePrint)return false;var w=ticketWidth();window.Capacitor.Plugins.VtaNativePrint.sharePdf({html:html,title:'Ticket VTA Commerce '+w+' mm',fileName:'ticket-vta-'+w+'mm.pdf',format:w});return true;}"
            + "function patchTicketPage(){if(window.location.pathname.indexOf('/dashboard/pos/print')===-1)return;"
            + "var frame=document.querySelector('iframe[title=\"Ticket POS\"]');if(frame&&frame.contentWindow&&!frame.contentWindow.__vtaNativePrintPatched){try{frame.contentWindow.__vtaNativePrintPatched=true;frame.contentWindow.print=function(){nativePrint();};}catch(e){}}"
            + "var buttons=document.querySelectorAll('button');for(var i=0;i<buttons.length;i++){var b=buttons[i];var text=(b.textContent||'').trim();if(/Imprimer/i.test(text)&&!b.dataset.vtaNativePrint){b.dataset.vtaNativePrint='1';b.addEventListener('click',function(ev){if(nativePrint()){ev.preventDefault();ev.stopImmediatePropagation();}},true);}}"
            + "if(!document.querySelector('[data-vta-native-share]')){var printButton=[].slice.call(buttons).find(function(btn){return /Imprimer/i.test(btn.textContent||'');});if(printButton&&printButton.parentElement){var share=document.createElement('button');share.type='button';share.textContent='Partager en PDF';share.dataset.vtaNativeShare='1';share.className=printButton.className;share.addEventListener('click',function(ev){if(nativeShare()){ev.preventDefault();ev.stopImmediatePropagation();}},true);printButton.parentElement.insertBefore(share,printButton);}}"
            + "}"
            + "function fileNameFromResponse(response,url){var cd=response.headers.get('content-disposition')||'';var m=/filename\\*?=(?:UTF-8''|\\\")?([^\\\";]+)/i.exec(cd);if(m)return decodeURIComponent(m[1].replace(/\\\"/g,''));var last=String(url).split('/').filter(Boolean).pop()||'export';var ext=(response.headers.get('content-type')||'').indexOf('spreadsheet')!==-1?'xlsx':((response.headers.get('content-type')||'').indexOf('pdf')!==-1?'pdf':'csv');return 'vta-export-'+last+'.'+ext;}"
            + "function toBase64(buffer){var binary='';var bytes=new Uint8Array(buffer);var chunk=0x8000;for(var i=0;i<bytes.length;i+=chunk){binary+=String.fromCharCode.apply(null,bytes.subarray(i,i+chunk));}return btoa(binary);}"
            + "async function downloadAuthenticated(url){"
            + "var token=localStorage.getItem('vta_access_token');if(!token){alert('Session expirée. Reconnectez-vous pour télécharger ce fichier.');return;}"
            + "try{var response=await fetch(url,{headers:{Authorization:'Bearer '+token},credentials:'include'});var type=response.headers.get('content-type')||'application/octet-stream';if(!response.ok){alert(response.status===401?'Session expirée. Reconnectez-vous.':response.status===403?'Accès non autorisé.':response.status===404?'Fichier introuvable.':'Téléchargement impossible.');return;}if(type.indexOf('application/json')!==-1){alert('Le serveur a retourné une erreur au lieu du fichier.');return;}var buffer=await response.arrayBuffer();if(!buffer.byteLength){alert('Le fichier téléchargé est vide.');return;}var fileName=fileNameFromResponse(response,url);if(window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.VtaNativePrint){await window.Capacitor.Plugins.VtaNativePrint.shareBase64File({base64:toBase64(buffer),fileName:fileName,mimeType:type,title:fileName});return;}var blob=new Blob([buffer],{type:type});var objectUrl=URL.createObjectURL(blob);var a=document.createElement('a');a.href=objectUrl;a.download=fileName;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(objectUrl);}"
            + "catch(e){alert('Erreur réseau pendant le téléchargement.');}"
            + "}"
            + "function patchAuthenticatedDownloads(){var links=document.querySelectorAll('a[href*=\"/import-export/\"],a[href*=\"/pdf\"],a[href*=\"/export/\"]');for(var i=0;i<links.length;i++){var a=links[i];if(a.dataset.vtaAuthDownload)return;var href=a.href||'';if(href.indexOf('api.vtaerp.com')===-1&&href.indexOf('/api/')===-1)continue;a.dataset.vtaAuthDownload='1';a.addEventListener('click',function(ev){ev.preventDefault();ev.stopImmediatePropagation();downloadAuthenticated(this.href);},true);}}"
            + "setInterval(patchTicketPage,500);patchTicketPage();"
            + "setInterval(patchAuthenticatedDownloads,500);patchAuthenticatedDownloads();"
            + "})();";
    }
}
