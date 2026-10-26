package com.amine.hotspotmanager

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.graphics.Typeface
import android.view.Gravity
import android.view.ViewGroup
import android.widget.*
import org.json.JSONArray
import org.json.JSONObject

data class DeviceEntry(
    var name: String,
    var ip: String,
    var limitMb: Int,
    var usedMb: Int
)

class MainActivity : Activity() {
    private val prefs by lazy { getSharedPreferences("hotspot_manager", Context.MODE_PRIVATE) }
    private lateinit var root: LinearLayout
    private lateinit var list: LinearLayout
    private val devices = mutableListOf<DeviceEntry>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        loadDevices()
        buildUi()
    }

    private fun buildUi() {
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(20), dp(18), dp(18))
            setBackgroundColor(0xFF0B1220.toInt())
        }
        val scroll = ScrollView(this)
        val content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        scroll.addView(content)
        root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))

        content.addView(text("HOTSPOT MANAGER", 25, 0xFFFFFFFF.toInt(), true))
        content.addView(text("TCL • Android 14", 14, 0xFF9CAFC8.toInt()))
        content.addView(space(14))
        val notice = TextView(this).apply {
            text = "Device discovery is best-effort. Android does not give ordinary apps reliable per-device data totals or permission to force-disconnect hotspot clients. Quotas here are reminders, not network-enforced limits."
            textSize = 13f
            setTextColor(0xFFFFD58A.toInt())
            setPadding(dp(12), dp(12), dp(12), dp(12))
            setBackgroundColor(0xFF332719.toInt())
        }
        content.addView(notice)
        content.addView(space(14))

        val actions = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        actions.addView(button("Refresh devices") { discoverDevices() }, LinearLayout.LayoutParams(0, dp(48), 1f))
        actions.addView(spaceWidth(8))
        actions.addView(button("Hotspot settings") { openHotspotSettings() }, LinearLayout.LayoutParams(0, dp(48), 1f))
        content.addView(actions)
        content.addView(space(8))
        content.addView(button("+ Add device / usage") { showAddDialog(null) })
        content.addView(space(16))
        content.addView(text("YOUR DEVICES", 17, 0xFFFFFFFF.toInt(), true))
        content.addView(text("Enter usage from your phone/carrier statistics. Per-device usage cannot be measured reliably by this app.", 12, 0xFF9CAFC8.toInt()))
        content.addView(space(8))
        list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        content.addView(list)
        renderDevices()
        setContentView(root)
    }

    private fun renderDevices() {
        if (!::list.isInitialized) return
        list.removeAllViews()
        if (devices.isEmpty()) {
            list.addView(text("No saved devices yet. Tap Refresh devices to try a local network scan, or add a device manually.", 14, 0xFFB8C5D8.toInt()))
            return
        }
        devices.forEachIndexed { index, device ->
            val card = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(14), dp(12), dp(14), dp(12))
                setBackgroundColor(0xFF172235.toInt())
            }
            val titleRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
            titleRow.addView(text(device.name, 17, 0xFFFFFFFF.toInt(), true), LinearLayout.LayoutParams(0, -2, 1f))
            titleRow.addView(button("Edit") { showAddDialog(index) })
            card.addView(titleRow)
            card.addView(text("IP: ${device.ip.ifBlank { "Not detected" }}", 13, 0xFFB8C5D8.toInt()))
            card.addView(space(6))
            val pct = if (device.limitMb > 0) (device.usedMb * 100 / device.limitMb).coerceAtMost(100) else 0
            card.addView(text("Entered usage: ${formatMb(device.usedMb)} / ${formatMb(device.limitMb)}  •  $pct%", 13, if (pct >= 100) 0xFFFF8585.toInt() else 0xFFB8C5D8.toInt()))
            val progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
                max = 100
                progress = pct
            }
            card.addView(progress, LinearLayout.LayoutParams(-1, dp(8)))
            if (device.limitMb > 0 && device.usedMb >= device.limitMb) {
                card.addView(text("Reminder: entered usage reached the chosen limit. Internet is NOT automatically blocked.", 12, 0xFFFF8585.toInt()))
            }
            card.addView(space(8))
            card.addView(button("Remove device") {
                devices.removeAt(index)
                saveDevices()
                renderDevices()
            })
            list.addView(card)
            list.addView(space(10))
        }
    }

    private fun showAddDialog(editIndex: Int?) {
        val old = editIndex?.let { devices.getOrNull(it) }
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(8), dp(20), dp(4))
        }
        fun input(hint: String, value: String = "") = EditText(this).apply {
            this.hint = hint
            setSingleLine(true)
            setText(value)
        }
        val name = input("Device name (e.g. Redmi 10)", old?.name ?: "")
        val ip = input("IP address (optional)", old?.ip ?: "")
        val limit = input("Data limit in MB (e.g. 555)", old?.limitMb?.toString() ?: "555")
        val used = input("Usage in MB (enter manually)", old?.usedMb?.toString() ?: "0")
        box.addView(name); box.addView(ip); box.addView(limit); box.addView(used)
        AlertDialog.Builder(this)
            .setTitle(if (old == null) "Add device" else "Edit device")
            .setView(box)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Save") { _, _ ->
                val entry = DeviceEntry(
                    name.text.toString().trim().ifBlank { "Unnamed device" },
                    ip.text.toString().trim(),
                    limit.text.toString().toIntOrNull()?.coerceAtLeast(1) ?: 555,
                    used.text.toString().toIntOrNull()?.coerceAtLeast(0) ?: 0
                )
                if (editIndex == null) devices.add(entry) else if (editIndex in devices.indices) devices[editIndex] = entry
                saveDevices()
                renderDevices()
            }.show()
    }

    private fun discoverDevices() {
        val found = linkedMapOf<String, String>()
        try {
            java.io.File("/proc/net/arp").readLines().drop(1).forEach { line ->
                val parts = line.trim().split(Regex("\\s+"))
                if (parts.size >= 4 && parts[0].matches(Regex("\\d{1,3}(\\.\\d{1,3}){3}")) &&
                    parts[3] != "00:00:00:00:00:00") {
                    found[parts[0]] = parts[3]
                }
            }
        } catch (_: Exception) { }
        var added = 0
        found.keys.forEach { ip ->
            if (devices.none { it.ip == ip }) {
                devices.add(DeviceEntry("Detected device", ip, 555, 0))
                added++
            }
        }
        saveDevices()
        renderDevices()
        AlertDialog.Builder(this)
            .setTitle("Discovery result")
            .setMessage(if (found.isEmpty()) {
                "No devices were found in the local ARP table. Android may hide hotspot clients from ordinary apps. Check Hotspot settings to view connected devices."
            } else {
                "Found ${found.size} IP/MAC entries in the local ARP table; added $added new entries. This scan may miss connected devices and cannot identify phone models reliably."
            })
            .setPositiveButton("OK", null)
            .setNeutralButton("Open hotspot settings") { _, _ -> openHotspotSettings() }
            .show()
    }

    private fun openHotspotSettings() {
        val intents = listOf(
            Intent("android.settings.TETHER_SETTINGS"),
            Intent(Settings.ACTION_WIRELESS_SETTINGS),
            Intent(Settings.ACTION_SETTINGS)
        )
        for (intent in intents) {
            try { startActivity(intent); return } catch (_: Exception) { }
        }
    }

    private fun loadDevices() {
        try {
            val array = JSONArray(prefs.getString("devices", "[]"))
            for (i in 0 until array.length()) {
                val o = array.getJSONObject(i)
                devices.add(DeviceEntry(o.optString("name"), o.optString("ip"), o.optInt("limitMb", 555), o.optInt("usedMb", 0)))
            }
        } catch (_: Exception) { }
    }

    private fun saveDevices() {
        val array = JSONArray()
        devices.forEach {
            array.put(JSONObject().put("name", it.name).put("ip", it.ip).put("limitMb", it.limitMb).put("usedMb", it.usedMb))
        }
        prefs.edit().putString("devices", array.toString()).apply()
    }

    private fun formatMb(mb: Int): String = if (mb >= 1024) String.format("%.2f GB", mb / 1024.0) else "$mb MB"
    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
    private fun text(value: String, size: Int, color: Int, bold: Boolean = false) = TextView(this).apply {
        text = value
        textSize = size.toFloat()
        setTextColor(color)
        if (bold) typeface = Typeface.DEFAULT_BOLD
    }
    private fun button(label: String, action: () -> Unit) = Button(this).apply {
        text = label
        textSize = 12f
        setOnClickListener { action() }
    }
    private fun space(height: Int) = android.view.View(this).apply {
        layoutParams = LinearLayout.LayoutParams(1, dp(height))
    }
    private fun spaceWidth(width: Int) = android.view.View(this).apply {
        layoutParams = LinearLayout.LayoutParams(dp(width), 1)
    }
}
