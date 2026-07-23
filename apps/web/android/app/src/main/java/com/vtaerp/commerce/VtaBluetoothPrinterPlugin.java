package com.vtaerp.commerce;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PermissionState;
import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;

/**
 * Impression Bluetooth directe (ESC/POS) vers une imprimante thermique deja appairee au niveau
 * du systeme Android. Pas de boite de dialogue d'impression : le ticket est rendu en image puis
 * envoye tel quel sur la connexion Bluetooth classique (SPP), comme le font les apps de caisse
 * (ex. Loyverse).
 */
@CapacitorPlugin(
    name = "VtaBluetoothPrinter",
    permissions = {
        @Permission(strings = { android.Manifest.permission.BLUETOOTH_CONNECT }, alias = "bluetooth")
    }
)
public class VtaBluetoothPrinterPlugin extends Plugin {
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final String PREFS_NAME = "vta_bluetooth_printer";
    private static final String PREF_ADDRESS = "address";
    private static final String PREF_NAME = "name";
    private static final int CONNECT_TIMEOUT_MS = 8000;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", BluetoothAdapter.getDefaultAdapter() != null);
        call.resolve(result);
    }

    @PluginMethod
    public void listPaired(PluginCall call) {
        if (getPermissionState("bluetooth") != PermissionState.GRANTED) {
            requestPermissionForAlias("bluetooth", call, "listPairedPermsCallback");
            return;
        }
        doListPaired(call);
    }

    @PermissionCallback
    private void listPairedPermsCallback(PluginCall call) {
        if (getPermissionState("bluetooth") == PermissionState.GRANTED) {
            doListPaired(call);
        } else {
            call.reject("BLUETOOTH_PERMISSION_DENIED");
        }
    }

    private void doListPaired(PluginCall call) {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            call.reject("BLUETOOTH_UNAVAILABLE");
            return;
        }
        try {
            Set<BluetoothDevice> devices = adapter.getBondedDevices();
            JSArray items = new JSArray();
            for (BluetoothDevice device : devices) {
                JSObject item = new JSObject();
                item.put("name", device.getName());
                item.put("address", device.getAddress());
                items.put(item);
            }
            JSObject result = new JSObject();
            result.put("devices", items);
            call.resolve(result);
        } catch (SecurityException exception) {
            call.reject("BLUETOOTH_PERMISSION_DENIED", exception);
        }
    }

    @PluginMethod
    public void getDefaultPrinter(PluginCall call) {
        SharedPreferences prefs = prefs();
        String address = prefs.getString(PREF_ADDRESS, null);
        JSObject result = new JSObject();
        if (address == null) {
            result.put("configured", false);
        } else {
            result.put("configured", true);
            result.put("address", address);
            result.put("name", prefs.getString(PREF_NAME, ""));
        }
        call.resolve(result);
    }

    @PluginMethod
    public void setDefaultPrinter(PluginCall call) {
        String address = call.getString("address");
        if (address == null || address.trim().isEmpty()) {
            call.reject("ADDRESS_REQUIRED");
            return;
        }
        prefs().edit()
            .putString(PREF_ADDRESS, address)
            .putString(PREF_NAME, call.getString("name", ""))
            .apply();
        call.resolve(new JSObject());
    }

    @PluginMethod
    public void clearDefaultPrinter(PluginCall call) {
        prefs().edit().clear().apply();
        call.resolve(new JSObject());
    }

    @PluginMethod
    public void printTicket(PluginCall call) {
        if (getPermissionState("bluetooth") != PermissionState.GRANTED) {
            requestPermissionForAlias("bluetooth", call, "printTicketPermsCallback");
            return;
        }
        doPrintTicket(call);
    }

    @PermissionCallback
    private void printTicketPermsCallback(PluginCall call) {
        if (getPermissionState("bluetooth") == PermissionState.GRANTED) {
            doPrintTicket(call);
        } else {
            call.reject("BLUETOOTH_PERMISSION_DENIED");
        }
    }

    private void doPrintTicket(PluginCall call) {
        String html = call.getString("html");
        if (html == null || html.trim().isEmpty()) {
            call.reject("HTML_REQUIRED");
            return;
        }
        String address = call.getString("address");
        int widthDots = call.getInt("widthDots", 576);
        if (address == null || address.trim().isEmpty()) {
            address = prefs().getString(PREF_ADDRESS, null);
        }
        if (address == null) {
            call.reject("NO_PRINTER_CONFIGURED");
            return;
        }
        final String targetAddress = address;
        final int dots = widthDots;

        mainHandler.post(() -> renderTicketToBitmap(html, dots, bitmap -> {
            if (bitmap == null) {
                call.reject("RENDER_FAILED");
                return;
            }
            new Thread(() -> sendBitmapOverBluetooth(call, targetAddress, bitmap)).start();
        }));
    }

    private interface BitmapReady {
        void onReady(Bitmap bitmap);
    }

    // Largeur de mise en page initiale, generreuse, uniquement pour laisser le contenu (mm ou px)
    // se mettre en page a sa taille naturelle sans etre artificiellement retreci. Tous les
    // gabarits de ticket declarent une largeur explicite sur html/body (en mm ou en px), donc
    // cette valeur n'affecte pas le resultat : elle sert juste de "canvas" assez large.
    private static final int INITIAL_LAYOUT_WIDTH_PX = 2000;

    private void renderTicketToBitmap(String html, int widthDots, BitmapReady callback) {
        WebView webView = new WebView(getActivity());
        // Rendu logiciel obligatoire : cette WebView n'est jamais attachee a une fenetre, et en
        // accélération matérielle (par defaut), view.draw(canvas) produit une capture vide.
        webView.setLayerType(WebView.LAYER_TYPE_SOFTWARE, null);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(false);

        webView.measure(
            WebView.MeasureSpec.makeMeasureSpec(INITIAL_LAYOUT_WIDTH_PX, WebView.MeasureSpec.EXACTLY),
            WebView.MeasureSpec.makeMeasureSpec(1, WebView.MeasureSpec.EXACTLY)
        );
        webView.layout(0, 0, INITIAL_LAYOUT_WIDTH_PX, 1);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                mainHandler.postDelayed(() -> {
                    // Les gabarits de ticket (facture reelle en mm, ticket de test en px) declarent
                    // tous une largeur explicite sur html/body : on la mesure directement dans le
                    // DOM plutot que de deviner un facteur d'echelle, ce qui marche quel que soit
                    // le systeme d'unites utilise par le gabarit. getBoundingClientRect().width
                    // (pas scrollWidth) : le gabarit reel utilise "overflow-x:hidden" pour masquer
                    // un contenu qui deborde de la largeur voulue, mais scrollWidth capte quand
                    // meme ce debordement cache. getBoundingClientRect() respecte la contrainte de
                    // largeur CSS (mm/px) telle que voulue, sans etre pollue par ce debordement.
                    view.evaluateJavascript(
                        "document.documentElement.getBoundingClientRect().width",
                        (String result) -> {
                            int measuredWidthPx;
                            try {
                                measuredWidthPx = (int) Math.round(Double.parseDouble(result));
                            } catch (Exception exception) {
                                measuredWidthPx = 0;
                            }
                            if (measuredWidthPx <= 0) {
                                measuredWidthPx = INITIAL_LAYOUT_WIDTH_PX;
                            }
                            layoutAndCapture(view, widthDots, measuredWidthPx, callback);
                        }
                    );
                }, 350);
            }
        });
        webView.loadDataWithBaseURL("https://vtaerp.com/", html, "text/html", "UTF-8", null);
    }

    private void layoutAndCapture(WebView view, int widthDots, int measuredWidthPx, BitmapReady callback) {
        try {
            float scale = widthDots / (float) measuredWidthPx;

            // Reflow a la largeur naturelle mesuree. Hauteur EXACTLY minimale (pas une grande
            // valeur) : WebView ne calcule pas une vraie hauteur intrinseque avec getContentHeight()
            // sinon, elle echo simplement la borne donnee (constate plus tot : donner 10000 fait
            // reapparaitre un enorme espace blanc). On attend un postVisualStateCallback avant de
            // lire getContentHeight() : un measure()/layout() qui CHANGE la largeur apres le
            // chargement initial ne se reflete pas forcement de facon synchrone dans Chromium
            // (constate : sans cette attente, getContentHeight() peut refleter l'ancienne largeur
            // et produire une capture tronquee/rognee).
            view.measure(
                WebView.MeasureSpec.makeMeasureSpec(measuredWidthPx, WebView.MeasureSpec.EXACTLY),
                WebView.MeasureSpec.makeMeasureSpec(1, WebView.MeasureSpec.EXACTLY)
            );
            view.layout(0, 0, measuredWidthPx, 1);
            view.postVisualStateCallback(1, new WebView.VisualStateCallback() {
                @Override
                public void onComplete(long requestId) {
                    captureAtFinalHeight(view, widthDots, measuredWidthPx, scale, callback);
                }
            });
            view.invalidate();
        } catch (Exception exception) {
            Log.e("VtaBtPrint", "layoutAndCapture failed", exception);
            view.destroy();
            callback.onReady(null);
        }
    }

    private void captureAtFinalHeight(WebView view, int widthDots, int measuredWidthPx, float scale, BitmapReady callback) {
        try {
            // Garde-fou : borne la hauteur a une plage raisonnable (jusqu'a ~125cm de ticket une
            // fois agrandie) au cas ou le contenu ou la mesure WebView deraille.
            int contentHeight = Math.min((int) (10000 / scale), Math.max(20, view.getContentHeight()));

            view.measure(
                WebView.MeasureSpec.makeMeasureSpec(measuredWidthPx, WebView.MeasureSpec.EXACTLY),
                WebView.MeasureSpec.makeMeasureSpec(contentHeight, WebView.MeasureSpec.EXACTLY)
            );
            view.layout(0, 0, measuredWidthPx, contentHeight);

            final int finalContentHeight = contentHeight;
            // Deuxieme attente : la mise en page precedente utilisait une hauteur volontairement
            // trop grande (10000) pour laisser le contenu respirer ; celle-ci passe a la vraie
            // hauteur avant la capture, et doit donc, elle aussi, etre confirmee commitee.
            view.postVisualStateCallback(2, new WebView.VisualStateCallback() {
                @Override
                public void onComplete(long requestId) {
                    boolean[] destroyed = { false };
                    try {
                        Bitmap smallBitmap = Bitmap.createBitmap(measuredWidthPx, finalContentHeight, Bitmap.Config.ARGB_8888);
                        Canvas canvas = new Canvas(smallBitmap);
                        canvas.drawColor(Color.WHITE);
                        view.draw(canvas);
                        view.destroy();
                        destroyed[0] = true;

                        int scaledHeight = Math.round(finalContentHeight * scale);
                        Bitmap bitmap = Bitmap.createScaledBitmap(smallBitmap, widthDots, scaledHeight, true);
                        smallBitmap.recycle();
                        callback.onReady(bitmap);
                    } catch (Exception exception) {
                        Log.e("VtaBtPrint", "capture failed", exception);
                        if (!destroyed[0]) view.destroy();
                        callback.onReady(null);
                    }
                }
            });
            view.invalidate();
        } catch (Exception exception) {
            Log.e("VtaBtPrint", "captureAtFinalHeight failed", exception);
            view.destroy();
            callback.onReady(null);
        }
    }

    private void sendBitmapOverBluetooth(PluginCall call, String address, Bitmap bitmap) {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            mainHandler.post(() -> call.reject("BLUETOOTH_UNAVAILABLE"));
            bitmap.recycle();
            return;
        }
        try {
            if (adapter.isDiscovering()) {
                adapter.cancelDiscovery();
            }
        } catch (Exception ignored) {
            // pas grave si on ne peut pas annuler la decouverte
        }

        BluetoothDevice device;
        try {
            device = adapter.getRemoteDevice(address);
        } catch (Exception exception) {
            mainHandler.post(() -> call.reject("INVALID_ADDRESS", exception));
            bitmap.recycle();
            return;
        }

        BluetoothSocket socket = connectWithFallback(device);
        if (socket == null) {
            mainHandler.post(() -> call.reject("CONNECTION_FAILED"));
            bitmap.recycle();
            return;
        }

        try {
            OutputStream out = socket.getOutputStream();
            out.write(new byte[] { 0x1B, 0x40 }); // ESC @ : reinitialise l'imprimante
            out.write(buildRasterCommand(bitmap));
            out.write(new byte[] { 0x1B, 0x64, 0x05 }); // ESC d 5 : avance papier pour degager le massicot
            out.write(new byte[] { 0x1D, 0x56, 0x00 }); // GS V 0 : coupe papier complete
            out.flush();
            // flush() ne garantit pas que la pile Bluetooth a fini d'emettre les derniers octets
            // sur les ondes, ni que l'imprimante a fini de physiquement imprimer/avancer/couper :
            // fermer le socket trop tot coupe la transmission ET peut interrompre le moteur du
            // massicot en plein cycle (l'imprimante a une etiquette avertissant que le massicot
            // se bloque et necessite un appui sur FEED ou un redemarrage dans ce cas). Le delai
            // est proportionnel a la hauteur du ticket : un gros ticket (facture avec plusieurs
            // articles) prend physiquement plus de temps a imprimer qu'un petit ticket de test,
            // et un delai fixe risquerait de couper la connexion avant la fin sur un gros ticket.
            int estimatedPrintMs = 800 + (bitmap.getHeight() * 3);
            try {
                Thread.sleep(Math.min(15000, estimatedPrintMs));
            } catch (InterruptedException ignored) {
                // rien a faire
            }
            final String resolvedAddress = address;
            mainHandler.post(() -> {
                JSObject result = new JSObject();
                result.put("status", "printed");
                result.put("address", resolvedAddress);
                call.resolve(result);
            });
        } catch (Exception exception) {
            mainHandler.post(() -> call.reject("PRINT_FAILED", exception));
        } finally {
            try {
                socket.close();
            } catch (Exception ignored) {
                // rien a faire si la fermeture echoue
            }
            bitmap.recycle();
        }
    }

    private interface SocketFactory {
        BluetoothSocket create() throws Exception;
    }

    /**
     * Beaucoup d'imprimantes thermiques bon marche ont un enregistrement SDP peu fiable : le
     * socket securise standard peut echouer ou bloquer indefiniment. On essaie plusieurs
     * strategies dans l'ordre, chacune avec un timeout explicite, avant d'abandonner.
     */
    private BluetoothSocket connectWithFallback(BluetoothDevice device) {
        BluetoothSocket socket = tryConnect(() -> device.createRfcommSocketToServiceRecord(SPP_UUID));
        if (socket != null) {
            return socket;
        }

        socket = tryConnect(() -> device.createInsecureRfcommSocketToServiceRecord(SPP_UUID));
        if (socket != null) {
            return socket;
        }

        // Repli final : connexion directe au canal RFCOMM 1 par reflexion, en contournant
        // completement le SDP (solution de repli courante pour ce type d'imprimante).
        return tryConnect(() -> {
            java.lang.reflect.Method method = device.getClass().getMethod("createRfcommSocket", int.class);
            return (BluetoothSocket) method.invoke(device, 1);
        });
    }

    private BluetoothSocket tryConnect(SocketFactory factory) {
        BluetoothSocket socket;
        try {
            socket = factory.create();
        } catch (Exception exception) {
            return null;
        }

        final BluetoothSocket finalSocket = socket;
        Thread watchdog = new Thread(() -> {
            try {
                Thread.sleep(CONNECT_TIMEOUT_MS);
                finalSocket.close();
            } catch (InterruptedException interrupted) {
                // connect() a deja abouti (succes ou echec) : rien a faire
            } catch (Exception ignored) {
                // le socket est peut-etre deja ferme
            }
        });
        watchdog.setDaemon(true);
        watchdog.start();

        try {
            socket.connect();
            watchdog.interrupt();
            return socket;
        } catch (Exception exception) {
            watchdog.interrupt();
            try {
                socket.close();
            } catch (Exception ignored) {
                // rien a faire si la fermeture echoue
            }
            return null;
        }
    }

    /** Convertit un bitmap en commande ESC/POS "GS v 0" (image raster monochrome). */
    private byte[] buildRasterCommand(Bitmap source) {
        int width = source.getWidth();
        int height = source.getHeight();
        int widthBytes = (width + 7) / 8;
        byte[] header = new byte[] {
            0x1D, 0x76, 0x30, 0x00,
            (byte) (widthBytes & 0xFF), (byte) ((widthBytes >> 8) & 0xFF),
            (byte) (height & 0xFF), (byte) ((height >> 8) & 0xFF)
        };
        byte[] data = new byte[widthBytes * height];
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int pixel = source.getPixel(x, y);
                int gray = (Color.red(pixel) + Color.green(pixel) + Color.blue(pixel)) / 3;
                boolean black = gray < 200;
                if (black) {
                    int byteIndex = y * widthBytes + (x / 8);
                    data[byteIndex] |= (byte) (0x80 >> (x % 8));
                }
            }
        }
        byte[] command = new byte[header.length + data.length];
        System.arraycopy(header, 0, command, 0, header.length);
        System.arraycopy(data, 0, command, header.length, data.length);
        return command;
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }
}
