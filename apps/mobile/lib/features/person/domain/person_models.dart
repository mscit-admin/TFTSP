/// Person + document domain models — mirror `person.ts` / `document.ts`.
///
/// IMPORTANT: the Visibility Resolver (M3) OMITS blocked fields — they arrive
/// absent, not null. Every optional field must therefore be tolerated. The card
/// UI renders only the fields that are present.
library;

class Person {
  const Person({
    required this.id,
    required this.fullName,
    required this.gender,
    required this.isDeceased,
    this.firstName,
    this.fatherName,
    this.grandfatherName,
    this.familyName,
    this.laqab,
    this.birthDate,
    this.birthPlace,
    this.deathDate,
    this.deathPlace,
    this.fatherId,
    this.motherId,
    this.tribalUnitId,
    this.profession,
    this.photoUrl,
    this.biography,
    this.version,
  });

  final String id;
  final String fullName;

  /// 'male' | 'female'
  final String gender;
  final bool isDeceased;

  final String? firstName;
  final String? fatherName;
  final String? grandfatherName;
  final String? familyName;
  final String? laqab;
  final String? birthDate;
  final String? birthPlace;
  final String? deathDate;
  final String? deathPlace;
  final String? fatherId;
  final String? motherId;
  final String? tribalUnitId;
  final String? profession;

  /// Presigned URL for the profile photo, when present + visible.
  final String? photoUrl;
  final String? biography;
  final int? version;

  static String? _str(Object? v) => v is String ? v : null;

  factory Person.fromJson(Map<String, dynamic> json) => Person(
        id: json['id'] as String,
        fullName: json['fullName'] as String? ?? '',
        gender: json['gender'] as String? ?? 'male',
        isDeceased: json['isDeceased'] as bool? ?? false,
        firstName: _str(json['firstName']),
        fatherName: _str(json['fatherName']),
        grandfatherName: _str(json['grandfatherName']),
        familyName: _str(json['familyName']),
        laqab: _str(json['laqab']),
        birthDate: _str(json['birthDate']),
        birthPlace: _str(json['birthPlace']),
        deathDate: _str(json['deathDate']),
        deathPlace: _str(json['deathPlace']),
        fatherId: _str(json['fatherId']),
        motherId: _str(json['motherId']),
        tribalUnitId: _str(json['tribalUnitId']),
        profession: _str(json['profession']),
        // Backend may expose either a presigned URL or a raw key; prefer URL.
        photoUrl: _str(json['photoUrl']),
        biography: _str(json['biography']),
        version: json['version'] as int?,
      );
}

/// One document with a short-lived presigned download URL (`document.ts`).
class PersonDocument {
  const PersonDocument({
    required this.id,
    required this.kind,
    required this.filename,
    required this.downloadUrl,
    this.sizeBytes,
  });

  final String id;

  /// 'image' | 'pdf'
  final String kind;
  final String filename;
  final String downloadUrl;
  final int? sizeBytes;

  bool get isImage => kind == 'image';

  factory PersonDocument.fromJson(Map<String, dynamic> json) => PersonDocument(
        id: json['id'] as String,
        kind: json['kind'] as String? ?? 'image',
        filename: json['filename'] as String? ?? '',
        downloadUrl: json['downloadUrl'] as String? ?? '',
        sizeBytes: json['sizeBytes'] as int?,
      );
}

/// A single ancestor step on the lineage path to the root.
class LineageEntry {
  const LineageEntry({required this.id, required this.name});

  final String id;
  final String name;

  factory LineageEntry.fromJson(Map<String, dynamic> json) => LineageEntry(
        id: json['id'] as String,
        name: (json['fullName'] ?? json['name'] ?? '') as String,
      );
}
