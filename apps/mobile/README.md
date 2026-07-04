# apps/mobile — Members App (Flutter)

**Status: placeholder (M1).** Per the spec, this directory is created empty with only this README in M1
and is fully built in **M5**, after all APIs and policies are stable and tested from the web panels.

## Planned (M5)
- Flutter (latest stable), single codebase for Android (API 26+) and iOS (15+)
- State: Riverpod · Networking: dio + retrofit (client generated from the backend OpenAPI)
- Secure token storage: flutter_secure_storage · i18n: easy_localization (AR RTL / EN LTR)
- Push: firebase_messaging (FCM) · Offline read cache: drift/sqlite
- Family tree rendered with `CustomPainter` consuming the same flat `/tree` endpoint as the web

Do not implement mobile features before M5.
