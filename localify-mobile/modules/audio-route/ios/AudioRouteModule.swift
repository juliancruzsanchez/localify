import ExpoModulesCore
import AVFoundation

public class AudioRouteModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AudioRoute")

    Function("getCurrentOutputDeviceName") { () -> String in
      let session = AVAudioSession.sharedInstance()
      let currentRoute = session.currentRoute
      guard let output = currentRoute.outputs.first else {
        return "Speaker"
      }
      return output.portName
    }

    Function("getCurrentOutputDeviceType") { () -> String in
      let session = AVAudioSession.sharedInstance()
      let currentRoute = session.currentRoute
      guard let output = currentRoute.outputs.first else {
        return "speaker"
      }
      switch output.portType {
      case .builtInSpeaker:  return "speaker"
      case .headphones:      return "headphones"
      case .bluetoothA2DP,
           .bluetoothHFP,
           .bluetoothLE:     return "bluetooth"
      case .airPlay:         return "airplay"
      case .HDMI:            return "hdmi"
      case .lineOut:         return "lineout"
      case .builtInReceiver: return "earpiece"
      case .usbAudio:        return "usb"
      default:               return "other"
      }
    }

    Function("showRoutePicker") {
      DispatchQueue.main.async {
        let pickerView = AVRoutePickerView()
        pickerView.isHidden = true
        guard let window = UIApplication.shared.connectedScenes
          .compactMap({ $0 as? UIWindowScene })
          .first?
          .windows
          .first
        else { return }
        window.addSubview(pickerView)
        if let button = pickerView.subviews.first(where: { $0 is UIButton }) as? UIButton {
          button.sendActions(for: .touchUpInside)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
          pickerView.removeFromSuperview()
        }
      }
    }
  }
}
