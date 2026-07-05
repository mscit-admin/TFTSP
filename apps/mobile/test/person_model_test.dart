import 'package:flutter_test/flutter_test.dart';
import 'package:tftsp_mobile/features/person/domain/person_models.dart';

void main() {
  group('Person.fromJson (Visibility Resolver tolerance)', () {
    test('parses a minimal payload with only required fields present', () {
      // A heavily-restricted read: the resolver omitted every optional field.
      final person = Person.fromJson({
        'id': 'p1',
        'fullName': 'Ali',
        'gender': 'male',
        'isDeceased': false,
      });
      expect(person.id, 'p1');
      expect(person.fullName, 'Ali');
      // Blocked/absent fields must be null, never crash.
      expect(person.birthDate, isNull);
      expect(person.birthPlace, isNull);
      expect(person.profession, isNull);
      expect(person.photoUrl, isNull);
    });

    test('parses a full payload', () {
      final person = Person.fromJson({
        'id': 'p2',
        'fullName': 'Sara bint Omar',
        'gender': 'female',
        'isDeceased': true,
        'birthDate': '1900',
        'deathDate': '1975',
        'profession': 'Poet',
        'photoUrl': 'https://example/presigned.jpg',
      });
      expect(person.gender, 'female');
      expect(person.isDeceased, isTrue);
      expect(person.birthDate, '1900');
      expect(person.profession, 'Poet');
      expect(person.photoUrl, startsWith('https://'));
    });

    test('ignores unexpected extra fields without failing', () {
      final person = Person.fromJson({
        'id': 'p3',
        'fullName': 'X',
        'gender': 'male',
        'isDeceased': false,
        'someFutureField': 42,
      });
      expect(person.id, 'p3');
    });
  });

  group('PersonDocument.fromJson', () {
    test('maps kind and download url', () {
      final doc = PersonDocument.fromJson({
        'id': 'd1',
        'kind': 'image',
        'filename': 'scan.png',
        'downloadUrl': 'https://example/dl',
      });
      expect(doc.isImage, isTrue);
      expect(doc.downloadUrl, 'https://example/dl');
    });
  });
}
