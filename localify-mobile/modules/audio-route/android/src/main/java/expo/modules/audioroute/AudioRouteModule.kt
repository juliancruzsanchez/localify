package expo.modules.audioroute

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AudioRouteModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AudioRoute")

    Function("getCurrentOutputDeviceName") {
      getCurrentOutputDeviceName()
    }

    Function("getCurrentOutputDeviceType") {
      getCurrentOutputDeviceType()
    }

    Function("showRoutePicker") {
      showRoutePicker()
    }
  }

  private fun getAudioManager(): AudioManager? {
    val context = appContext.reactContext ?: return null
    return context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
  }

  private fun getCurrentOutputDevices(): List<AudioDeviceInfo> {
    val audioManager = getAudioManager() ?: return emptyList()
    return audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS).toList()
  }

  private fun getCurrentOutputDeviceName(): String {
    val devices = getCurrentOutputDevices()
    if (devices.isEmpty()) return "Speaker"
    val device = devices.first()
    val name = device.productName?.toString()
    return if (name.isNullOrBlank()) {
      when (device.type) {
        AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "Speaker"
        AudioDeviceInfo.TYPE_BUILTIN_EARPIECE -> "Earpiece"
        AudioDeviceInfo.TYPE_WIRED_HEADPHONES -> "Headphones"
        AudioDeviceInfo.TYPE_WIRED_HEADSET -> "Headset"
        AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
        AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> "Bluetooth"
        else -> "Audio Device"
      }
    } else {
      name
    }
  }

  private fun getCurrentOutputDeviceType(): String {
    val devices = getCurrentOutputDevices()
    if (devices.isEmpty()) return "speaker"
    return when (devices.first().type) {
      AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "speaker"
      AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
      AudioDeviceInfo.TYPE_WIRED_HEADSET -> "headphones"
      AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
      AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> "bluetooth"
      AudioDeviceInfo.TYPE_HDMI -> "hdmi"
      AudioDeviceInfo.TYPE_BUILTIN_EARPIECE -> "earpiece"
      AudioDeviceInfo.TYPE_LINE_ANALOG,
      AudioDeviceInfo.TYPE_LINE_DIGITAL -> "lineout"
      AudioDeviceInfo.TYPE_USB_ACCESSORY,
      AudioDeviceInfo.TYPE_USB_DEVICE,
      AudioDeviceInfo.TYPE_USB_HEADSET -> "usb"
      else -> "other"
    }
  }

  private fun showRoutePicker() {
    val context = appContext.reactContext ?: return
    val intent = android.content.Intent(android.provider.Settings.ACTION_BLUETOOTH_SETTINGS)
    intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
  }
}
