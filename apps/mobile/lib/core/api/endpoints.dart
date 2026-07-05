/// Central place for API paths (all relative to the `/api/v1` base URL).
class Endpoints {
  const Endpoints._();

  // Auth
  static const login = '/auth/login';
  static const refresh = '/auth/refresh';
  static const logout = '/auth/logout';
  static const me = '/auth/me';

  // Tree
  static const tree = '/tree';

  // Persons
  static const persons = '/persons';
  static String person(String id) => '/persons/$id';
  static String personAncestors(String id) => '/persons/$id/ancestors';
  static String personDocuments(String id) => '/persons/$id/documents';

  // Change requests / contributions
  static const changeRequests = '/change-requests';
  static String changeRequestSubmit(String id) =>
      '/change-requests/$id/submit';
  static const reputationMe = '/reputation/me';

  // View requests (public)
  static const viewRequests = '/view-requests';

  // Notifications
  static const notifications = '/notifications';
  static String notificationRead(String id) => '/notifications/$id/read';
  static const notificationsReadAll = '/notifications/read-all';

  // Devices (M5 push)
  static const devices = '/devices';
  static String device(String token) => '/devices/$token';
}
