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
        int widthDots = call.getInt("widthDots", 384);
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

    private void renderTicketToBitmap(String html, int widthDots, BitmapReady callback) {
        WebView webView = new WebView(getActivity());
        webView.getSettings().setJavaScriptEnabled(false);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(false);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                mainHandler.postDelayed(() -> {
                    try {
                        int contentHeight = Math.max(1, view.getContentHeight());
                        view.measure(
                            WebView.MeasureSpec.makeMeasureSpec(widthDots, WebView.MeasureSpec.EXACTLY),
                            WebView.MeasureSpec.makeMeasureSpec(contentHeight, WebView.MeasureSpec.AT_MOST)
                        );
                        view.layout(0, 0, widthDots, contentHeight);
                        Bitmap bitmap = Bitmap.createBitmap(widthDots, contentHeight, Bitmap.Config.ARGB_8888);
                        Canvas canvas = new Canvas(bitmap);
                        canvas.drawColor(Color.WHITE);
                        view.draw(canvas);
                        view.destroy();
                        callback.onReady(bitmap);
                    } catch (Exception exception) {
                        view.destroy();
                        callback.onReady(null);
                    }
                }, 350);
            }
        });
        webView.loadDataWithBaseURL("https://vtaerp.com/", html, "text/html", "UTF-8", null);
    }

    private void sendBitmapOverBluetooth(PluginCall call, String address, Bitmap bitmap) {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            mainHandler.post(() -> call.reject("BLUETOOTH_UNAVAILABLE"));
            return;
        }
        BluetoothDevice device;
        BluetoothSocket socket = null;
        try {
            device = adapter.getRemoteDevice(address);
            socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            socket.connect();
            OutputStream out = socket.getOutputStream();
            out.write(new byte[] { 0x1B, 0x40 }); // ESC @ : reinitialise l'imprimante
            out.write(buildRasterCommand(bitmap));
            out.write(new byte[] { 0x1B, 0x64, 0x03 }); // ESC d 3 : avance papier
            out.write(new byte[] { 0x1D, 0x56, 0x00 }); // GS V 0 : coupe papier (si supportee, sinon ignoree)
            out.flush();
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
            if (socket != null) {
                try {
                    socket.close();
                } catch (Exception ignored) {
                    // rien a faire si la fermeture echoue
                }
            }
            bitmap.recycle();
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
