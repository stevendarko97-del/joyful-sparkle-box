import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../core/constants/api_constants.dart';
import '../core/storage/token_storage.dart';

class SocketService extends ChangeNotifier {
  IO.Socket? _socket;
  bool _isConnected = false;
  final List<Map<String, dynamic>> _liveMessages = [];

  bool get isConnected => _isConnected;
  List<Map<String, dynamic>> get liveMessages => _liveMessages;

  Future<void> connectToRoom(String roomId) async {
    final token = await TokenStorage.getToken();
    
    _socket = IO.io(
      ApiConstants.socketUrl,
      IO.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .setPath('/socket.io')
          .setQuery({
            'room': roomId,
            'token': token ?? '',
          })
          .build(),
    );

    _socket?.onConnect((_) {
      _isConnected = true;
      notifyListeners();
    });

    _socket?.onDisconnect((_) {
      _isConnected = false;
      notifyListeners();
    });

    _socket?.on('chat-message', (data) {
      if (data is Map) {
        _liveMessages.add(Map<String, dynamic>.from(data));
        notifyListeners();
      }
    });

    _socket?.connect();
  }

  void sendChatMessage(String message, String senderName) {
    if (_socket != null && _isConnected) {
      final msgData = {
        'message': message,
        'sender': senderName,
        'time': DateTime.now().toIso8601String(),
      };
      _socket?.emit('chat-message', msgData);
      _liveMessages.add(msgData);
      notifyListeners();
    }
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _isConnected = false;
    _liveMessages.clear();
    notifyListeners();
  }
}
