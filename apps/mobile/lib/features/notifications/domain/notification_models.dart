/// Notification + device domain models — mirror `notification.ts` / `device.ts`.
library;

class AppNotification {
  const AppNotification({
    required this.id,
    required this.type,
    required this.payload,
    required this.createdAt,
    this.readAt,
  });

  final String id;
  final String type;
  final Map<String, dynamic> payload;
  final String createdAt;
  final String? readAt;

  bool get isUnread => readAt == null;

  factory AppNotification.fromJson(Map<String, dynamic> json) =>
      AppNotification(
        id: json['id'] as String,
        type: json['type'] as String? ?? '',
        payload: (json['payload'] as Map<String, dynamic>?) ?? const {},
        createdAt: json['createdAt'] as String? ?? '',
        readAt: json['readAt'] as String?,
      );

  /// easy_localization key describing the event.
  String get messageKey => switch (type) {
        'change_request_submitted' =>
          'notifications.typeChangeRequestSubmitted',
        'change_request_approved' => 'notifications.typeChangeRequestApproved',
        'change_request_rejected' => 'notifications.typeChangeRequestRejected',
        'change_request_changes_requested' =>
          'notifications.typeChangeRequestChangesRequested',
        'change_request_published' =>
          'notifications.typeChangeRequestPublished',
        'change_request_expiring' => 'notifications.typeChangeRequestExpiring',
        'change_request_expired' => 'notifications.typeChangeRequestExpired',
        'change_request_conflict' => 'notifications.typeChangeRequestConflict',
        'view_request_submitted' => 'notifications.typeViewRequestSubmitted',
        _ => 'notifications.title',
      };

  /// The change-request id this notification points at, if any (for tap-open).
  String? get changeRequestId => payload['changeRequestId'] as String?;
}

class NotificationListResponse {
  const NotificationListResponse({
    required this.data,
    required this.unread,
    required this.page,
    required this.total,
  });

  final List<AppNotification> data;
  final int unread;
  final int page;
  final int total;

  factory NotificationListResponse.fromJson(Map<String, dynamic> json) =>
      NotificationListResponse(
        data: (json['data'] as List<dynamic>? ?? const [])
            .map((e) => AppNotification.fromJson(e as Map<String, dynamic>))
            .toList(),
        unread: json['unread'] as int? ?? 0,
        page: json['page'] as int? ?? 1,
        total: json['total'] as int? ?? 0,
      );
}

/// `RegisterDeviceDto` (device.ts).
class RegisterDevice {
  const RegisterDevice({required this.token, required this.platform});

  final String token;

  /// 'android' | 'ios'
  final String platform;

  Map<String, dynamic> toJson() => {'token': token, 'platform': platform};
}
